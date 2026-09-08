# Contributing to CMIS

## Development setup

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt                          # or requirements-ci.txt for tests only
cp .env.example .env
uvicorn main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

## Running the tests

```bash
cd backend
pytest tests/ -v
```

The tests mock Whisper and pyannote, so they run in a few seconds without any
model download.

## Where things live

| Area | Path |
|---|---|
| Transcription (upload + live) | `backend/ingestion/` |
| Decision / action-item extraction | `backend/nlp/intent.py` |
| Optional LLM extraction | `backend/nlp/llm_extractor.py` |
| Topic segmentation, summaries | `backend/nlp/topic_segmenter.py`, `backend/nlp/summarizer.py` |
| Report generation (docx / pptx / md) | `backend/reports/generator.py` |
| REST + WebSocket routes | `backend/routers/` |
| React pages | `frontend/src/pages/` |

## Pull requests

1. Branch from `main`, keep the change focused.
2. Add or update tests in `backend/tests/` for backend changes.
3. Run `pytest` and `npm run lint` before opening the PR.
4. Describe *why* in the PR body, not just what.

## Adding extraction rules

`nlp/intent.py` is regex-based on purpose (offline, deterministic). When a real
transcript produces a wrong decision or to-do:

1. Add the sentence as a test in `tests/test_intent.py` with the expected result.
2. Adjust the trigger pattern or the exclusion lists until the test passes
   without breaking the others.
