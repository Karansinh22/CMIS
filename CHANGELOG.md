# Changelog

All notable changes to CMIS are documented here.

## [0.2.0] — 2026-09-09

### Added
- **Live transcript streaming** — Whisper segments are persisted and pushed to the
  dashboard while the audio is still being transcribed; progress shown as % of audio.
- **Live microphone recording** (`/live`) — browser streams 16 kHz PCM over WebSocket,
  chunks are transcribed at natural pauses, and the same extraction runs on stop.
- **Context/intent-aware extraction** (`nlp/intent.py`) replacing the keyword classifier:
  decisions, action items with owner/deadline/rationale/evidence/confidence,
  open items, speaker-name inference. Optional LLM engine (Anthropic / Ollama).
- **Order-aware topic segmentation** (TextTiling-style) with distinctive-term titles.
- **Phase 6 reports** — Minutes of Meeting (.docx), slide deck (.pptx) and Markdown
  generated from the context store; project-level Word report.
- Reports tab, evidence quotes, due dates and confidence chips in the UI.
- CI workflow (pytest + frontend lint/build), CONTRIBUTING, LICENSE, EditorConfig.

### Changed
- Whisper defaults: greedy decoding, auto GPU, all CPU threads, model warm-up at startup,
  no 3-minute ffmpeg chunking.
- Ingestion now ends in `structuring` (fixes the socket closing before NLP results).
- SQLite journal files are no longer tracked.

### Fixed
- Cross-thread WebSocket publishing now uses `call_soon_threadsafe`.
- Meeting page kept an empty summary during processing; it now opens the live transcript.

## [0.1.0] — 2026-08

Initial release: upload → transcribe → diarize → keyword classification → context store,
recurring-topic detection, local auth, React dashboard.
