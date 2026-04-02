from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional
import logging
import traceback
import uuid

from automation.pdf_filler import PDFFiller

logger = logging.getLogger(__name__)

class OrderProcessor:
    """Orchestrates the complete order processing pipeline"""
    
    def __init__(self, db, templates_dir: Path, personalized_dir: Path):
        self.db = db
        self.templates_dir = templates_dir
        self.personalized_dir = personalized_dir
        self.pdf_filler = PDFFiller()
    
    async def add_log(self, order_id: str, status: str, message: str):
        """Add a log entry to order processing log"""
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "message": message
        }
        
        await self.db.automation_orders.update_one(
            {"id": order_id},
            {
                "$push": {"processingLog": log_entry},
                "$set": {"updatedAt": datetime.now(timezone.utc).isoformat()}
            }
        )
        logger.info(f"Order {order_id}: {message}")
    
    async def process_order(self, order_id: str, convert_to_flipbook_func) -> Dict:
        """
        Process a complete order from template selection to flipbook generation.
        
        Args:
            order_id: The order ID to process
            convert_to_flipbook_func: Function to convert PDF to flipbook (from server.py)
            
        Returns:
            Updated order dict
        """
        try:
            # Get order
            order = await self.db.automation_orders.find_one({"id": order_id})
            if not order:
                raise Exception(f"Order {order_id} not found")
            
            await self.add_log(order_id, "processing", "Starting order processing")
            
            # Step 1: Select Template
            await self.add_log(order_id, "processing", "Selecting template...")
            template = await self._select_template(order)
            
            if not template:
                await self._mark_failed(
                    order_id,
                    f"No active template found for product '{order['productSlug']}'"
                )
                return await self.db.automation_orders.find_one({"id": order_id}, {"_id": 0})
            
            # Step 2: Snapshot Template
            await self.add_log(order_id, "verified", f"Template selected: {template['title']}")
            await self._snapshot_template(order_id, template)
            
            # Step 3: Lock Order
            await self.add_log(order_id, "processing", "Locking order for generation...")
            await self._lock_order(order_id)
            
            # Step 4: Personalize PDF
            await self.add_log(order_id, "processing", "Personalizing PDF...")
            personalized_pdf_path = await self._personalize_pdf(order_id)
            
            # Step 5: Generate Flipbook
            await self.add_log(order_id, "processing", "Generating flipbook...")
            flipbook_data = await self._generate_flipbook(
                order_id,
                personalized_pdf_path,
                convert_to_flipbook_func
            )
            
            # Step 6: Finalize Order
            await self.add_log(order_id, "completed", "Order processing completed successfully")
            await self._finalize_order(order_id, flipbook_data)
            
            # Return completed order
            return await self.db.automation_orders.find_one({"id": order_id}, {"_id": 0})
            
        except Exception as e:
            error_msg = str(e)
            error_details = traceback.format_exc()
            logger.error(f"Order processing failed: {error_msg}\n{error_details}")
            
            await self._mark_failed(order_id, error_msg, error_details)
            raise
    
    async def _select_template(self, order: Dict) -> Optional[Dict]:
        """Select active template for the product"""
        product_slug = order["productSlug"]
        
        template = await self.db.templates.find_one({
            "productSlug": product_slug,
            "status": "active"
        }, {"_id": 0})
        
        return template
    
    async def _snapshot_template(self, order_id: str, template: Dict):
        """Snapshot template data into order"""
        snapshot = {
            "productSlug": template["productSlug"],
            "basePdfPath": template["basePdfPath"],
            "title": template["title"],
            "fieldMappings": template.get("fieldMappings", []),
            "pageCount": template["pageCount"],
            "orientation": template["orientation"],
            "stylingDefaults": template.get("stylingDefaults")
        }
        
        await self.db.automation_orders.update_one(
            {"id": order_id},
            {
                "$set": {
                    "templateId": template["id"],
                    "templateTitle": template["title"],
                    "templateSnapshot": snapshot,
                    "status": "verified",
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    async def _lock_order(self, order_id: str):
        """Lock order to prevent duplicate generation"""
        order = await self.db.automation_orders.find_one({"id": order_id})
        
        if order.get("generationLocked"):
            raise Exception("Order is already locked")
        
        await self.db.automation_orders.update_one(
            {"id": order_id},
            {
                "$set": {
                    "generationLocked": True,
                    "lockedAt": datetime.now(timezone.utc).isoformat(),
                    "status": "processing",
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    async def _personalize_pdf(self, order_id: str) -> str:
        """Fill PDF fields with customer data"""
        order = await self.db.automation_orders.find_one({"id": order_id})
        
        # Get template snapshot
        snapshot = order["templateSnapshot"]
        template_pdf_path = snapshot["basePdfPath"]
        field_mappings = snapshot["fieldMappings"]
        
        # Get customer data
        customer_data = order["customerData"]
        
        # Output path for personalized PDF
        output_path = self.personalized_dir / f"{order_id}.pdf"
        
        # Fill the PDF
        await self.pdf_filler.fill_pdf_fields(
            template_path=template_pdf_path,
            field_mappings=field_mappings,
            customer_data=customer_data,
            output_path=str(output_path)
        )
        
        # Update order with personalized PDF info
        await self.db.automation_orders.update_one(
            {"id": order_id},
            {
                "$set": {
                    "personalizedPdfPath": str(output_path),
                    "personalizedPdfUrl": f"/api/personalized/{order_id}.pdf",
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        return str(output_path)
    
    async def _generate_flipbook(
        self,
        order_id: str,
        pdf_path: str,
        convert_func
    ) -> Dict:
        """Generate flipbook from personalized PDF"""
        order = await self.db.automation_orders.find_one({"id": order_id})
        
        # Get title for storybook
        requested_name = order["customerData"]["requestedName"]
        template_title = order["templateSnapshot"]["title"]
        storybook_title = f"{requested_name}'s {template_title}"
        
        # Get password if provided
        password = order["customerData"].get("password")
        
        # Get styling defaults from template snapshot
        styling_defaults = order["templateSnapshot"].get("stylingDefaults")
        
        # Call the conversion function (internal reuse of existing system)
        flipbook_data = await convert_func(
            pdf_path=pdf_path,
            title=storybook_title,
            customer_name=requested_name,
            password=password,
            styling_defaults=styling_defaults
        )
        
        return flipbook_data
    
    async def _finalize_order(self, order_id: str, flipbook_data: Dict):
        """Mark order as completed with flipbook data"""
        await self.db.automation_orders.update_one(
            {"id": order_id},
            {
                "$set": {
                    "status": "completed",
                    "storybookId": flipbook_data["storybookId"],
                    "storybookSlug": flipbook_data["slug"],
                    "customerViewUrl": flipbook_data["customerViewUrl"],
                    "finalizedAt": datetime.now(timezone.utc).isoformat(),
                    "completedAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Send delivery email
        try:
            from automation.email_sender import EmailSender
            
            order = await self.db.automation_orders.find_one({"id": order_id})
            customer_email = (
                order["customerData"].get("customerEmail") or
                order["customerData"].get("buyerEmail") or
                order["customerData"].get("email")
            )
            
            if not customer_email:
                logger.warning(f"No customer email found for order {order_id} — skipping email")
                return
            
            customer_name = order["customerData"].get("requestedName", "Friend")
            password = order["customerData"].get("password")
            
            # Get the storybook title from the storybook record
            storybook = await self.db.storybooks.find_one(
                {"id": flipbook_data["storybookId"]},
                {"title": 1}
            )
            storybook_title = storybook["title"] if storybook else f"{customer_name}'s Storybook"
            
            # Get base URL from environment
            import os
            base_url = os.getenv("APP_BASE_URL", "http://localhost:3000")
            base_url = base_url.rstrip('/')
            full_view_url = f"{base_url}{flipbook_data['customerViewUrl']}"
            
            email_sent = await EmailSender.send_storybook_delivery_email(
                to_email=customer_email,
                customer_name=customer_name,
                storybook_title=storybook_title,
                customer_view_url=full_view_url,
                password=password,
                order_id=order_id
            )
            
            # Update order with email status
            await self.db.automation_orders.update_one(
                {"id": order_id},
                {
                    "$set": {
                        "emailSent": email_sent,
                        "emailSentAt": datetime.now(timezone.utc).isoformat() if email_sent else None
                    }
                }
            )
            
            await self.add_log(
                order_id,
                "completed",
                f"Delivery email {'sent successfully' if email_sent else 'FAILED to send'} to {customer_email}"
            )
            
        except Exception as e:
            logger.error(f"Email delivery failed for order {order_id}: {str(e)}")
            await self.add_log(order_id, "warning", f"Email delivery failed: {str(e)}")
            # Do NOT fail the order if email fails — order is still completed
        
        # Cleanup: Delete the personalized PDF to save storage
        try:
            import os as _os
            order = await self.db.automation_orders.find_one({"id": order_id})
            pdf_path = order.get("personalizedPdfPath")
            if pdf_path and _os.path.exists(pdf_path) and pdf_path != "deleted_after_use":
                _os.remove(pdf_path)
                await self.db.automation_orders.update_one(
                    {"id": order_id},
                    {"$set": {"personalizedPdfPath": "deleted_after_use"}}
                )
                logger.info(f"Deleted personalized PDF to save storage: {pdf_path}")
        except Exception as e:
            logger.warning(f"Could not delete personalized PDF for order {order_id}: {str(e)}")
    
    async def _mark_failed(
        self,
        order_id: str,
        error_message: str,
        error_details: Optional[str] = None
    ):
        """Mark order as failed with error info"""
        update_data = {
            "status": "failed",
            "errorMessage": error_message,
            "generationLocked": False,  # Unlock for retry
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        
        if error_details:
            update_data["errorDetails"] = error_details
        
        await self.db.automation_orders.update_one(
            {"id": order_id},
            {"$set": update_data}
        )
        
        await self.add_log(order_id, "failed", f"Processing failed: {error_message}")
    
    async def retry_order(self, order_id: str, convert_to_flipbook_func) -> Dict:
        """Retry a failed order"""
        order = await self.db.automation_orders.find_one({"id": order_id})
        
        if not order:
            raise Exception(f"Order {order_id} not found")
        
        # Validation: Can only retry failed orders without finalization
        if order["status"] != "failed":
            raise Exception(f"Cannot retry order with status '{order['status']}'. Only 'failed' orders can be retried.")
        
        if order.get("finalizedAt"):
            raise Exception("Cannot retry finalized order")
        
        # Reset order state for retry
        await self.db.automation_orders.update_one(
            {"id": order_id},
            {
                "$set": {
                    "status": "received",
                    "generationLocked": False,
                    "errorMessage": None,
                    "errorDetails": None,
                    "lastRetryAt": datetime.now(timezone.utc).isoformat(),
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                },
                "$inc": {"retryCount": 1}
            }
        )
        
        await self.add_log(order_id, "retry", f"Retry attempt #{order.get('retryCount', 0) + 1}")
        
        # Process the order again
        return await self.process_order(order_id, convert_to_flipbook_func)
