# CMIS — Next Steps Plan

_Last updated: 9 September 2026 (on `main`)_

This document records what was wrong at the panel demo, what has been changed
to fix it, how to verify the fix on the demo laptop, and the prioritised
roadmap from here.

---

## 1. What went wrong at the demo

| Symptom | Root cause found in the code |
|---|---|
| 5–7 minute wait, then the whole transcript at once | `transcribe()` collected every Whisper segment into a list, then diarization ran, then everything was written to the DB in one `bulk_create_segments`. The UI only fetched the transcript after the status turned `done`. |
| Slow transcription | `beam_size=3`, device hard-coded to `cpu`, single-file decode conditioned on previous text (repetition-loop risk), model loaded lazily on the first upload, audio split into 3-minute ffmpeg chunks (cut mid-word, no context across cuts). |
| Status bar stuck / no progress | Status events only had a stage name; no fraction of audio processed. |
| Meeting page stopped updating | Ingestion set the status to `done` before the NLP stage started; the front end closed the socket on `done` and never saw the NLP result. |
| "Decisions" were nonsense | `classifier.py` scored keyword hits: any sentence containing *decide/agree* became a decision — including "we still need to decide", "did we decide?", "if we decide…". |
| To-dos were vague | Any sentence with *will/need to* became an action item verbatim ("I'll be honest…", "we have to be careful"); owner fell back to `SPEAKER_00`; no deadline, no evidence. |

## 2. What changed

### 2.1 Live transcript streaming

* `ingestion/transcriber.py` — `transcribe_stream()` is a generator that yields
  each Whisper segment as it is decoded and reports progress (seconds decoded /
  total). `transcribe()` still exists for callers that want a list.
* `ingestion/pipeline.py` — segments are written to the DB every 3 segments or
  1.5 s (configurable) with a provisional speaker and pushed to WebSocket
  clients as `segments` events. Diarization runs **after** the transcript is
  already visible and re-labels the persisted rows, then sends
  `transcript_ready`. Ingestion ends in `structuring`, never `done`.
* `jobs/worker.py` — thread-safe event bus (`loop.call_soon_threadsafe`) with
  typed events: `status` (with `progress`), `segments`, `transcript_ready`,
  `context_ready`.
* `routers/ws.py` — forwards all event types; closes only on `done`/`error`.
* Front end — `useStatusSocket` forwards typed events; new `LiveTranscript`
  component on the Upload page and Meeting page shows lines as they arrive with
  a % progress; `ProcessingStatus` bar uses real progress; the meeting page
  auto-opens the Transcript tab while transcribing and refreshes speaker
  labels when diarization finishes.

### 2.2 Transcription speed

| Setting (`.env`) | Old | New default | Effect |
|---|---|---|---|
| `WHISPER_BEAM_SIZE` | 3 (hard-coded) | 1 | ~2× faster decoding |
| `WHISPER_DEVICE` | cpu (hard-coded) | auto | uses CUDA when faster-whisper sees a GPU |
| `WHISPER_CPU_THREADS` | library default | all cores | better CPU utilisation |
| `WHISPER_CONDITION_ON_PREVIOUS_TEXT` | true | false | avoids repetition loops on long audio |
| `PRELOAD_MODELS` | — | true | Whisper (and pyannote) load at server start, not on first upload |
| 3-minute ffmpeg chunking | on | removed | faster-whisper handles long files itself |

### 2.3 Context/intent-aware NLP (`nlp/intent.py`)

The keyword classifier is replaced by a speech-act engine that looks at what a
sentence *does* and at the surrounding turns:

* Decisions: "let's go with X", "we agreed to X", "it was decided that X",
  proposal by one speaker + acceptance by another. Questions, hypotheticals,
  hedges and negations are excluded. "We still need to decide on X" becomes an
  **open item** to-do ("Decide on X"), not a decision.
* Action items: first-person commitments (owner = speaker), third-person
  assignments (owner = named person), requests ("Karan, can you…", "please…",
  "can someone…") with owner resolved from the vocative, the responder who says
  "sure, I'll do it", or the other speaker in a two-person meeting.
  In-meeting talk ("I'll share my screen"), finished work ("I already sent it")
  and hedged musings ("maybe we could…") are dropped.
