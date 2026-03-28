import { useEffect, useRef, useCallback } from "react";
import { getWsUrl } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import type { ServerMessage, SessionInfoMsg, SessionConfig } from "@/lib/types";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useClaudeWebSocket(sessionId: string | null, cwd?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanedUpRef = useRef(false);
  const store = useSessionStore();
  const setReconnecting = useUIStore((s) => s.setReconnecting);

  // Stable ref to sessionId so onmessage handler always has current value
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // Track connected session ID from server
  const connectedSessionIdRef = useRef<string | null>(null);

  const getKey = useCallback(() => {
    return connectedSessionIdRef.current || sessionIdRef.current || "";
  }, []);

  const connect = useCallback(() => {
    if (cleanedUpRef.current) return;
    if (!sessionIdRef.current && !cwd) return;

    const params = new URLSearchParams();
    if (sessionIdRef.current) params.set("session_id", sessionIdRef.current);
    if (cwd) params.set("cwd", cwd);

    const url = getWsUrl(`/ws/claude?${params}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (cleanedUpRef.current) { ws.close(); return; }
      retryRef.current = 0;
      setReconnecting(false);
    };

    ws.onmessage = (event) => {
      if (cleanedUpRef.current) return;

      let data: ServerMessage;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (data.type) {
        case "session_info": {
          const info = data as SessionInfoMsg;
          const key = sessionIdRef.current || info.session_id;
          connectedSessionIdRef.current = key;
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
      if (retryRef.current > 0) {
        setReconnecting(true);
      }
      if (retryRef.current < 10) {
        const delay = RECONNECT_DELAYS[Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)];
        retryRef.current++;
        retryTimerRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [cwd, store, setReconnecting, getKey]);

  useEffect(() => {
    cleanedUpRef.current = false;
    connect();

    return () => {
      // Mark as cleaned up so stale callbacks don't fire
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
  }, [connect]);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const sendQuery = useCallback((prompt: string) => {
    send({ type: "query", prompt });
  }, [send]);

  const sendPermission = useCallback(
    (requestId: string, decision: string, message = "") => {
      send({ type: "permission_response", request_id: requestId, decision, message });
    },
    [send],
  );

  const sendInterrupt = useCallback(() => {
    send({ type: "interrupt" });
  }, [send]);

  const sendConfig = useCallback((changes: Record<string, unknown>) => {
    send({ type: "config", ...changes });
  }, [send]);

  return { send, sendQuery, sendPermission, sendInterrupt, sendConfig };
}
