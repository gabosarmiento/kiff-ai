from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
import os
from ..util.session import get_session_from_request

DEFAULT_TENANT = os.getenv("DEFAULT_TENANT_ID", "4485db48-71b7-47b0-8128-c6dca5be352d")
ALLOW_TENANT_FALLBACK = os.getenv("ALLOW_TENANT_FALLBACK", "true").lower() == "true"


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path or "/"
        # Exemptions: root, health, and auth endpoints must not block
        exempt = path in {"/", "/health"} or path.startswith("/api/auth/") or path == "/api/auth"

        # Priority: header > session > fallback (if allowed)
        tenant_id = request.headers.get("X-Tenant-ID")
        if not tenant_id:
            sess = get_session_from_request(dict(request.headers), request.cookies)
            if sess and isinstance(sess, dict):
                tenant_id = sess.get("tenant_id")

        if not tenant_id:
            if exempt or ALLOW_TENANT_FALLBACK:
                tenant_id = DEFAULT_TENANT
            else:
                return JSONResponse(
                    status_code=400,
                    content={"error": "Tenant not specified", "message": "Send X-Tenant-ID header"},
                )

        # attach to state for handlers
        request.state.tenant_id = tenant_id
        response = await call_next(request)
        return response
