import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { notifications as notificationsApi } from "@/lib/api";

export function PushOnboarding() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    const wasDismissed = localStorage.getItem("push-onboarding-dismissed") === "true";

    if (!supported || wasDismissed) return;

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (!sub) setVisible(true);
      });
    });
  }, []);

  if (!visible || dismissed) return null;

  const handleEnable = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const { public_key } = await notificationsApi.vapidKey();

      const padding = "=".repeat((4 - public_key.length % 4) % 4);
      const base64 = (public_key + padding).replace(/-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const keyArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; i++) keyArray[i] = rawData.charCodeAt(i);

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray as BufferSource,
      });

      await notificationsApi.subscribe(sub.toJSON());
      setVisible(false);
    } catch (e) {
      console.error("Push subscription failed:", e);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("push-onboarding-dismissed", "true");
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", borderRadius: 10, marginBottom: 24,
      background: "var(--color-bg-elevated)",
      border: "1px solid rgba(212,132,90,0.2)",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: "rgba(212,132,90,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Bell size={16} color="var(--color-accent)" />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 2 }}>
          Enable notifications
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
          Get notified when Claude needs permission approval while you're away.
        </div>
      </div>

      <button
        onClick={handleEnable}
        style={{
          padding: "6px 14px", borderRadius: 6, border: "none",
          background: "var(--color-accent)", color: "#fff",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Enable
      </button>

      <button
        onClick={handleDismiss}
        style={{
          width: 24, height: 24, borderRadius: 6, border: "none",
          background: "transparent", color: "var(--color-text-tertiary)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
