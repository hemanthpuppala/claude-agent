"""Entry point — run with: uv run server.py"""

import os

import uvicorn

from app import create_app
from app.config import HOST, PORT

app = create_app()

if __name__ == "__main__":
    print(f"Claude Code Web running at http://localhost:{PORT}")
    uvicorn.run(
        "server:app",
        host=HOST,
        port=PORT,
        timeout_keep_alive=300,
        reload=True,
        reload_dirs=[os.path.join(os.path.dirname(__file__), "app")],
    )
