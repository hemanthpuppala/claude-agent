"""Mount all route modules onto the FastAPI app."""

from app.routes.sessions import router as sessions_router
from app.routes.projects import router as projects_router
from app.routes.notifications import router as notifications_router
from app.routes.commands import router as commands_router
from app.routes.claude_ws import router as claude_ws_router
from app.routes.terminal_ws import router as terminal_ws_router
from app.routes.watcher_ws import router as watcher_ws_router


def mount_routes(app):
    app.include_router(sessions_router)
    app.include_router(projects_router)
    app.include_router(notifications_router)
    app.include_router(commands_router)
    app.include_router(claude_ws_router)
    app.include_router(terminal_ws_router)
    app.include_router(watcher_ws_router)
