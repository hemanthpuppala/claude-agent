/* Service Worker — handles push notifications when the browser tab is closed */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("[SW] Push received:", event.data ? event.data.text() : "no data");

  if (!event.data) {
    // Show generic notification even without data
    event.waitUntil(
      self.registration.showNotification("Claude Code Web", { body: "New notification" })
    );
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error("[SW] Failed to parse push data:", e);
    event.waitUntil(
      self.registration.showNotification("Claude Code Web", { body: event.data.text() })
    );
    return;
  }

  console.log("[SW] Push data:", JSON.stringify(data));

  const options = {
    body: data.body || "Notification",
    tag: data.type === "permission_request"
      ? `perm-${data.request_id}`
      : `status-${data.session_id || "general"}`,
    renotify: true,
    requireInteraction: data.type === "permission_request",
    data: {
      url: data.url || "/",
      session_id: data.session_id,
      request_id: data.request_id,
      type: data.type,
    },
    actions: data.type === "permission_request"
      ? [
          { action: "allow", title: "Allow" },
          { action: "deny", title: "Deny" },
        ]
      : [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Claude Code Web", options)
      .then(() => console.log("[SW] Notification shown"))
      .catch((err) => console.error("[SW] showNotification error:", err))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};

  // Quick-approve/deny from action buttons (no need to open browser)
  if (event.action === "allow" || event.action === "deny") {
    event.waitUntil(
      fetch(`/api/sessions/${data.session_id}/permission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: data.request_id,
          decision: event.action,
        }),
      }).catch((err) => console.error("Quick-approve failed:", err))
    );
    return;
  }

  // Default click: open/focus the app
  const targetUrl = data.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus existing tab if open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      // Otherwise open new tab
      return self.clients.openWindow(targetUrl);
    })
  );
});
