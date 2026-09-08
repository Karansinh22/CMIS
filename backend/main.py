"""
main.py — FastAPI application entrypoint for CMIS backend.

Run with:
    uvicorn main:app --reload

Swagger UI available at: http://localhost:8000/docs
ReDoc available at:       http://localhost:8000/redoc
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.database import init_db
from routers import auth, context, insights, live, meetings, projects, reports, ws

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Lifespan ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("CMIS backend starting up…")
    from utils.audio import ensure_ffmpeg
    ffmpeg_path = ensure_ffmpeg()
    if ffmpeg_path:
        logger.info("FFmpeg configured at: %s", ffmpeg_path)
    else:
        logger.warning("FFmpeg not found!")
    init_db()
    logger.info("Database tables verified / created.")
    if settings.preload_models:
        import threading
        from ingestion.transcriber import preload as preload_whisper

        def _warm_up():
            preload_whisper()
            if settings.diarization_enabled and settings.hf_token:
                try:
                    from ingestion.diarizer import preload as preload_diarizer
                    preload_diarizer()
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Diarization preload skipped: %s", exc)

        threading.Thread(target=_warm_up, name="model-warmup", daemon=True).start()
        logger.info("Warming up speech models in the background (PRELOAD_MODELS=true).")
    logger.info("Upload directory: %s", settings.upload_dir.resolve())
    logger.info("Swagger UI at http://localhost:8000/docs")
    yield
    logger.info("CMIS backend shutting down.")


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
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the React dev server (localhost:5173) during development.
# Tighten this to your production domain before deploying.

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,                 # CORS_ORIGINS=http://localhost:5173,https://example.com
    allow_credentials=_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(meetings.router)
app.include_router(context.router)
app.include_router(insights.router)
app.include_router(ws.router)
app.include_router(live.router)
app.include_router(reports.router)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"])
def health_check():
    """Simple liveness probe — returns OK if the server is running."""
    return {"status": "ok", "version": settings.app_version}
