/** REST API client — thin fetch wrappers */

const BASE = "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

/* Sessions */

export const sessions = {
  list: (params?: { status?: string; cwd?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<Record<string, unknown>[]>(`/api/sessions${qs ? `?${qs}` : ""}`);
  },
  create: (body: { cwd: string; name?: string; permission_mode?: string }) =>
    request<Record<string, unknown>>("/api/sessions", { method: "POST", body: JSON.stringify(body) }),
  get: (id: string) =>
    request<Record<string, unknown>>(`/api/sessions/${id}`),
  update: (id: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (id: string) =>
    request<{ deleted: boolean }>(`/api/sessions/${id}`, { method: "DELETE" }),
  messages: (id: string, afterSeq = 0, limit = 100) =>
    request<Record<string, unknown>[]>(`/api/sessions/${id}/messages?after_seq=${afterSeq}&limit=${limit}`),
  query: (id: string, prompt: string) =>
    request<Record<string, unknown>>(`/api/sessions/${id}/query`, { method: "POST", body: JSON.stringify({ prompt }) }),
  permission: (id: string, requestId: string, decision: string, message = "") =>
    request<{ resolved: boolean }>(`/api/sessions/${id}/permission`, {
      method: "POST",
      body: JSON.stringify({ request_id: requestId, decision, message }),
    }),
  cost: (id: string) =>
    request<{ total_cost_usd: number; total_turns: number }>(`/api/sessions/${id}/cost`),
};

/* Projects */

export const projects = {
  list: () => request<Record<string, unknown>[]>("/api/projects"),
  discover: () => request<{ name: string; path: string }[]>("/api/projects/discover"),
  save: (path: string, name?: string, pinned = false) =>
    request<Record<string, unknown>>("/api/projects", { method: "POST", body: JSON.stringify({ path, name, pinned }) }),
  delete: (path: string) =>
    request<{ deleted: boolean }>(`/api/projects/${encodeURIComponent(path)}`, { method: "DELETE" }),
  tree: (path: string, maxDepth = 6) =>
    request<Record<string, unknown>[]>(`/api/projects/tree?path=${encodeURIComponent(path)}&max_depth=${maxDepth}`),
  file: (projectPath: string, filePath: string) =>
    request<Record<string, unknown>>("/api/projects/file", {
      method: "POST",
      body: JSON.stringify({ project_path: projectPath, file_path: filePath }),
    }),
};

/* Notifications */

export const notifications = {
  vapidKey: () => request<{ public_key: string }>("/api/notifications/vapid-public-key"),
  subscribe: (subscription: PushSubscriptionJSON) =>
    request<{ status: string }>("/api/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify(subscription),
    }),
  unsubscribe: (endpoint: string) =>
    request<{ status: string }>("/api/notifications/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    }),
  test: () => request<{ status: string }>("/api/notifications/test", { method: "POST" }),
};
