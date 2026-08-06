# CMIS — Build Specification & Implementation Guide
### Contextual Meeting Intelligence System — What It Should Be, and How to Build It Using Only Free Tools

---

## 1. The Vision — What This Project Actually Is

CMIS is not "a transcription app." The transcription is just the input layer. The actual product is:

> **A system that turns spoken discussion into structured, permanent, queryable knowledge — and can regenerate that knowledge into any document format on demand.**

The depth that makes this a real project (not a toy) comes from three ideas working together:

1. **Structured extraction, not just summarization.** Most tools give you a paragraph summary. CMIS extracts *typed* objects — decisions, action items (with owner + urgency), topics — so the output is queryable data, not prose you have to re-read.
2. **Persistent context across meetings, not per-session amnesia.** Every other tool treats each meeting as an island. CMIS keeps a running context store per project/team, so it can say "this is the third meeting this topic has come up" or "this action item from two weeks ago is still open."
3. **Generation on demand, not one fixed output.** Once the context exists, MoM, PPT, summary, and agenda are just different *views* of the same underlying data — not four separate manual writing tasks.

If you only build the transcription + a plain summary, you've built a Whisper wrapper. The three ideas above are what you actually need to implement for this to be defensible as "your project" and not "an API call."

---

## 2. What "Done" Looks Like (Definition of Success)

A working demo where you:
1. Upload a real recorded meeting (10–20 min, multiple speakers)
2. Watch it get transcribed with speaker labels
3. See it automatically broken into topics, with action items and decisions pulled out and tagged with urgency
4. Click a button and get a Word doc (MoM), a PPT, and a one-paragraph summary — all generated from the same underlying data, no re-processing
5. Upload a **second, related meeting** and see the system recognize a recurring topic from the first one

That fifth point is the one everyone else skips. It's also the one that makes your project genuinely different from Otter.ai/Fireflies. Protect it — don't let it fall off if you run low on time.

---

## 3. Hard Constraint: Free-Only Stack

Every tool below has a genuinely free tier or is fully open-source and self-hosted. Nothing here requires a credit card to start.

| Layer | Tool | Cost | Notes |
|---|---|---|---|
| Speech-to-Text | **faster-whisper** (self-hosted) | Free forever | Runs locally, no API key, no quota. Use the `small` or `medium` model — good accuracy/speed tradeoff on a laptop CPU |
| Speaker Diarization | **pyannote.audio** | Free (needs a free Hugging Face account + token) | Open weights, runs locally |
| NLP / Classification | **spaCy** + **scikit-learn** | Free forever | No API, no internet needed once installed |
| Sentence Embeddings | **sentence-transformers** (`all-MiniLM-L6-v2`) | Free forever | Runs locally, used for topic clustering & recurring-topic matching |
| Recurring-topic detection | **datasketch** (MinHash/LSH) | Free forever | Pure Python library |
| Backend | **FastAPI** | Free forever | Open-source |
| Frontend | **React (Vite) + Tailwind** | Free forever | Open-source |
| Database | **SQLite** (dev) → **PostgreSQL via Docker** (integration) | Free forever | No cloud account needed if you keep everything local |
| Real-time updates | **WebSockets** (built into FastAPI) | Free forever | No external service needed |
| Document generation | **python-docx**, **pptxgenjs** | Free forever | Open-source |
| Version control | **GitHub** | Free | Free private repos; get GitHub Student Pack for extras |
| Optional: better Indian-accent ASR | **Sarvam AI API** | Free tier (check current quota) | Use only as an *optional* swap-in, never as your only path — see §7 |

**Rule of thumb:** everything in the "self-hosted" column above runs entirely on your own laptop/Jetson with no internet connection required after setup. This means your demo can never fail due to a rate limit, an expired free trial, or spotty WiFi in a viva room.

---

## 4. Architecture (What Talks to What)

```
[React Dashboard]
        |  REST + WebSocket
        v
[FastAPI Backend] ---> [faster-whisper]  (transcription)
        |          ---> [pyannote.audio] (diarization)
        |          ---> [spaCy / scikit-learn] (topic + action-item + decision classification)
        |          ---> [sentence-transformers + datasketch] (recurring-topic detection)
        |
        v
[SQLite / PostgreSQL]  <-- the Context Store, the real product
        |
        v
[python-docx / pptxgenjs]  (generate MoM / PPT / summary / agenda on request)
```

Everything below the FastAPI layer runs as plain Python function calls — no microservices, no message queues needed at this scale. Don't over-architect it; a monolith is correct here.

---

## 5. Build Order (Do It In This Sequence)

Building this in the wrong order is the #1 way teams stall. Follow this exact sequence — each phase produces something demoable before you move to the next.

### Phase 1 — Get a transcript (Week 1–2)
- Install faster-whisper locally, run it on a 5-minute test recording, get a raw transcript out
- Add pyannote.audio, get speaker-labelled segments
- **Checkpoint:** you can feed in an audio file and get back `[{speaker: "Speaker 1", text: "...", start: 0.0, end: 4.2}, ...]`
- Do not touch NLP or the database yet. Get this rock-solid first — everything downstream depends on transcript quality.

