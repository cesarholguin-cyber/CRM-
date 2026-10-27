"""One limiter for the API and both generations of landing intake."""
from slowapi import Limiter
from slowapi.util import get_remote_address
from limits import parse
from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings


# Uvicorn resolves forwarded addresses only from its configured trusted proxies.
# Do not parse an arbitrary X-Forwarded-For header here.
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL or "memory://",
    headers_enabled=True,
)

public_intake_limit = limiter.shared_limit(
    "10/minute", scope="landing-intake",
)


class APIRateLimitMiddleware(BaseHTTPMiddleware):
    """Limit before parsing, independent of FastAPI's lazy router internals.

    One budget per IP and API area preserves normal dashboard polling while
    preventing alternate IDs or the SPA catch-all from bypassing the limit.
    The public routes additionally share their stricter intake quota.
    """
    async def dispatch(self, request, call_next):
        if not limiter.enabled or not request.scope["path"].startswith("/api/"):
            return await call_next(request)
        parts = request.scope["path"].split("/")
        area = parts[3] if len(parts) > 3 else "other"
        if area not in {"auth", "users", "projects", "lots", "clients", "sales",
                        "dashboard", "admin", "public", "web-requests"}:
            area = "other"
        budget = parse(f"{settings.RATE_LIMIT_PER_MINUTE}/minute")
        try:
            allowed = await run_in_threadpool(
                limiter.limiter.hit, budget, "crm-api", area, get_remote_address(request),
            )
        except Exception:
            # Never silently disable protection when a configured Redis is down.
            return JSONResponse({"detail": "Protección temporalmente no disponible. Intenta de nuevo."},
                                status_code=503, headers={"Retry-After": "60"})
        if not allowed:
            return JSONResponse({"detail": "Demasiadas solicitudes. Espera un minuto e intenta de nuevo."},
                                status_code=429, headers={"Retry-After": "60"})
        return await call_next(request)
