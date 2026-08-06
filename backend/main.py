"""
main.py — FastAPI application entrypoint for CMIS backend.

Run with:
    uvicorn main:app --reload

Swagger UI available at: http://localhost:8000/docs
ReDoc available at:       http://localhost:8000/redoc
"""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.database import init_db
from routers import context, insights, meetings, ws

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    description=(
        "AI-powered backend that transcribes meeting audio, extracts structured "
        "context (topics, action items, decisions, urgency), stores it in a "
        "persistent context store, and detects recurring topics across meetings."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the React dev server (localhost:5173) during development.
# Tighten this to your production domain before deploying.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def on_startup():
    logger.info("CMIS backend starting up…")
    from utils.audio import ensure_ffmpeg
    ffmpeg_path = ensure_ffmpeg()
    if ffmpeg_path:
        logger.info("FFmpeg configured at: %s", ffmpeg_path)
    else:
        logger.warning("FFmpeg not found!")
    init_db()
    logger.info("Database tables verified / created.")
    logger.info("Upload directory: %s", settings.upload_dir.resolve())
    logger.info("Swagger UI at http://localhost:8000/docs")


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(meetings.router)
app.include_router(context.router)
app.include_router(insights.router)
app.include_router(ws.router)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
def health_check():
    """Simple liveness probe — returns OK if the server is running."""
    return {"status": "ok", "version": settings.app_version}
