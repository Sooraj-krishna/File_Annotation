"""
FastAPI application entry point.

Configures the app with CORS middleware, registers all API routers,
and attaches custom exception handlers. The lifespan handler ensures
the database connection pool is properly disposed on shutdown.
"""

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.api import annotations, documents, extraction, tasks
from app.core.config import settings
from app.core.error_handler import register_error_handlers
from app.database.session import engine


limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.

    Currently only handles cleanup on shutdown by disposing the
    async database engine. Can be extended for startup tasks like
    connection pool warmup or cache initialization.
    """
    yield
    await engine.dispose()


app = FastAPI(
    title="Document Annotation API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS: allow the frontend dev server to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.app_env == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response: Response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Register API route groups under their respective prefixes
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(annotations.router, prefix="/api/annotations", tags=["annotations"])
app.include_router(extraction.router, prefix="/api/documents", tags=["extraction"])
app.include_router(tasks.router, prefix="/api", tags=["tasks"])

# Attach custom exception → HTTP status code handlers
register_error_handlers(app)


@app.get("/health")
async def health():
    """Simple healthcheck endpoint for monitoring and load balancers."""
    return {"status": "ok", "version": "0.1.0"}


@app.get("/health/ready")
@limiter.limit("10/minute")
async def health_ready(request: Request):
    """Readiness probe - checks database connectivity."""
    from sqlalchemy import text
    from app.database.session import engine as db_engine
    
    try:
        async with db_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "database": "disconnected", "error": str(e)}
        )
