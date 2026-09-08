# CMIS — Contextual Meeting Intelligence System

[![CI](https://github.com/Karansinh22/CMIS/actions/workflows/ci.yml/badge.svg)](https://github.com/Karansinh22/CMIS/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.10%20%7C%203.11-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

> Turn meeting recordings — uploaded or captured live from the microphone — into a
> structured, persistent, queryable knowledge base: transcript, speakers, topics,
> decisions, action items, summaries and downloadable Minutes of Meeting. Runs
> entirely on your own machine.

---

## Contents

1. [What it does](#what-it-does)
2. [Quick start](#quick-start)
3. [Using CMIS](#using-cmis)
4. [How it works](#how-it-works)
5. [Configuration](#configuration)
6. [API reference](#api-reference)
7. [Project layout](#project-layout)
8. [Testing](#testing)
9. [Roadmap & status](#roadmap--status)
10. [Team](#team)

---

## What it does

| Capability | Details |
|---|---|
| **Transcription** | faster-whisper, local, streamed line-by-line to the dashboard while the audio is still being processed. |
| **Live recording** | Record straight from the browser microphone; chunks are transcribed at natural pauses while you talk. |
| **Speaker labels** | pyannote.audio diarization (optional, needs a free HuggingFace token); labels are mapped to names from self-introductions. |
| **Decisions & action items** | Context/intent-aware extraction: *what a sentence does* in the conversation, not which keywords it contains. Owner, deadline, rationale, confidence and the verbatim source sentence are stored for every item. |
| **Topics & summaries** | Order-aware topic segmentation, extractive summaries at three depths (brief / balanced / comprehensive). |
| **Reports** | Minutes of Meeting (`.docx`), slide deck (`.pptx`) and Markdown, generated from the stored context — no re-processing. Project-level Word report across meetings. |
| **Cross-meeting memory** | Projects group meetings; MinHash/LSH flags recurring topics; open action items are tracked across all meetings. |
| **Optional LLM engine** | `NLP_ENGINE=llm` routes extraction to Claude (Anthropic SDK) or a local Ollama model, with automatic fallback to the offline engine. |

Everything in the default configuration works offline after the first model download.

---

## Quick start

### Prerequisites

- Python 3.10 or 3.11
- Node.js 18+ (20 recommended)
- [ffmpeg](https://ffmpeg.org/download.html) on the `PATH`
- Optional: a free [HuggingFace](https://huggingface.co) token for speaker diarization

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm               # optional, improves owner detection
cp .env.example .env                                   # set SECRET_KEY; HF_TOKEN if you want diarization
uvicorn main:app --reload
```

The server warms up the Whisper model in the background at startup; the log
prints `Whisper model 'small' ready` when it is done.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- Dashboard → http://localhost:5173
- Swagger UI → http://localhost:8000/docs

### Docker (backend only)

```bash
docker compose up
```

---

## Using CMIS

1. **Register** a local account and log in.
2. **Upload** a recording (`.mp3 .wav .m4a .mp4 .ogg .flac .webm`) **or** open **Record Live** and press *Start recording*.
3. **Watch the transcript appear** line by line. Speaker labels update when diarization finishes.
4. When processing completes, browse **Summary · Topics · Actions · Decisions**. Every extracted item has a *Show source* link to the sentence it came from.
5. Open **Reports** to download Minutes of Meeting (Word), a slide deck (PowerPoint) or Markdown.
6. Group meetings into a **Project** to get a cumulative summary, open items across meetings, recurring-topic flags and a project-wide report.

---

## How it works

```
Upload ──► ffmpeg ──► faster-whisper (generator) ──► every 3 lines / 1.5 s ──► SQLite ──► WS "segments"
Live mic ─► AudioWorklet 16 kHz PCM ─► WS /ws/live ─► pause-based chunks ─┘                     │
                                                                                                 ▼
                                                        pyannote diarization ─► relabel rows ─► WS "transcript_ready"
                                                                                                 │
                                                                                                 ▼
                 nlp/intent.py ─► decisions · action items · open items   (or nlp/llm_extractor.py)
                 nlp/topic_segmenter.py ─► ordered topics      nlp/summarizer.py ─► summary
                                                                                                 │
                                                                                                 ▼
                                                     SQLite context store ─► dashboard · reports/generator.py
```

### Transcript streaming

`ingestion/transcriber.py` exposes `transcribe_stream()`, a generator over Whisper
segments. `ingestion/pipeline.py` persists them in small batches and publishes
`segments` events on `/ws/status/{id}`. A client that connects late fetches what
is already stored over REST, then receives the rest live. Diarization runs after
the transcript is visible and re-labels the existing rows.

### Live microphone recording

`LivePage` captures the microphone, downsamples to 16 kHz mono in an AudioWorklet
and streams int16 PCM frames to `/ws/live/{id}`. `ingestion/live.py` cuts the
audio at pauses (3–10 s chunks, RMS silence detection), transcribes each chunk
with a time offset, and on *Stop* writes the WAV, diarizes, re-labels and runs
the same extraction as an upload.

### Decision and action-item extraction

`nlp/intent.py` classifies each sentence by its speech act and uses the
neighbouring turns:

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

Each item stores owner, deadline phrase, rationale (decisions), a 0–1 confidence
and the verbatim evidence sentence with its transcript position.

---

### Generated documents

Reports are built from the stored context, so they are instant and never re-process audio.

| Document | Contents |
|---|---|
| **Minutes of Meeting (.docx)** | Cover block, meeting-at-a-glance metrics, agenda with a topic timeline chart, executive summary, discussion by topic (with the decisions and actions raised in each), decisions table with rationale and timestamp, action-item register with priority/owner charts, open questions and a proposed agenda for the next meeting, participation table and speaking-time chart, approval/sign-off block, transcript appendix. Header, footer and page numbers included. |
| **Slide deck (.pptx)** | Title, agenda, at-a-glance tiles, executive summary, topic timeline, participation donut (native chart), one slide per topic, decisions, action-item charts and register with colour-coded priorities, open questions, next steps, closing. 16:9, editable in PowerPoint / Google Slides. |
| **Markdown (.md)** | The same sections as the Word document with tables; suitable for wikis, email and version control. |
| **Project report (.docx)** | Overall summary, meeting index, open action items across all meetings with charts, decisions by meeting. |

Speaker labels are replaced by real names when participants introduce themselves ("Hi, this is Karan") or when you rename a speaker.

## Configuration

All settings live in `backend/.env` (see `.env.example`). The ones that matter most:

| Variable | Default | Purpose |
|---|---|---|
| `WHISPER_MODEL` | `small` | `tiny` / `base` / `small` / `medium` / `large-v3`. `base` is 2–3× faster than `small` on a laptop CPU. |
| `WHISPER_DEVICE` | `auto` | `cuda` when faster-whisper sees a GPU, else `cpu`. |
| `WHISPER_BEAM_SIZE` | `1` | Greedy decoding; raise to 5 for maximum accuracy at ~2–3× the time. |
| `PRELOAD_MODELS` | `true` | Load Whisper (and pyannote) at startup. |
| `DIARIZATION_ENABLED` / `HF_TOKEN` | `true` / empty | Speaker labels need both; otherwise all lines are `SPEAKER_00`. |
| `TRANSCRIPT_FLUSH_SEGMENTS` / `_SECONDS` | `3` / `1.5` | How often live lines are written and pushed. |
| `LIVE_MIN_CHUNK_SECONDS` / `LIVE_MAX_CHUNK_SECONDS` | `3` / `10` | Chunking for microphone recording. |
| `NLP_ENGINE` | `local` | `llm` to use `LLM_PROVIDER` (`anthropic` or `ollama`) with local fallback. |
| `EXTRACTION_MIN_CONFIDENCE` | `0.45` | Drop extracted items below this confidence. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins for production. |
| `SECRET_KEY` | placeholder | **Change it.** JWT signing key. |

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register`, `/auth/login` | Local account, JWT tokens |
| `POST` | `/meetings/upload` | Upload audio, start processing |
| `POST` | `/meetings/live` | Create a meeting to be recorded live |
| `WS` | `/ws/live/{id}` | Stream 16 kHz mono int16 PCM (`{"type":"start"}` … audio … `{"type":"stop"}`) |
| `WS` | `/ws/status/{id}` | Events: `status` (with `progress`), `segments`, `transcript_ready`, `context_ready` |
| `GET` | `/meetings/`, `/meetings/{id}`, `/meetings/{id}/transcript` | Meetings and speaker-labelled transcript |
| `PATCH` | `/meetings/{id}/transcript/{segment_id}` | Edit a line (audit history kept) |
| `GET` | `/context/{id}` | Topics, action items, decisions, summary |
| `GET` / `PATCH` | `/context/action-items/open`, `/context/action-items/{id}` | Cross-meeting open items; resolve / edit |
| `POST` | `/meetings/{id}/reports?format=docx\|pptx\|md` | Generate a report from the context store |
| `GET` | `/meetings/{id}/reports`, `/reports/{report_id}/download` | List and download reports |
| `POST` | `/projects/{id}/reports` | Project-wide Word report |
| `GET` | `/insights/recurring-topics` | Recurring topics with history |

Full interactive documentation at `/docs`.

---

## Project layout

```
CMIS/
├── backend/
│   ├── main.py                 FastAPI app (lifespan, routers, CORS)
│   ├── config.py               Settings (pydantic-settings, .env)
│   ├── auth/                   JWT + bcrypt local accounts
│   ├── db/                     SQLAlchemy models, CRUD, schemas, migrations
│   ├── ingestion/
│   │   ├── transcriber.py      faster-whisper streaming wrapper
│   │   ├── diarizer.py         pyannote wrapper + merge
│   │   ├── pipeline.py         upload ingestion (incremental persistence)
│   │   └── live.py             live microphone sessions
│   ├── nlp/
│   │   ├── intent.py           context/intent-aware extraction
│   │   ├── llm_extractor.py    optional Claude / Ollama engine
│   │   ├── topic_segmenter.py  order-aware topic segmentation
│   │   ├── summarizer.py       extractive summaries
│   │   ├── recurring.py        MinHash/LSH recurring topics
│   │   └── pipeline.py         NLP orchestrator
│   ├── reports/generator.py    .docx / .pptx / .md generation
│   ├── routers/                REST + WebSocket endpoints
│   ├── jobs/worker.py          thread-safe event bus for WebSockets
│   └── tests/                  pytest suite (models mocked)
├── frontend/                   React 19 + Vite + Tailwind dashboard
├── docs/                       Build spec, UML, NEXT_STEPS roadmap
├── .github/workflows/ci.yml    pytest + frontend lint/build
└── docker-compose.yml
```

---

## Testing

```bash
cd backend
pip install -r requirements-ci.txt     # light set, no ML weights
pytest tests/ -v
```

Whisper and pyannote are mocked, so the suite runs in seconds. It covers the
streaming pipeline, live chunking and WebSocket protocol, the extraction engine
(behavioural cases), report generation and the REST API.

---

## Roadmap & status

| Phase | Description | Status |
|---|---|---|
| 1 | Transcription & diarization | ✅ |
| 2 | NLP structuring (topics, actions, decisions, urgency) | ✅ rebuilt as intent engine |
| 3 | Context store (SQLite + CRUD) | ✅ |
| 4 | Recurring-topic detection (MinHash/LSH) | ✅ |
| 5 | Local authentication | ✅ |
| 5.5 | Live transcript streaming, live microphone recording | ✅ |
| 6 | Report generation (.docx / .pptx / .md, project report) | ✅ |
| 7 | Polish & testing | 🔄 CI, tests, docs in place — see [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) |

See [CHANGELOG.md](CHANGELOG.md) for release notes and [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

---

## Team

| Member | Responsibility |
|---|---|
| Desai Karansinh (23IT402) | Transcription & diarization, backend architecture, auth |
| Krunalkumar Rohit (23IT419) | NLP structuring, topic segmentation, recurring-topic detection |
| Dev Chavda (23IT441) | Context store, DB schema, report generation |
| Saksham Sharma (23IT553) | Dashboard frontend, testing, documentation |

Licensed under the [MIT License](LICENSE).
