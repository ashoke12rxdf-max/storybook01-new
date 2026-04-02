import os
import logging
import resend
from typing import Optional

logger = logging.getLogger(__name__)

# Configure Resend
resend.api_key = os.getenv("RESEND_API_KEY", "")

class EmailSender:
    """Handles email delivery for storybook orders"""
    
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
        Send a branded delivery email to customer with their storybook link.
        
        Args:
            to_email: Customer's email address
            customer_name: Customer's requested name for personalization
            storybook_title: Title of the personalized storybook
            customer_view_url: Full URL to view the storybook
            password: Optional password if storybook is protected
            order_id: Order ID for logging
            
        Returns:
            True if email sent successfully, False otherwise
        """
        try:
            email_from = os.getenv("FROM_EMAIL")
            
            # Build HTML email
            html_content = EmailSender._build_html_email(
                customer_name,
                storybook_title,
                customer_view_url,
                password
            )
            
            # Build plain text fallback
            text_content = EmailSender._build_text_email(
                customer_name,
                storybook_title,
                customer_view_url,
                password
            )
            
            # Send email via Resend
            params = {
                "from": f"Storybook Vault <{email_from}>",
                "to": [to_email],
                "subject": "Your personalized storybook is ready! 🎉",
                "html": html_content,
                "text": text_content
            }
            
            logger.info(f"Sending delivery email to {to_email} for order {order_id}")
            
            response = resend.Emails.send(params)
            
            if response and response.get("id"):
                logger.info(f"Email sent successfully to {to_email}. Email ID: {response['id']}")
                return True
            else:
                logger.error(f"Email send failed. Response: {response}")
                return False
                
        except Exception as e:
            logger.error(f"Email sending error for order {order_id}: {str(e)}")
            return False
    
    @staticmethod
    def _build_html_email(
        customer_name: str,
        storybook_title: str,
        customer_view_url: str,
        password: Optional[str] = None
    ) -> str:
        """Build branded HTML email content"""
        
        password_section = ""
        if password:
            password_section = f"""
            <div style="background: linear-gradient(135deg, #f3e7ff 0%, #ffe7f3 100%); 
                        border-radius: 12px; 
                        padding: 20px; 
                        margin: 30px 0; 
                        border: 2px solid #e0d0ff;">
                <p style="margin: 0 0 10px 0; 
                          color: #6b46c1; 
                          font-weight: 600; 
                          font-size: 16px;">
                    🔒 Your Access Password
                </p>
                <p style="margin: 0; 
                          font-size: 24px; 
                          font-weight: 700; 
                          color: #553c9a; 
                          font-family: 'Courier New', monospace; 
                          letter-spacing: 2px;">
                    {password}
                </p>
            </div>
            """
        
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your Storybook is Ready</title>
</head>
<body style="margin: 0; 
             padding: 0; 
             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
             background: linear-gradient(135deg, #f5f0ff 0%, #fff0f5 100%); 
             line-height: 1.6;">
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0; padding: 40px 20px;">
        <tr>
            <td align="center">
                <!-- Main Container -->
                <table width="600" cellpadding="0" cellspacing="0" style="background: white; 
                                                                          border-radius: 20px; 
                                                                          box-shadow: 0 10px 40px rgba(107, 70, 193, 0.1); 
                                                                          overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #9333ea 0%, #db2777 100%); 
                                   padding: 40px 40px 50px 40px; 
                                   text-align: center;">
                            <h1 style="margin: 0; 
                                       color: white; 
                                       font-size: 32px; 
                                       font-weight: 700; 
                                       text-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                                📚 Storybook Vault
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 50px 40px;">
                            
                            <h2 style="margin: 0 0 20px 0; 
                                       color: #1f2937; 
                                       font-size: 28px; 
                                       font-weight: 700;">
                                Hi {customer_name}! 👋
                            </h2>
                            
                            <p style="margin: 0 0 25px 0; 
                                      color: #4b5563; 
                                      font-size: 18px; 
                                      line-height: 1.7;">
                                Your personalized storybook is ready and waiting for you!
                            </p>
                            
                            <!-- Storybook Title Box -->
                            <div style="background: linear-gradient(135deg, #faf5ff 0%, #fef2f8 100%); 
                                        border-radius: 12px; 
                                        padding: 25px; 
                                        margin: 30px 0; 
                                        border-left: 4px solid #9333ea;">
                                <p style="margin: 0 0 8px 0; 
                                          color: #6b7280; 
                                          font-size: 14px; 
                                          text-transform: uppercase; 
                                          letter-spacing: 1px; 
                                          font-weight: 600;">
                                    Your Storybook
                                </p>
                                <p style="margin: 0; 
                                          color: #1f2937; 
                                          font-size: 22px; 
                                          font-weight: 700;">
                                    {storybook_title}
                                </p>
                            </div>
                            
                            {password_section}
                            
                            <!-- CTA Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 35px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{customer_view_url}" 
                                           style="display: inline-block; 
                                                  background: linear-gradient(135deg, #9333ea 0%, #db2777 100%); 
                                                  color: white; 
                                                  text-decoration: none; 
                                                  padding: 18px 50px; 
                                                  border-radius: 50px; 
                                                  font-size: 18px; 
                                                  font-weight: 700; 
                                                  box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4); 
                                                  transition: all 0.3s;">
                                            📖 Read Your Storybook
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 30px 0 0 0; 
                                      color: #6b7280; 
                                      font-size: 15px; 
                                      line-height: 1.6;">
                                Click the button above to open your personalized storybook. 
                                {"You'll need your password to access it." if password else "Enjoy your magical reading experience!"}
                            </p>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #faf5ff; 
                                   padding: 30px 40px; 
                                   text-align: center; 
                                   border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0; 
                                      color: #9333ea; 
                                      font-size: 16px; 
                                      font-weight: 600;">
                                Made with love by Storybook Vault 💜
                            </p>
                            <p style="margin: 10px 0 0 0; 
                                      color: #9ca3af; 
                                      font-size: 13px;">
                                This storybook was personalized just for you
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
        
        return html
    
    @staticmethod
    def _build_text_email(
        customer_name: str,
        storybook_title: str,
        customer_view_url: str,
        password: Optional[str] = None
    ) -> str:
        """Build plain text email fallback"""
        
        password_section = ""
        if password:
            password_section = f"""

🔒 YOUR ACCESS PASSWORD
{password}

You'll need this password to view your storybook.
"""
        
        text = f"""
Hi {customer_name}! 👋

Your personalized storybook is ready and waiting for you!

YOUR STORYBOOK
{storybook_title}
{password_section}

📖 READ YOUR STORYBOOK
Click here: {customer_view_url}

Enjoy your magical reading experience!

---
Made with love by Storybook Vault 💜
This storybook was personalized just for you
        """
        
        return text.strip()
