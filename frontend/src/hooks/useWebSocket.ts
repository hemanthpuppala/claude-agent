import { useEffect, useRef, useCallback, useState } from "react";
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

  // Track the actual session ID returned by the server
  const [connectedSessionId, setConnectedSessionId] = useState<string | null>(null);

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

      switch (data.type) {
        case "session_info": {
          const info = data as SessionInfoMsg;
          // Use the session ID from the tab prop as key (what ChatView looks up)
          const key = sessionId || info.session_id;
          setConnectedSessionId(key);
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
          const key = connectedSessionId || sessionId || "";
          if (key) store.setStatus(key, (data as { status: string }).status as never);
          break;
        }
        case "replay_start": {
          const key = connectedSessionId || sessionId || "";
          if (key) store.setReplaying(key, true);
          break;
        }
        case "replay_end": {
          const key = connectedSessionId || sessionId || "";
          if (key) store.setReplaying(key, false);
          break;
        }
        case "config_updated": {
          const key = connectedSessionId || sessionId || "";
          if (key) store.setConfig(key, (data as unknown as { config: SessionConfig }).config);
          break;
        }
        case "assistant":
        case "result":
        case "user_echo":
        case "system":
        case "permission_request":
        case "error": {
          const key = connectedSessionId || sessionId || "";
          if (key) store.addMessage(key, data);
          break;
        }
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      // Only show "reconnecting" after we've connected at least once
      if (retryRef.current > 0) {
        setReconnecting(true);
      }
      // Cap retries at 10
      if (retryRef.current < 10) {
        const delay = RECONNECT_DELAYS[Math.min(retryRef.current, RECONNECT_DELAYS.length - 1)];
        retryRef.current++;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [sessionId, cwd, store, setReconnecting, connectedSessionId]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
    // Only reconnect when sessionId or cwd changes, not on every connectedSessionId change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, cwd]);

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

  return { send, sendQuery, sendPermission, sendInterrupt, sendConfig, connectedSessionId };
}
