# Contextual Meeting Intelligence System (CMIS)

**Project – I (4IT31)**
**Team:** Desai Karansinh (23IT402) · Krunalkumar Rohit (23IT419) · Dev Chavda (23IT441) · Saksham Sharma (23IT553)

---

## 1. Project Definition

CMIS is an AI-powered platform that listens to meetings, calls, and lectures, converts them into structured, persistent context — topics, decisions, action items, and urgency — and generates minutes of meeting, summaries, presentations, and agendas on demand from that shared context. Unlike a plain transcription tool, CMIS retains context across multiple related meetings so recurring discussion points and outstanding action items can be tracked automatically over time.

---

## 2. Problem Statement

Meeting documentation today is manual, inconsistent, and disposable — someone types notes during the meeting (or nobody does), the notes live in one person's inbox, and nothing connects one meeting to the next. Action items get lost, decisions get re-litigated, and producing a summary or slide deck afterward means starting from scratch. CMIS solves this by treating "what was discussed" as structured, reusable data rather than a one-off text file.

---

## 3. Objectives

### Primary Objective
Develop an AI-based system that automatically transcribes, structures, and summarizes meetings, calls, and lectures, and generates multiple documentation formats from a single, persistent understanding of the discussion.

### Specific Objectives
- Convert recorded or live meeting audio into an accurate, speaker-labelled transcript
- Segment transcripts into topics and identify recurring discussion points
- Extract action items, decisions, and urgency levels from natural conversation
- Maintain a persistent, searchable context store across multiple meetings
- Automatically generate minutes of meeting, summaries, and presentations on demand

---

## 4. Scope

**In scope:**
- Post-session processing of recorded/uploaded audio (meetings, calls, lectures)
- English and commonly used Indian-accented speech; limited regional-language support depending on the speech engine
- Speaker diarization (voice-based labelling, e.g., Speaker 1, Speaker 2)
- Multi-format output generation from one shared context

**Out of scope (current phase):**
- Live, real-time transcription during an ongoing session (future extension)
- Video analysis, facial recognition, or biometric speaker identification
- Real-time translation across languages

---

## 5. System Modules

| # | Module | Responsibility |
|---|---|---|
| 1 | **Audio Ingestion** | Accepts uploaded/recorded audio or video, validates format, extracts audio stream, captures session metadata |
| 2 | **Transcription & Diarization** | Converts audio to a time-aligned, speaker-labelled transcript using an ASR engine |
| 3 | **NLP Structuring** | Topic segmentation, action-item/decision classification, urgency scoring, recurring-topic detection (LSH) |
| 4 | **Context Store** | Persistent, queryable database of every processed meeting's structured context |
| 5 | **Report & Presentation Generation** | Produces MoM, summaries, agendas, and slide decks on demand from the context store |
| 6 | **Dashboard & Visualization** | User interface to browse meetings, search context, track action-item status, view statistics |

---

## 6. Technology Stack

### Core (fully free & open-source)

| Layer | Technology | License |
|---|---|---|
| Speech-to-Text | Whisper / faster-whisper (self-hosted) | MIT |
| Speaker Diarization | pyannote.audio | MIT |
| NLP / Classification | spaCy, scikit-learn | MIT / BSD |
| Embeddings & Similarity | sentence-transformers | Apache 2.0 |
| Recurring-topic detection | datasketch (MinHash/LSH) | MIT |
| Backend | FastAPI | MIT |
| Frontend | React (Vite) + Tailwind CSS | MIT |
| Database (dev) | SQLite | Public Domain |
| Database (integrated/deployed) | PostgreSQL | PostgreSQL License |
| Real-time comms | WebSockets + Redis | BSD |
| Document/Slide generation | python-docx, pptxgenjs | MIT |
| Containerization | Docker + Docker Compose | Free (individual/student use) |
| Version control | Git + GitHub | Free |

### Optional free-tier services

| Tool | Purpose | Note |
|---|---|---|
| Sarvam AI | Improved Indian-accent/regional-language transcription | Free tier with quota limits — evaluated alternative, not core dependency |
| Google Colab | Free GPU for model testing | Session/GPU limits apply |
| Supabase / Neon | Free managed cloud PostgreSQL for shared team database | Free tier storage cap |
| Render / Railway | Free hosting for demo deployment | Sleeps on inactivity |

---

## 7. Database Strategy

- **Local development:** SQLite — zero setup, file-based, ideal while each member builds/tests their module independently
- **Team integration / deployment:** PostgreSQL (via Docker locally, or Supabase/Neon free tier for a shared cloud instance) — required once multiple modules read/write concurrently

---

## 8. Project Basic Requirements

