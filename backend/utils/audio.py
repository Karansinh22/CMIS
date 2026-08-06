"""
utils/audio.py — Audio format conversion helpers.

Converts any ffmpeg-decodable audio to 16 kHz mono WAV — the format
required by both faster-whisper and pyannote.audio.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def ensure_ffmpeg() -> str | None:
    """Ensure ffmpeg is in PATH, using imageio-ffmpeg as fallback if system ffmpeg is missing."""
    if shutil.which("ffmpeg"):
        return shutil.which("ffmpeg")
    try:
        import imageio_ffmpeg
        exe = Path(imageio_ffmpeg.get_ffmpeg_exe())
        if exe.exists():
            bin_dir = exe.parent
            target = bin_dir / "ffmpeg.exe"
            if not target.exists():
                shutil.copy(exe, target)
            os.environ["PATH"] = str(bin_dir) + os.path.pathsep + os.environ.get("PATH", "")
            return str(target)
    except Exception as exc:
        logger.warning("Could not auto-configure ffmpeg: %s", exc)
    return None


# Run on module import
ensure_ffmpeg()


def to_wav_16k_mono(source_path: Path, output_dir: Path) -> Path:
    """
    Convert an audio file to 16 kHz mono PCM WAV using ffmpeg (subprocess).

    If the file is already a .wav and named with '_16k' suffix we skip
    conversion to avoid redundant work.

    Args:
        source_path: Path to the source audio file.
        output_dir:  Directory where the converted file will be saved.

    Returns:
        Path to the converted WAV file.

    Raises:
        RuntimeError: if ffmpeg is not installed or conversion fails.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / (source_path.stem + "_16k.wav")

    if out_path.exists():
        logger.debug("Reusing cached WAV: %s", out_path)
        return out_path

    ffmpeg_path = ensure_ffmpeg() or "ffmpeg"
    cmd = [
        ffmpeg_path,
        "-y",                    # overwrite without prompting
        "-i", str(source_path),
        "-ar", "16000",          # sample rate 16 kHz
        "-ac", "1",              # mono
        "-acodec", "pcm_s16le",  # 16-bit PCM
        str(out_path),
    ]

    logger.info("Converting %s → %s", source_path.name, out_path.name)
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
        )
    except FileNotFoundError:
        raise RuntimeError(
            "ffmpeg not found in PATH. Install it from https://ffmpeg.org/download.html "
            "and ensure it is accessible from the command line."
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            f"ffmpeg conversion failed for {source_path.name}:\n{exc.stderr}"
        ) from exc

    logger.info("Conversion complete: %s", out_path)
    return out_path


def get_duration_seconds(audio_path: Path) -> float:
    """
    Return the duration of an audio file in seconds using ffprobe.
    Returns 0.0 if ffprobe is unavailable or the file can't be probed.
    """
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(audio_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(result.stdout.strip())
    except Exception:
        return 0.0
