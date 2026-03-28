import { useEffect, useRef, useCallback } from "react";
import { getWsUrl } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import type { ServerMessage, SessionInfoMsg, SessionConfig } from "@/lib/types";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useClaudeWebSocket(sessionId: string | null, cwd?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const store = useSessionStore();
  const setReconnecting = useUIStore((s) => s.setReconnecting);

  const connect = useCallback(() => {
    if (!sessionId && !cwd) return;

    const params = new URLSearchParams();
    if (sessionId) params.set("session_id", sessionId);
    if (cwd) params.set("cwd", cwd);

    const url = getWsUrl(`/ws/claude?${params}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      setReconnecting(false);
    };

    ws.onmessage = (event) => {
      let data: ServerMessage;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      const sid = sessionId || "";

      switch (data.type) {
        case "session_info": {
          const info = data as SessionInfoMsg;
          store.initSession(info.session_id, {
            sdk_session_id: info.sdk_session_id,
            cwd: info.cwd,
            status: info.status,
            config: info.config,
            total_cost: info.total_cost,
            total_turns: info.total_turns,
          });
          break;
        }
        case "status":
          if (sid) store.setStatus(sid, (data as { status: string }).status as never);
          break;
        case "replay_start":
          if (sid) store.setReplaying(sid, true);
          break;
        case "replay_end":
          if (sid) store.setReplaying(sid, false);
          break;
        case "config_updated":
          if (sid) store.setConfig(sid, (data as unknown as { config: SessionConfig }).config);
          break;
        case "stream":
          // TODO: handle partial streaming text
          break;
        case "assistant":
        case "result":
        case "user_echo":
        case "system":
        case "permission_request":
        case "error":
          if (sid) store.addMessage(sid, data);
          break;
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      const delay = RECONNECT_DELAYS[Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)];
      retryRef.current++;
      setReconnecting(true);
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [sessionId, cwd, store, setReconnecting]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
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
