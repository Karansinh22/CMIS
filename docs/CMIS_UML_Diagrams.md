# CMIS — UML Diagrams

All diagrams below use **Mermaid** syntax. They render natively on GitHub, GitLab, VS Code (with the Mermaid extension), Obsidian, and most modern Markdown viewers. If your viewer doesn't render Mermaid, paste any block into [mermaid.live](https://mermaid.live) to preview and export as PNG/SVG.

---

## 1. Use Case Diagram

Shows the single actor (the User) and all interactions they have with CMIS.

```mermaid
graph TB
    User((User))

    subgraph CMIS["Contextual Meeting Intelligence System (Personal Tool)"]
        UC1([Upload Meeting Recording])
        UC2([View Transcript])
        UC3([Generate Minutes of Meeting])
        UC4([Generate Presentation / Summary])
        UC5([Track Personal Action Items])
        UC6([Search Personal Context Store])
        UC7([View Dashboard & Meeting History])
        UC8([Detect Recurring Topics Across My Meetings])
        UC9([Register / Login to Local Account])
    end

    User --> UC9
    User --> UC1
    User --> UC2
    User --> UC3
    User --> UC4
    User --> UC5
    User --> UC6
    User --> UC7
    User --> UC8
```

---

## 2. Class Diagram

Core domain model of CMIS.

```mermaid
classDiagram
    class User {
        +UUID id
        +string email
        +string hashed_password
        +datetime created_at
        +login()
        +getMyMeetings()
    }

    class Meeting {
        +UUID id
        +UUID user_id
        +string title
        +datetime date
        +string status
        +getTranscript()
        +getContext()
    }

    class TranscriptSegment {
        +UUID id
        +string text
        +float startTime
        +float endTime
        +string speakerLabel
    }

    class Topic {
        +UUID id
        +string title
        +string summary
        +bool isRecurring
    }

    class ActionItem {
        +UUID id
        +string description
        +string owner
        +string urgency
        +bool resolved
    }

    class Decision {
        +UUID id
        +string description
        +datetime decidedOn
    }

    class ContextEntry {
        +UUID id
        +Meeting meeting
        +List~Topic~ topics
        +List~ActionItem~ actionItems
        +List~Decision~ decisions
    }

    class Report {
        +UUID id
        +string format
        +datetime generatedOn
        +generate()
    }

    User "1" --> "many" Meeting : owns
    Meeting "1" --> "many" TranscriptSegment : contains
    Meeting "1" --> "1" ContextEntry : produces
    ContextEntry "1" --> "many" Topic : includes
    ContextEntry "1" --> "many" ActionItem : includes
    ContextEntry "1" --> "many" Decision : includes
    Meeting "1" --> "many" Report : generates
    Topic "0..1" --> "0..1" Topic : "recurs as (same user's past meetings)"
```

---

## 3. Sequence Diagram

Flow from audio upload to report generation — single user interaction.

```mermaid
sequenceDiagram
    actor User
    participant UI as Dashboard (React)
    participant API as Backend (FastAPI)
    participant ASR as Transcription Engine
    participant NLP as NLP Structuring
    participant DB as Personal Context Store

    User->>UI: Log in to local account
    UI->>API: POST /auth/login
    API-->>UI: JWT token

    User->>UI: Upload meeting recording
    UI->>API: POST /meetings/upload (with JWT)
    API->>ASR: Send audio for transcription
    ASR-->>API: Speaker-labelled transcript
    API->>NLP: Send transcript for structuring
    NLP-->>API: Topics, action items, decisions, urgency
    API->>DB: Store structured context (user_id scoped)
    DB-->>API: Confirmation
    API-->>UI: Processing complete

    User->>UI: Request "Generate MoM"
    UI->>API: POST /reports/generate (with JWT)
    API->>DB: Fetch my context
    DB-->>API: Context data
    API-->>UI: Generated MoM (.docx)
    UI-->>User: Download document
```

---

## 4. Activity Diagram

End-to-end processing pipeline with decision points.

```mermaid
flowchart TD
    Start([User Uploads Recording]) --> A[Validate Audio Format]
    A --> B{Valid Format?}
    B -- No --> Z[Reject & Notify User]
    B -- Yes --> C[Transcribe Audio with Whisper]
    C --> D[Diarize Speakers]
    D --> E[Segment into Topics]
    E --> F[Classify Action Items & Decisions]
    F --> G[Score Urgency]
    G --> H{Recurring Topic in User's Past Meetings?}
    H -- Yes --> I[Link to Previous Context Entry]
    H -- No --> J[Create New Context Entry]
    I --> K[Store in Personal Context Store]
    J --> K
    K --> L{User Requests Output?}
    L -- Yes --> M[Generate Requested Format]
    M --> N([End — Document Ready for Download])
    L -- No --> N
    Z --> N
```

