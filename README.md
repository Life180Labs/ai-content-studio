# AI Content Studio

> AI-powered Content Operating System — Transform a simple idea into a complete AI-generated video.

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16, React 19, TailwindCSS 4, ShadCN | App Router + RSC, premium design system |
| Backend | FastAPI, SQLAlchemy 2, Pydantic v2 | Async REST API, repository pattern |
| Auth | JWT (access + refresh), bcrypt | Token rotation, rate limiting |
| Database | PostgreSQL 16 | Primary data store with Alembic migrations |
| Cache | Redis 7 | Token blacklisting, rate limiting, sessions |
| AI Layer | LangGraph, AI Gateway | Multi-provider routing (future phases) |

## Quick Start

### Prerequisites

- **Node.js** 20+
- **Python** 3.11+
- **Docker** & Docker Compose (for PostgreSQL + Redis)

### 1. Clone & Setup Environment

```bash
git clone <repo-url> && cd ai-content-studio
cp .env.example .env  # Fill in your values
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL (port 5432) and Redis (port 6379).

### 3. Backend

```bash
cd backend
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs available at: `http://localhost:8000/docs`

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at: `http://localhost:3000`

## Project Structure

```
ai-content-studio/
├── frontend/         # Next.js 16 + React 19
│   ├── src/app/      # App Router pages
│   ├── src/components/  # UI components (ShadCN)
│   ├── src/lib/      # API client, utilities
│   └── src/stores/   # Zustand state management
├── backend/          # FastAPI
│   ├── app/api/      # REST endpoints (v1)
│   ├── app/core/     # Config, security, logging
│   ├── app/models/   # SQLAlchemy models
│   ├── app/schemas/  # Pydantic schemas
│   ├── app/repositories/  # Data access layer
│   ├── app/services/ # Business logic
│   └── app/db/       # Session factory + Alembic
├── docker-compose.yml
└── .env.example
```

## API Endpoints (Phase 1)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/register` | Register new user |
| `POST` | `/api/v1/auth/login` | Login (JWT tokens) |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token |
| `POST` | `/api/v1/auth/logout` | Revoke token |
| `GET` | `/api/v1/auth/me` | Current user profile |
| `POST` | `/api/v1/workspaces` | Create workspace |
| `GET` | `/api/v1/workspaces` | List workspaces |
| `POST` | `/api/v1/workspaces/{id}/projects` | Create project |
| `GET` | `/api/v1/workspaces/{id}/projects` | List projects |
| `GET` | `/api/v1/health` | Health check |

## Environment Variables

See [`.env.example`](.env.example) for all required configuration.

## License

MIT
