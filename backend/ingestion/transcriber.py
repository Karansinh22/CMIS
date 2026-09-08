"""
transcriber.py — Wraps faster-whisper for speech-to-text transcription.

Two entry points:

    transcribe_stream(path)  → generator yielding RawSegment objects as soon as
                               Whisper decodes them (used for live transcript
                               streaming to the dashboard).
    transcribe(path)         → convenience wrapper returning the full list.

Performance notes
-----------------
* The model is loaded once per process (``_get_model``) and can be warmed up at
  startup via ``preload()``.
* ``WHISPER_DEVICE=auto`` uses CUDA when faster-whisper can see a GPU.
* ``WHISPER_BEAM_SIZE=1`` (greedy decoding) is roughly twice as fast as beam 5.
* ``condition_on_previous_text=False`` avoids the slow "repetition loop"
  failure mode on long recordings.
"""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Callable, Iterator, List, Optional

from config import settings

logger = logging.getLogger(__name__)


# ── Data types ────────────────────────────────────────────────────────────────

class RawSegment:
    """A single spoken segment from the Whisper output."""

    def __init__(self, text: str, start: float, end: float):
        self.text = text.strip()
        self.start = start
        self.end = end

    def __repr__(self) -> str:
        return f"RawSegment(start={self.start:.2f}, end={self.end:.2f}, text={self.text!r})"


# ── Model management ──────────────────────────────────────────────────────────

_model_cache: dict = {}   # {model_name: WhisperModel} — loaded once per process
_model_lock = threading.Lock()


def _resolve_device() -> tuple[str, str]:
    """Return (device, compute_type) honouring the 'auto' settings."""
    device = (settings.whisper_device or "auto").lower()
    compute = (settings.whisper_compute_type or "auto").lower()

    if device == "auto":
        device = "cpu"
        try:
            import ctranslate2  # bundled with faster-whisper
            if ctranslate2.get_cuda_device_count() > 0:
                device = "cuda"
        except Exception:  # noqa: BLE001
            pass

    if compute == "auto":
        compute = "float16" if device == "cuda" else "int8"

    return device, compute


def _get_model(model_name: str):
    """Lazy-load and cache the Whisper model (thread-safe)."""
    if model_name in _model_cache:
        return _model_cache[model_name]

    with _model_lock:
        if model_name in _model_cache:
            return _model_cache[model_name]

        try:
            from faster_whisper import WhisperModel
        except ImportError:
            raise RuntimeError(
                "faster-whisper is not installed. Run: pip install faster-whisper"
            )

        device, compute_type = _resolve_device()
        cpu_threads = settings.whisper_cpu_threads or (os.cpu_count() or 4)

        logger.info(
            "Loading Whisper model '%s' on %s/%s (first run may download weights)…",
            model_name, device, compute_type,
        )
        try:
            model = WhisperModel(
                model_name, device=device, compute_type=compute_type, cpu_threads=cpu_threads
            )
        except Exception as exc:  # noqa: BLE001
            if device != "cpu":
                logger.warning("Could not load Whisper on %s (%s); falling back to CPU.", device, exc)
                model = WhisperModel(model_name, device="cpu", compute_type="int8", cpu_threads=cpu_threads)
            else:
                raise
        _model_cache[model_name] = model
        logger.info("Whisper model '%s' ready.", model_name)

    return _model_cache[model_name]


def preload(model_name: Optional[str] = None) -> None:
    """Warm up the Whisper model (called from a background thread at startup)."""
    try:
        _get_model(model_name or settings.whisper_model)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Whisper preload failed: %s", exc)


def _get_audio_duration(audio_path: Path) -> float:
    """Return total duration in seconds (wave module, ffprobe fallback)."""
    try:
        import wave
        with wave.open(str(audio_path), "rb") as wf:
            return wf.getnframes() / float(wf.getframerate())
    except Exception:  # noqa: BLE001
        try:
            from utils.audio import get_duration_seconds
            return get_duration_seconds(audio_path)
        except Exception:  # noqa: BLE001
            return 0.0


# ── Public API ────────────────────────────────────────────────────────────────

def transcribe_stream(
    audio_path: Path,
    model_name: Optional[str] = None,
    on_progress: Optional[Callable[[float], None]] = None,
) -> Iterator[RawSegment]:
    """
    Transcribe an audio file, yielding segments as Whisper produces them.

    Args:
        audio_path:  Path to a 16 kHz mono WAV.
        model_name:  Override the model from settings.
        on_progress: Optional callback receiving a 0–1 fraction of audio decoded.

    Yields:
        RawSegment objects in chronological order.
    """
    from utils.audio import ensure_ffmpeg
    ensure_ffmpeg()

    model_name = model_name or settings.whisper_model
    model = _get_model(model_name)
    duration = _get_audio_duration(audio_path)

    logger.info("Transcribing %s with model '%s' (%.0fs of audio)…", audio_path.name, model_name, duration)

    segments_iter, info = model.transcribe(
        str(audio_path),
        beam_size=max(1, int(settings.whisper_beam_size)),
        language="en",   # set None to enable (slower) auto-detection
        vad_filter=bool(settings.whisper_vad_filter),
        condition_on_previous_text=bool(settings.whisper_condition_on_previous_text),
    )

    count = 0
    for seg in segments_iter:
        text = (seg.text or "").strip()
        if not text:
            continue
        count += 1
        if on_progress and duration > 0:
            try:
                on_progress(min(1.0, float(seg.end) / duration))
            except Exception:  # noqa: BLE001
                pass
        yield RawSegment(text, float(seg.start), float(seg.end))

    lang = getattr(info, "language", "?")
    prob = getattr(info, "language_probability", 0.0) or 0.0
    logger.info(
        "Transcription complete: %d segments, detected language '%s' (prob=%.2f)",
        count, lang, float(prob),
    )
    if on_progress:
        try:
            on_progress(1.0)
        except Exception:  # noqa: BLE001
            pass


def transcribe(audio_path: Path, model_name: Optional[str] = None) -> List[RawSegment]:
    """Transcribe an audio file and return all segments (non-streaming wrapper)."""
    return list(transcribe_stream(audio_path, model_name=model_name))
