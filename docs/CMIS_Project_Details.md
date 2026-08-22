# Contextual Meeting Intelligence System (CMIS)

**Project – I (4IT31)**
**Team:** Desai Karansinh (23IT402) · Krunalkumar Rohit (23IT419) · Dev Chavda (23IT441) · Saksham Sharma (23IT553)

---

## 1. Project Definition

CMIS is an AI-powered **personal** tool that listens to a single user's meetings, calls, and lectures, converts them into structured, persistent context — topics, decisions, action items, and urgency — and generates minutes of meeting, summaries, and presentations on demand from that personal context store. Unlike a plain transcription tool, CMIS retains context **across the user's own multiple meetings** over time, so recurring discussion points and outstanding action items can be tracked automatically.

The system is designed for **one user running it locally on their own machine**. There is no team sharing, no collaborative workspace, and no cloud dependency — all data stays on the user's device.

---

## 2. Problem Statement

Meeting documentation today is manual, inconsistent, and disposable — someone types notes during a meeting (or nobody does), the notes live in a single file that is never revisited, and nothing connects one meeting to the next. Action items get lost, decisions get re-litigated, and producing a summary or slide deck means starting from scratch every time.

CMIS solves this **for the individual** by treating "what was discussed" as structured, reusable personal data rather than one-off text files. A person who attends many meetings — a student, a professional, a researcher — gets a searchable personal knowledge base that grows with every recording they upload.

---

## 3. Objectives

### Primary Objective
Develop an AI-based personal tool that automatically transcribes, structures, and summarizes a single user's meetings, calls, and lectures, and generates multiple documentation formats from a persistent, local understanding of those discussions.

### Specific Objectives
- Convert a user's recorded meeting audio into an accurate, speaker-labelled transcript
- Segment transcripts into topics and identify recurring discussion points across the user's own meetings
- Extract action items, decisions, and urgency levels from natural conversation
- Maintain a persistent, searchable personal context store across the user's multiple meetings
- Automatically generate minutes of meeting, summaries, and presentations on demand

---

## 4. Scope

**In scope:**
- Post-session processing of recorded/uploaded audio (meetings, calls, lectures) belonging to one user
- English and commonly used Indian-accented speech; limited regional-language support depending on the speech engine
- Speaker diarization (voice-based labelling, e.g., Speaker 1, Speaker 2) within a single recording
- Multi-format output generation from one shared personal context store
- Local user account (single account, single device — no sharing or multi-user access)

**Out of scope (current phase):**
- Live, real-time transcription during an ongoing session (future extension)
- Video analysis, facial recognition, or biometric speaker identification
- Real-time translation across languages
- Multi-user collaboration, meeting sharing, or team workspaces
- Cloud sync or cross-device access

---

## 5. System Modules

| # | Module | Responsibility |
|---|---|---|
| 1 | **Audio Ingestion** | Accepts uploaded audio or video, validates format, extracts audio stream, captures session metadata |
| 2 | **Transcription & Diarization** | Converts audio to a time-aligned, speaker-labelled transcript using an ASR engine |
| 3 | **NLP Structuring** | Topic segmentation, action-item/decision classification, urgency scoring, recurring-topic detection (LSH) across the user's own past meetings |
| 4 | **Context Store** | Persistent local database of every meeting the user has processed, with structured context |
| 5 | **Report & Presentation Generation** | Produces MoM, summaries, and slide decks on demand from the personal context store |
| 6 | **Dashboard & Visualization** | Personal interface to browse meetings, search context, track action-item status, view recurring topics |

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
| Frontend | React (Vite) | MIT |
| Database | SQLite (local, single-file) | Public Domain |
| Real-time comms | WebSockets (built into FastAPI) | — |
| Document generation | python-docx, python-pptx | MIT |
| Auth | JWT (python-jose + passlib) | MIT |
| Containerization | Docker + Docker Compose | Free (individual/student use) |
| Version control | Git + GitHub | Free |

### Optional free-tier services

| Tool | Purpose | Note |
|---|---|---|
| Sarvam AI | Improved Indian-accent/regional-language transcription | Free tier with quota limits — optional swap-in, not a core dependency |
| Google Colab | Free GPU for model testing | Session/GPU limits apply |

---

## 7. Database Strategy

- **SQLite only** — a single local `.db` file on the user's machine. Zero setup, zero cloud, zero sharing. All the user's meeting data stays private on their device.
- The schema includes a `user_id` field on all records (linked to the single local account) so the data model remains clean and extendable if multi-user support were ever added in a future phase.

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
| **Operational** | Feasible — the user interacts only with a local dashboard and generated documents; no technical expertise required to operate beyond initial setup |

---

## 10. Requirement Gathering

**Techniques used:**
- Study of existing meeting-transcription and note-taking tools
- Review of academic literature on meeting summarization and diarization
- Analysis of recurring documentation needs faced by individual students and professionals
- Discussion with faculty guide

**Comparison with existing applications:**

| Feature | Existing Applications | CMIS (Proposed) |
|---|---|---|
| Meeting Documentation | Manual note-taking | Automated, AI-generated |
| Action Item Tracking | Not available | Available, with urgency level |
| Output Formats | Single text note | MoM, presentation, summary |
| Cross-Meeting Context | Not retained | Persistent personal context store |
| Recurring Topic Detection | Not available | Available (LSH-based similarity across your own meetings) |
| Data Privacy | Often cloud-stored | Fully local — your data stays on your device |

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
| Desai Karansinh (23IT402) | Transcription & diarization module, speech-to-text integration, overall system architecture, backend, and local authentication |
| Krunalkumar Rohit (23IT419) | NLP structuring module — topic segmentation, action-item/decision classification, recurring-topic detection across personal meetings |
| Dev Chavda (23IT441) | Context store design, local SQLite schema, report & presentation generation module |
| Saksham Sharma (23IT553) | Dashboard & visualization module, frontend development, testing, documentation |

---

## 13. Expected Outcomes

- Automated minutes of meeting generated from the user's own recordings
- Structured, searchable personal meeting context
- Personal action-item & decision tracking across all your meetings
- On-demand report/slide generation
- Recurring topic detection across the user's meeting history
- Reduced manual documentation effort
- All data stays local — full privacy

---

## 14. Future Scope

- Live, real-time transcription mode
- Cross-meeting personal knowledge graph
- Expanded regional-language support
- Mobile companion app
- Calendar integration (Google Calendar / Outlook)
- Voice-based query assistant ("What did I agree to do last week?")
- Optional cloud backup (user-controlled, opt-in only)

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
