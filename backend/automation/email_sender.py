import os
import logging
import resend
import asyncio
from typing import Optional
from functools import partial

logger = logging.getLogger(__name__)

# Configure Resend
resend.api_key = os.getenv("RESEND_API_KEY", "")

# Brand constants
BRAND_NAME = "Keepsake Gifts"
SUPPORT_EMAIL = "orchidsplanner@gmail.com"


def _send_email_sync(params: dict) -> dict:
    """Synchronous wrapper for resend.Emails.send — run via executor."""
    return resend.Emails.send(params)


class EmailSender:
    """Handles email delivery for storybook orders - Keepsake Gifts branding"""
    
    @staticmethod
    async def send_personalization_link_email(
        to_email: str,
        customer_name: str,
        product_title: str,
        personalization_url: str,
        order_id: str = ""
    ) -> bool:
        """
        Send email with personalization form link after successful payment.
        This is the ONLY email sent after purchase.
        """
        try:
            api_key = os.getenv("RESEND_API_KEY", "")
            if not api_key:
                logger.warning("[EMAIL] RESEND_API_KEY not configured — skipping email")
                return False

            email_from = os.getenv("FROM_EMAIL")
            if not email_from:
                logger.warning("[EMAIL] FROM_EMAIL not configured — skipping email")
                return False

            # Refresh key in case env was loaded after module init
            resend.api_key = api_key

            html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complete your storybook personalization</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #f5f0ff 0%, #fff0f5 100%); line-height: 1.6;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 20px; box-shadow: 0 10px 40px rgba(107, 70, 193, 0.1); overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #9333ea 0%, #db2777 100%); padding: 40px 40px 50px 40px; text-align: center;">
                            <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">
                                {BRAND_NAME}
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 50px 40px;">
                            
                            <p style="margin: 0 0 25px 0; color: #4b5563; font-size: 16px; line-height: 1.7;">
                                Hi{f' {customer_name}' if customer_name else ''},
                            </p>
                            
                            <p style="margin: 0 0 25px 0; color: #4b5563; font-size: 16px; line-height: 1.7;">
                                Thank you for your order. Your keepsake storybook is almost ready — we just need a few details from you.
                            </p>
                            
                            <p style="margin: 0 0 25px 0; color: #4b5563; font-size: 16px; line-height: 1.7;">
                                Use the button below to complete your personalization. This secure link is unique to your order and can only be submitted once.
                            </p>
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 35px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{personalization_url}" 
                                           style="display: inline-block; background: linear-gradient(135deg, #9333ea 0%, #db2777 100%); color: white; text-decoration: none; padding: 18px 45px; border-radius: 50px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4);">
                                            Personalize My Storybook
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0 0 25px 0; color: #9ca3af; font-size: 14px; text-align: center;">
                                If the button does not work, use this link:<br>
                                <a href="{personalization_url}" style="color: #9333ea; word-break: break-all;">{personalization_url}</a>
                            </p>
                            
                            <p style="margin: 25px 0 0 0; color: #4b5563; font-size: 14px; line-height: 1.7; background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                                Please review your details carefully before submitting, because changes cannot be made after submission.
                            </p>
                            
                            <p style="margin: 25px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.7;">
                                If you need help, contact us at <a href="mailto:{SUPPORT_EMAIL}" style="color: #9333ea;">{SUPPORT_EMAIL}</a>.
                            </p>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #f9fafb; padding: 25px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                With love,
                            </p>
                            <p style="margin: 5px 0 0 0; color: #9333ea; font-size: 16px; font-weight: 600;">
                                {BRAND_NAME}
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

            text_content = f"""Hi{f' {customer_name}' if customer_name else ''},

Thank you for your order. Your keepsake storybook is almost ready — we just need a few details from you.

Use the link below to complete your personalization. This secure link is unique to your order and can only be submitted once.

Personalize My Storybook:
{personalization_url}

Please review your details carefully before submitting, because changes cannot be made after submission.

If you need help, contact us at {SUPPORT_EMAIL}.

With love,
{BRAND_NAME}
"""

            params = {
                "from": f"{BRAND_NAME} <{email_from}>",
                "to": [to_email],
                "subject": "Complete your storybook personalization",
                "html": html_content,
                "text": text_content,
            }

            # FIX: resend.Emails.send() is a BLOCKING/synchronous call.
            # Running it directly inside an async function blocks the event loop.
            # We offload it to a thread pool executor so FastAPI stays responsive.
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, partial(_send_email_sync, params))

            logger.info(f"[EMAIL SENT] Personalization link sent to {to_email}: id={result.get('id', result)}")
            return True

        except Exception as e:
            logger.error(f"[EMAIL ERROR] Failed to send personalization link to {to_email}: {str(e)}")
            return False

    @staticmethod
    async def send_storybook_delivery_email(
        to_email: str,
        customer_name: str,
        storybook_title: str,
        customer_view_url: str,
        password: Optional[str] = None,
        order_id: str = ""
    ) -> bool:
        """
        DEPRECATED: This email is no longer sent automatically.
        The storybook link is shown on the success page instead.
        Keeping this method for manual admin use if needed.
        """
        logger.info(f"Delivery email skipped for {to_email} - link shown on success page instead")
        return True  # Return True to not break existing flows
