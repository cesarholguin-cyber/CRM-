from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from contextlib import asynccontextmanager
import time
import logging
import os
from pathlib import Path

from app.core.config import settings
from app.core.rate_limit import limiter, APIRateLimitMiddleware
from app.core.request_limits import RequestBodyLimitMiddleware
from app.core.database import engine, Base, async_session_factory
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.api import auth, users, projects, lots, clients, sales, dashboard, public_routes, admin, web_requests, documents

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Managed databases must be migrated and verified before accepting traffic.
    if settings.DATABASE_MODE in ("oracle", "supabase"):
        from sqlalchemy import select
        from app.models.oracle import SchemaMigration
        async with async_session_factory() as session:
            marker = "supabase-commercial-v5-ready" if settings.DATABASE_MODE == "supabase" else "oracle-v1-ready"
            if await session.get(SchemaMigration, marker) is None:
                raise RuntimeError("Completa y verifica la migración de la base antes de iniciar el CRM.")
    async with engine.begin() as conn:
        if settings.DATABASE_MODE not in ("oracle", "supabase"):
            await conn.run_sync(Base.metadata.create_all)
            from app.core.reservation_schema import ensure_reservation_history
            await ensure_reservation_history(conn)
    if settings.DATABASE_MODE not in ("oracle", "supabase"):
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("DELETE FROM users WHERE role = 'SISTEMAS'"))
    logger.info("Database tables created/verified")

    if engine.dialect.name == "postgresql" and settings.DATABASE_MODE != "supabase":
        # Migrate old enum and role values
        async with async_session_factory() as session:
            from sqlalchemy import text as sa_text
            # Create new enum type and migrate
            await session.execute(sa_text("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole_new') THEN
                        CREATE TYPE userrole_new AS ENUM ('ADMIN', 'PROMOTOR');
                    END IF;
                END $$;
            """))
            await session.execute(sa_text("""
                ALTER TABLE users ALTER COLUMN role TYPE userrole_new
                    USING CASE
                        WHEN role::text IN ('EMPLOYEE', 'SUPERVISOR') THEN 'PROMOTOR'::userrole_new
                        WHEN role::text = 'ADMIN' THEN 'ADMIN'::userrole_new
                        ELSE 'PROMOTOR'::userrole_new
                    END
            """))
            await session.execute(sa_text("DROP TYPE IF EXISTS userrole CASCADE"))
            await session.execute(sa_text("ALTER TYPE userrole_new RENAME TO userrole"))
            await session.commit()
            logger.info("User roles verified")

    # Seed default admin user if none exist
    async with async_session_factory() as session:
        from sqlalchemy import select, func
        result = await session.execute(select(func.count(User.id)))
        if result.scalar() == 0 and settings.DATABASE_MODE == "embedded":
            import json
            bootstrap = json.loads((Path(__file__).resolve().parent / "data/demo-bootstrap.json").read_text())
            session.add(User(email=bootstrap['email'], username="pruebas", full_name="Administrador de pruebas",
                             hashed_password=bootstrap['password_hash'], role=UserRole.ADMIN,
                             is_superuser=True, is_active=True))
            await session.commit()
            logger.info("Test administrator created")
        else:
            logger.info("Users already exist, skipping seed")

    # Provision the requested account even when the persistent database has users.
    from app.services.deployment_access import provision_deployment_access
    if await provision_deployment_access(async_session_factory, settings.DATABASE_MODE):
        logger.info("Requested CRM account created")

    # Fail closed on conflicts; never seed a second copy of the plan.
    from app.services.project_consolidation import consolidate_projects
    consolidation = await consolidate_projects()
    if consolidation['migrated']:
        logger.info("Project consolidation completed: %s", consolidation)

    # Add the supplied 358-lot catalog without replacing existing inventory.
    from app.services.catalog import seed
    try:
        await seed(apply=True)
    except RuntimeError as exc:
        logger.error("Campestre catalog requires reconciliation: %s", exc)

    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# Serve frontend static files
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")
    logger.info(f"Serving frontend static files from {frontend_dist}")
else:
    logger.warning(f"Frontend dist not found at {frontend_dist}")

# Rate limit handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(RequestBodyLimitMiddleware)
app.add_middleware(APIRateLimitMiddleware)

# CORS
cors_origins = settings.cors_origins_list
# Keep the deployed landing domains even when Easypanel supplies an older
# CORS_ORIGINS value. Explicit origins only; no wildcard or suffix matching.
for origin in (
    "https://maculisur.com.mx",
    "https://www.maculisur.com.mx",
    "http://127.0.0.1:4176",
    "http://localhost:4176",
    "https://eltriunfo.mx",
    "https://www.eltriunfo.mx",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
    "http://127.0.0.1:4175",
    "https://rf-campestre-aztrotech.cesarholguin.chatgpt.site",
):
    if origin not in cors_origins:
        cors_origins.append(origin)
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
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if not settings.DEBUG:
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; "
            "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
        )
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
@limiter.exempt
async def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "version": settings.VERSION,
            "database_mode": settings.DATABASE_MODE,
            "auth_provider": "supabase" if settings.DATABASE_MODE == "supabase" else "local",
            "integration_version": "landing-requests-v1"}


# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(lots.router, prefix="/api/v1")
app.include_router(clients.router, prefix="/api/v1")
app.include_router(sales.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(public_routes.router, prefix="/api/v1")
app.include_router(web_requests.public_router, prefix="/api/v1")
app.include_router(web_requests.router, prefix="/api/v1")


# Serve frontend for all non-API routes (MUST be after all routers)
@app.get("/{full_path:path}")
@limiter.exempt
async def serve_frontend(full_path: str):
    # API routes are handled by routers above
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404)
    # Try to serve the exact file first (for assets, etc.)
    file_path = (frontend_dist / full_path).resolve()
    if not file_path.is_relative_to(frontend_dist.resolve()):
        raise HTTPException(status_code=404)
    if full_path and file_path.is_file():
        return FileResponse(str(file_path))
    # For everything else, serve index.html (SPA routing)
    index_path = frontend_dist / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    raise HTTPException(status_code=404)
