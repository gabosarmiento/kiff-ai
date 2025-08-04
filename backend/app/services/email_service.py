import resend
from typing import List, Optional, Dict, Any
from datetime import datetime
import logging
from jinja2 import Template

from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    """Email service using Resend for transactional emails"""
    
    def __init__(self):
        # Initialize Resend with API key
        self.api_key = getattr(settings, 'RESEND_API_KEY', None)
        if self.api_key:
            resend.api_key = self.api_key
        else:
            logger.warning("RESEND_API_KEY not found in settings. Email functionality will be disabled.")
        
        # Default sender
        self.default_from = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@tradeforge.ai')
        self.company_name = "TradeForge AI"
        
    async def send_email(
        self,
        to: List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        from_email: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        reply_to: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Send an email using Resend"""
        if not self.api_key:
            logger.error("Cannot send email: RESEND_API_KEY not configured")
            return {"success": False, "error": "Email service not configured"}
        
        try:
            email_data = {
                "from": from_email or self.default_from,
                "to": to,
                "subject": subject,
                "html": html_content,
            }
            
            if text_content:
                email_data["text"] = text_content
            if cc:
                email_data["cc"] = cc
            if bcc:
                email_data["bcc"] = bcc
            if reply_to:
                email_data["reply_to"] = reply_to
            if tags:
                email_data["tags"] = tags
            
            response = resend.Emails.send(email_data)
            
            logger.info(f"Email sent successfully to {to}. ID: {response.get('id')}")
            return {
                "success": True,
                "message_id": response.get("id"),
                "response": response
            }
            
        except Exception as e:
            logger.error(f"Failed to send email to {to}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def send_welcome_email(self, user_email: str, user_name: str, verification_token: str) -> Dict[str, Any]:
        """Send welcome email with verification link"""
        verification_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')}/verify-email?token={verification_token}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Welcome to {self.company_name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to {self.company_name}!</h1>
                </div>
                <div class="content">
                    <h2>Hi {user_name},</h2>
                    <p>Thank you for joining {self.company_name}! We're excited to help you build powerful AI-driven trading agents.</p>
                    
                    <p>To get started, please verify your email address by clicking the button below:</p>
                    
                    <a href="{verification_url}" class="button">Verify Email Address</a>
                    
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p><a href="{verification_url}">{verification_url}</a></p>
                    
                    <h3>What's Next?</h3>
                    <ul>
                        <li>Complete your profile setup</li>
                        <li>Explore our AI agent templates</li>
                        <li>Create your first trading strategy</li>
                        <li>Test in our sandbox environment</li>
                    </ul>
                    
                    <p>If you have any questions, our support team is here to help!</p>
                    
                    <p>Best regards,<br>The {self.company_name} Team</p>
                </div>
                <div class="footer">
                    <p>This email was sent to {user_email}. If you didn't create an account, please ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Welcome to {self.company_name}!
        
        Hi {user_name},
        
        Thank you for joining {self.company_name}! We're excited to help you build powerful AI-driven trading agents.
        
        To get started, please verify your email address by visiting:
        {verification_url}
        
        What's Next?
        - Complete your profile setup
        - Explore our AI agent templates
        - Create your first trading strategy
        - Test in our sandbox environment
        
        If you have any questions, our support team is here to help!
        
        Best regards,
        The {self.company_name} Team
        """
        
        return await self.send_email(
            to=[user_email],
            subject=f"Welcome to {self.company_name} - Please verify your email",
            html_content=html_content,
            text_content=text_content,
            tags=["welcome", "verification"]
        )
    
    async def send_password_reset_email(self, user_email: str, user_name: str, reset_token: str) -> Dict[str, Any]:
        """Send password reset email"""
        reset_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')}/reset-password?token={reset_token}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Password Reset - {self.company_name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #f44336; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background: #f44336; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .warning {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Password Reset Request</h1>
                </div>
                <div class="content">
                    <h2>Hi {user_name},</h2>
                    <p>We received a request to reset your password for your {self.company_name} account.</p>
                    
                    <p>Click the button below to reset your password:</p>
                    
                    <a href="{reset_url}" class="button">Reset Password</a>
                    
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p><a href="{reset_url}">{reset_url}</a></p>
                    
                    <div class="warning">
                        <strong>Security Notice:</strong>
                        <ul>
                            <li>This link will expire in 1 hour</li>
                            <li>If you didn't request this reset, please ignore this email</li>
                            <li>Your password won't be changed until you create a new one</li>
                        </ul>
                    </div>
                    
                    <p>If you continue to have problems, please contact our support team.</p>
                    
                    <p>Best regards,<br>The {self.company_name} Team</p>
                </div>
                <div class="footer">
                    <p>This email was sent to {user_email}. If you didn't request a password reset, please ignore this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Password Reset Request - {self.company_name}
        
        Hi {user_name},
        
        We received a request to reset your password for your {self.company_name} account.
        
        To reset your password, visit:
        {reset_url}
        
        Security Notice:
        - This link will expire in 1 hour
        - If you didn't request this reset, please ignore this email
        - Your password won't be changed until you create a new one
        
        If you continue to have problems, please contact our support team.
        
        Best regards,
        The {self.company_name} Team
        """
        
        return await self.send_email(
            to=[user_email],
            subject=f"Password Reset - {self.company_name}",
            html_content=html_content,
            text_content=text_content,
            tags=["password-reset", "security"]
        )
    
    async def send_support_ticket_notification(
        self, 
        admin_email: str, 
        admin_name: str, 
        ticket_id: str, 
        ticket_subject: str,
        user_email: str,
        priority: str
    ) -> Dict[str, Any]:
        """Send support ticket notification to admin"""
        ticket_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')}/admin/support?ticket={ticket_id}"
        
        priority_colors = {
            "low": "#28a745",
            "medium": "#ffc107", 
            "high": "#fd7e14",
            "urgent": "#dc3545"
        }
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>New Support Ticket - {self.company_name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #17a2b8; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background: #17a2b8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .priority {{ display: inline-block; padding: 6px 12px; border-radius: 4px; color: white; font-weight: bold; background: {priority_colors.get(priority, '#6c757d')}; }}
                .ticket-info {{ background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #17a2b8; }}
                .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>New Support Ticket</h1>
                </div>
                <div class="content">
                    <h2>Hi {admin_name},</h2>
                    <p>A new support ticket has been created and requires your attention.</p>
                    
                    <div class="ticket-info">
                        <h3>Ticket Details</h3>
                        <p><strong>Ticket ID:</strong> {ticket_id}</p>
                        <p><strong>Subject:</strong> {ticket_subject}</p>
                        <p><strong>From:</strong> {user_email}</p>
                        <p><strong>Priority:</strong> <span class="priority">{priority.upper()}</span></p>
                        <p><strong>Created:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
                    </div>
                    
                    <a href="{ticket_url}" class="button">View Ticket</a>
                    
                    <p>Please respond to this ticket as soon as possible to maintain our high customer satisfaction standards.</p>
                    
                    <p>Best regards,<br>The {self.company_name} System</p>
                </div>
                <div class="footer">
                    <p>This is an automated notification from the {self.company_name} support system.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(
            to=[admin_email],
            subject=f"[{priority.upper()}] New Support Ticket: {ticket_subject}",
            html_content=html_content,
            tags=["support", "notification", f"priority-{priority}"]
        )
    
    async def send_support_response_notification(
        self,
        user_email: str,
        user_name: str,
        ticket_id: str,
        ticket_subject: str,
        admin_name: str,
        response_message: str
    ) -> Dict[str, Any]:
        """Send notification to user when admin responds to their ticket"""
        ticket_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')}/support/tickets/{ticket_id}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Support Ticket Update - {self.company_name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .response {{ background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #28a745; }}
                .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Support Ticket Update</h1>
                </div>
                <div class="content">
                    <h2>Hi {user_name},</h2>
                    <p>Great news! {admin_name} from our support team has responded to your ticket.</p>
                    
                    <p><strong>Ticket:</strong> {ticket_subject}</p>
                    <p><strong>Ticket ID:</strong> {ticket_id}</p>
                    
                    <div class="response">
                        <h3>Response from {admin_name}:</h3>
                        <p>{response_message[:500]}{'...' if len(response_message) > 500 else ''}</p>
                    </div>
                    
                    <a href="{ticket_url}" class="button">View Full Response</a>
                    
                    <p>You can reply to this ticket through your support dashboard or by responding to this email.</p>
                    
                    <p>Thank you for using {self.company_name}!</p>
                    
                    <p>Best regards,<br>The {self.company_name} Support Team</p>
                </div>
                <div class="footer">
                    <p>This email was sent to {user_email} regarding ticket #{ticket_id}.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(
            to=[user_email],
            subject=f"Re: {ticket_subject} [Ticket #{ticket_id}]",
            html_content=html_content,
            reply_to="support@tradeforge.ai",
            tags=["support", "response", "user-notification"]
        )
    
    async def send_billing_notification(
        self,
        user_email: str,
        user_name: str,
        amount: float,
        currency: str,
        invoice_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send billing/payment notification"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Payment Confirmation - {self.company_name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .amount {{ font-size: 24px; font-weight: bold; color: #28a745; text-align: center; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Payment Confirmed</h1>
                </div>
                <div class="content">
                    <h2>Hi {user_name},</h2>
                    <p>Thank you! Your payment has been successfully processed.</p>
                    
                    <div class="amount">{currency} {amount:.2f}</div>
                    
                    <p>Your {self.company_name} services will continue uninterrupted.</p>
                    
                    {f'<a href="{invoice_url}" class="button">Download Invoice</a>' if invoice_url else ''}
                    
                    <p>If you have any questions about your billing, please don't hesitate to contact our support team.</p>
                    
                    <p>Thank you for choosing {self.company_name}!</p>
                    
                    <p>Best regards,<br>The {self.company_name} Team</p>
                </div>
                <div class="footer">
                    <p>This email was sent to {user_email}. For billing questions, contact billing@tradeforge.ai</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self.send_email(
            to=[user_email],
            subject=f"Payment Confirmation - {currency} {amount:.2f}",
            html_content=html_content,
            tags=["billing", "payment", "confirmation"]
        )

# Global email service instance
email_service = EmailService()
