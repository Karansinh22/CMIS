"""
config.py — Central settings for the CMIS backend.

All values can be overridden via a .env file in the backend/ directory
or by setting environment variables directly.
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── HuggingFace ──────────────────────────────────────────────────────────
    hf_token: str = ""

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = "sqlite:///./cmis.db"

    # ── Whisper ──────────────────────────────────────────────────────────────
    whisper_model: str = "small"          # tiny | base | small | medium | large-v2
    asr_engine: str = "whisper"           # whisper | sarvam
    sarvam_api_key: str = ""

    # ── Diarization ──────────────────────────────────────────────────────────
    diarization_enabled: bool = True

    # ── Paths ────────────────────────────────────────────────────────────────
    upload_dir: Path = Path("./uploads")
    lsh_index_path: Path = Path("./lsh_index.pkl")

    # ── Auth / JWT ────────────────────────────────────────────────────────────
    secret_key:                     str = "CHANGE_ME_IN_PRODUCTION_USE_OPENSSL_RAND_32"
    jwt_algorithm:                  str = "HS256"
    access_token_expire_minutes:    int = 60          # 1 hour
    refresh_token_expire_days:      int = 30
    otp_expire_minutes:             int = 10

    # ── Email / SMTP ──────────────────────────────────────────────────────────
    # Leave smtp_host empty or 'localhost' to use DEV mode (OTP printed to console)
    smtp_host:     str = ""
    smtp_port:     int = 587
    smtp_user:     str = ""
    smtp_password: str = ""
    smtp_from:     str = "noreply@cmis.local"
    smtp_tls:      bool = True

    # ── App ──────────────────────────────────────────────────────────────────
    debug: bool = False
    app_title: str = "CMIS — Contextual Meeting Intelligence System"
    app_version: str = "0.1.0"

    def ensure_dirs(self) -> None:
        """Create required directories if they don't exist."""
        self.upload_dir.mkdir(parents=True, exist_ok=True)


# Module-level singleton — import this everywhere
settings = Settings()
settings.ensure_dirs()
