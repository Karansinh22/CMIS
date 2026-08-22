# CMIS — UML Diagrams

All diagrams below use **Mermaid** syntax. They render natively on GitHub, GitLab, VS Code (with the Mermaid extension), Obsidian, and most modern Markdown viewers. If your viewer doesn't render Mermaid, paste any block into [mermaid.live](https://mermaid.live) to preview and export as PNG/SVG.

---

## 1. Use Case Diagram

Single actor (User) on the left; all use cases on the right, grouped by subsystem.

```mermaid
graph LR
    User((User))

    subgraph Account
        direction TB
        UC_REG([Register])
        UC_LOG([Login])
    end

    subgraph MeetingInput["Meeting Input"]
        direction TB
        UC_UP([Upload Recording])
    end

    subgraph AutoProcessing["Automatic Processing"]
        direction TB
        UC_TR([Transcription and Diarization])
        UC_NLP([NLP Structuring])
        UC_REC([Detect Recurring Topics])
        UC_STORE([Store Meeting Context])
    end

    subgraph GeneratedOutputs["Generated Outputs"]
        direction TB
        UC_VT([View Transcript])
        UC_MOM([Minutes of Meeting])
        UC_SUM([Executive Summary])
        UC_PPT([Generate Presentation])
        UC_AGN([Next Meeting Agenda])
        UC_REP([View Meeting Reports])
    end

    subgraph ActionsInsights["Actions and Insights"]
        direction TB
        UC_AI([Track Action Items])
        UC_SR([Review Action Item Status])
        UC_SC([Search Meeting Context])
        UC_DT([Dashboard and Trends])
        UC_RT([Recurring Topics])
    end

    User --> Account
    User --> MeetingInput
    User --> GeneratedOutputs
    User --> ActionsInsights
    UC_UP -.->|triggers| AutoProcessing
```

---

## 2. Class Diagram

Core domain model of CMIS — Report subtypes use inheritance as per the reference diagram.

```mermaid
classDiagram
    class User {
        +UUID id
        +string name
        +string email
        +string role
        +login()
        +register()
    }

    class Meeting {
        +UUID id
        +string title
        +datetime date
        +string status
        +List~TranscriptSegment~ transcript
        +getTranscript()
        +getContext()
    }

    class TranscriptSegment {
        +UUID id
        +string text
        +float startTime
        +float endTime
        +string speakerLabel
        +string speakerName
    }

    class ContextEntry {
        +UUID id
        +Meeting meeting
        +List~Topic~ topics
        +List~ActionItem~ actionItems
        +List~Decision~ decisions
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
        +string status
    }

    class Decision {
        +UUID id
        +string description
        +datetime decidedOn
    }

    class Report {
        +UUID id
        +string outputType
        +datetime generatedOn
        +generate()
    }

    class MoMReport {
        +generate()
    }

    class SummaryReport {
        +generate()
    }

    class ActionTrackerReport {
        +generate()
    }

    class AgendaReport {
        +generate()
    }

    class PresentationReport {
        +generate()
    }

    User "1" --> "*" Meeting : owns
    Meeting "1" *-- "*" TranscriptSegment : contains
    Meeting "1" --> "1" ContextEntry : generates
    Meeting "1" --> "*" Report : produces
    TranscriptSegment "*" --> "1" ContextEntry : feeds into
    ContextEntry "1" *-- "*" Topic : has
    ContextEntry "1" *-- "*" ActionItem : has
    ContextEntry "1" *-- "*" Decision : has
    Topic "0..1" --> "0..1" Topic : links to previous
    Report <|-- MoMReport
    Report <|-- SummaryReport
    Report <|-- ActionTrackerReport
    Report <|-- AgendaReport
    Report <|-- PresentationReport
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

Database schema for the personal context store — includes ISA inheritance for Report subtypes as per the reference diagram.

```mermaid
erDiagram
    USER ||--o{ MEETING : creates
    MEETING ||--o{ TRANSCRIPT_SEGMENT : contains
    MEETING ||--|| CONTEXT_ENTRY : produces
    TRANSCRIPT_SEGMENT }o--|| CONTEXT_ENTRY : feeds_into
    CONTEXT_ENTRY ||--o{ REPORT : includes
    CONTEXT_ENTRY ||--o{ ACTION_ITEM : includes
    CONTEXT_ENTRY ||--o{ DECISION : includes
    CONTEXT_ENTRY ||--o{ TOPIC : includes
    TOPIC ||--o| TOPIC : links_to_previous
    REPORT ||--o| MOM_REPORT : ISA
    REPORT ||--o| SUMMARY_REPORT : ISA
    REPORT ||--o| ACTION_TRACKER_REPORT : ISA
    REPORT ||--o| AGENDA_REPORT : ISA
    REPORT ||--o| PRESENTATION_REPORT : ISA

    USER {
        uuid user_id PK
        string full_name
        string email
        string password_hash
        string role
        string status
    }
    MEETING {
        uuid id PK
        uuid user_id FK
        string title
        datetime date
        string status
    }
    TRANSCRIPT_SEGMENT {
        uuid id PK
        uuid meeting_id FK
        string speaker_label
        string speaker_name
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
        uuid previous_topic_id FK
        string title
        string summary
        bool is_recurring
    }
    ACTION_ITEM {
        uuid id PK
        uuid context_id FK
        string description
        string owner
        string urgency
        string status
    }
    DECISION {
        uuid id PK
        uuid context_id FK
        string description
        datetime decided_on
    }
    REPORT {
        uuid id PK
        uuid context_id FK
        string output_type
        string format
        datetime generated_on
    }
    MOM_REPORT {
        uuid id PK
        uuid context_id FK
        datetime generated_on
    }
    SUMMARY_REPORT {
        uuid id PK
        uuid context_id FK
        datetime generated_on
    }
    ACTION_TRACKER_REPORT {
        uuid id PK
        uuid context_id FK
        datetime generated_on
    }
    AGENDA_REPORT {
        uuid id PK
        uuid context_id FK
        datetime generated_on
    }
    PRESENTATION_REPORT {
        uuid id PK
        uuid context_id FK
        datetime generated_on
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
