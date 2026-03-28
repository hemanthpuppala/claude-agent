"""Claude Code Web — FastAPI application factory."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import APP_TITLE, APP_VERSION
from app.database.connection import init_db, close_db
from app.core.notifications import NotificationManager
from app.core.session_manager import SessionManager
from app.routes import mount_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = await init_db()
    app.state.db = db
    app.state.notifications = NotificationManager(db)
    await app.state.notifications.init()
    app.state.manager = SessionManager(db, app.state.notifications)
    await app.state.manager.restore_active_sessions()
    yield
    await close_db(db)


def create_app() -> FastAPI:
    app = FastAPI(title=APP_TITLE, version=APP_VERSION, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    mount_routes(app)
    return app