**Software:**
- OS: Windows 10 / Ubuntu 22.04
- Languages: Python, JavaScript
- IDE: VS Code / Jupyter Notebook

**Hardware:**
- Standard laptop/desktop (webcam/GPU not required; a modest GPU speeds up transcription of long recordings but is optional)

---

## 9. Feasibility Study

| Aspect | Assessment |
|---|---|
| **Technical** | Feasible — mature open-source ASR (Whisper), NLP (spaCy, scikit-learn), and web frameworks (FastAPI, React) are well-documented and require no specialized hardware |
| **Economic** | Feasible — entirely open-source/free-tier stack, zero licensing cost, suitable for academic development |
| **Operational** | Feasible — end users interact only with a dashboard and generated documents; no technical expertise required to operate |

---

## 10. Requirement Gathering

**Techniques used:**
- Study of existing meeting-transcription and note-taking tools
- Review of academic literature on meeting summarization and diarization
- Analysis of recurring documentation needs within student project teams
- Discussion with faculty guide

**Comparison with existing applications:**

| Feature | Existing Applications | CMIS (Proposed) |
|---|---|---|
| Meeting Documentation | Manual note-taking | Automated, AI-generated |
| Action Item Tracking | Not available | Available, with owner & urgency |
| Output Formats | Single text note | MoM, presentation, summary, agenda |
| Cross-Meeting Context | Not retained | Persistent, searchable context store |
| Recurring Topic Detection | Not available | Available (LSH-based similarity) |

---

## 11. Project Timeline

| Phase | Duration |
|---|---|
| Requirement Analysis | First week of January |
| Dataset & sample meeting collection | Second week of January |
| Transcription & diarization pipeline | Third week of January |
| NLP structuring module development | February |
| Testing and evaluation | Early March |
| Report/presentation generation module | Mid March |
| Documentation and presentation | Last week of March |

---

## 12. Team Work Distribution

| Member | Responsibility |
|---|---|
| Desai Karansinh (23IT402) | Transcription & diarization module, speech-to-text integration, overall system architecture and backend |
| Krunalkumar Rohit (23IT419) | NLP structuring module — topic segmentation, action-item/decision classification, recurring-topic detection |
| Dev Chavda (23IT441) | Context store design, database schema, report & presentation generation module |
| Saksham Sharma (23IT553) | Dashboard & visualization module, frontend development, testing, documentation |

---

## 13. Expected Outcomes

- Automated minutes of meeting
- Structured, searchable meeting context
- Action-item & decision tracking
- On-demand report/slide generation
- Reduced manual documentation effort
- Consistent, standardized meeting records

## 14. Future Scope

- Live, real-time transcription mode
- Cross-meeting knowledge graph
- Expanded regional-language support
- Mobile companion app
- Calendar/LMS integration
- Voice-based meeting-query assistant

---

## 15. References

1. V. Rennard, G. Shang, J. Hunter, and M. Vazirgiannis, "Abstractive Meeting Summarization: A Survey," *Transactions of the Association for Computational Linguistics*, vol. 11, pp. 861–884, 2023.
2. L. Golia and J. Kalita, "Action-Item-Driven Summarization of Long Meeting Transcripts," in *Proc. NLPIR 2023*, Seoul, Republic of Korea, pp. 91–98, 2023.
3. X. Feng, X. Feng, and B. Qin, "A Survey on Dialogue Summarization: Recent Advances and New Frontiers," arXiv:2107.03175, 2022.
4. M. F. A. FM, S. Pawankumar, M. Guruprasath, and J. Jayaprakash, "Automation of Minutes of Meeting (MoM) using NLP," in *2022 IC3IoT*, pp. 1–6, 2022.
5. B. Gliwa, I. Mochol, M. Biesek, and A. Wawer, "SAMSum Corpus: A Human-annotated Dialogue Dataset for Abstractive Summarization," in *Proc. 2nd Workshop on New Frontiers in Summarization*, pp. 70–79, 2019.
6. A. Radford, J. W. Kim, T. Xu, G. Brockman, C. McLeavey, and I. Sutskever, "Robust Speech Recognition via Large-Scale Weak Supervision," in *Proc. ICML*, vol. 202, pp. 28492–28518, 2023.
7. T. J. Park, N. Kanda, D. Dimitriadis, K. J. Han, S. Watanabe, and S. Narayanan, "A Review of Speaker Diarization: Recent Advances with Deep Learning," *Computer Speech & Language*, vol. 72, p. 101317, 2022.
8. H. Bredin, "pyannote.audio 2.1 Speaker Diarization Pipeline: Principle, Benchmark, and Recipe," in *Proc. INTERSPEECH 2023*, 2023.
