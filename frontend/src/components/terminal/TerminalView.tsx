import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { getWsUrl } from "@/lib/utils";

export function TerminalView({ cwd, name }: { cwd: string; name?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 14,
      fontFamily: "'Geist Mono', 'SF Mono', 'Fira Code', monospace",
      lineHeight: 1.35,
      theme: {
        background: "#171717",
        foreground: "#ECECEC",
        cursor: "#F97316",
        cursorAccent: "#171717",
        selectionBackground: "rgba(249,115,22,0.3)",
        black: "#171717",
        red: "#EF4444",
        green: "#10B981",
        yellow: "#F59E0B",
        blue: "#3B82F6",
        magenta: "#8B5CF6",
        cyan: "#06B6D4",
        white: "#ECECEC",
        brightBlack: "#8E8E8E",
        brightRed: "#FCA5A5",
        brightGreen: "#86EFAC",
        brightYellow: "#FDE68A",
        brightBlue: "#93C5FD",
        brightMagenta: "#C4B5FD",
        brightCyan: "#67E8F9",
        brightWhite: "#FFFFFF",
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);

    term.open(containerRef.current);

    // Try WebGL rendering, fall back to canvas
    try {
      const webgl = new WebglAddon();
      term.loadAddon(webgl);
      webgl.onContextLoss(() => webgl.dispose());
    } catch {
      // WebGL not available, canvas renderer works fine
    }

    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    // Connect WebSocket
    const params = new URLSearchParams({ cwd });
    if (name) params.set("name", name);
    const url = getWsUrl(`/ws/terminal?${params}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send initial size
      const dims = fit.proposeDimensions();
      if (dims) {
        ws.send(`\x1b[resize:${dims.cols},${dims.rows}`);
      }
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      term.write("\r\n\x1b[90m[Connection closed]\x1b[0m\r\n");
    };

    // Terminal input → WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle resize
    const observer = new ResizeObserver(() => {
      fit.fit();
      const dims = fit.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(`\x1b[resize:${dims.cols},${dims.rows}`);
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      ws.close();
      term.dispose();
      termRef.current = null;
      wsRef.current = null;
      fitRef.current = null;
    };
  }, [cwd, name]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        padding: 4,
        background: "#1e1e1c",
      }}
    />
  );
}
