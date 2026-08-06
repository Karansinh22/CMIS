# CMIS — UML Diagrams

All diagrams below use **Mermaid** syntax. They render natively on GitHub, GitLab, VS Code (with the Mermaid extension), Obsidian, and most modern Markdown viewers. If your viewer doesn't render Mermaid, paste any block into [mermaid.live](https://mermaid.live) to preview and export as PNG/SVG.

---

## 1. Use Case Diagram

Shows the actors and the interactions they have with the system.

```mermaid
graph TB
    Host((Meeting Host / Faculty))
    Member((Team Member))
    Coordinator((Committee Coordinator))

    subgraph CMIS[Contextual Meeting Intelligence System]
        UC1([Upload Meeting Recording])
        UC2([View Transcript])
        UC3([Generate Minutes of Meeting])
        UC4([Generate Presentation])
        UC5([Track Action Items])
        UC6([Search Context Store])
        UC7([View Dashboard & Trends])
        UC8([Detect Recurring Topics])
    end

    Host --> UC1
    Host --> UC3
    Host --> UC4
    Member --> UC2
    Member --> UC5
    Member --> UC6
    Coordinator --> UC7
    Coordinator --> UC8
```

---

## 2. Class Diagram

Core domain model of CMIS.

```mermaid
classDiagram
    class Meeting {
        +UUID id
        +string title
        +datetime date
        +string status
        +getTranscript()
        +getContext()
    }

    class Speaker {
        +UUID id
        +string label
        +string name
    }

    class TranscriptSegment {
        +UUID id
        +string text
        +float startTime
        +float endTime
        +Speaker speaker
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

    Meeting "1" --> "many" TranscriptSegment
    TranscriptSegment "many" --> "1" Speaker
    Meeting "1" --> "1" ContextEntry
    ContextEntry "1" --> "many" Topic
    ContextEntry "1" --> "many" ActionItem
    ContextEntry "1" --> "many" Decision
    Meeting "1" --> "many" Report
```

---

## 3. Sequence Diagram

Flow from audio upload to report generation.

```mermaid
sequenceDiagram
    actor User
    participant UI as Dashboard (React)
    participant API as Backend (FastAPI)
    participant ASR as Transcription Engine
    participant NLP as NLP Structuring
    participant DB as Context Store

    User->>UI: Upload meeting recording
    UI->>API: POST /meetings/upload
    API->>ASR: Send audio for transcription
    ASR-->>API: Speaker-labelled transcript
    API->>NLP: Send transcript for structuring
    NLP-->>API: Topics, action items, decisions, urgency
    API->>DB: Store structured context
    DB-->>API: Confirmation
    API-->>UI: Processing complete
    User->>UI: Request "Generate MoM"
    UI->>API: POST /reports/generate
    API->>DB: Fetch context
    DB-->>API: Context data
    API-->>UI: Generated MoM (.docx)
    UI-->>User: Download document
```

---

## 4. Activity Diagram

End-to-end processing pipeline with decision points.

```mermaid
flowchart TD
    Start([Start]) --> A[Upload Audio/Video]
    A --> B{Valid Format?}
    B -- No --> Z[Reject & Notify User]
    B -- Yes --> C[Transcribe Audio]
    C --> D[Diarize Speakers]
    D --> E[Segment Topics]
    E --> F[Classify Action Items & Decisions]
    F --> G[Score Urgency]
    G --> H{Recurring Topic Detected?}
    H -- Yes --> I[Link to Previous Context]
    H -- No --> J[Create New Context Entry]
    I --> K[Store in Context Store]
    J --> K
    K --> L{User Requests Output?}
    L -- Yes --> M[Generate Requested Format]
    M --> N([End])
    L -- No --> N
    Z --> N
```

---

## 5. Component Diagram

High-level system architecture.

```mermaid
graph LR
    subgraph Client
        FE[React Dashboard]
    end

    subgraph Server
        API[FastAPI Backend]
        ASR[Transcription & Diarization\nWhisper + pyannote.audio]
        NLP[NLP Structuring Engine\nspaCy + scikit-learn]
        LSH[Similarity Engine\nMinHash / LSH]
        GEN[Report Generation Engine\npython-docx + pptxgenjs]
    end

    subgraph Storage
        DB[(Context Store\nPostgreSQL / SQLite)]
    end

    FE <-->|REST / WebSocket| API
    API --> ASR
    API --> NLP
    NLP --> LSH
    API --> GEN
    API <--> DB
    GEN --> DB
```

---

## 6. Deployment Diagram

Physical/logical deployment view.

```mermaid
graph TB
    subgraph ClientDevice[Client Device]
        Browser[Web Browser]
    end

    subgraph AppServer[Application Server - Docker Compose]
        WebApp[React Frontend Container]
        API2[FastAPI Backend Container]
        ASRService[ASR/Diarization Service Container]
    end

    subgraph DBServer[Database Server]
        Postgres[(PostgreSQL Instance)]
    end

    Browser -->|HTTPS| WebApp
    WebApp -->|REST/WS| API2
    API2 --> ASRService
    API2 -->|SQL| Postgres
```

---

## 7. Entity–Relationship (ER) Diagram

Database schema view of the context store.

```mermaid
erDiagram
    MEETING ||--o{ TRANSCRIPT_SEGMENT : contains
    MEETING ||--|| CONTEXT_ENTRY : produces
    MEETING ||--o{ REPORT : generates
    SPEAKER ||--o{ TRANSCRIPT_SEGMENT : speaks
    CONTEXT_ENTRY ||--o{ TOPIC : includes
    CONTEXT_ENTRY ||--o{ ACTION_ITEM : includes
    CONTEXT_ENTRY ||--o{ DECISION : includes
    TOPIC ||--o{ TOPIC : "recurs as"

    MEETING {
        uuid id PK
        string title
        datetime date
        string status
    }
    SPEAKER {
        uuid id PK
        string label
        string name
    }
    TRANSCRIPT_SEGMENT {
        uuid id PK
        uuid meeting_id FK
        uuid speaker_id FK
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
        bool is_recurring
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
    }
```

---

## 8. State Diagram

Lifecycle of a single meeting record within the system.

```mermaid
stateDiagram-v2
    [*] --> Uploaded
    Uploaded --> Transcribing : ASR triggered
    Transcribing --> Structuring : Transcript ready
    Structuring --> ContextStored : NLP structuring complete
    ContextStored --> ReportGenerated : User requests output
    ReportGenerated --> ContextStored : Additional output requested
    ContextStored --> Archived : No further action
    ReportGenerated --> Archived : Session closed
    Archived --> [*]
```

---

## How to export these as images

1. Copy any code block (including the ` ```mermaid ` fence) into [mermaid.live](https://mermaid.live)
2. Click **Actions → Export as PNG/SVG**
3. Insert the exported image into your Word report or PPT wherever a diagram is required

Alternatively, install the **Markdown Preview Mermaid Support** extension in VS Code to preview and export directly from your editor.
