"""WebSocket routes for real-time event streaming."""

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from redis import asyncio as aioredis

from app.api.deps import get_current_user_ws
from app.core.config import settings
from app.db.models.user import User, UserRole

router = APIRouter()


async def _subscribe_and_stream(websocket: WebSocket, channel: str) -> None:
    """Subscribe to a Redis Pub/Sub channel and forward messages to the WebSocket client.

    Creates a dedicated Redis connection for pub/sub (separate from the shared app
    connection) and polls for messages every second. Exits cleanly on disconnect.
    """
    sub_redis = aioredis.from_url(
        settings.REDIS_URL, encoding="utf-8", decode_responses=True
    )
    pubsub = sub_redis.pubsub()
    await pubsub.subscribe(channel)
    try:
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )
            if message:
                await websocket.send_text(message["data"])
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await sub_redis.aclose()


@router.websocket("/admin/live")
async def admin_live_feed(
    websocket: WebSocket,
    current_user: User = Depends(get_current_user_ws),
) -> None:
    """Admin WebSocket: streams all NFC tap events in real-time.

    Connect with:  ws://localhost:8008/api/v1/ws/admin/live?token=<jwt>
    Messages are JSON with: tap_type, action, member_name, location, tapped_at
    """
    if not current_user.has_role(UserRole.ADMIN):
        await websocket.close(code=4003, reason="Admin access required")
        return
    await websocket.accept()
    await _subscribe_and_stream(websocket, "tap_events")


@router.websocket("/member/live")
async def member_live_feed(
    websocket: WebSocket,
    current_user: User = Depends(get_current_user_ws),
) -> None:
    """Member WebSocket: streams personal notifications for the authenticated member.

    Connect with:  ws://localhost:8008/api/v1/ws/member/live?token=<jwt>
    Messages are JSON with: tap_type, action, message
    """
    await websocket.accept()
    await _subscribe_and_stream(websocket, f"member:{current_user.id}")
