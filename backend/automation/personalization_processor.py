"""
Personalization Processor
Handles the flipbook generation pipeline after personalization form submission.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Callable
import logging
import traceback
import os
import re

from automation.pdf_filler import PDFFiller
from automation.personalization_session import PersonalizationSessionManager

logger = logging.getLogger(__name__)


class PersonalizationProcessor:
    """Processes submitted personalization sessions into flipbooks"""
    
    def __init__(self, db, templates_dir: Path, personalized_dir: Path):
        self.db = db
        self.templates_dir = templates_dir
        self.personalized_dir = personalized_dir
        self.pdf_filler = PDFFiller()
        self.session_manager = PersonalizationSessionManager(db)
    
    async def process_session(
        self,
        session_token: str,
        convert_to_flipbook_func: Callable
    ) -> Dict:
        """
        Process a submitted personalization session into a flipbook.
        
        Args:
            session_token: The session token to process
            convert_to_flipbook_func: Function to convert PDF to flipbook
            
        Returns:
            Updated session dict
        """
        try:
            # Get session
            session = await self.session_manager.get_session_by_token(session_token)
            
            if not session:
                raise Exception(f"Session {session_token} not found")
            
            if session.get("status") != "submitted":
                raise Exception(f"Session status is '{session.get('status')}', expected 'submitted'")
            
            # Update status to processing
            await self.session_manager.update_session_status(
                session_token, 
                "processing"
            )
            
            logger.info(f"Processing personalization session: {session_token}")
            
            # Get template snapshot and personalization data
            snapshot = session.get("template_snapshot", {})
            personalization_data = session.get("personalization_data", {})
            
            # Step 1: Fill PDF with personalization data
            personalized_pdf_path = await self._fill_pdf(
                session,
                snapshot,
                personalization_data
            )
            
            # Step 2: Generate flipbook
            flipbook_data = await self._generate_flipbook(
                session,
                personalized_pdf_path,
                convert_to_flipbook_func
            )
            
            # Step 3: Update session with completion data
            await self.session_manager.update_session_status(
                session_token,
                "completed",
                storybook_id=flipbook_data["storybookId"],
                storybook_slug=flipbook_data["slug"],
                customer_view_url=flipbook_data["customerViewUrl"]
            )
            
            # Step 4: Send delivery email
            await self._send_delivery_email(session, flipbook_data)
            
            # Step 5: Cleanup personalized PDF
            await self._cleanup_pdf(personalized_pdf_path)
            
            logger.info(f"Session {session_token} processed successfully")
            
            # Return updated session
            return await self.session_manager.get_session_by_token(session_token)
            
        except Exception as e:
            error_msg = str(e)
            error_details = traceback.format_exc()
            logger.error(f"Session processing failed: {error_msg}\n{error_details}")
            
            # Update session with error
            await self.session_manager.update_session_status(
                session_token,
                "failed",
                error_message=error_msg
            )
            
            raise
    
    async def _fill_pdf(
        self,
        session: Dict,
        snapshot: Dict,
        personalization_data: Dict
    ) -> str:
        """Fill PDF fields using personalization data and spread_blocks"""
        
        template_pdf_path = snapshot.get("basePdfPath")
        field_mappings = snapshot.get("fieldMappings", [])
        spread_blocks = snapshot.get("spread_blocks", [])
        
        # Build customer_data compatible with existing PDFFiller
        # Map personalization_data to the format expected by the filler
        customer_data = {
            "requestedName": session.get("requested_name", ""),
            "buyerFullName": session.get("customer_name", ""),
            "customerEmail": session.get("customer_email", ""),
        }
        
        # If we have spread_blocks, we need to build the replacement values
        # by applying personalization_data to text_templates
        if spread_blocks:
            # Create a mapping for each block's resolved text
            for block in spread_blocks:
                if block.get("type") == "text" and block.get("text_template"):
                    resolved_text = self._apply_placeholders(
                        block["text_template"],
                        personalization_data
                    )
                    # The block_id can be used as a field mapping target
                    customer_data[block["block_id"]] = resolved_text
        
        # Also add raw personalization_data fields for direct field mappings
        for key, value in personalization_data.items():
            if isinstance(value, str):
                customer_data[key] = value
            elif isinstance(value, dict) and "url" in value:
                # Image field - store URL
                customer_data[key] = value.get("url", "")
        
        # Output path
        output_path = self.personalized_dir / f"{session['id']}.pdf"
        
        # Fill the PDF
        await self.pdf_filler.fill_pdf_fields(
            template_path=template_pdf_path,
            field_mappings=field_mappings,
            customer_data=customer_data,
            output_path=str(output_path)
        )
        
        logger.info(f"PDF filled for session {session['session_token']}: {output_path}")
        
        return str(output_path)
    
    def _apply_placeholders(self, text_template: str, personalization_data: Dict) -> str:
        """Replace [field_key] placeholders with actual values"""
        result = text_template
        
        placeholders = re.findall(r'\[(\w+)\]', text_template)
        
        for placeholder in placeholders:
            value = personalization_data.get(placeholder, "")
            
            # Handle image fields
            if isinstance(value, dict):
                value = value.get("display_name", "")
            
            result = result.replace(f"[{placeholder}]", str(value))
        
        return result
    
    async def _generate_flipbook(
        self,
        session: Dict,
        pdf_path: str,
        convert_func: Callable
    ) -> Dict:
        """Generate flipbook from personalized PDF"""
        
        snapshot = session.get("template_snapshot", {})
        personalization_data = session.get("personalization_data", {})
        
        # Build title using personalization data
        template_title = snapshot.get("title", "Storybook")
        
        # Try to get a name field for the title
        name_for_title = ""
        for field_key in ["child_name", "son_name", "daughter_name", "baby_name", "name", "requested_name"]:
            if field_key in personalization_data:
                val = personalization_data[field_key]
                if isinstance(val, str) and val.strip():
                    name_for_title = val.strip()
                    break
        
        # Fallback to legacy requested_name
        if not name_for_title:
            name_for_title = session.get("requested_name", "Friend")
        
        storybook_title = f"{name_for_title}'s {template_title}"
        
        # Get password if in personalization data
        password = personalization_data.get("password")
        
        # Get styling defaults
        styling_defaults = snapshot.get("stylingDefaults")
        
        # Convert to flipbook
        flipbook_data = await convert_func(
            pdf_path=pdf_path,
            title=storybook_title,
            customer_name=name_for_title,
            password=password,
            styling_defaults=styling_defaults
        )
        
        logger.info(f"Flipbook generated for session {session['session_token']}: {flipbook_data['storybookId']}")
        
        return flipbook_data
    
    async def _send_delivery_email(self, session: Dict, flipbook_data: Dict):
        """Send delivery email to customer"""
        try:
            from automation.email_sender import EmailSender
            
            customer_email = session.get("customer_email")
            if not customer_email:
                logger.warning(f"No email for session {session['session_token']}")
                return
            
            customer_name = session.get("customer_name", "Friend")
            personalization_data = session.get("personalization_data", {})
            
            # Try to get name from personalization data
            for field_key in ["child_name", "son_name", "daughter_name", "baby_name", "name"]:
                if field_key in personalization_data:
                    val = personalization_data[field_key]
                    if isinstance(val, str) and val.strip():
                        customer_name = val.strip()
                        break
            
            # Get storybook title
            storybook = await self.db.storybooks.find_one(
                {"id": flipbook_data["storybookId"]},
                {"title": 1}
            )
            storybook_title = storybook.get("title") if storybook else f"{customer_name}'s Storybook"
            
            # Build full URL
            base_url = os.getenv("APP_BASE_URL", "http://localhost:3000").rstrip('/')
            full_view_url = f"{base_url}{flipbook_data['customerViewUrl']}"
            
            # Get password from personalization data
            password = personalization_data.get("password")
            
            email_sent = await EmailSender.send_storybook_delivery_email(
                to_email=customer_email,
                customer_name=customer_name,
                storybook_title=storybook_title,
                customer_view_url=full_view_url,
                password=password,
                order_id=session.get("order_id", "")
            )
            
            logger.info(f"Delivery email {'sent' if email_sent else 'FAILED'} for session {session['session_token']}")
            
        except Exception as e:
            logger.error(f"Email delivery failed for session {session['session_token']}: {str(e)}")
    
    async def _cleanup_pdf(self, pdf_path: str):
        """Delete personalized PDF to save storage"""
        try:
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
                logger.info(f"Cleaned up personalized PDF: {pdf_path}")
        except Exception as e:
            logger.warning(f"Could not delete PDF {pdf_path}: {str(e)}")