* Every item is rewritten as a clean imperative ("Send the deck to the client
  by Friday"), with owner, deadline phrase, rationale (for decisions),
  confidence, the verbatim evidence sentence and the transcript segment index.
* Speaker labels are mapped to real names from self-introductions ("Hi, this is
  Karan").
* `nlp/classifier.py` keeps its `classify()` API for backwards compatibility.
* Optional `NLP_ENGINE=llm` (`nlp/llm_extractor.py`) sends the transcript to
  Claude (Anthropic SDK, structured output) or a local Ollama model and falls
  back to the local engine on any failure.

DB: `action_items` gained `due`, `evidence`, `confidence`, `segment_index`;
`decisions` gained `rationale`, `evidence`, `confidence`, `segment_index`.
Existing SQLite files are migrated automatically at startup.

Tests: `tests/test_intent.py` (31 behavioural cases) and
`tests/test_streaming.py` (incremental persistence, progress, re-labelling).

### 2.4 Live microphone recording (Phase 5.5 complete)

* `POST /meetings/live` creates a meeting with `source = "live"`;
  `WS /ws/live/{id}` accepts 16 kHz mono int16 PCM frames.
* `ingestion/live.py` — `LiveSession` buffers audio, cuts chunks at pauses
  (RMS silence detection, 3–10 s), transcribes each chunk in a worker thread
  with `transcribe_stream(np.ndarray, time_offset=…)` and reuses
  `persist_segments` / `relabel_with_diarization` from the upload pipeline.
  On stop it writes the WAV, diarizes, re-labels and runs `run_nlp`.
* Front end — `LivePage.jsx` (`/live`, "Record Live" in the sidebar): AudioWorklet
  downsampler, level meter, live transcript, stop → processing → report.
* Tests — `tests/test_live.py` covers pause-based chunking and the whole
  WebSocket protocol through to `status = done` with Whisper mocked.

## 3. Verify on the demo laptop (do this first)

```bash
cd backend
pip install -r requirements.txt          # unchanged deps
cp .env.example .env                     # review the new settings
uvicorn main:app --reload                # watch for "Whisper model 'small' ready"
cd ../frontend && npm install && npm run dev
```

1. Upload a real 10–15 minute recording. Lines must start appearing within a
   few seconds of "Transcribing audio…" on both the Upload page and the meeting
   page. The stage badge shows "% of audio".
2. When diarization finishes, speaker chips change from `SPEAKER_00` to the
   real labels without a reload.
3. The Actions tab shows owner, deadline, and "Show source" quotes. The
   Decisions tab shows "Why:" where a reason was spoken.
4. Open **Record Live**, allow the microphone, talk for a minute with a pause or
   two, press Stop. Lines should appear within ~3–5 s of being spoken; after
   Stop the Actions/Decisions tabs fill in.
5. `pytest tests/ -v` — `test_projects::test_create_and_list_projects` fails on
   `main` as well (the list endpoint requires a logged-in user); everything
   else passes.

Demo-day settings to consider in `.env`:

* `WHISPER_MODEL=base` if the laptop is slow (2–3× faster than `small`,
  slightly worse accuracy); keep `small` if it already keeps up.
* `DIARIZATION_ENABLED=false` if pyannote takes minutes on CPU — the
  transcript is already visible, but the speaker relabel step is what delays
  the NLP stage.
* Start the server a minute before the demo so the model warm-up has finished.

## 4. Roadmap

### P0 — before the next demo
- [ ] Run the verification above with the recordings used at the panel.
- [ ] Build a small labelled evaluation set (100–150 sentences from your own
      recordings, tagged decision / to-do / neither) and record precision and
      recall of `nlp.intent` on it. Add the misses as tests in
      `tests/test_intent.py`; extend the trigger patterns where needed.
- [ ] Speaker naming UI: let the user rename `SPEAKER_01` → "Priya" on the
      meeting page and re-run extraction so owners use real names
      (`Speaker.name` is already stored and already used by the engine).

### P1 — product completeness (Phase 6 in the build spec)
- [ ] Minutes-of-Meeting `.docx` and one-paragraph summary generated from the
      context store (python-docx is already in requirements).
- [ ] Editable action items (description, due date) and "open questions"
      section in the UI; mark decisions as superseded.
- [ ] Run diarization concurrently with transcription in a second thread when a
      GPU is present (CPU-only machines should keep the sequential order).
- [ ] Live recording: pause/resume, reconnect after a dropped WebSocket (the
      server already keeps the session alive and finalises on disconnect), and
      a system-audio option for online calls (browser tab capture).
- [ ] Use sentence-transformers embeddings (already a dependency, currently
      unused) for topic segmentation and recurring-topic matching instead of
      TF-IDF; makes recurring detection tolerant to paraphrase.

### P2 — quality and robustness
- [ ] Try `NLP_ENGINE=llm` with a local Ollama model for the demo machine that
      has a GPU; compare against the local engine on the evaluation set.
- [ ] Abstractive summary from the extracted structure instead of the
      TF-IDF extractive template.
- [ ] Fix `GET /projects` for unauthenticated dev sessions (or make the test log
      in), migrate `@app.on_event` to a lifespan handler, add an auth check on
      the WebSocket endpoint.
- [ ] Drop unused heavy dependencies from `requirements.txt` (or split them into
      `requirements-ml.txt`) so a fresh install is faster on a laptop.

### P3 — engineering hygiene
- [ ] GitHub Actions running `pytest` (models are mocked, so it is fast).
- [ ] Docker image with CUDA variant for GPU laptops.
- [ ] Persist job status in SQLite so a server restart doesn't lose the
      "transcribing" state shown to clients.
