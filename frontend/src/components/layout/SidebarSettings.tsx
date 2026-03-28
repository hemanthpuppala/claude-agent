import { useState, useEffect } from "react";
import { Bell, BellOff, Settings } from "lucide-react";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { PERMISSION_MODES, MODELS } from "@/lib/constants";
import { notifications as notificationsApi } from "@/lib/api";

export function SidebarSettings() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported] = useState("serviceWorker" in navigator && "PushManager" in window);
  const [defaultMode, setDefaultMode] = useState("acceptEdits");
  const [defaultModel, setDefaultModel] = useState("claude-opus-4-6");

  useEffect(() => {
    // Check current push subscription state
    if (pushSupported && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushEnabled(!!sub);
        });
      });
    }
  }, [pushSupported]);

  const handlePushToggle = async (enable: boolean) => {
    if (!pushSupported) return;

    if (enable) {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const reg = await navigator.serviceWorker.ready;
        const { public_key } = await notificationsApi.vapidKey();

        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource,
        });

        await notificationsApi.subscribe(sub.toJSON());
        setPushEnabled(true);
      } catch (e) {
        console.error("Push subscription failed:", e);
      }
    } else {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await notificationsApi.unsubscribe(sub.endpoint);
          await sub.unsubscribe();
        }
        setPushEnabled(false);
      } catch (e) {
        console.error("Push unsubscribe failed:", e);
      }
    }
  };

  const testPush = async () => {
    try {
      await notificationsApi.test();
    } catch (e) {
      console.error("Test push failed:", e);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "0 16px", height: 44, flexShrink: 0,
        borderBottom: "1px solid var(--color-border-subtle)",
      }}>
        <Settings size={13} color="var(--color-text-secondary)" />
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: "var(--color-text-secondary)",
        }}>
          Settings
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {/* Default Permission Mode */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>Default Permission Mode</SectionLabel>
          <RadioGroup
            options={PERMISSION_MODES.map((m) => ({
              value: m.value, label: m.label, description: m.description,
            }))}
            value={defaultMode}
            onChange={setDefaultMode}
          />
        </div>

        {/* Default Model */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>Default Model</SectionLabel>
          <Select
            options={MODELS.map((m) => ({ value: m.value, label: m.label }))}
            value={defaultModel}
            onChange={setDefaultModel}
          />
        </div>

        {/* Project Directory */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>Project Directory</SectionLabel>
          <div style={{
            padding: "7px 10px", borderRadius: 8,
            border: "1px solid var(--color-border)",
            background: "var(--color-bg)",
            fontSize: 13, fontFamily: "var(--font-mono)",
            color: "var(--color-text-secondary)",
          }}>
            ~/Project
          </div>
          <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 4 }}>
            Set via PROJECT_DIR environment variable
          </div>
        </div>

        {/* Push Notifications */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>Push Notifications</SectionLabel>

          {!pushSupported ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 12px", borderRadius: 8,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.15)",
              fontSize: 12, color: "var(--color-warning)",
            }}>
              <BellOff size={14} />
              Push notifications not supported in this browser
            </div>
          ) : (
            <>
              <Toggle
                checked={pushEnabled}
                onChange={handlePushToggle}
                label={pushEnabled ? "Enabled" : "Disabled"}
              />
              <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 6 }}>
                Get notified when Claude needs permission approval while the browser is closed.
              </div>

              {pushEnabled && (
                <button
                  onClick={testPush}
                  style={{
                    marginTop: 10, padding: "6px 14px", borderRadius: 6,
                    border: "1px solid var(--color-border)",
                    background: "transparent", color: "var(--color-text-secondary)",
                    fontSize: 12, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <Bell size={12} />
                  Send test notification
                </button>
              )}
            </>
          )}
        </div>

        {/* Server Port */}
        <div style={{ marginBottom: 24 }}>
          <SectionLabel>Server</SectionLabel>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
            Backend: <span style={{ color: "var(--color-success)" }}>localhost:9282</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
