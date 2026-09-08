# CMIS Dashboard (frontend)

React 19 + Vite + Tailwind single-page app for the CMIS backend.

```bash
npm install
npm run dev        # http://localhost:5173, expects the API on http://localhost:8000
npm run lint       # oxlint
npm run build      # production bundle in dist/
```

Set `VITE_API_URL` to point at a backend on another host (defaults to `http://localhost:8000`).

## Pages

| Route | Page | Purpose |
|---|---|---|
| `/` | `HomePage` | Dashboard: counts, recent meetings, open action items |
| `/upload` | `UploadPage` | Upload a recording; the transcript streams in while it is processed |
| `/live` | `LivePage` | Record from the microphone; live transcript, then extraction on stop |
| `/meetings`, `/meetings/:id` | `MeetingsPage`, `MeetingDetailPage` | Summary · Transcript · Topics · Actions · Decisions · Reports · History |
| `/projects`, `/projects/:id` | `ProjectsPage`, `ProjectDetailPage` | Multi-meeting workspaces, project report |
| `/actions` | `ActionItemsPage` | Open action items across all meetings |
| `/insights` | `InsightsPage` | Recurring topics, overdue items |

## Real-time updates

`src/hooks/useStatusSocket.js` subscribes to `ws://…/ws/status/{meetingId}` and forwards typed events
(`status`, `segments`, `transcript_ready`, `context_ready`). `LiveTranscript.jsx` renders lines as they
arrive; `ProcessingStatus.jsx` shows stage progress. `LivePage.jsx` additionally opens `/ws/live/{id}`
and streams 16 kHz int16 PCM from an AudioWorklet.

## Structure

```
src/
├── api.js              axios client + all API calls (incl. report download via blob)
├── auth.js, context/   JWT storage, AuthContext, ThemeContext
├── hooks/              useStatusSocket
├── components/         Navbar, ProcessingStatus, LiveTranscript, badges, modals
└── pages/              one file per route
```
