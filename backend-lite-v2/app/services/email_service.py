import os
from typing import Optional, Dict, Any

import resend


class EmailService:
    """Thin wrapper around Resend Python SDK.

    Requires RESEND_API_KEY in environment (loaded in app/main.py via dotenv).
    """

    def __init__(self) -> None:
        api_key = os.getenv("RESEND_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("RESEND_API_KEY not configured")
        resend.api_key = api_key

    def send_email(
        self,
        *,
        to: str,
        subject: str,
        text: Optional[str] = None,
        html: Optional[str] = None,
        from_email: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Send an email via Resend.

        - If html is provided, it will be used; otherwise text will be used.
        - from_email defaults to a Resend-provided address if not set.
        """
        payload: Dict[str, Any] = {
            "to": to,
            "subject": subject,
        }
        if html:
            payload["html"] = html
        elif text:
            payload["text"] = text
        else:
            payload["text"] = ""

        # Prefer configured FROM; fall back to a generic Resend address
        payload["from"] = from_email or os.getenv("RESEND_FROM_EMAIL", "Kiff AI <onboarding@resend.dev>")

        if headers:
            payload["headers"] = headers

        result = resend.Emails.send(payload)
        # result is typically a dict like {"id": "..."}
        return result
