/* Service Worker — handles push notifications when the browser tab is closed */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.type === "permission_request"
      ? `perm-${data.request_id}`
      : `status-${data.session_id}`,
    renotify: true,
    // Permission notifications stay until clicked
    requireInteraction: data.type === "permission_request",
    data: {
      url: data.url || "/",
      session_id: data.session_id,
      request_id: data.request_id,
      type: data.type,
    },
    // Action buttons for permission requests
    actions: data.type === "permission_request"
      ? [
          { action: "allow", title: "Allow" },
          { action: "deny", title: "Deny" },
        ]
      : [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Claude Code Web", options)
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
