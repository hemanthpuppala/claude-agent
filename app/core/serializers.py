"""Serialize Claude SDK message types to JSON-safe dicts for WebSocket transport."""

from claude_agent_sdk import (
    AssistantMessage, ResultMessage, SystemMessage, UserMessage, StreamEvent,
)

from app.config import MAX_TOOL_RESULT_LEN

try:
    from claude_agent_sdk import (
        TaskStartedMessage, TaskProgressMessage, TaskNotificationMessage, RateLimitEvent,
    )
except ImportError:
    TaskStartedMessage = TaskProgressMessage = TaskNotificationMessage = RateLimitEvent = None


def serialize_content_block(block) -> dict:
    """Convert an SDK content block to a JSON-serializable dict."""
    if hasattr(block, "thinking"):
        return {"type": "thinking", "thinking": block.thinking}
    if hasattr(block, "text") and not hasattr(block, "name"):
        return {"type": "text", "text": block.text}
    if hasattr(block, "name") and hasattr(block, "input"):
        return {
            "type": "tool_use",
            "id": getattr(block, "id", ""),
            "name": block.name,
            "input": block.input,
        }
    if hasattr(block, "tool_use_id") and hasattr(block, "content"):
        content = block.content
        if isinstance(content, str):
            if len(content) > MAX_TOOL_RESULT_LEN:
                content = content[:MAX_TOOL_RESULT_LEN] + "\n... [truncated]"
        elif isinstance(content, list):
            # Structured content — extract text or serialize to readable string
            parts = []
            for item in content:
                if isinstance(item, dict):
                    if item.get("type") == "text":
                        parts.append(item.get("text", ""))
                    elif item.get("type") == "tool_reference":
                        pass  # Internal SDK reference, skip
                    else:
                        parts.append(str(item))
                elif isinstance(item, str):
                    parts.append(item)
                elif hasattr(item, "text"):
                    parts.append(item.text)
                else:
                    parts.append(str(item))
            content = "\n".join(parts) if parts else ""
        elif content is not None:
            content = str(content)
        else:
            content = ""
        return {
            "type": "tool_result",
            "tool_use_id": block.tool_use_id,
            "content": content,
            "is_error": getattr(block, "is_error", False),
        }
    return {"type": "unknown", "data": str(block)}


def serialize_message(msg, seq: int | None = None) -> dict | None:
    """Convert an SDK message to a JSON-serializable dict for WebSocket."""
    result = None

    if isinstance(msg, AssistantMessage):
        result = {
            "type": "assistant",
            "content": [serialize_content_block(b) for b in (msg.content or [])],
            "model": getattr(msg, "model", None),
        }
    elif isinstance(msg, ResultMessage):
        result = {
            "type": "result",
            "session_id": getattr(msg, "session_id", None),
            "total_cost_usd": getattr(msg, "total_cost_usd", None),
            "duration_ms": getattr(msg, "duration_ms", None),
            "duration_api_ms": getattr(msg, "duration_api_ms", None),
            "num_turns": getattr(msg, "num_turns", None),
            "is_error": getattr(msg, "is_error", False),
            "stop_reason": getattr(msg, "stop_reason", None),
            "subtype": getattr(msg, "subtype", None),
            "result": getattr(msg, "result", None),
        }
    elif isinstance(msg, UserMessage):
        content = msg.content
        # The SDK uses UserMessage for both actual user prompts AND internal
        # tool-result feedback. When content is a list (of ToolResultBlock objects),
        # extract tool results so they can be displayed under tool cards.
        if not isinstance(content, str):
            if isinstance(content, list):
                blocks = []
                for item in content:
                    tool_use_id = getattr(item, "tool_use_id", None)
                    if not tool_use_id:
                        continue
                    raw = getattr(item, "content", "")
                    # Extract text from structured content
                    if isinstance(raw, list):
                        parts = []
                        for sub in raw:
                            if isinstance(sub, dict) and sub.get("type") == "text":
                                parts.append(sub.get("text", ""))
                            elif isinstance(sub, dict) and sub.get("type") == "tool_reference":
                                continue  # internal, skip
                            elif hasattr(sub, "text"):
                                parts.append(sub.text)
                        text = "\n".join(parts)
                    elif isinstance(raw, str):
                        text = raw
                    else:
                        text = str(raw) if raw else ""
                    if text and len(text) > MAX_TOOL_RESULT_LEN:
                        text = text[:MAX_TOOL_RESULT_LEN] + "\n... [truncated]"
                    is_error = getattr(item, "is_error", False)
                    blocks.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": text,
                        "is_error": bool(is_error),
                    })
                if blocks:
                    result = {"type": "assistant", "content": blocks}
                else:
                    return None
            else:
                return None
        else:
            result = {"type": "user_echo", "content": content}
    elif isinstance(msg, SystemMessage):
        result = {
            "type": "system",
            "subtype": getattr(msg, "subtype", ""),
            "session_id": getattr(msg, "session_id", None),
            "data": str(getattr(msg, "data", "")),
        }
    elif StreamEvent and isinstance(msg, StreamEvent):
        result = {"type": "stream", "event": getattr(msg, "event", {})}
    elif TaskStartedMessage and isinstance(msg, TaskStartedMessage):
        result = {
            "type": "task_started",
            "task_id": msg.task_id,
            "description": getattr(msg, "description", ""),
        }
    elif TaskProgressMessage and isinstance(msg, TaskProgressMessage):
        result = {
            "type": "task_progress",
            "task_id": msg.task_id,
            "description": getattr(msg, "description", ""),
        }
    elif TaskNotificationMessage and isinstance(msg, TaskNotificationMessage):
        result = {
            "type": "task_notification",
            "task_id": msg.task_id,
            "status": getattr(msg, "status", ""),
            "summary": getattr(msg, "summary", ""),
        }
    elif RateLimitEvent and isinstance(msg, RateLimitEvent):
        result = {
            "type": "rate_limit",
            "info": str(getattr(msg, "rate_limit_info", "")),
        }

    if result is not None and seq is not None:
        result["seq"] = seq

    return result
