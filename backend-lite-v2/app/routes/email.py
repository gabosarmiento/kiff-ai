from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any

from ..services.email_service import EmailService

router = APIRouter(prefix="/email", tags=["email"])


class TestEmailRequest(BaseModel):
    to: EmailStr
    subject: str = Field(default="Kiff AI test email")
    text: Optional[str] = None
    html: Optional[str] = None
    from_email: Optional[str] = Field(default=None, alias="from")
    headers: Optional[Dict[str, str]] = None

    class Config:
        populate_by_name = True


@router.post("/test")
async def send_test_email(body: TestEmailRequest) -> dict[str, Any]:
    if not (body.text or body.html):
        # Provide a default plain text body if neither is provided
        body.text = "Hello from Kiff AI! This is a test email via Resend."
    try:
        svc = EmailService()
        result = svc.send_email(
            to=body.to,
            subject=body.subject,
            text=body.text,
            html=body.html,
            from_email=body.from_email,
            headers=body.headers,
        )
        return {"ok": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
