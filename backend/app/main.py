from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import time
import logging
import os
from pathlib import Path

from app.core.config import settings
from app.core.database import engine, Base, async_session_factory
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.api import auth, users, projects, lots, clients, sales, dashboard, public_routes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified")

    # Seed default admin user if none exist
    async with async_session_factory() as session:
        from sqlalchemy import select, func
        result = await session.execute(select(func.count(User.id)))
        if result.scalar() == 0:
            admin = User(
                email="admin@rfdesarrollos.com",
                username="admin",
                hashed_password=get_password_hash("Admin123!"),
                full_name="Administrador",
                role=UserRole.ADMIN,
                is_superuser=True,
                is_active=True,
            )
            session.add(admin)

            supervisor = User(
                email="supervisor@rfdesarrollos.com",
                username="supervisor",
                hashed_password=get_password_hash("Supervisor123!"),
                full_name="Supervisor",
                role=UserRole.SUPERVISOR,
                is_superuser=True,
                is_active=True,
            )
            session.add(supervisor)

            employee = User(
                email="employee@rfdesarrollos.com",
                username="employee",
                hashed_password=get_password_hash("Employee123!"),
                full_name="Empleado",
                role=UserRole.EMPLOYEE,
                is_superuser=False,
                is_active=True,
            )
            session.add(employee)
            await session.commit()
            logger.info("Default users created")
        else:
            logger.info("Users already exist, skipping seed")

    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

# Serve frontend static files
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")
    logger.info(f"Serving frontend static files from {frontend_dist}")
else:
    logger.warning(f"Frontend dist not found at {frontend_dist}")

# Rate limit handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
cors_origins = settings.cors_origins_list
# Always include the Netlify frontend
netlify_url = "https://dashing-marshmallow-9ef64c.netlify.app"
if netlify_url not in cors_origins:
    cors_origins.append(netlify_url)
logger.info(f"CORS origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return response


# Request timing and logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {duration:.3f}s")
    return response


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.VERSION}


# Debug endpoint
@app.get("/debug-login")
async def debug_login():
    import traceback
    try:
        from app.core.security import verify_password, create_access_token
        from app.models.user import User, UserRole
        from app.schemas.user import UserResponse
        async with async_session_factory() as session:
            from sqlalchemy import select
            result = await session.execute(select(User).where(User.email == "admin@rfdesarrollos.com"))
            user = result.scalar_one_or_none()
            if not user:
                return {"error": "user not found"}
            
            # Check password
            pw_check = verify_password("Admin123!", user.hashed_password)
            
            # Check all fields
            user_data = {c.name: getattr(user, c.name) for c in user.__table__.columns}
            
            # Try creating TokenResponse
            access_token = create_access_token(user.id)
            res = UserResponse.model_validate(user)
            
            return {
                "user_found": True,
                "password_match": pw_check,
                "role": user.role.value,
                "role_type": str(type(user.role)),
                "totp_enabled": user.totp_enabled,
                "totp_type": str(type(user.totp_enabled)),
                "last_login": str(user.last_login),
                "user_data_keys": list(user_data.keys()),
                "raw_role": user_data.get("role"),
                "token_ok": bool(access_token),
                "user_response_created": True,
            }
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}


# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(lots.router, prefix="/api/v1")
app.include_router(clients.router, prefix="/api/v1")
app.include_router(sales.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(public_routes.router, prefix="/api/v1")

# SPA catch-all: serve index.html for any non-API route via middleware
@app.middleware("http")
async def spa_fallback(request: Request, call_next):
    try:
        response = await call_next(request)
        if response.status_code == 404 and not request.url.path.startswith("/api/"):
            index_path = frontend_dist / "index.html"
            if index_path.exists():
                return FileResponse(str(index_path))
        return response
    except HTTPException as exc:
        if exc.status_code == 404 and not request.url.path.startswith("/api/"):
            index_path = frontend_dist / "index.html"
            if index_path.exists():
                return FileResponse(str(index_path))
        raise
