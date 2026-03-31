"""Project browser routes — list, save, file tree, file reader."""

import os
import subprocess

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


@router.get("/api/projects/git-status")
async def api_git_status(path: str):
    """Get git status for all files in a project directory."""
    path = os.path.abspath(path)
    if not os.path.isdir(path):
        raise HTTPException(400, f"Directory not found: {path}")

    # Check if it's a git repo
    git_dir = os.path.join(path, ".git")
    if not os.path.isdir(git_dir):
        return {"is_git": False, "branch": None, "files": {}}

    try:
        # Get current branch
        branch_result = subprocess.run(
            ["git", "-C", path, "branch", "--show-current"],
            capture_output=True, text=True, timeout=5,
        )
        branch = branch_result.stdout.strip() or None

        # Get file statuses (include ignored files)
        status_result = subprocess.run(
            ["git", "-C", path, "status", "--porcelain", "-u", "--ignored"],
            capture_output=True, text=True, timeout=10,
        )

        files: dict[str, str] = {}
        for line in status_result.stdout.strip().split("\n"):
            if not line or len(line) < 4:
                continue
            # Format: XY filename (or XY old -> new for renames)
            xy = line[:2]
            filepath = line[3:].split(" -> ")[-1]  # Handle renames

            index_status = xy[0]   # Staged status
            work_status = xy[1]    # Working tree status

            if xy == "??":
                files[filepath] = "untracked"
            elif xy == "!!":
                files[filepath] = "ignored"
            elif index_status == "A" or work_status == "A":
                files[filepath] = "added"
            elif index_status == "D" or work_status == "D":
                files[filepath] = "deleted"
            elif index_status == "M" or work_status == "M":
                files[filepath] = "modified"
            elif index_status == "R":
                files[filepath] = "renamed"
            elif "U" in xy:
                files[filepath] = "conflict"
            else:
                files[filepath] = "modified"

        # Count summary
        summary = {}
        for status in files.values():
            summary[status] = summary.get(status, 0) + 1

        return {
            "is_git": True,
            "branch": branch,
            "files": files,
            "summary": summary,
        }
    except subprocess.TimeoutExpired:
        return {"is_git": True, "branch": None, "files": {}, "error": "timeout"}
    except Exception as e:
        return {"is_git": True, "branch": None, "files": {}, "error": str(e)}


@router.get("/api/projects/git-diff")
async def api_git_diff(path: str, file: str):
    """Get git diff for a specific file."""
    path = os.path.abspath(path)
    if not os.path.isdir(path):
        raise HTTPException(400, f"Directory not found: {path}")

    try:
        # Check if file is untracked (new file — show full content as added)
        status_result = subprocess.run(
            ["git", "-C", path, "status", "--porcelain", "--", file],
            capture_output=True, text=True, timeout=5,
        )
        status_line = status_result.stdout.strip()
        is_untracked = status_line.startswith("??")

        if is_untracked:
            # Untracked file — show entire content as added
            full_path = os.path.join(path, file)
            if os.path.isfile(full_path):
                try:
                    content = open(full_path, "r", errors="replace").read()
                    lines = [{"type": "add", "content": line} for line in content.split("\n")]
                    return {"file": file, "is_new": True, "hunks": [{"lines": lines}], "raw": ""}
                except Exception:
                    pass
            return {"file": file, "is_new": True, "hunks": [], "raw": ""}

        # Tracked file — get diff (staged + unstaged)
        diff_result = subprocess.run(
            ["git", "-C", path, "diff", "HEAD", "--", file],
            capture_output=True, text=True, timeout=10,
        )
        raw_diff = diff_result.stdout

        if not raw_diff:
            # Try staged-only diff
            diff_result = subprocess.run(
                ["git", "-C", path, "diff", "--cached", "--", file],
                capture_output=True, text=True, timeout=10,
            )
            raw_diff = diff_result.stdout

        if not raw_diff:
            return {"file": file, "is_new": False, "hunks": [], "raw": ""}

        # Parse diff into hunks
        hunks = _parse_diff(raw_diff)
        return {"file": file, "is_new": False, "hunks": hunks, "raw": raw_diff}

    except subprocess.TimeoutExpired:
        return {"file": file, "error": "timeout", "hunks": [], "raw": ""}
    except Exception as e:
        return {"file": file, "error": str(e), "hunks": [], "raw": ""}


def _parse_diff(raw: str) -> list[dict]:
    """Parse unified diff into structured hunks with typed lines."""
    hunks = []
    current_hunk = None

    for line in raw.split("\n"):
        if line.startswith("@@"):
            # New hunk header — parse line numbers
            if current_hunk:
                hunks.append(current_hunk)
            current_hunk = {"header": line, "lines": []}
        elif current_hunk is not None:
            if line.startswith("+"):
                current_hunk["lines"].append({"type": "add", "content": line[1:]})
            elif line.startswith("-"):
                current_hunk["lines"].append({"type": "del", "content": line[1:]})
            elif line.startswith(" "):
                current_hunk["lines"].append({"type": "ctx", "content": line[1:]})
            elif line.startswith("\\"):
                continue  # "\ No newline at end of file"
            else:
                current_hunk["lines"].append({"type": "ctx", "content": line})

    if current_hunk:
        hunks.append(current_hunk)

    return hunks


@router.post("/api/projects/file")
async def api_read_file(body: ReadFileRequest):
    project = os.path.abspath(body.project_path)
    if not os.path.isdir(project):
        raise HTTPException(400, f"Project not found: {project}")
    result = read_file(project, body.file_path)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result
