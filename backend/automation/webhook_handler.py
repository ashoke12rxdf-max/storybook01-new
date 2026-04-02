from datetime import datetime, timezone
from typing import Dict, Optional
import logging
import uuid
import hmac
import hashlib
import base64

from automation.personalization_session import PersonalizationSessionManager

logger = logging.getLogger(__name__)

class WebhookHandler:
    """Handles webhook events with idempotency protection"""
    
    def __init__(self, db):
        self.db = db
        self.session_manager = PersonalizationSessionManager(db)
    
    async def check_template_requires_personalization(self, product_slug: str) -> tuple:
        """
        Check if the template for this product requires personalization.
        
        Returns:
            (requires_personalization: bool, template: dict or None)
        """
        template = await self.db.templates.find_one({
            "productSlug": product_slug,
            "status": "active"
        }, {"_id": 0})
        
        if not template:
            return False, None
        
        # Check if field_definitions exists and has items
        field_definitions = template.get("field_definitions", [])
        requires_personalization = len(field_definitions) > 0
        
        return requires_personalization, template
    
    async def handle_webhook_with_personalization(
        self, 
        webhook_data: Dict, 
        is_simulated: bool = False
    ) -> Dict:
        """
        Handle webhook with conditional personalization flow.
        
        If template has field_definitions -> create personalization session
        If no field_definitions -> use existing auto-generation flow
        
        Returns:
            Result dict with flow type and relevant data
        """
        try:
            product_slug = webhook_data.get("productSlug")
            if not product_slug:
                raise ValueError("productSlug is required")
            
            # Check if template requires personalization
            requires_personalization, template = await self.check_template_requires_personalization(product_slug)
            
            if requires_personalization and template:
                # NEW FLOW: Create personalization session
                return await self._handle_personalization_flow(webhook_data, template, is_simulated)
            else:
                # LEGACY FLOW: Auto-generate immediately
                return await self.handle_webhook(webhook_data, is_simulated)
                
        except Exception as e:
            logger.error(f"Webhook handling failed: {str(e)}")
            raise
    
    async def _handle_personalization_flow(
        self, 
        webhook_data: Dict, 
        template: Dict,
        is_simulated: bool
    ) -> Dict:
        """Handle webhook by creating a personalization session"""
        
        external_order_id = webhook_data.get("orderId") or webhook_data.get("externalOrderId")
        checkout_id = webhook_data.get("checkoutId") or external_order_id  # Use order_id as fallback
        
        # Check for existing session (idempotency)
        existing_session = await self.db.personalization_sessions.find_one({
            "external_order_id": external_order_id
        })
        
        if existing_session:
            logger.info(f"Session already exists for order {external_order_id}")
            return {
                "received": True,
                "flow": "personalization",
                "sessionToken": existing_session["session_token"],
                "status": existing_session["status"],
                "message": "Personalization session already exists (idempotent)",
                "isExisting": True,
                "requiresPersonalization": True
            }
        
        # Create personalization session
        result = await self.session_manager.create_session(
            checkout_id=checkout_id,
            order_id=external_order_id,
            external_order_id=external_order_id,
            customer_email=webhook_data.get("customerEmail", ""),
            customer_name=webhook_data.get("buyerFullName", ""),
            product_slug=webhook_data.get("productSlug"),
            template=template,
            requested_name=webhook_data.get("requestedName", "")
        )
        
        session = result["session"]
        
        logger.info(f"Created personalization session {session['session_token']} for order {external_order_id}")
        
        return {
            "received": True,
            "flow": "personalization",
            "sessionToken": session["session_token"],
            "sessionId": session["id"],
            "status": "ready",
            "message": "Personalization session created - customer must complete form",
            "isExisting": False,
            "requiresPersonalization": True,
            "personalizationUrl": f"/personalize/{session['session_token']}"
        }
    
    async def handle_webhook(self, webhook_data: Dict, is_simulated: bool = False) -> Dict:
        """
        Handle incoming webhook with idempotency protection.
        
        Args:
            webhook_data: The webhook payload
            is_simulated: Whether this is a simulated webhook
            
        Returns:
            Order creation result
        """
        try:
            # Extract data
            external_order_id = webhook_data.get("orderId") or webhook_data.get("externalOrderId")
            webhook_event_id = webhook_data.get("eventId", external_order_id)
            
            if not external_order_id:
                raise ValueError("Missing orderId in webhook data")
            
            # Idempotency check
            existing_order = await self.db.automation_orders.find_one({
                "externalOrderId": external_order_id
            })
            
            if existing_order:
                logger.info(f"Order {external_order_id} already exists (idempotent)")
                return {
                    "received": True,
                    "orderId": existing_order["id"],
                    "status": existing_order["status"],
                    "message": "Order already processed (idempotent)",
                    "isExisting": True
                }
            
            # Create new order
            order = await self._create_order(webhook_data, is_simulated)
            
            logger.info(f"New order created: {order['id']} (external: {external_order_id})")
            
            return {
                "received": True,
                "orderId": order["id"],
                "status": "received",
                "message": "Webhook received and order created",
                "isExisting": False
            }
            
        except Exception as e:
            logger.error(f"Webhook handling failed: {str(e)}")
            raise
    
    async def _create_order(self, webhook_data: Dict, is_simulated: bool) -> Dict:
        """Create a new automation order from webhook data"""
        
        # Generate order ID
        order_id = str(uuid.uuid4())
        
        # Extract external order ID
        external_order_id = webhook_data.get("orderId") or webhook_data.get("externalOrderId")
        
        # Extract customer data
        customer_data = {
            "requestedName": webhook_data.get("requestedName") or webhook_data.get("customerName"),
            "buyerFullName": webhook_data.get("buyerFullName") or webhook_data.get("requestedName"),
            "customerEmail": webhook_data.get("customerEmail") or webhook_data.get("email", ""),
            "password": webhook_data.get("password"),
            "customFields": webhook_data.get("customFields", {})
        }
        
        # Validate required fields
        if not customer_data["requestedName"]:
            raise ValueError("requestedName is required")
        if not customer_data["customerEmail"]:
            raise ValueError("customerEmail is required")
        
        # Extract product slug
        product_slug = webhook_data.get("productSlug")
        if not product_slug:
            raise ValueError("productSlug is required")
        
        # Extract payment data (optional)
        payment_data = webhook_data.get("paymentData", {})
        if not payment_data and not is_simulated:
            # Try to extract from top level
            payment_data = {
                "amount": webhook_data.get("amount"),
                "currency": webhook_data.get("currency"),
                "paymentMethod": webhook_data.get("paymentMethod"),
                "transactionId": webhook_data.get("transactionId")
            }
        
        # Create order document
        order = {
            "id": order_id,
            "externalOrderId": external_order_id,
            "webhookEventId": webhook_data.get("eventId", external_order_id),
            "isSimulatedWebhook": is_simulated,
            "customerData": customer_data,
            "productSlug": product_slug,
            "templateId": None,
            "templateTitle": None,
            "templateSnapshot": None,
            "paymentData": payment_data if payment_data else None,
            "status": "received",
            "generationLocked": False,
            "lockedAt": None,
            "finalizedAt": None,
            "personalizedPdfPath": None,
            "personalizedPdfUrl": None,
            "storybookId": None,
            "storybookSlug": None,
            "customerViewUrl": None,
            "processingLog": [
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": "received",
                    "message": f"Webhook received ({'simulated' if is_simulated else 'real'})"
                }
            ],
            "errorMessage": None,
            "errorDetails": None,
            "retryCount": 0,
            "lastRetryAt": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
            "completedAt": None
        }
        
        # Insert into database
        await self.db.automation_orders.insert_one(order)
        
        return order
    
    async def verify_polar_signature(
        self,
        raw_body: bytes,
        webhook_id: str,
        timestamp: str,
        signature: str,
        webhook_secret: str
    ) -> bool:
        """
        Verify Polar webhook signature.
        
        Polar uses a format: webhook-id.webhook-timestamp.raw_body
        Then signs with HMAC-SHA256 and base64 encodes
        
        Args:
            raw_body: The raw request body bytes
            webhook_id: The webhook-id header value
            timestamp: The webhook-timestamp header value
            signature: The webhook-signature header value
            webhook_secret: The webhook secret from environment
            
        Returns:
            True if signature is valid
        """
        try:
            # Polar signature format: v1,<base64_signature>
            # The secret is base64 encoded, so we need to decode it first
            
            # Build the signed payload: id.timestamp.body
            signed_payload = f"{webhook_id}.{timestamp}.{raw_body.decode('utf-8')}"
            
            # Decode the secret (Polar secrets are base64 encoded after 'polar_whs_' prefix)
            # Actually, let's try with the raw secret first
            secret_bytes = webhook_secret.encode('utf-8')
            
            # Compute HMAC-SHA256
            expected_sig = hmac.new(
                secret_bytes,
                signed_payload.encode('utf-8'),
                hashlib.sha256
            ).digest()
            
            # Base64 encode
            expected_b64 = base64.standard_b64encode(expected_sig).decode('utf-8')
            
            # Parse the provided signature (format: v1,<sig>)
            provided_sigs = []
            for part in signature.split(' '):
                if part.startswith('v1,'):
                    provided_sigs.append(part[3:])
            
            # Compare
            for sig in provided_sigs:
                if hmac.compare_digest(expected_b64, sig):
                    return True
            
            # If direct comparison fails, try alternate methods
            logger.warning(f"Polar signature mismatch. Expected: {expected_b64[:20]}..., Got: {provided_sigs}")
            return False
            
        except Exception as e:
            logger.error(f"Polar signature verification error: {str(e)}")
            return False
    
    def parse_polar_webhook(self, webhook_data: Dict) -> Dict:
        """
        Parse Polar webhook payload and extract relevant fields.
        
        Polar order.paid event structure:
        {
            "type": "order.paid",
            "data": {
                "id": "order_id",
                "metadata": {
                    "product_slug": "..."
                },
                "custom_field_data": {
                    "requested_name": "...",
                    "password": "..."
                },
                "customer": {
                    "email": "...",
                    "name": "..."
                },
                ...
            }
        }
        """
        event_type = webhook_data.get("type", "")
        data = webhook_data.get("data", {})
        
        # Extract order ID
        order_id = data.get("id") or webhook_data.get("id")
        
        # Extract product slug from metadata
        metadata = data.get("metadata", {})
        product_slug = metadata.get("product_slug") or metadata.get("productSlug")
        
        # Extract custom field data
        custom_fields = data.get("custom_field_data", {})
        requested_name = (
            custom_fields.get("requested_name") or 
            custom_fields.get("requestedName") or
            custom_fields.get("Requested Name") or
            custom_fields.get("child_name") or
            custom_fields.get("name")
        )
        password = (
            custom_fields.get("password") or 
            custom_fields.get("Password")
        )
        
        # Extract customer info
        customer = data.get("customer", {})
        customer_email = customer.get("email", "")
        customer_name = customer.get("name", "")
        
        # Extract payment data
        payment_data = {
            "amount": data.get("amount"),
            "currency": data.get("currency"),
            "transactionId": order_id,
            "paymentStatus": "paid",
            "paymentProvider": "polar"
        }
        
        return {
            "eventType": event_type,
            "orderId": order_id,
            "externalOrderId": order_id,
            "eventId": webhook_data.get("event_id") or order_id,
            "productSlug": product_slug,
            "requestedName": requested_name,
            "buyerFullName": customer_name,
            "customerEmail": customer_email,
            "password": password,
            "customFields": custom_fields,
            "paymentData": payment_data,
            "rawData": webhook_data
        }
