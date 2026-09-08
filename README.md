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
| **Phase 5.5** | Live transcript streaming, context-aware decision/to-do extraction, live microphone recording | ✅ Built (see [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)) |
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
2. **Upload** a recording — any meeting, lecture, or call you attended — or **Record Live** from the microphone while the meeting happens.
3. **Watch the transcript appear line by line** while CMIS is still transcribing; speaker labels update when diarization finishes, then decisions, action items and the summary are generated.
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
| `POST` | `/meetings/live` | Create a meeting to be recorded live from the microphone |
| `WS` | `/ws/live/{meeting_id}` | Stream 16 kHz mono int16 PCM frames into a live meeting (`{"type":"start"}` … audio … `{"type":"stop"}`) |
| `GET` | `/meetings/` | List your meetings |
| `GET` | `/meetings/{id}` | Meeting detail + status |
| `GET` | `/meetings/{id}/transcript` | Full speaker-labelled transcript |
| `GET` | `/context/{meeting_id}` | Structured context (topics, actions, decisions) |
| `GET` | `/context/action-items/open` | All your open action items across meetings |
| `PATCH` | `/context/action-items/{id}` | Resolve/reopen an action item |
| `GET` | `/insights/recurring-topics` | Your recurring topics with history |
| `WS` | `/ws/status/{meeting_id}` | Real-time event stream: `status` (with `progress`), `segments` (live transcript lines), `transcript_ready`, `context_ready` |

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

## How the transcript streams

```
faster-whisper generator ──► every 3 segments / 1.5 s ──► SQLite insert ──► WS "segments" event ──► dashboard
                                                                     │
                                          diarization runs afterwards, re-labels the rows ──► WS "transcript_ready"
```

* A client that connects late fetches what is already stored via `GET /meetings/{id}/transcript` and then receives the rest live.
* Tune with `TRANSCRIPT_FLUSH_SEGMENTS` / `TRANSCRIPT_FLUSH_SECONDS`.
* Speed knobs: `WHISPER_MODEL`, `WHISPER_BEAM_SIZE` (1 = fastest), `WHISPER_DEVICE=auto` (uses CUDA if available), `PRELOAD_MODELS=true` (models load at startup).

## Recording live from the microphone

The **Record Live** page captures the microphone in the browser, downsamples it to 16 kHz mono in an AudioWorklet and streams raw PCM frames to `WS /ws/live/{meeting_id}`. The backend cuts the audio at natural pauses (3–10 s chunks), transcribes each chunk with Whisper and publishes the lines on the normal status stream, so the transcript appears while people are still talking. Pressing **Stop** writes the WAV to `uploads/`, runs speaker diarization over the whole recording, re-labels the transcript, and runs the same decision / action-item / summary extraction as an upload.

Tune with `LIVE_MIN_CHUNK_SECONDS`, `LIVE_MAX_CHUNK_SECONDS`, `LIVE_SILENCE_RMS` and `LIVE_SILENCE_SECONDS`. Browsers only expose the microphone on `http://localhost` or HTTPS.

## How decisions and to-dos are extracted

`nlp/intent.py` classifies each sentence by what it *does* in the conversation rather than by keywords:

| Spoken | Result |
|---|---|
| "Let's go with Postgres for the main database." | **Decision:** Go with Postgres for the main database |
| "We agreed to postpone the launch to March because QA isn't done." | **Decision:** Postpone the launch to March — *why:* QA isn't done |
| "Should we use Redis?" / (other speaker) "Yeah, sounds good." | **Decision:** Use Redis |
| "We still need to decide on the vendor." | **To-do (open item):** Decide on the vendor |
| "Did we decide on the logo?" / "If we decide to…" | nothing (question / hypothetical) |
| "Karan, can you update the API docs before the demo?" | **To-do:** Update the API docs before the demo — owner Karan, due *before the demo* |
| "Can you set it up by Thursday?" / (Karan) "Sure, I'll do it." | **To-do:** Set up … by Thursday — owner Karan |
| "I'll be honest…", "I'll share my screen", "I already sent it yesterday" | nothing |

Every item stores the verbatim sentence it came from (shown as "Show source" in the UI), a confidence score, owner and deadline. Speaker labels are mapped to names from self-introductions ("Hi, this is Karan").

Set `NLP_ENGINE=llm` to use a language model instead (Claude via the Anthropic SDK, or a local Ollama model); the local engine is the automatic fallback.

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
