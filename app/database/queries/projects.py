"""Project CRUD operations."""

from datetime import datetime, timezone

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def upsert_project(conn: aiosqlite.Connection, path: str, name: str,
                         pinned: bool = False) -> dict:
    now = _now()
    await conn.execute(
        """INSERT INTO projects (path, name, pinned, last_used) VALUES (?, ?, ?, ?)
           ON CONFLICT(path) DO UPDATE SET name = ?, pinned = ?, last_used = ?""",
        (path, name, int(pinned), now, name, int(pinned), now),
    )
    await conn.commit()
    async with conn.execute("SELECT * FROM projects WHERE path = ?", (path,)) as cur:
        row = await cur.fetchone()
        return dict(row) if row else {}


async def list_projects(conn: aiosqlite.Connection) -> list[dict]:
    async with conn.execute(
        "SELECT * FROM projects ORDER BY pinned DESC, last_used DESC",
    ) as cur:
        return [dict(row) for row in await cur.fetchall()]


async def delete_project(conn: aiosqlite.Connection, path: str) -> bool:
    cur = await conn.execute("DELETE FROM projects WHERE path = ?", (path,))
    await conn.commit()
    return cur.rowcount > 0