### Phase 2 — Structure the transcript (Week 3–4)
- Topic segmentation: cluster transcript segments using sentence-transformers embeddings + simple clustering (KMeans or agglomerative) — group consecutive segments that are semantically similar
- Action-item/decision classification: start with a **rule-based + keyword classifier** (e.g., presence of "I'll", "let's", "we need to", modal verbs + a person's name) to get a baseline working fast, then upgrade to a trained scikit-learn classifier (logistic regression on TF-IDF or embedding features) once you've hand-labeled ~100–200 example sentences from your own test meetings
- Urgency scoring: simple 3-class classifier (low/medium/high) trained the same way
- **Checkpoint:** transcript in → structured JSON out (topics, action items with owners, decisions, urgency tags)

### Phase 3 — Context store (Week 4–5)
- Design the schema (see the ER diagram in your UML file) in SQLite first
- Write the save/query functions: store a processed meeting, retrieve past meetings, search across meetings
- **Checkpoint:** you can query "show me all open action items across all meetings"

### Phase 4 — Recurring-topic detection (Week 5)
- Use MinHash/LSH (datasketch) on topic text to detect near-duplicate topics across different meetings' context entries
- **Checkpoint:** upload two related test meetings, system flags "this topic appeared before"
- This is your novelty claim — don't skip it even if time is tight; cut something else instead

### Phase 5 — Generation layer (Week 6–7)
- Build one generator first (MoM as .docx using python-docx), get it fully working end-to-end
- Only then add the second format (PPT via pptxgenjs) — reuse the same context object, different renderer
- **Checkpoint:** click "Generate MoM" and "Generate PPT" for the same meeting, both come from the same context, no re-processing

### Phase 6 — Dashboard (Week 7–8)
- React frontend: upload page, meeting list, meeting detail view (transcript + extracted context), "generate report" buttons, simple action-item tracker view
- WebSocket for live status updates while a meeting is processing (queued → transcribing → structuring → done)

### Phase 7 — Polish & test (Week 8+)
- Test on real, messy recordings (not just clean solo audio) — this is where diarization and classification accuracy problems show up
- Write up known limitations honestly (accented speech accuracy, overlapping speech, classifier precision) — this strengthens your report, it doesn't weaken it

---

## 6. MVP vs Stretch — Know Your Fallback

If you're running out of time, this is your **non-negotiable MVP** (cut nothing below this line):

- ✅ Upload audio → transcript with speaker labels
- ✅ Topic segmentation
- ✅ Action item + decision extraction (rule-based is fine)
- ✅ Context store (even just SQLite, even just one table)
- ✅ Generate ONE output format (MoM as .docx)

Everything below this is **stretch, add if time allows**, roughly in priority order:
1. Recurring-topic detection across meetings (this is your differentiator — try hard to keep this)
2. Urgency scoring
3. Second output format (PPT)
4. Dashboard with search/trend view
5. Live/streaming transcription mode

---

## 7. About Sarvam AI (and any paid-adjacent API)

Sarvam AI's free tier is worth testing for Indian-accent accuracy, but treat it strictly as an **optional accuracy upgrade**, never a dependency:

- Build and test your entire pipeline against faster-whisper first
- If you want to compare, add a config flag that swaps the ASR engine (`ENGINE=whisper` vs `ENGINE=sarvam`) so switching is a one-line change, not a rewrite
- Never let your demo depend on an external API being up and within quota on the day you present

Same rule applies to any other "free tier" service (Supabase, Render, etc.) — fine for the shared/deployed version of your project, but your local demo path should never require the internet to work.

---

## 8. What Makes This Defensible in a Viva

Be ready to answer:
- **"Why not just use ChatGPT to summarize the transcript?"** → Because a single LLM call gives you a summary, not structured, queryable, persistent data. Your context store is the actual product; generation is just a rendering step on top of it.
- **"How is this different from Otter.ai/Fireflies?"** → Those tools treat each meeting as an isolated session. CMIS is the only one that links topics/action items across meetings into a running project memory (your recurring-topic detection is your evidence for this claim).
- **"What happens with bad audio / heavy accents / overlapping speech?"** → Be honest: diarization and ASR accuracy degrade, this is a known limitation you tested for and documented, not something you're hiding.

---

## 9. Quick Setup Checklist

```bash
# Backend
pip install faster-whisper pyannote.audio spacy scikit-learn sentence-transformers datasketch fastapi uvicorn python-docx pptxgenjs sqlalchemy

# spaCy model
python -m spacy download en_core_web_sm

# Frontend
npm create vite@latest cmis-frontend -- --template react
cd cmis-frontend && npm install tailwindcss

# Local Postgres (only needed once you integrate, skip for solo dev)
docker run --name cmis-db -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres
```

Everything above installs with no signup required except a free Hugging Face account (needed once, to accept pyannote's model license and get a token).
