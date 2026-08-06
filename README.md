# CMIS — Contextual Meeting Intelligence System

> An AI-powered backend that transforms meeting recordings into structured, persistent, queryable knowledge — and detects recurring topics across multiple meetings.

---

## What This Is

CMIS is not "a transcription app." The transcription is the input layer. The actual product is:

1. **Structured extraction** — typed objects (decisions, action items with owner + urgency, topics) stored as queryable DB rows, not a wall of prose.
2. **Persistent context across meetings** — every meeting writes to the same context store so CMIS can say "this topic appeared in 3 previous meetings."
3. **Generation on demand** — once the context exists, MoM, PPT, and summaries are different *views* of the same data (Phase 5).

---

## Project Status

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Transcription & diarization pipeline | ✅ Built |
| **Phase 2** | NLP structuring (topics, actions, decisions, urgency) | ✅ Built |
| **Phase 3** | Context store (SQLite + CRUD layer) | ✅ Built |
| **Phase 4** | Recurring-topic detection (MinHash/LSH) | ✅ Built |
| Phase 5 | Report/presentation generation | 🔲 Planned |
| Phase 6 | React dashboard frontend | 🔲 Planned |
| Phase 7 | Polish & testing | 🔲 Planned |

---

## Quick Setup

### 1. Prerequisites

- Python 3.10 or 3.11
- [ffmpeg](https://ffmpeg.org/download.html) installed and in PATH
- (Optional) A free [HuggingFace](https://huggingface.co) account + token for speaker diarization

### 2. Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum, set HF_TOKEN if you want diarization
```

### 4. Start the server

```bash
cd backend
uvicorn main:app --reload
```

Swagger UI → **http://localhost:8000/docs**

---

## API Reference (50% milestone)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/meetings/upload` | Upload audio, start processing |
| `GET` | `/meetings/` | List all meetings |
| `GET` | `/meetings/{id}` | Meeting detail + status |
| `GET` | `/meetings/{id}/transcript` | Full speaker-labelled transcript |
| `GET` | `/context/{meeting_id}` | Structured context (topics, actions, decisions) |
| `GET` | `/context/action-items/open` | All open action items across meetings |
| `PATCH` | `/context/action-items/{id}` | Resolve/reopen an action item |
| `GET` | `/insights/recurring-topics` | All recurring topics with history |
| `WS` | `/ws/status/{meeting_id}` | Real-time processing status stream |

---

## End-to-End Test

```bash
# 1. Upload a meeting recording
curl -X POST "http://localhost:8000/meetings/upload" \
  -F "file=@data/test_meeting.wav" \
  -F "title=Sprint Planning — Week 22"

# 2. Check status (or watch live via WebSocket)
curl "http://localhost:8000/meetings/<id>"

# 3. View structured context
curl "http://localhost:8000/context/<id>"

# 4. See all open action items (cross-meeting)
curl "http://localhost:8000/context/action-items/open"

# 5. Upload a second related meeting, then check recurring topics
curl "http://localhost:8000/insights/recurring-topics"
```

---

## Running Tests

```bash
cd backend
pytest tests/ -v
```

Tests are designed to run without downloading any ML models — they mock the model layer and test the pipeline logic directly.

---

## Architecture

```
[React Dashboard]  (Phase 6)
        |  REST + WebSocket
        v
[FastAPI Backend]
    ├── POST /meetings/upload ──> [Audio Validator] ──> [faster-whisper] ──> [pyannote.audio]
    │                                                                              |
    │                                                        Speaker-labelled transcript
    │                                                              saved to DB
    │
    ├── Background NLP pipeline:
    │       [sentence-transformers] ──> topic clusters
    │       [spaCy + rule-based]    ──> action items + decisions
    │       [urgency scorer]        ──> low / medium / high
    │       [datasketch MinHash/LSH]──> recurring topic detection
    │
    └── [SQLite / PostgreSQL]  ← the Context Store — the real product
```

---

## File Structure

```
CMIS/
├── backend/
│   ├── main.py            ← FastAPI app entrypoint
│   ├── config.py          ← Settings (pydantic-settings)
│   ├── requirements.txt
│   ├── .env.example
│   ├── Dockerfile
│   ├── db/
│   │   ├── database.py    ← SQLAlchemy engine + session
│   │   ├── models.py      ← ORM models (ER diagram)
│   │   ├── crud.py        ← CRUD helpers
│   │   └── schemas.py     ← Pydantic v2 schemas
│   ├── ingestion/
│   │   ├── validator.py   ← Format check + ffmpeg extraction
│   │   ├── transcriber.py ← faster-whisper wrapper
│   │   ├── diarizer.py    ← pyannote.audio wrapper + merge
│   │   └── pipeline.py    ← Ingestion orchestrator
│   ├── nlp/
│   │   ├── topic_segmenter.py  ← sentence-transformers clustering
│   │   ├── classifier.py       ← rule-based + ML classifier
│   │   ├── urgency_scorer.py   ← 3-class urgency (low/medium/high)
│   │   ├── owner_extractor.py  ← spaCy NER owner extraction
│   │   ├── recurring.py        ← MinHash/LSH recurring detection
│   │   └── pipeline.py         ← NLP orchestrator
│   ├── routers/
│   │   ├── meetings.py    ← /meetings/* endpoints
│   │   ├── context.py     ← /context/* endpoints
│   │   ├── insights.py    ← /insights/* endpoints
│   │   └── ws.py          ← WebSocket /ws/status/{id}
│   ├── jobs/
│   │   └── worker.py      ← In-memory status tracker
│   ├── utils/
│   │   ├── audio.py       ← WAV conversion helper
│   │   └── text.py        ← Text normalization helpers
│   └── tests/
│       ├── conftest.py
│       ├── test_transcription.py
│       ├── test_nlp.py
│       └── test_recurring.py
├── data/                  ← Place sample .wav/.mp3 files here
├── docs/                  ← Project documentation
├── frontend/              ← React dashboard (Phase 6)
├── docker-compose.yml
└── README.md
```

---

## Notes

- **HuggingFace token**: Required for pyannote diarization. Set `HF_TOKEN` in `.env`. Without it, diarization is skipped (all segments get `SPEAKER_00`).
- **ffmpeg**: Must be installed on the system PATH before running the server.
- **spaCy model**: Run `python -m spacy download en_core_web_sm` once after installing requirements.
- **SQLite vs PostgreSQL**: SQLite is the default for local dev. Switch by setting `DATABASE_URL=postgresql://...` in `.env`.
- **Docker**: Use `docker-compose up` to run the backend in a container (includes ffmpeg).

---

## Team

| Member | Responsibility |
|---|---|
| Desai Karansinh (23IT402) | Transcription & diarization, backend architecture |
| Krunalkumar Rohit (23IT419) | NLP structuring, topic segmentation, recurring-topic detection |
| Dev Chavda (23IT441) | Context store, DB schema, report generation (Phase 5) |
| Saksham Sharma (23IT553) | Dashboard frontend (Phase 6), testing, documentation |
