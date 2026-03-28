"""Project browser routes — list, save, file tree, file reader."""

import os

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import DEFAULT_PROJECT_ROOT
from app.database.queries.projects import (
    upsert_project, list_projects, delete_project,
)
from app.utils.files import get_file_tree, read_file

router = APIRouter(tags=["projects"])


class SaveProjectRequest(BaseModel):
    path: str
    name: str | None = None
    pinned: bool = False


class ReadFileRequest(BaseModel):
    project_path: str
    file_path: str


@router.get("/api/projects")
async def api_list_projects(request: Request):
    return await list_projects(request.app.state.db)


@router.post("/api/projects")
async def api_save_project(request: Request, body: SaveProjectRequest):
    path = os.path.abspath(body.path)
    if not os.path.isdir(path):
        raise HTTPException(400, f"Directory not found: {path}")
    name = body.name or os.path.basename(path)
    return await upsert_project(request.app.state.db, path, name, body.pinned)


@router.delete("/api/projects/{path:path}")
async def api_delete_project(request: Request, path: str):
    full = os.path.abspath("/" + path)
    if not await delete_project(request.app.state.db, full):
        raise HTTPException(404, "Project not found")
    return {"deleted": True}


@router.get("/api/projects/discover")
async def api_discover_projects():
    """Auto-discover project directories in the default project root."""
    root = DEFAULT_PROJECT_ROOT
    if not os.path.isdir(root):
        return []
    return [
        {"name": name, "path": os.path.join(root, name)}
        for name in sorted(os.listdir(root))
        if os.path.isdir(os.path.join(root, name)) and not name.startswith(".")
    ]


@router.get("/api/projects/tree")
async def api_file_tree(path: str, max_depth: int = 6):
    path = os.path.abspath(path)
    if not os.path.isdir(path):
        raise HTTPException(400, f"Directory not found: {path}")
    return get_file_tree(path, max_depth=max_depth)


@router.post("/api/projects/file")
async def api_read_file(body: ReadFileRequest):
    project = os.path.abspath(body.project_path)
    if not os.path.isdir(project):
        raise HTTPException(400, f"Project not found: {project}")
    result = read_file(project, body.file_path)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result
