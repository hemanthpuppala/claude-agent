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
        background: "#1e1e1c",
        foreground: "#ede9e1",
        cursor: "#d4845a",
        cursorAccent: "#1e1e1c",
        selectionBackground: "rgba(212,132,90,0.3)",
        black: "#1e1e1c",
        red: "#ef4444",
        green: "#10b981",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#c084fc",
        cyan: "#5eead4",
        white: "#ede9e1",
        brightBlack: "#706c64",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde68a",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#99f6e4",
        brightWhite: "#ffffff",
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
