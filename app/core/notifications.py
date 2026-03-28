"""Web Push notification manager — VAPID keys + pywebpush."""

import base64
import json
import logging

import aiosqlite
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from pywebpush import webpush, WebPushException

from app.config import VAPID_CONTACT
from app.database.queries.push import (
    get_vapid_keys, save_vapid_keys,
    get_all_push_subscriptions, delete_push_subscription,
    save_push_subscription,
)

log = logging.getLogger(__name__)


def _generate_vapid_keys() -> tuple[str, str]:
    """Generate a VAPID key pair. Returns (private_key_b64, public_key_b64)."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_bytes = private_key.private_numbers().private_value.to_bytes(32, "big")
    public_bytes = private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return (
        base64.urlsafe_b64encode(private_bytes).decode().rstrip("="),
        base64.urlsafe_b64encode(public_bytes).decode().rstrip("="),
    )


class NotificationManager:
    """Manages VAPID keys and sends Web Push notifications."""

    def __init__(self, db: aiosqlite.Connection):
        self._db = db
        self._vapid_private: str | None = None
        self._vapid_public: str | None = None

    async def init(self):
        """Load existing VAPID keys or generate new ones."""
        keys = await get_vapid_keys(self._db)
        if keys:
            self._vapid_private = keys["private_key"]
            self._vapid_public = keys["public_key"]
            log.info("VAPID keys loaded from database")
        else:
            self._vapid_private, self._vapid_public = _generate_vapid_keys()
            await save_vapid_keys(self._db, self._vapid_private, self._vapid_public)
            log.info("VAPID keys generated and saved")

    @property
    def public_key(self) -> str:
        """VAPID public key — browser needs this to subscribe."""
        return self._vapid_public or ""

    async def subscribe(self, subscription: dict):
        """Store a push subscription from the browser."""
        await save_push_subscription(
            self._db,
            endpoint=subscription["endpoint"],
            p256dh=subscription["keys"]["p256dh"],
            auth=subscription["keys"]["auth"],
            user_agent=subscription.get("user_agent"),
        )

    async def unsubscribe(self, endpoint: str):
        """Remove a push subscription."""
        await delete_push_subscription(self._db, endpoint)

    async def send_permission_push(self, session_id: str, session_name: str,
                                   tool_name: str, tool_input: dict,
                                   request_id: str):
        """Send push notification for a permission request."""
        summary = self._summarize_tool(tool_name, tool_input)
        payload = json.dumps({
            "type": "permission_request",
            "title": "Claude needs permission",
            "body": f"[{session_name}] {summary}",
            "session_id": session_id,
            "request_id": request_id,
            "tool_name": tool_name,
            "url": f"/session/{session_id}",
        })
        await self._send_to_all(payload)

    async def send_status_push(self, session_id: str, session_name: str,
                               title: str, body: str):
        """Send a generic status notification (task complete, error, etc.)."""
        payload = json.dumps({
            "type": "status",
            "title": title,
            "body": f"[{session_name}] {body}",
            "session_id": session_id,
            "url": f"/session/{session_id}",
        })
        await self._send_to_all(payload)

    async def _send_to_all(self, payload: str):
        """Send a push notification to all subscriptions. Clean up dead ones."""
        subscriptions = await get_all_push_subscriptions(self._db)
        dead_endpoints = []

        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub["endpoint"],
                        "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                    },
                    data=payload,
                    vapid_private_key=self._vapid_private,
                    vapid_claims={"sub": VAPID_CONTACT},
                )
            except WebPushException as e:
                if e.response and e.response.status_code in (404, 410):
                    dead_endpoints.append(sub["endpoint"])
                else:
                    log.warning("Push failed for %s: %s", sub["endpoint"][:40], e)
            except Exception as e:
                log.warning("Push error: %s", e)

        for endpoint in dead_endpoints:
            await delete_push_subscription(self._db, endpoint)

    @staticmethod
    def _summarize_tool(tool_name: str, tool_input: dict) -> str:
        """Human-readable summary for notification body."""
        if tool_name == "Bash":
            cmd = tool_input.get("command", "")
            return f"Run: {cmd[:80]}{'...' if len(cmd) > 80 else ''}"
        if tool_name in ("Write", "Edit"):
            path = tool_input.get("file_path", "unknown")
            return f"{tool_name}: {path}"
        if tool_name == "WebFetch":
            url = tool_input.get("url", "")
            return f"Fetch: {url[:60]}"
        if tool_name == "WebSearch":
            query = tool_input.get("query", tool_input.get("prompt", ""))
            return f"Search: {query[:60]}"
        return f"Use tool: {tool_name}"
