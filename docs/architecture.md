# Architecture Guide

This project follows a **Repository + Service** layered architecture.

## Request Flow

```
HTTP Request → API Route → Service → Repository → Database
                  ↓
              Response ← Service ← Repository ←
```

## Directory Structure (`backend/app/`)

| Directory | Purpose |
|-----------|---------|
| `api/routes/v1/` | HTTP endpoints, request validation, auth |
| `api/deps.py` | Dependency injection (db session, current user) |
| `services/` | Business logic, orchestration |
| `repositories/` | Data access layer, database queries |
| `schemas/` | Pydantic models for request/response |
| `db/models/` | SQLAlchemy/MongoDB models |
| `core/config.py` | Settings via pydantic-settings |
{%- if cookiecutter.use_auth %}
| `core/security.py` | JWT/API key utilities |
{%- endif %}
{%- if cookiecutter.enable_ai_agent %}
| `agents/` | AI agents and tools |
{%- endif %}
| `commands/` | Django-style CLI commands |
{%- if cookiecutter.use_celery or cookiecutter.use_taskiq %}
| `worker/` | Background task definitions |
{%- endif %}

## Layer Responsibilities

### API Routes (`api/routes/v1/`)
- HTTP request/response handling
- Input validation via Pydantic schemas
- Authentication/authorization checks
- Delegates to services for business logic

### Services (`services/`)
- Business logic and validation
- Orchestrates repository calls
- Raises domain exceptions (NotFoundError, etc.)
- Transaction boundaries

### Repositories (`repositories/`)
- Database operations only
- No business logic
- Uses `db.flush()` not `commit()` (let dependency manage transactions)
- Returns domain models

## Key Files

- Entry point: `app/main.py`
- Configuration: `app/core/config.py`
- Dependencies: `app/api/deps.py`
{%- if cookiecutter.use_auth %}
- Auth utilities: `app/core/security.py`
{%- endif %}
- Exception handlers: `app/api/exception_handlers.py`
