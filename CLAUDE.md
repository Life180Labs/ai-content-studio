# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (Next.js 16 + React 19)
```bash
cd frontend
npm run dev                    # Dev server on port 3000 (localhost only)
npm run dev -- -H 0.0.0.0     # Listen on all IPs (for mobile QR code access)
npm run build                 # Production build
npm run lint                  # ESLint
```

**Mobile recording:** When using mobile video recording in the digital human wizard, open the form on your computer's **IP address** (e.g., `http://192.168.1.100:3000` not `localhost`), and run the dev server with `-H 0.0.0.0` so it accepts connections from other WiFi devices.

### Backend (FastAPI + Python 3.11)
```bash
cd backend
pip install -e ".[dev]"                                        # Install dependencies
alembic upgrade head                                           # Run DB migrations
uvicorn app.main:app --reload --port 8000                     # Dev server
celery -A app.worker.celery_app worker --loglevel=info        # Celery worker
pytest                                                         # Run tests
ruff check .                                                   # Lint
```

### Infrastructure
```bash
docker compose up -d    # Start PostgreSQL (5432) + Redis (6379) + Celery worker
```

## Architecture Overview

**AI Content Studio** is a multi-stage AI pipeline platform that transforms user inputs (topic, audience, tone) into complete videos via: Canvas → Content variations → Script → Storyboard → Voice (ElevenLabs) → Avatar (HeyGen) → Final video.

### Frontend (`frontend/src/`)
- **App Router** with two route groups: `(auth)/` (login, register, verify) and `(dashboard)/` (protected pages)
- **State**: Zustand store at `stores/auth.ts` for user/tokens; TanStack Query (`hooks/`) for all API calls with caching
- **API client** at `lib/api.ts` — handles JWT Authorization headers, automatic token refresh on 401, and error normalization
- **Token storage**: access token in `sessionStorage`, refresh token in `localStorage`
- **Pipeline UI components** in `components/pipeline/`: CanvasEditor → ContentViewer → ScriptEditor → StoryboardEditor → VideoReview

### Backend (`backend/app/`)
- **Layered architecture**: endpoints → services → repositories → models
- **Repositories** (`repositories/`) use a generic base with soft-delete, pagination, and async SQLAlchemy 2 sessions
- **Services** (`services/`) orchestrate business logic; `pipeline.py` drives the full AI generation flow
- **Models** all extend `BaseModel` (UUID PK, created_at, updated_at, soft-delete via `deleted_at`)
- **Auth**: bcrypt-hashed passwords, short-lived JWT access tokens (15 min) + rotatable refresh tokens (7 days) stored hashed in DB; logout revokes all refresh tokens via Redis blacklist

### AI Gateway (`backend/app/gateway/`)
- Provider-agnostic interface in `base.py` (Gemini, OpenAI, Anthropic, ElevenLabs, HeyGen)
- `router.py` (`AIGateway`) handles routing: primary provider → fallback with either exponential backoff retry or provider switch
- Per-task provider/model overrides via user `AIPreference` records
- Every AI call creates a `PipelineRun` DB record tracking tokens, USD cost, latency, stage, and provider

### Workflow (`backend/app/workflow/`)
- LangGraph state machine (`graph.py`) with `PipelineGraphState` for resumable pipeline execution
- Long-running tasks (voice, avatar video) dispatched via Celery + Redis

### Database
- PostgreSQL 16 with Alembic migrations in `backend/db/migrations/versions/`
- Key models: `User`, `Workspace`/`WorkspaceMember` (roles: owner/admin/member/viewer), `Project` (tracks `langgraph_thread_id`), `PipelineRun`, `AIPreference`, `RefreshToken`, `AuditLog`

### Middleware Stack (request order)
1. RateLimitMiddleware (Redis-backed, per-user)
2. CorrelationIdMiddleware (request tracing UUID)
3. RequestLoggingMiddleware (structured logs)
4. CORSMiddleware

## Environment Setup

Copy `backend/.env.example` to `backend/.env` and fill in:
- `DATABASE_URL` — PostgreSQL async URL (`postgresql+asyncpg://...`)
- `REDIS_URL` — Redis connection
- `JWT_SECRET_KEY` — random secret for signing tokens
- `ENCRYPTION_KEY` — Fernet key for encrypting stored API keys
- `S3_*` — Cloudflare R2 or S3-compatible storage
- `SMTP_*` — Email for OTP verification
- `NEXT_PUBLIC_API_URL=http://localhost:8000` in `frontend/.env.local`

AI provider keys (stored encrypted per-user in `AIPreference`, not in `.env`): Gemini, OpenAI, Anthropic, ElevenLabs, HeyGen.
