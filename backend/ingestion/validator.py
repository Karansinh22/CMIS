"""
validator.py — Validates uploaded audio/video files and extracts audio streams.

Accepted containers: .mp3, .wav, .m4a, .mp4, .ogg, .flac, .webm
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Optional

ALLOWED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".ogg", ".flac", ".webm"}
VIDEO_EXTENSIONS = {".mp4", ".webm"}  # need ffmpeg audio extraction


class InvalidAudioError(ValueError):
    """Raised when an uploaded file cannot be processed."""


def validate_extension(filename: str) -> str:
    """
    Check the file extension is in the allowed list.
    Returns the extension (lowercase) on success.
    Raises InvalidAudioError otherwise.
    """
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise InvalidAudioError(
            f"Unsupported file type '{ext}'. "
            f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
    return ext


def extract_audio_if_video(source_path: Path, output_dir: Path) -> Path:
    """
    If the file is a video container, use ffmpeg-python to extract the audio
    stream as a .wav file.  Pure audio files are returned as-is.

    Returns the path to the audio file (may be the same as source_path).
    Raises InvalidAudioError if ffmpeg extraction fails.
    """
    ext = source_path.suffix.lower()
    if ext not in VIDEO_EXTENSIONS:
        return source_path  # already audio

    try:
        import ffmpeg  # ffmpeg-python
    except ImportError:
        raise InvalidAudioError(
            "ffmpeg-python is not installed. Cannot extract audio from video. "
            "Install it with: pip install ffmpeg-python"
        )

    out_path = output_dir / (source_path.stem + "_audio.wav")
    try:
        (
            ffmpeg
            .input(str(source_path))
            .output(str(out_path), acodec="pcm_s16le", ar=16000, ac=1)
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as exc:
        raise InvalidAudioError(f"ffmpeg extraction failed: {exc.stderr.decode()}") from exc

    return out_path


def validate_and_prepare(source_path: Path, upload_dir: Path) -> Path:
    """
    Full validation + preparation pipeline:
    1. Check extension
    2. Extract audio stream if video container
    Returns path to an audio file ready for transcription.
    """
    validate_extension(source_path.name)
    return extract_audio_if_video(source_path, upload_dir)
