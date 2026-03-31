import { useEffect, useRef, useCallback } from "react";
import { getWsUrl } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import type { ServerMessage, SessionInfoMsg, SessionConfig } from "@/lib/types";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

/**
 * WebSocket hook for Claude sessions.
 *
 * Key design decisions:
 * - All store interactions go through refs to avoid useCallback/useEffect dependency loops
 * - connect() is a plain ref function, NOT a useCallback, so it never triggers re-effects
 * - cleanedUpRef prevents StrictMode double-mount from causing duplicate messages
 * - Reconnect timer is tracked and cleared on cleanup
 */
export function useClaudeWebSocket(sessionId: string | null, cwd?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanedUpRef = useRef(false);
  const connectedKeyRef = useRef<string | null>(null);

  // Stable refs to props — avoids stale closures
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;

  // Stable refs to store actions — avoids dependency loops
  // getState() is called inside handlers, not during render, so always fresh
  const getStore = () => useSessionStore.getState();
  const getUIStore = () => useUIStore.getState();

  const getKey = () => connectedKeyRef.current || sessionIdRef.current || "";

  // connect is a ref function — never changes identity, never triggers useEffect
  const connectRef = useRef<() => void>(() => {});
  connectRef.current = () => {
    if (cleanedUpRef.current) return;
    const sid = sessionIdRef.current;
    const c = cwdRef.current;
    if (!sid && !c) return;

    const params = new URLSearchParams();
    if (sid) params.set("session_id", sid);
    if (c) params.set("cwd", c);

    const url = getWsUrl(`/ws/claude?${params}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (cleanedUpRef.current) { ws.close(); return; }
      retryRef.current = 0;
      getUIStore().setReconnecting(false);
    };

    ws.onmessage = (event) => {
      if (cleanedUpRef.current) return;
      const store = getStore();

      let raw: Record<string, unknown>;
      try { raw = JSON.parse(event.data); } catch { return; }

      // Handle rate_limit separately (not in ServerMessage type union)
      if (raw.type === "rate_limit") {
        const key = getKey();
        if (key) {
          const infoStr = String(raw.info || "");
          const utilMatch = infoStr.match(/utilization=([\d.]+|None)/);
          const resetsMatch = infoStr.match(/resets_at=(\d+)/);
          const typeMatch = infoStr.match(/rate_limit_type='([^']+)'/);
          const statusMatch = infoStr.match(/status='([^']+)'/);
          const type = typeMatch ? typeMatch[1] : "unknown";
          if (type !== "unknown") {
            const util = utilMatch && utilMatch[1] !== "None" ? parseFloat(utilMatch[1]) : -1;
            store.setRateLimit(key, {
              utilization: util >= 0 ? util : -1,  // -1 means "no data"
              resetsAt: resetsMatch ? parseInt(resetsMatch[1]) : 0,
              type,
              status: statusMatch ? statusMatch[1] : "unknown",
            });
          }
        }
        return;
      }

      const data = raw as unknown as ServerMessage;

      switch (data.type) {
        case "session_info": {
          const info = data as SessionInfoMsg;
          const key = sessionIdRef.current || info.session_id;
          connectedKeyRef.current = key;
          store.initSession(key, {
            sdk_session_id: info.sdk_session_id,
            cwd: info.cwd,
            status: info.status,
            config: info.config,
            total_cost: info.total_cost,
            total_turns: info.total_turns,
          });
          break;
        }
        case "status": {
          const key = getKey();
          if (key) store.setStatus(key, (data as { status: string }).status as never);
          break;
        }
        case "replay_start": {
          const key = getKey();
          if (key) store.setReplaying(key, true);
          break;
        }
        case "replay_end": {
          const key = getKey();
          if (key) store.setReplaying(key, false);
          break;
        }
        case "config_updated": {
          const key = getKey();
          if (key) store.setConfig(key, (data as unknown as { config: SessionConfig }).config);
          break;
        }
        case "assistant":
        case "result":
        case "user_echo":
        case "system":
        case "permission_request":
        case "error": {
          const key = getKey();
          if (key) store.addMessage(key, data);

          break;
        }
      }
    };

    ws.onclose = () => {
      if (cleanedUpRef.current) return;
      wsRef.current = null;
      // Only show reconnecting after first successful connection
      if (retryRef.current > 0) {
        getUIStore().setReconnecting(true);
      }
      if (retryRef.current < 10) {
        const delay = RECONNECT_DELAYS[Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)];
        retryRef.current++;
        retryTimerRef.current = setTimeout(() => connectRef.current?.(), delay);
      }
    };

    ws.onerror = () => { ws.close(); };
  };

  // Single effect — runs once on mount (and once on unmount for StrictMode)
  // Dependencies: sessionId and cwd only (the actual connection params)
  useEffect(() => {
    cleanedUpRef.current = false;
    retryRef.current = 0;
    connectedKeyRef.current = null;
    connectRef.current?.();

    return () => {
      cleanedUpRef.current = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sessionId, cwd]);

  // Stable send functions — never change identity
  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendQuery = useCallback((prompt: string) => send({ type: "query", prompt }), [send]);
  const sendPermission = useCallback(
    (requestId: string, decision: string, message = "") =>
      send({ type: "permission_response", request_id: requestId, decision, message }),
    [send],
  );
  const sendInterrupt = useCallback(() => send({ type: "interrupt" }), [send]);
  const sendConfig = useCallback((changes: Record<string, unknown>) => send({ type: "config", ...changes }), [send]);

  return { send, sendQuery, sendPermission, sendInterrupt, sendConfig };
}
