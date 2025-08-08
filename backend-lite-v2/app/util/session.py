import os
import hmac
import base64
import hashlib
import json
import time
from typing import Optional, Dict, Any

SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "session")
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "86400"))  # 24h
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret-change-me")


def _sign(data: bytes) -> str:
    sig = hmac.new(SESSION_SECRET.encode("utf-8"), data, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(sig).decode("utf-8").rstrip("=")


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64d(data: str) -> bytes:
    pad = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def encode_session(payload: Dict[str, Any]) -> str:
    # inject issued_at and expiry
    now = int(time.time())
    payload = {**payload, "iat": now, "exp": now + SESSION_TTL_SECONDS}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    body = _b64(raw)
    sig = _sign(raw)
    return f"{body}.{sig}"


def decode_session(token: str) -> Optional[Dict[str, Any]]:
    try:
        body, sig = token.split(".")
        raw = _b64d(body)
        if _sign(raw) != sig:
            return None
        obj = json.loads(raw.decode("utf-8"))
        if int(time.time()) > int(obj.get("exp", 0)):
            return None
        return obj
    except Exception:
        return None


def make_cookie(value: str, *, secure: bool = False) -> Dict[str, Any]:
    return {
        "key": SESSION_COOKIE_NAME,
        "value": value,
        "httponly": True,
        "samesite": "lax",
        "secure": secure,
        "max_age": SESSION_TTL_SECONDS,
        "path": "/",
    }


def clear_cookie() -> Dict[str, Any]:
    return {
        "key": SESSION_COOKIE_NAME,
        "value": "",
        "httponly": True,
        "samesite": "lax",
        "secure": False,
        "max_age": 0,
        "path": "/",
    }


def get_session_from_request(headers: Dict[str, str], cookies: Dict[str, str]) -> Optional[Dict[str, Any]]:
    token = cookies.get(SESSION_COOKIE_NAME)
    if not token:
        # try Authorization: Bearer <token> fallback for debugging
        auth = headers.get("authorization") or headers.get("Authorization")
        if auth and auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1]
    return decode_session(token) if token else None
