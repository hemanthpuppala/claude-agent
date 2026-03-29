"""Push notification routes — subscription management + VAPID key."""

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class PushSubscription(BaseModel):
    endpoint: str
    keys: dict  # {p256dh: str, auth: str}
    user_agent: str | None = None


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.get("/vapid-public-key")
async def get_vapid_key(request: Request):
    """Browser calls this to get the VAPID public key for push subscription."""
    return {"public_key": request.app.state.notifications.public_key}


@router.post("/subscribe")
async def subscribe(request: Request, body: PushSubscription):
    """Store a push subscription after user grants notification permission."""
    await request.app.state.notifications.subscribe(body.model_dump())
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
        return {"status": "error", "message": str(e)}
    return {"status": "sent", "subscriptions": len(subs)}
