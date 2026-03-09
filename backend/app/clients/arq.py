"""ARQ client wrapper."""

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import settings

_pool: ArqRedis | None = None


async def get_arq_pool() -> ArqRedis:
    """Get or create ARQ Redis pool.
    
    Can be used everywhere in the application to enqueue background jobs.
    """
    global _pool
    if _pool is None:
        _pool = await create_pool(
            RedisSettings(
                host=settings.ARQ_REDIS_HOST,
                port=settings.ARQ_REDIS_PORT,
                password=settings.ARQ_REDIS_PASSWORD or None,
                database=settings.ARQ_REDIS_DB,
            )
        )
    return _pool


async def close_arq_pool() -> None:
    """Close ARQ Redis pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
