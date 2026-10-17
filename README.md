# Verified Course Material Studio

> Generate trainer-ready course packs — slides, notes, exercises, quizzes — where **every code snippet is actually executed and scored** before it reaches a learner.

Built for the **DYP Kurukshetra 2026 / TechSummitTrainers PS5** challenge.

<img width="988" height="498" alt="Course generation dashboard" src="https://github.com/user-attachments/assets/2192be9a-bebf-4c2e-bfa1-1b592cfe617c" />
<img width="1075" height="867" alt="Confidence score and verification report" src="https://github.com/user-attachments/assets/218f746b-c173-4f30-9621-a73070e46ecb" />

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Features](#features)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Generated course pack](#generated-course-pack)
- [Confidence score](#confidence-score)
- [Testing](#testing)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)

---

## Why this exists

AI-generated training material often contains code that looks right but does not compile, fails its own tests, or targets the wrong framework version. This studio treats every generated snippet as untrusted: it extracts it, runs it in an isolated sandbox, checks the exercises against real tests, renders the final slides, and only then gives the pack a confidence score and a status of **VERIFIED**, **NEEDS_REVIEW**, or **BLOCKED**.

## Features

- **Course generation** from a topic or pasted source text (up to 30,000 characters), tuned by learner level and session length.
- **Code extraction** of every snippet in the slides, exercises and tests, with a manifest.
- **Sandboxed execution** of Python 3.12 and Java 21 snippets: no network, read-only source, non-root user, CPU / memory / PID / time limits.
- **Automatic repair loop**: failed snippets or layout problems are sent back to the model for fixing, up to `MAX_REPAIR_ATTEMPTS` times.
- **Exercise integrity checks**: the reference solution must pass, and a deliberately naive solution must fail (`EXPECTED_FAILURE`), which proves the tests catch mistakes.
- **Real slide rendering**: the final PPTX is converted to PDF with LibreOffice and checked for page count, visible text and page bounds.
- **Downloads**: PowerPoint deck, PDF slides, trainer notes, quiz, cheat sheet, verification report (JSON + Markdown) and a full ZIP.
- **Single-slide regeneration** that re-extracts and re-verifies the whole deck afterwards.
- **Live progress** over Server-Sent Events or polling.
- **Demo mode**: works without an API key and labels its output `DEMO_MODE`.

## Architecture

```text
 ┌──────────────┐   REST / SSE    ┌──────────────────────┐
 │   Frontend   │ ──────────────► │   Backend (FastAPI)  │
 │  Next.js 16  │ ◄────────────── │  pipeline.py         │
 └──────────────┘                 │   ├─ generator       │──► OpenAI-compatible LLM
                                  │   ├─ extraction      │
                                  │   ├─ verification ───┼──► Sandbox  (Docker, :8081)
                                  │   ├─ packager        │
                                  │   ├─ render_client ──┼──► Renderer (LibreOffice, :8082)
                                  │   └─ scoring         │
                                  └─────────┬────────────┘
                                            │
                                  PostgreSQL / SQLite + artifact storage
```

**Pipeline stages:** `GENERATING → VERIFYING → (repair loop) → packaging → final render → scoring → VERIFIED | NEEDS_REVIEW | BLOCKED | FAILED`

## Repository layout

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI routes
│   │   ├── pipeline.py        # Generation → verify → repair → render → score
│   │   ├── generator.py       # LLM adapter + deterministic demo content
│   │   ├── extraction.py      # Snippet extraction and manifest
│   │   ├── verification.py    # Sandbox client and result classification
│   │   ├── packager.py        # PPTX / PDF / notes / quiz / ZIP builder
│   │   ├── render_client.py   # LibreOffice renderer client
│   │   ├── scoring.py         # Confidence score and bands
│   │   ├── models.py          # Pydantic request/content models
│   │   └── db.py              # SQLAlchemy persistence
│   ├── tests/                 # pytest suite
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── Dockerfile
└── frontend/
    ├── Dockerfile             # Multi-stage Next.js standalone build
    └── public/
```

> **Note:** the Next.js source (`frontend/src`, `package.json`), `docker-compose.yml`, `.env.example`, and the sandbox and renderer service code are **not in this branch right now**. Restore them before running `docker compose up`. The backend can run and be tested on its own (see below).

## Getting started

### Prerequisites

- Python 3.12+
- Docker Desktop (for the sandbox, renderer and full stack)
- Node.js 22+ (for the frontend)

### Option A — Full stack with Docker

```bash
# 1. Pre-pull the approved runtime images
docker pull python:3.12.15-slim-bookworm
docker pull eclipse-temurin:21.0.12.1_1-jdk-jammy

# 2. Configure environment
cp .env.example .env         # optionally add OPENAI_API_KEY

# 3. Build and start
docker compose up --build
```

| Service      | URL                          |
| ------------ | ---------------------------- |
| Frontend     | http://localhost:3000        |
| API docs     | http://localhost:8000/docs   |
| API health   | http://localhost:8000/health |
| Sandbox      | http://localhost:8081/health |

Stop with `Ctrl+C`, then `docker compose down`. Add `-v` to also delete the database and artifact volumes.

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
docker pull python:3.12.15-slim-bookworm
docker pull eclipse-temurin:21.0.12.1_1-jdk-jammy
docker compose up --build
```

### Option B — Backend only (local)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Without `DATABASE_URL`, the backend uses SQLite at `./storage/studio.db`. Code execution and rendering need the sandbox and renderer services; without them, snippets are reported as blocked instead of being treated as verified.

## Configuration

| Variable              | Default                          | Purpose                                               |
| --------------------- | -------------------------------- | ----------------------------------------------------- |
| `OPENAI_API_KEY`      | _(unset → demo mode)_            | Key for the OpenAI-compatible generation endpoint     |
| `OPENAI_BASE_URL`     | `https://api.openai.com/v1`      | Any OpenAI-compatible Chat Completions endpoint      |
| `OPENAI_MODEL`        | `gpt-4.1-mini`                   | Model used for generation and repair                  |
| `MAX_REPAIR_ATTEMPTS` | `2`                              | Auto-repair rounds for failed code or layout          |
| `DATABASE_URL`        | `sqlite:///./storage/studio.db`  | SQLAlchemy URL (PostgreSQL in Docker)                 |
| `POSTGRES_PASSWORD`   | —                                | Password for the Compose PostgreSQL service           |
| `STORAGE_ROOT`        | `./storage/materials`            | Where generated artifacts are written                 |
| `SANDBOX_URL`         | `http://sandbox:8081`            | Code-execution sandbox controller                     |
| `RENDERER_URL`        | `http://renderer:8082`           | LibreOffice PPTX → PDF renderer                       |
| `PYTHON_IMAGE`        | `python:3.12.15-slim-bookworm`   | Python runtime image (pin to `@sha256:` for release)  |
| `JAVA_IMAGE`          | `eclipse-temurin:21.0.12.1_1-jdk-jammy` | Java runtime image                            |
| `CORS_ORIGINS`        | `http://localhost:3000`          | Allowed frontend origins                              |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000`     | Backend URL baked into the frontend build             |

## API reference

Base URL: `http://localhost:8000`. Interactive docs are at `/docs`.

| Method | Endpoint                                                   | Description                                  |
| ------ | ---------------------------------------------------------- | -------------------------------------------- |
| GET    | `/health`                                                  | Health check                                 |
| POST   | `/api/v1/materials/generate`                               | Start a generation job (`202` + job id)      |
| GET    | `/api/v1/jobs/{job_id}`                                    | Job status and progress                      |
| GET    | `/api/v1/jobs/{job_id}/events`                             | Live progress stream (SSE)                   |
| GET    | `/api/v1/materials`                                        | List materials                               |
| GET    | `/api/v1/materials/{id}`                                   | Full material record                         |
| GET    | `/api/v1/materials/{id}/files`                             | Generated file listing                       |
| GET    | `/api/v1/materials/{id}/snippets`                          | All snippets with results                    |
| GET    | `/api/v1/materials/{id}/snippets/{snippet_id}`             | One snippet with its logs                    |
| POST   | `/api/v1/materials/{id}/extract-code`                      | Re-run extraction                            |
| POST   | `/api/v1/materials/{id}/verify-code`                       | Re-run verification (`202`)                  |
| POST   | `/api/v1/materials/{id}/slides/{slide_id}/regenerate`      | Rewrite one slide, then re-verify            |
| GET    | `/api/v1/materials/{id}/verification-report`               | Verification report                          |
| GET    | `/api/v1/materials/{id}/export?format=pptx\|pdf`            | Download the slide deck                      |
| GET    | `/api/v1/materials/{id}/download?format=zip`               | Download the full course pack                |

### Example request

```http
POST /api/v1/materials/generate
Content-Type: application/json
```

```json
{
  "topic": "REST APIs with Spring Boot",
  "student_level": "beginner",
  "duration_minutes": 60,
  "programming_language": "java",
  "framework": "Spring Boot",
  "framework_version": "3.x (pin exact patch for release)",
  "brand_name": "TechSummitTrainers",
  "brand_primary_color": "#1D4ED8",
  "source_text": null
}
```

| Field                  | Constraint                                    |
| ---------------------- | --------------------------------------------- |
| `topic`                | 3–240 characters (required)                   |
| `student_level`        | `beginner` · `intermediate` · `advanced`      |
| `duration_minutes`     | 15–480                                        |
| `programming_language` | `python` · `java`                             |
| `source_text`          | Optional, max 30,000 characters               |
| `brand_primary_color`  | Hex color, e.g. `#1D4ED8`                     |

## Generated course pack

```text
01_Presentation/course_slides.pptx
01_Presentation/course_slides.pdf
02_Trainer_Notes/complete_trainer_notes.md
02_Trainer_Notes/slide_XX_notes.md
03_Extracted_Code/all_snippets.md
03_Extracted_Code/snippet_manifest.json
04_Verified_Code/*                 # only snippets that passed execution
05_Failed_Code/*                   # failed or blocked code + failure notes
06_Exercises/exercise_XX/{reference_solution,naive_solution,tests}
07_Verification_Reports/verification_report.{json,md}
07_Verification_Reports/execution_logs/*
08_Quiz_CheatSheet/{quiz.md,quiz_answers_explanations.md,one_page_cheatsheet.pdf}
```

## Confidence score

The score comes only from measured checks in `backend/app/scoring.py`:

$$C = 100 \times (0.15A + 0.25E + 0.15T + 0.10V + 0.15L + 0.20Q)$$

| Symbol | Metric                       | Weight |
| ------ | ---------------------------- | ------ |
| A      | Extraction completeness      | 15%    |
| E      | Execution success            | 25%    |
| T      | Exercise test integrity      | 15%    |
| V      | Version reproducibility      | 10%    |
| L      | Layout / export integrity    | 15%    |
| Q      | Educational quality          | 20%    |

Every metric is between 0 and 1.

| Band       | Range   | Meaning                                    |
| ---------- | ------- | ------------------------------------------ |
| **LOW**    | 0–49    | Invalid — regenerate                       |
| **MEDIUM** | 50–70   | Needs trainer review                       |
| **HIGH**   | 71–100  | Valid — ready to deliver                   |

**Mandatory gates:** if any hard gate fails (incomplete extraction, unexpected failed or blocked snippets, broken exercise tests, unpinned runtime, or a failed final render), the score is capped at **49** and the pack cannot be marked VERIFIED. A high score summarises the evidence; it is not a guarantee.

## Testing

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

| Test file                 | Covers                                      |
| ------------------------- | ------------------------------------------- |
| `test_scoring.py`         | Weights, bands, gate clamping, input range  |
| `test_extraction.py`      | Snippet extraction and manifest             |
| `test_generator.py`       | Demo content and schema validity            |
| `test_verification.py`    | Result classification, expected failures    |
| `test_packager.py`        | PPTX / PDF / ZIP artifact output            |

The unit tests do not need Docker. End-to-end execution tests need a running Docker engine and the pre-pulled runtime images.

## Security notes

- The sandbox controller uses the **Docker socket** and is for local development only. **Never expose it publicly.**
- Runtime containers have networking turned off, use a read-only source mount, run as a non-root user, and have memory, CPU, PID and time limits.
- For production, swap the socket controller for a hardened execution service (gVisor or Firecracker), use immutable `@sha256:` image digests, and add authentication, rate limiting and audit logging.
- The backend container runs as the unprivileged `studio` user (UID 10001).

## Known limitations

- Without `OPENAI_API_KEY`, demo content is used and labelled `DEMO_MODE`.
- Standalone Python and Java snippets are verified. Full Spring Boot (Maven/Gradle) projects with external dependencies need a separate build profile and are **not** claimed as verified.
- Layout checks cover rendering, page count, text visibility and page bounds. They do not do full visual or contrast analysis.
- Jobs run as FastAPI background tasks. Use Celery or RQ with Redis for durable production queues.
- There is no end-user auth, multi-tenancy, rate limiting or upload malware scanning yet.

---

<sub>Built for DYP Kurukshetra 2026 · TechSummitTrainers PS5</sub>
