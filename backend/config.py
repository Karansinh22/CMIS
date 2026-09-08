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
    # "auto" picks CUDA when faster-whisper can see a GPU, otherwise CPU.
    whisper_device: str = "auto"          # auto | cpu | cuda
    # "auto" → int8 on CPU, float16 on CUDA. Override e.g. "int8_float16".
    whisper_compute_type: str = "auto"
    # beam_size=1 (greedy) is ~2× faster than 5 with a small accuracy cost.
    whisper_beam_size: int = 1
    # 0 → use all CPU cores.
    whisper_cpu_threads: int = 0
    whisper_vad_filter: bool = True
    # Conditioning on previous text slows decoding and causes repetition loops.
    whisper_condition_on_previous_text: bool = False
    # Load Whisper (and pyannote if enabled) in a background thread at startup
    # so the first upload doesn't pay the model-load cost.
    preload_models: bool = True

    # ── Live transcript streaming ────────────────────────────────────────────
    # Segments are persisted + pushed over the WebSocket as soon as either
    # threshold is reached (whichever comes first).
    transcript_flush_segments: int = 3
    transcript_flush_seconds: float = 1.5

    # ── Live microphone streaming ────────────────────────────────────────────
    # Audio is transcribed in chunks: a chunk is cut at a pause once it holds at
    # least `live_min_chunk_seconds`, or forcibly at `live_max_chunk_seconds`.
    live_min_chunk_seconds: float = 3.0
    live_max_chunk_seconds: float = 10.0
    live_silence_rms: float = 0.010          # RMS below this (float32 scale) counts as silence
    live_silence_seconds: float = 0.6        # pause length that ends a chunk

    # ── NLP extraction engine ────────────────────────────────────────────────
    # "local" → intent/context-aware rule engine (offline, default)
    # "llm"   → LLM extraction (Anthropic or Ollama) with local fallback
    nlp_engine: str = "local"
    llm_provider: str = "anthropic"       # anthropic | ollama
    anthropic_api_key: str = ""           # or set ANTHROPIC_API_KEY in the env
    llm_model: str = "claude-opus-5"      # anthropic model id, or ollama model name (e.g. llama3.1)
    ollama_base_url: str = "http://localhost:11434"
    llm_timeout_seconds: float = 120.0
    # Minimum confidence (0–1) an extracted item needs to be stored.
    extraction_min_confidence: float = 0.45

    # ── Diarization ──────────────────────────────────────────────────────────
    diarization_enabled: bool = True

    # ── Paths ────────────────────────────────────────────────────────────────
    upload_dir: Path = Path("./uploads")
    reports_dir: Path = Path("./reports_out")
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
    app_version: str = "0.2.0"
    # Comma-separated list of allowed browser origins; "*" allows all (dev default)
    cors_origins: str = "*"

    def ensure_dirs(self) -> None:
        """Create required directories if they don't exist."""
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.reports_dir.mkdir(parents=True, exist_ok=True)


# Module-level singleton — import this everywhere
settings = Settings()
settings.ensure_dirs()
