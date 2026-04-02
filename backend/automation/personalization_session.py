"""
Personalization Session Manager
Handles creation, retrieval, and submission of personalization sessions.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Any, List
import logging
import os
import re

from automation.models import (
    PersonalizationSession, 
    TemplateSnapshot, 
    generate_session_token,
    FieldDefinition
)

logger = logging.getLogger(__name__)

# Session expiry in days
SESSION_EXPIRY_DAYS = int(os.getenv("SESSION_EXPIRY_DAYS", "30"))

# Built-in system field: optional password for storybook access
SYSTEM_PASSWORD_FIELD = {
    "field_key": "view_password",
    "label": "Password for your storybook link",
    "type": "password",
    "required": False,
    "placeholder": "Optional",
    "help_text": "Leave blank if you want the storybook link to open without a password.",
    "max_length": 50,
    "options": [],
    "validation_regex": None,
    "is_system_field": True
}


class PersonalizationSessionManager:
    """Manages personalization sessions for multi-field templates"""
    
    def __init__(self, db):
        self.db = db
    
    async def create_session(
        self,
        checkout_id: str,
        order_id: str,
        external_order_id: str,
        customer_email: str,
        customer_name: Optional[str],
        product_slug: str,
        template: Dict,
        requested_name: str = ""
    ) -> Dict:
        """
        Create a new personalization session for a paid order.
        
        Args:
            checkout_id: Polar checkout ID (from redirect URL)
            order_id: Polar order ID (from webhook)
            external_order_id: For idempotency
            customer_email: Customer's email
            customer_name: Customer's name
            product_slug: Product identifier
            template: Full template document
            requested_name: Legacy single-name value for backward compatibility
            
        Returns:
            Created session document
        """
        # Check for existing session (idempotency)
        existing = await self.db.personalization_sessions.find_one({
            "external_order_id": external_order_id
        })
        
        if existing:
            logger.info(f"Session already exists for order {external_order_id}")
            return {
                "session": existing,
                "is_existing": True
            }
        
        # Get field definitions and inject system password field
        field_definitions = list(template.get("field_definitions", []))
        
        # Inject built-in optional password field if not already present
        has_password_field = any(f.get("field_key") == "view_password" for f in field_definitions)
        if not has_password_field:
            field_definitions.append(SYSTEM_PASSWORD_FIELD)
        
        # Create template snapshot with injected fields
        snapshot = TemplateSnapshot(
            productSlug=template["productSlug"],
            basePdfPath=template["basePdfPath"],
            title=template["title"],
            fieldMappings=template.get("fieldMappings", []),
            field_definitions=field_definitions,
            spread_blocks=template.get("spread_blocks", []),
            pageCount=template.get("pageCount", 0),
            orientation=template.get("orientation", "landscape"),
            stylingDefaults=template.get("stylingDefaults")
        )
        
        # Calculate expiry
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
        
        # Create session
        session = PersonalizationSession(
            session_token=generate_session_token(),
            checkout_id=checkout_id,
            order_id=order_id,
            external_order_id=external_order_id,
            customer_email=customer_email,
            customer_name=customer_name or "",  # Handle None
            requested_name=requested_name or "",
            product_slug=product_slug,
            template_id=template["id"],
            template_snapshot=snapshot,
            status="ready",  # Ready for customer input
            expires_at=expires_at.isoformat()
        )
        
        # Insert into database
        session_dict = session.model_dump()
        await self.db.personalization_sessions.insert_one(session_dict)
        
        logger.info(f"Created personalization session: {session.session_token} for order {order_id}")
        
        return {
            "session": session_dict,
            "is_existing": False
        }
    
    async def get_session_by_checkout(self, checkout_id: str) -> Optional[Dict]:
        """
        Find session by Polar checkout ID.
        Falls back to order_id / external_order_id lookups for backward compat.
        """
        # Primary: look up by the stored checkout_id
        session = await self.db.personalization_sessions.find_one(
            {"checkout_id": checkout_id},
            {"_id": 0}
        )
        if session:
            return session
        
        # Fallback 1: some older sessions may have stored order_id where checkout_id is stored
        session = await self.db.personalization_sessions.find_one(
            {"order_id": checkout_id},
            {"_id": 0}
        )
        if session:
            logger.info(f"[CHECKOUT LOOKUP] Found session via order_id fallback for checkout_id={checkout_id}")
            return session
        
        # Fallback 2: external_order_id
        session = await self.db.personalization_sessions.find_one(
            {"external_order_id": checkout_id},
            {"_id": 0}
        )
        if session:
            logger.info(f"[CHECKOUT LOOKUP] Found session via external_order_id fallback for checkout_id={checkout_id}")
        return session
    
    async def get_session_by_token(self, token: str) -> Optional[Dict]:
        """Find session by session token"""
        session = await self.db.personalization_sessions.find_one(
            {"session_token": token},
            {"_id": 0}
        )
        
        if not session:
            return None
        
        # Check expiration
        if session.get("expires_at"):
            expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
            if datetime.now(timezone.utc) > expires_at:
                # Mark as expired
                await self.db.personalization_sessions.update_one(
                    {"session_token": token},
                    {"$set": {"status": "expired"}}
                )
                session["status"] = "expired"
        
        return session
    
    async def validate_and_submit(
        self,
        token: str,
        personalization_data: Dict[str, Any]
    ) -> Dict:
        """
        Validate and submit personalization data.
        
        Args:
            token: Session token
            personalization_data: Customer-submitted field values
            
        Returns:
            Result dict with success status and session/error info
        """
        session = await self.get_session_by_token(token)
        
        if not session:
            return {
                "success": False,
                "error": "Session not found",
                "error_code": "NOT_FOUND"
            }
        
        # Check if already submitted
        if session.get("submit_count", 0) >= 1:
            return {
                "success": False,
                "error": "This form has already been submitted",
                "error_code": "ALREADY_SUBMITTED"
            }
        
        # Check if locked
        if session.get("form_locked"):
            return {
                "success": False,
                "error": "This form is locked and cannot be modified",
                "error_code": "LOCKED"
            }
        
        # Check expiration
        if session.get("status") == "expired":
            return {
                "success": False,
                "error": "This session has expired",
                "error_code": "EXPIRED"
            }
        
        # Validate required fields
        field_definitions = session.get("template_snapshot", {}).get("field_definitions", [])
        validation_errors = []
        
        for field_def in field_definitions:
            field_key = field_def.get("field_key")
            is_required = field_def.get("required", False)
            field_type = field_def.get("type", "text")
            max_length = field_def.get("max_length")
            
            value = personalization_data.get(field_key)
            
            # Check required
            if is_required:
                if field_type == "image":
                    if not value or not value.get("url"):
                        validation_errors.append(f"{field_def.get('label', field_key)} is required")
                elif not value or (isinstance(value, str) and not value.strip()):
                    validation_errors.append(f"{field_def.get('label', field_key)} is required")
            
            # Check max length for text fields
            if value and isinstance(value, str) and max_length:
                if len(value) > max_length:
                    validation_errors.append(
                        f"{field_def.get('label', field_key)} must be {max_length} characters or less"
                    )
        
        if validation_errors:
            return {
                "success": False,
                "error": "Validation failed",
                "validation_errors": validation_errors,
                "error_code": "VALIDATION_ERROR"
            }
        
        # Update session with submitted data
        now = datetime.now(timezone.utc).isoformat()
        
        await self.db.personalization_sessions.update_one(
            {"session_token": token},
            {
                "$set": {
                    "personalization_data": personalization_data,
                    "status": "submitted",
                    "form_locked": True,
                    "submit_count": 1,
                    "submitted_at": now
                }
            }
        )
        
        logger.info(f"Personalization submitted for session {token}")
        
        # Get updated session
        updated_session = await self.get_session_by_token(token)
        
        return {
            "success": True,
            "session": updated_session,
            "message": "Personalization submitted successfully"
        }
    
    async def update_session_status(
        self,
        token: str,
        status: str,
        storybook_id: Optional[str] = None,
        storybook_slug: Optional[str] = None,
        customer_view_url: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        """Update session status after processing"""
        update_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if storybook_id:
            update_data["storybook_id"] = storybook_id
        if storybook_slug:
            update_data["storybook_slug"] = storybook_slug
        if customer_view_url:
            update_data["customer_view_url"] = customer_view_url
        if error_message:
            update_data["error_message"] = error_message
        if status == "completed":
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        await self.db.personalization_sessions.update_one(
            {"session_token": token},
            {"$set": update_data}
        )
    
    def apply_personalization_to_text(
        self,
        text_template: str,
        personalization_data: Dict[str, Any]
    ) -> str:
        """
        Replace placeholders in text template with personalization values.
        
        Placeholder format: [field_key]
        Example: "From [dad_name] to [son_name]" -> "From James to Ethan"
        """
        result = text_template
        
        # Find all placeholders [xxx]
        placeholders = re.findall(r'\[(\w+)\]', text_template)
        
        for placeholder in placeholders:
            value = personalization_data.get(placeholder, "")
            
            # Handle image fields (they have url property)
            if isinstance(value, dict):
                value = value.get("display_name", value.get("url", ""))
            
            result = result.replace(f"[{placeholder}]", str(value))
        
        return result