---

## 5. Component Diagram

High-level system architecture — all components run locally on the user's machine.

```mermaid
graph LR
    subgraph UserDevice["User's Local Machine"]
        subgraph Client
            FE[React Dashboard]
        end

        subgraph Server
            API[FastAPI Backend]
            AUTH[Auth Module\nJWT + bcrypt]
            ASR[Transcription & Diarization\nWhisper + pyannote.audio]
            NLP[NLP Structuring Engine\nspaCy + scikit-learn]
            LSH[Similarity Engine\nMinHash / LSH]
            GEN[Report Generation Engine\npython-docx + python-pptx]
        end

        subgraph Storage
            DB[(Personal Context Store\nSQLite — local file)]
        end
    end

    FE <-->|REST / WebSocket| API
    API --> AUTH
    API --> ASR
    API --> NLP
    NLP --> LSH
    API --> GEN
    API <--> DB
    GEN --> DB
```

---

## 6. Deployment Diagram

Physical deployment — everything runs on the user's own laptop or desktop.

```mermaid
graph TB
    subgraph UserMachine["User's Machine (Local)"]
        subgraph DockerCompose["Docker Compose (optional)"]
            WebApp[React Frontend\nVite Dev Server]
            API2[FastAPI Backend Container]
            ASRService[ASR / Diarization\nWhisper + pyannote]
        end

        subgraph FileSystem["Local File System"]
            DBFile[(cmis_local.db\nSQLite)]
            Uploads[(uploads/\nAudio Files)]
        end
    end

    Browser[Web Browser\nlocalhost:5173] --> WebApp
    WebApp -->|REST/WS localhost:8000| API2
    API2 --> ASRService
    API2 --> DBFile
    API2 --> Uploads
```

---

## 7. Entity–Relationship (ER) Diagram

Database schema for the personal context store.

```mermaid
erDiagram
    USER ||--o{ MEETING : owns
    MEETING ||--o{ TRANSCRIPT_SEGMENT : contains
    MEETING ||--|| CONTEXT_ENTRY : produces
    MEETING ||--o{ REPORT : generates
    CONTEXT_ENTRY ||--o{ TOPIC : includes
    CONTEXT_ENTRY ||--o{ ACTION_ITEM : includes
    CONTEXT_ENTRY ||--o{ DECISION : includes
    TOPIC ||--o{ TOPIC : "recurs as (user's own meetings)"

    USER {
        uuid id PK
        string email
        string hashed_password
        datetime created_at
    }
    MEETING {
        uuid id PK
        uuid user_id FK
        string title
        datetime date
        string status
        string audio_path
    }
    TRANSCRIPT_SEGMENT {
        uuid id PK
        uuid meeting_id FK
        string speaker_label
        string text
        float start_time
        float end_time
    }
    CONTEXT_ENTRY {
        uuid id PK
        uuid meeting_id FK
    }
    TOPIC {
        uuid id PK
        uuid context_id FK
        string title
        string summary
        bool is_recurring
        uuid previous_topic_id FK
    }
    ACTION_ITEM {
        uuid id PK
        uuid context_id FK
        string description
        string owner
        string urgency
        bool resolved
    }
    DECISION {
        uuid id PK
        uuid context_id FK
        string description
        datetime decided_on
    }
    REPORT {
        uuid id PK
        uuid meeting_id FK
        string format
        datetime generated_on
        string file_path
    }
```

---

## 8. State Diagram

Lifecycle of a single meeting record within the personal context store.

```mermaid
stateDiagram-v2
    [*] --> Uploaded : User uploads recording
    Uploaded --> Transcribing : ASR triggered
    Transcribing --> Structuring : Transcript ready
    Structuring --> ContextStored : NLP structuring complete
    ContextStored --> ReportGenerated : User requests output
    ReportGenerated --> ContextStored : User requests another format
    ContextStored --> Archived : User archives meeting
    ReportGenerated --> Archived : User archives meeting
    Archived --> [*]
```

---

## How to export these as images

1. Copy any code block (including the ` ```mermaid ` fence) into [mermaid.live](https://mermaid.live)
2. Click **Actions → Export as PNG/SVG**
3. Insert the exported image into your Word report or PPT wherever a diagram is required

Alternatively, install the **Markdown Preview Mermaid Support** extension in VS Code to preview and export directly from your editor.
