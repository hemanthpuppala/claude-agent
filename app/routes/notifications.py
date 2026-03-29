"""Push notification routes — subscription management + VAPID key."""

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.config import NTFY_TOPIC, NTFY_SERVER
from app.database.queries.push import get_all_push_subscriptions

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/ntfy-info")
async def ntfy_info():
    """Get ntfy.sh topic info for mobile setup."""
    return {
        "topic": NTFY_TOPIC,
        "server": NTFY_SERVER,
        "subscribe_url": f"{NTFY_SERVER}/{NTFY_TOPIC}",
        "app_url": f"ntfy://{NTFY_TOPIC}",
    }


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # {p256dh: str, auth: str}
    user_agent: str | None = None
    device_name: str | None = None


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/devices")
async def list_devices(request: Request):
    """List all registered push devices."""
    subs = await get_all_push_subscriptions(request.app.state.db)
    return [{
        "id": s["id"],
        "endpoint_short": s["endpoint"][:60] + "...",
        "user_agent": s.get("user_agent") or "Unknown device",
        "created_at": s["created_at"],
    } for s in subs]


@router.get("/vapid-public-key")
async def get_vapid_key(request: Request):
    """Browser calls this to get the VAPID public key for push subscription."""
    return {"public_key": request.app.state.notifications.public_key}


@router.post("/subscribe")
async def subscribe(request: Request, body: PushSubscription):
    """Store a push subscription after user grants notification permission."""
    data = body.model_dump()
    # Capture user agent from HTTP header if not provided
    if not data.get("user_agent"):
        data["user_agent"] = request.headers.get("user-agent", "Unknown")
    await request.app.state.notifications.subscribe(data)
    print(f"[PUSH] New subscription from: {data.get('user_agent', 'unknown')[:60]}")
    return {"status": "subscribed"}


@router.post("/unsubscribe")
async def unsubscribe(request: Request, body: UnsubscribeRequest):
    """Remove a push subscription."""
    await request.app.state.notifications.unsubscribe(body.endpoint)
    return {"status": "unsubscribed"}


@router.post("/test")
async def test_push(request: Request):
    """Send a test notification to verify push is working."""
    mgr = request.app.state.notifications
    # Debug: check subscriptions
    from app.database.queries.push import get_all_push_subscriptions
    subs = await get_all_push_subscriptions(request.app.state.db)
    print(f"[PUSH TEST] Found {len(subs)} subscription(s)")
    for s in subs:
        print(f"[PUSH TEST] Endpoint: {s['endpoint'][:60]}...")

    try:
        await mgr.send_status_push(
            "test", "Test",
            "Push works!",
            "Notifications are configured correctly.",
        )
        print("[PUSH TEST] send_status_push completed")
    except Exception as e:
        print(f"[PUSH TEST] ERROR: {e}")

    # Also send via ntfy
    try:
        await mgr.send_ntfy_test()
        print("[NTFY TEST] sent")
    except Exception as e:
        print(f"[NTFY TEST] ERROR: {e}")

    return {"status": "sent", "subscriptions": len(subs)}
