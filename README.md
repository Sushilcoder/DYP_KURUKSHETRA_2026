# Verified Course Material Studio — MVP

A starter implementation for the TechSummitTrainers PS5 challenge. It creates a course pack from a topic/source text, generates PowerPoint and PDF slide exports, per-slide trainer notes, extracted snippet files, exercise/test folders, a quiz, a one-page cheat sheet, a ZIP archive, and an evidence-oriented verification report.

> **Important:** this is an MVP scaffold, not a production security certification. The included Docker sandbox controller is for local development only because it accesses the Docker socket. Never expose it publicly. Production should replace the socket-based controller with a hardened execution service (gVisor or Firecracker microVMs), immutable image digests, authentication, rate limiting, audit controls, and a rendered-slide inspection worker.

## Stack

- Frontend: Next.js 16.4.2, React 19.3, TypeScript, responsive CSS dashboard.
- Backend: FastAPI, Pydantic, SQLAlchemy, PostgreSQL.
- Generation: OpenAI-compatible Chat Completions adapter; deterministic demo mode when no key is set.
- Packaging: python-pptx, ReportLab fallback, ZIP artifacts.
- Renderer: LibreOffice Impress service, PyMuPDF text-visibility and page-bound checks; the PDF downloadable in a final pack is rendered from the final PPTX.
- Sandbox controller: FastAPI + Docker SDK, allowlisted Python/Java runtime images, disabled runtime networking, read-only source volume, non-root runtime, memory/CPU/PID/time limits.
- Runtime profiles in this MVP: standalone Python 3.12 and standalone Java 21. Full Spring Boot Maven/Gradle project verification requires a separate dependency-prefetch/build profile and is deliberately not claimed as implemented.

## Quick start (Docker Desktop recommended)

1. Install Docker Desktop and make sure the Docker engine is running.
2. Copy `.env.example` to `.env`. Optionally add your `OPENAI_API_KEY`. Without one, demo course content is generated.
3. Pre-pull the two approved runtime images before starting the app:

   ```bash
   docker pull python:3.12.15-slim-bookworm
   docker pull eclipse-temurin:21.0.12.1_1-jdk-jammy
   ```

4. Build and start the services from the repository root:

   ```bash
   docker compose up --build
   ```

5. Open the frontend at http://localhost:3000, API docs at http://localhost:8000/docs, backend health at http://localhost:8000/health, and local sandbox health at http://localhost:8081/health.
6. Enter a course topic and click **Generate course pack**. The UI polls until the material is verified, blocked, or failed. It then shows the confidence score, snippets, logs, PPTX/PDF links, and ZIP download. The renderer service converts the final PPTX to PDF and reconciles visible slide text against the source file before the hard gate can pass.

### Windows PowerShell commands

```powershell
Copy-Item .env.example .env
docker pull python:3.12.15-slim-bookworm
docker pull eclipse-temurin:21.0.12.1_1-jdk-jammy
docker compose up --build
```

Stop the app with `Ctrl+C`, then `docker compose down`. To also delete database and artifact volumes, use `docker compose down -v` (this deletes generated data).

## API sample

```http
POST http://localhost:8000/api/v1/materials/generate
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
  "brand_primary_color": "#1D4ED8"
}
```

The API returns `202 Accepted` with a job ID. Poll `GET /api/v1/jobs/{job_id}`. Once complete, retrieve `GET /api/v1/materials/{id}`, `GET /api/v1/materials/{id}/snippets`, `GET /api/v1/materials/{id}/verification-report`, and `GET /api/v1/materials/{id}/download?format=zip`.

## Files generated

```text
01_Presentation/course_slides.pptx
01_Presentation/course_slides.pdf
02_Trainer_Notes/complete_trainer_notes.md
02_Trainer_Notes/slide_XX_notes.md
03_Extracted_Code/all_snippets.md
03_Extracted_Code/snippet_manifest.json
04_Verified_Code/*
05_Failed_Code/*
06_Exercises/exercise_XX/{reference_solution,naive_solution,tests}
07_Verification_Reports/verification_report.{json,md}
07_Verification_Reports/execution_logs/*
08_Quiz_CheatSheet/{quiz.md,quiz_answers_explanations.md,one_page_cheatsheet.pdf}
```

`04_Verified_Code` only holds snippets with successful execution checks. `05_Failed_Code` contains unexpected failed/blocked code plus a failure note. An intentionally naive solution that executes and fails its intended assertions is labeled `EXPECTED_FAILURE`; the exercise integrity report treats that as the expected negative test case, not as a working solution.

## Confidence score

`C_raw = 100 * (0.15*A + 0.25*E + 0.15*T + 0.10*V + 0.15*L + 0.20*Q)`

Where `A` is extraction completeness, `E` execution check success (including expected negative-test behavior), `T` exercise test integrity, `V` runtime/version reproducibility, `L` export/layout integrity, and `Q` educational quality.

Bands: 0–49 LOW, 50–70 MEDIUM, 71–100 HIGH. A mandatory gate failure clamps the final score to at most 49 and blocks the verified status. A high score is not a probability guarantee and must not be forced to 100.

## Current MVP scope / honest limitations

- The generator uses demo content unless `OPENAI_API_KEY` is configured. Demo content is labeled `DEMO_MODE` in reports.
- Standalone Python and Java snippets can be verified using fixed runner commands. Spring Boot examples using external dependencies will not be treated as verified by standalone `javac`; add a dedicated Maven/Gradle profile with preloaded, checksum-verified dependencies to support full framework projects.
- The renderer performs an actual LibreOffice PPTX-to-PDF render, checks page count, text visibility/extractability and page bounds, and flags very long slide code blocks. This is useful layout validation, not a perfect computer-vision guarantee for visual quality, font readability at every projector size, or visual overlap; production should add image-based slide geometry/contrast checks and trainer preview approval.
- With `OPENAI_API_KEY` set, the single-slide regeneration endpoint asks the model to rewrite only the selected slide and then re-extracts/re-verifies the deck. Without a key, demo mode appends the request to notes and explicitly reports that the slide itself was not rewritten.
- The job execution uses FastAPI background tasks, not a durable queue. Replace with Celery/RQ + Redis for production.
- This MVP does not include end-user authentication, tenant isolation, rate limiting, SSO, malware scanning for uploaded files, or a hardened public deployment configuration.

## Tests

From repository root, after installing backend dependencies:

```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest
```

Test the scoring and extraction logic without running Docker. End-to-end code verification tests require a running Docker engine and pre-pulled runtime images.


## Runtime image reproducibility

The development defaults use versioned image tags for Python 3.12 and Java 21. The sandbox records the resolved Docker image ID for each executed snippet. For a deployment that requires stricter reproducibility, set `PYTHON_IMAGE` and `JAVA_IMAGE` in `.env` to reviewed multi-architecture-compatible `image@sha256:...` references and rebuild only after approving the new image. Keep the Docker-socket controller on localhost for development only; it is not a public production service.
