"""Message storage operations."""

from datetime import datetime, timezone

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def append_message(conn: aiosqlite.Connection, session_id: str, seq: int,
                         msg_type: str, data: str):
    now = _now()
    await conn.execute(
        """INSERT OR REPLACE INTO messages (session_id, seq, type, data, created_at)
           VALUES (?, ?, ?, ?, ?)""",
        (session_id, seq, msg_type, data, now),
    )
    await conn.execute(
        "UPDATE sessions SET message_count = message_count + 1, updated_at = ? WHERE id = ?",
        (now, session_id),
    )
    await conn.commit()


async def get_messages(conn: aiosqlite.Connection, session_id: str,
                       after_seq: int = 0, limit: int = 500) -> list[dict]:
    async with conn.execute(
        "SELECT * FROM messages WHERE session_id = ? AND seq > ? ORDER BY seq LIMIT ?",
        (session_id, after_seq, limit),
    ) as cur:
        return [dict(row) for row in await cur.fetchall()]


async def get_message_count(conn: aiosqlite.Connection, session_id: str) -> int:
    async with conn.execute(
        "SELECT COUNT(*) FROM messages WHERE session_id = ?", (session_id,),
    ) as cur:
        row = await cur.fetchone()
        return row[0] if row else 0
