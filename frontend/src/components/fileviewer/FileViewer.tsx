import { useEffect, useState } from "react";
import { Copy, Check, FileText, Image, FileWarning } from "lucide-react";
import { useMobile } from "@/hooks/useMobile";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { projects } from "@/lib/api";
import { basename } from "@/lib/utils";
import type { FileContent } from "@/lib/types";

export function FileViewer({ projectPath, filePath }: { projectPath: string; filePath: string }) {
  const [file, setFile] = useState<FileContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { isMobile } = useMobile();

  useEffect(() => {
    setFile(null);
    setError(null);
    projects.file(projectPath, filePath)
      .then((data) => setFile(data as unknown as FileContent))
      .catch((e) => setError(String(e)));
  }, [projectPath, filePath]);

  const handleCopy = async () => {
    if (file?.content) {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (error) {
    return (
      <div style={{
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12,
      }}>
        <FileWarning size={32} color="var(--color-destructive)" />
        <p style={{ fontSize: 14, color: "var(--color-destructive)" }}>{error}</p>
      </div>
    );
  }

  if (!file) {
    return (
      <div style={{
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--color-text-tertiary)", fontSize: 14,
      }}>
        Loading...
      </div>
    );
  }

  if (file.error) {
    return (
      <div style={{
        height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12,
      }}>
        <FileWarning size={32} color="var(--color-warning)" />
        <p style={{ fontSize: 14, color: "var(--color-warning)" }}>{file.error}</p>
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
        background: "var(--color-bg-elevated)",
        flexShrink: 0,
      }}>
        {file.file_type === "image"
          ? <Image size={14} color="var(--color-text-tertiary)" />
          : <FileText size={14} color="var(--color-text-tertiary)" />
        }
        <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--color-text)" }}>
          {basename(filePath)}
        </span>
        {!isMobile && (
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {filePath}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {file.lines && (
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>
            {file.lines} lines
          </span>
        )}
        {file.content && (
          <button
            onClick={handleCopy}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 6, border: "none",
              background: "var(--color-bg-surface)", color: "var(--color-text-secondary)",
              fontSize: 11, cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
          >
            {copied ? <><Check size={12} color="var(--color-success)" /> Copied</> : <><Copy size={12} /> Copy</>}
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {file.file_type === "image" && file.data_uri && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, height: "100%",
          }}>
            <img
              src={file.data_uri}
              alt={basename(filePath)}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
            />
          </div>
        )}

        {file.file_type === "markdown" && file.content && (
          <div style={{ maxWidth: 768, margin: "0 auto", padding: "24px 32px" }} className="claude-markdown">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>
              {file.content}
            </ReactMarkdown>
          </div>
        )}

        {file.file_type === "text" && file.content && (
          <div style={{ padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
              <tbody>
                {file.content.split("\n").map((line, i) => (
                  <tr key={i} style={{ borderBottom: "none" }}>
                    <td style={{
                      width: 50, textAlign: "right", padding: "0 12px 0 0",
                      color: "var(--color-text-tertiary)", userSelect: "none",
                      borderRight: "1px solid var(--color-border-subtle)",
                      fontSize: 12, opacity: 0.6,
                    }}>
                      {i + 1}
                    </td>
                    <td style={{ padding: "0 0 0 12px", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "var(--color-text)" }}>
                      {line || " "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {file.file_type === "binary" && (
          <div style={{
            height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 12,
          }}>
            <FileWarning size={32} color="var(--color-text-tertiary)" />
            <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
              Binary file — cannot preview
            </p>
            <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>
              {file.mime} · {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
