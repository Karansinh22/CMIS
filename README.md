# CMIS — Contextual Meeting Intelligence System

> An AI-powered personal tool that turns your meeting recordings into structured, persistent, queryable knowledge — and tracks recurring topics across all your meetings over time.

---

## What This Is

CMIS is a **single-user desktop/local tool**. You upload your own meeting recordings (work calls, lectures, interviews, stand-ups) and CMIS builds a personal knowledge base from them.

The transcription is just the input layer. The actual product is:

1. **Structured extraction** — typed objects (decisions, action items with urgency, topics) stored as queryable DB rows, not a wall of prose.
2. **Persistent personal context** — every meeting you upload writes to the same context store, so CMIS can say "this topic appeared in 3 of your previous meetings."
3. **Generation on demand** — once the context exists, MoM, summaries, and presentations are different *views* of the same data — no re-processing.

> **Single-user by design.** There is no account sharing, team workspaces, or meeting collaboration. CMIS is your personal meeting memory, running entirely on your own machine.

---

## Project Status

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Transcription & diarization pipeline | ✅ Built |
| **Phase 2** | NLP structuring (topics, actions, decisions, urgency) | ✅ Built |
| **Phase 3** | Context store (SQLite + CRUD layer) | ✅ Built |
| **Phase 4** | Recurring-topic detection (MinHash/LSH) | ✅ Built |
| **Phase 5** | User authentication (local account) | ✅ Built |
| Phase 6 | Report/presentation generation | 🔲 Planned |
| Phase 7 | Polish & testing | 🔲 Planned |

---

## Quick Setup

### 1. Prerequisites

- Python 3.10 or 3.11
- Node.js 18+
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

### 4. Start the backend

```bash
cd backend
uvicorn main:app --reload
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Swagger UI → **http://localhost:8000/docs**  
Dashboard → **http://localhost:5173**

---

## How You Use It

1. **Register** a local account (your personal data, stored on your machine only).
2. **Upload** a recording — any meeting, lecture, or call you attended.
3. **Wait** while CMIS transcribes, identifies speakers, and structures the content.
4. **Browse** your personal context: topics discussed, action items you need to act on, decisions made.
5. **Generate** a Minutes of Meeting document or summary on demand.
6. **Track** recurring topics that keep coming up across your different meetings over time.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Create your local account |
| `POST` | `/auth/login` | Log in, receive JWT token |
| `POST` | `/meetings/upload` | Upload audio, start processing |
| `GET` | `/meetings/` | List your meetings |
| `GET` | `/meetings/{id}` | Meeting detail + status |
| `GET` | `/meetings/{id}/transcript` | Full speaker-labelled transcript |
| `GET` | `/context/{meeting_id}` | Structured context (topics, actions, decisions) |
| `GET` | `/context/action-items/open` | All your open action items across meetings |
| `PATCH` | `/context/action-items/{id}` | Resolve/reopen an action item |
| `GET` | `/insights/recurring-topics` | Your recurring topics with history |
| `WS` | `/ws/status/{meeting_id}` | Real-time processing status stream |

---

## End-to-End Test

```bash
# 1. Upload a recording
curl -X POST "http://localhost:8000/meetings/upload" \
  -H "Authorization: Bearer <your_token>" \
  -F "file=@data/my_meeting.wav" \
  -F "title=Weekly Standup — Week 22"

# 2. Check status (or watch live via WebSocket)
curl "http://localhost:8000/meetings/<id>" \
  -H "Authorization: Bearer <your_token>"

# 3. View structured context
curl "http://localhost:8000/context/<id>" \
  -H "Authorization: Bearer <your_token>"

# 4. See all your open action items (cross-meeting)
curl "http://localhost:8000/context/action-items/open" \
  -H "Authorization: Bearer <your_token>"

# 5. Upload a second related meeting, then check recurring topics
curl "http://localhost:8000/insights/recurring-topics" \
  -H "Authorization: Bearer <your_token>"
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
[React Dashboard]  (Personal, runs locally)
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
    │       [datasketch MinHash/LSH]──> recurring topic detection (across your own meetings)
    │
    └── [SQLite]  ← your personal Context Store — the real product
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
│   ├── auth/              ← Local user auth (JWT)
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
│   │   ├── auth.py        ← /auth/* endpoints
│   │   └── ws.py          ← WebSocket /ws/status/{id}
│   ├── jobs/
│   │   └── worker.py      ← In-memory status tracker
│   └── utils/
│       ├── audio.py       ← WAV conversion helper
│       └── text.py        ← Text normalization helpers
├── data/                  ← Place your .wav/.mp3 recordings here
├── docs/                  ← Project documentation
├── frontend/              ← React dashboard (Vite)
├── docker-compose.yml
└── README.md
```

---

## Notes

- **HuggingFace token**: Required for pyannote diarization. Set `HF_TOKEN` in `.env`. Without it, diarization is skipped (all segments get `SPEAKER_00`).
- **ffmpeg**: Must be installed on the system PATH before running the server.
- **spaCy model**: Run `python -m spacy download en_core_web_sm` once after installing requirements.
- **SQLite**: The default and only database for this single-user tool — no PostgreSQL or cloud DB required.
- **Docker**: Use `docker-compose up` to run the backend in a container (includes ffmpeg).
- **Data privacy**: All your recordings and meeting data stay on your own machine. Nothing is sent to any external service except the optional HuggingFace token handshake for the diarization model.

---

## Team

| Member | Responsibility |
|---|---|
| Desai Karansinh (23IT402) | Transcription & diarization, backend architecture, auth |
| Krunalkumar Rohit (23IT419) | NLP structuring, topic segmentation, recurring-topic detection |
| Dev Chavda (23IT441) | Context store, DB schema, report generation (Phase 6) |
| Saksham Sharma (23IT553) | Dashboard frontend, testing, documentation |
