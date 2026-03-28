"""Session CRUD operations."""

import json
from datetime import datetime, timezone

import aiosqlite


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def create_session(conn: aiosqlite.Connection, session_id: str, cwd: str,
                         name: str = "", **config) -> dict:
    now = _now()
    await conn.execute(
        """INSERT INTO sessions (id, cwd, name, permission_mode, model, allowed_tools,
           disallowed_tools, system_prompt, max_turns, max_budget_usd, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (session_id, cwd, name,
         config.get("permission_mode", "acceptEdits"),
         config.get("model"),
         json.dumps(config["allowed_tools"]) if config.get("allowed_tools") else None,
         json.dumps(config["disallowed_tools"]) if config.get("disallowed_tools") else None,
         config.get("system_prompt"),
         config.get("max_turns"),
         config.get("max_budget_usd"),
         now, now),
    )
    await conn.commit()
    return await get_session(conn, session_id)


async def get_session(conn: aiosqlite.Connection, session_id: str) -> dict | None:
    async with conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cur:
        row = await cur.fetchone()
        return dict(row) if row else None


async def list_sessions(conn: aiosqlite.Connection, status: str | None = None,
                        cwd: str | None = None, limit: int = 50) -> list[dict]:
    query = "SELECT * FROM sessions"
    params: list = []
    conditions = []
    if status:
        conditions.append("status = ?")
        params.append(status)
    if cwd:
        conditions.append("cwd = ?")
        params.append(cwd)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY updated_at DESC LIMIT ?"
    params.append(limit)
    async with conn.execute(query, params) as cur:
        return [dict(row) for row in await cur.fetchall()]


async def update_session(conn: aiosqlite.Connection, session_id: str, **fields):
    if not fields:
        return
    for key in ("allowed_tools", "disallowed_tools"):
        if key in fields and fields[key] is not None and not isinstance(fields[key], str):
            fields[key] = json.dumps(fields[key])
    fields["updated_at"] = _now()
    sets = ", ".join(f"{k} = ?" for k in fields)
    vals = list(fields.values()) + [session_id]
    await conn.execute(f"UPDATE sessions SET {sets} WHERE id = ?", vals)
    await conn.commit()


async def delete_session(conn: aiosqlite.Connection, session_id: str) -> bool:
    cur = await conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    await conn.commit()
    return cur.rowcount > 0
