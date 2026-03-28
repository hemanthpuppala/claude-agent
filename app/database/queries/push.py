"""Push subscription and VAPID key operations."""

from datetime import datetime, timezone

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def save_push_subscription(conn: aiosqlite.Connection, endpoint: str,
                                 p256dh: str, auth: str,
                                 user_agent: str | None = None):
    now = _now()
    await conn.execute(
        """INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(endpoint) DO UPDATE SET p256dh = ?, auth = ?, user_agent = ?""",
        (endpoint, p256dh, auth, user_agent, now, p256dh, auth, user_agent),
    )
    await conn.commit()


async def get_all_push_subscriptions(conn: aiosqlite.Connection) -> list[dict]:
    async with conn.execute("SELECT * FROM push_subscriptions") as cur:
        return [dict(row) for row in await cur.fetchall()]


async def delete_push_subscription(conn: aiosqlite.Connection, endpoint: str):
    await conn.execute(
        "DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,),
    )
    await conn.commit()


async def get_vapid_keys(conn: aiosqlite.Connection) -> dict | None:
    async with conn.execute("SELECT * FROM vapid_keys WHERE id = 1") as cur:
        row = await cur.fetchone()
        return dict(row) if row else None


async def save_vapid_keys(conn: aiosqlite.Connection, private_key: str,
                          public_key: str):
    await conn.execute(
        """INSERT INTO vapid_keys (id, private_key, public_key) VALUES (1, ?, ?)
           ON CONFLICT(id) DO UPDATE SET private_key = ?, public_key = ?""",
        (private_key, public_key, private_key, public_key),
    )
    await conn.commit()
