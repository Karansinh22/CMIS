"""
tests/conftest.py — Pytest fixtures shared across all CMIS test modules.
"""

from __future__ import annotations

import os
import wave
import struct
import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Force in-memory SQLite and dummy HF token before importing app modules
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("HF_TOKEN", "dummy")
os.environ.setdefault("DIARIZATION_ENABLED", "false")
os.environ.setdefault("UPLOAD_DIR", str(Path(__file__).parent / "tmp_uploads"))

from db.database import Base, get_db
from main import app


# ── In-memory DB session ──────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def engine():
    _engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=_engine)
    yield _engine
    _engine.dispose()


@pytest.fixture()
def db(engine):
    """Provide a transactional DB session that rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    """FastAPI TestClient with the in-memory DB injected."""
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ── Sample audio fixture ──────────────────────────────────────────────────────

def _create_test_wav(path: Path, duration_s: float = 3.0, sample_rate: int = 16000) -> Path:
    """Generate a minimal sine-wave WAV file for testing."""
    path.parent.mkdir(parents=True, exist_ok=True)
    n_samples = int(duration_s * sample_rate)
    frequency = 440.0  # A4 tone

    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)       # 16-bit
        wf.setframerate(sample_rate)
        for i in range(n_samples):
            sample = int(32767 * math.sin(2 * math.pi * frequency * i / sample_rate))
            wf.writeframes(struct.pack("<h", sample))

    return path


@pytest.fixture(scope="session")
def sample_wav(tmp_path_factory) -> Path:
    """A short synthetic WAV file available for the whole test session."""
    tmp = tmp_path_factory.mktemp("audio")
    return _create_test_wav(tmp / "test_meeting.wav", duration_s=3.0)
