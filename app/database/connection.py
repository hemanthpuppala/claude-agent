"""Database connection management."""

import os

import aiosqlite

from app.config import DB_PATH
from app.database.schema import SCHEMA


async def init_db() -> aiosqlite.Connection:
    """Initialize the database — create tables if needed, return connection."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row
    await conn.executescript(SCHEMA)
    await conn.execute("PRAGMA journal_mode=WAL")
    await conn.execute("PRAGMA foreign_keys=ON")
    await conn.commit()
    return conn


async def close_db(conn: aiosqlite.Connection):
    """Close the database connection."""
    await conn.close()
