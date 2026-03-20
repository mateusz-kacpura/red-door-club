"""API v1 router aggregation."""
# ruff: noqa: I001 - Imports structured for Jinja2 template conditionals

from fastapi import APIRouter

from app.api.routes.v1 import health
from app.api.routes.v1 import auth, users
from app.api.routes.v1 import items
from app.api.routes.v1 import nfc, members, events, admin, ws, promoters, corporate, staff

v1_router = APIRouter()

# Health check routes (no auth required)
v1_router.include_router(health.router, tags=["health"])

# Authentication routes
v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# User routes
v1_router.include_router(users.router, prefix="/users", tags=["users"])

# Example CRUD routes (items)
v1_router.include_router(items.router, prefix="/items", tags=["items"])

# Red Door Club — Phase 1 routes
v1_router.include_router(nfc.router, prefix="/nfc", tags=["nfc"])
v1_router.include_router(members.router, prefix="/members", tags=["members"])
v1_router.include_router(events.router, prefix="/events", tags=["events"])
v1_router.include_router(admin.router, prefix="/admin", tags=["admin"])

# Red Door Club — Staff Door Operations
v1_router.include_router(staff.router, prefix="/staff", tags=["staff"])

# Red Door Club — Phase 4A: Real-Time WebSocket
v1_router.include_router(ws.router, prefix="/ws", tags=["websocket"])

# Red Door Club — Phase 5B: Promoter Portal
v1_router.include_router(promoters.router, prefix="/promoters", tags=["promoters"])

# Red Door Club — Phase 5C: Corporate Accounts
v1_router.include_router(corporate.router, prefix="/corporate", tags=["corporate"])
