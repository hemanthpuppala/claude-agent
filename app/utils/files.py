"""File tree, file reader, and type classifier utilities."""

import base64
import mimetypes
import os

from app.config import (
    IGNORE_DIRS, IGNORE_EXTENSIONS, IMAGE_EXTENSIONS, BINARY_EXTENSIONS,
    MARKDOWN_EXTENSIONS,
)


def classify_file(ext: str) -> str:
    """Classify file type for rendering: text, image, markdown, binary."""
    ext = ext.lower()
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in MARKDOWN_EXTENSIONS:
        return "markdown"
    if ext in BINARY_EXTENSIONS:
        return "binary"
    return "text"


def get_file_tree(project_dir: str, max_depth: int = 6) -> list[dict]:
    """Return a nested file tree structure for the UI."""
    project_dir = os.path.abspath(project_dir)

    def walk(path: str, depth: int) -> list[dict]:
        if depth > max_depth:
            return []
        try:
            items = sorted(os.listdir(path))
        except PermissionError:
            return []

        dirs = []
        files = []
        for name in items:
            if name.startswith(".") and name not in (".env.example",):
                continue
            full = os.path.join(path, name)
            rel = os.path.relpath(full, project_dir)

            if os.path.isdir(full):
                if name.lower() in IGNORE_DIRS:
                    continue
                children = walk(full, depth + 1)
                dirs.append({
                    "name": name,
                    "path": rel,
                    "type": "directory",
                    "children": children,
                })
            elif os.path.isfile(full):
                _, ext = os.path.splitext(name)
                if ext.lower() in IGNORE_EXTENSIONS:
                    continue
                size = os.path.getsize(full)
                files.append({
                    "name": name,
                    "path": rel,
                    "type": "file",
                    "size": size,
                    "extension": ext.lstrip("."),
                })

        return dirs + files

    return walk(project_dir, 0)


def read_file(project_dir: str, rel_path: str) -> dict:
    """Read a file and return its content with metadata."""
    project_dir = os.path.abspath(project_dir)
    full = os.path.normpath(os.path.join(project_dir, rel_path))

    # Path traversal protection
    if not full.startswith(project_dir):
        return {"error": "Access denied: path escapes project directory"}

    if not os.path.isfile(full):
        return {"error": f"File not found: {rel_path}"}

    _, ext = os.path.splitext(rel_path)
    size = os.path.getsize(full)
    file_type = classify_file(ext)
    mime = mimetypes.guess_type(full)[0] or "application/octet-stream"

    base = {
        "path": rel_path,
        "size": size,
        "extension": ext.lstrip("."),
        "file_type": file_type,
        "mime": mime,
    }

    # Images: base64 data URI (limit 10MB)
    if file_type == "image":
        if size > 10_000_000:
            return {**base, "error": f"Image too large ({size} bytes). Max 10MB."}
        try:
            with open(full, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            result = {**base, "data_uri": f"data:{mime};base64,{b64}"}
            if ext.lower() == ".svg":
                try:
                    text_content = open(full, "r").read()
                    result["content"] = text_content
                    result["lines"] = text_content.count("\n") + 1
                except Exception:
                    pass
            return result
        except Exception as e:
            return {**base, "error": str(e)}

    # Binary files: metadata only
    if file_type == "binary":
        return {**base, "content": None}

    # Text and markdown
    if size > 2_000_000:
        return {**base, "error": f"File too large ({size} bytes). Max 2MB for text."}

    try:
        content = open(full, "r", errors="replace").read()
    except Exception as e:
        return {**base, "error": str(e)}

    return {**base, "content": content, "lines": content.count("\n") + 1}
