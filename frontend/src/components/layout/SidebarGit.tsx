import { useEffect, useState, useCallback } from "react";
import { GitBranch, RefreshCw } from "lucide-react";
import { projects } from "@/lib/api";
import { useTabStore } from "@/stores/tabStore";
import { useOpenTab } from "@/hooks/useOpenTab";
import { getWsUrl, basename } from "@/lib/utils";
import { GIT_STATUS_COLORS, GIT_STATUS_LETTERS } from "@/lib/constants";

export function SidebarGit() {
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const projectPath = activeTab?.project || activeTab?.cwd || activeTab?.projectPath || "";
  const projectName = projectPath ? basename(projectPath) : "";
  const { openFile } = useOpenTab();

  const [gitData, setGitData] = useState<{
    branch: string | null;
    files: Record<string, string>;
    summary?: Record<string, number>;
  } | null>(null);

  const loadGit = useCallback(() => {
    if (!projectPath) return;
    projects.gitStatus(projectPath).then((data) => {
      if (data.is_git) {
        setGitData({ branch: data.branch, files: data.files, summary: data.summary });
      } else {
        setGitData(null);
      }
    }).catch(() => {});
  }, [projectPath]);

  useEffect(() => {
    loadGit();
    if (!projectPath) return;
    const url = getWsUrl(`/ws/watch?path=${encodeURIComponent(projectPath)}`);
    const ws = new WebSocket(url);
    ws.onmessage = () => loadGit();
    return () => ws.close();
  }, [projectPath, loadGit]);

  const changedFiles = gitData
    ? Object.entries(gitData.files).filter(([, s]) => s !== "ignored")
    : [];

  if (!projectPath) {
    return (
      <div style={{ padding: 20, fontSize: 12, color: "var(--color-text-tertiary)" }}>
        Open a session to view source control.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 44, flexShrink: 0,
        borderBottom: "1px solid var(--color-border-subtle)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GitBranch size={13} color="var(--color-accent)" />
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-secondary)" }}>
            Source Control
          </span>
        </div>
        <button
          onClick={loadGit}
          style={{
            width: 26, height: 26, borderRadius: 6, border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", background: "transparent", color: "var(--color-text-tertiary)",
          }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Branch info */}
      {gitData?.branch && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}>
          <GitBranch size={14} color="var(--color-text-secondary)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>
            {gitData.branch}
          </span>
          <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
            {projectName}
          </span>
        </div>
      )}

      {/* Changes list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!gitData && (
          <div style={{ padding: 20, fontSize: 12, color: "var(--color-text-tertiary)", textAlign: "center" }}>
            Not a git repository
          </div>
        )}

        {gitData && changedFiles.length === 0 && (
          <div style={{ padding: 20, fontSize: 12, color: "var(--color-text-tertiary)", textAlign: "center" }}>
            No changes
          </div>
        )}

        {changedFiles.length > 0 && (
          <>
            <div style={{
              padding: "8px 16px 4px",
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.05em", color: "var(--color-text-tertiary)",
            }}>
              Changes
              <span style={{
                marginLeft: 8, padding: "1px 6px", borderRadius: 99,
                background: "var(--color-bg-surface)", fontSize: 10, fontWeight: 600,
              }}>
                {changedFiles.length}
              </span>
            </div>

            {changedFiles.map(([path, status]) => {
              const name = path.split("/").pop() || path;
              const dir = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
              const color = GIT_STATUS_COLORS[status] || "var(--color-text-secondary)";
              const letter = GIT_STATUS_LETTERS[status] || "";

              return (
                <button
                  key={path}
                  onClick={() => openFile(projectPath, path, name)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "6px 16px", border: "none", background: "transparent",
                    cursor: "pointer", textAlign: "left",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{
                    fontSize: 13, fontWeight: 500, color,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    flexShrink: 0, maxWidth: "45%",
                  }}>
                    {name}
                  </span>
                  {dir && (
                    <span style={{
                      fontSize: 11, color: "var(--color-text-tertiary)", flex: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {dir}
                    </span>
                  )}
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)",
                    color, flexShrink: 0,
                  }}>
                    {letter}
                  </span>
                </button>
              );
            })}
          </>
        )}

        {/* Summary */}
        {gitData?.summary && Object.keys(gitData.summary).length > 0 && (
          <div style={{
            padding: "12px 16px", marginTop: 8,
            borderTop: "1px solid var(--color-border-subtle)",
            display: "flex", gap: 12, fontSize: 11, color: "var(--color-text-tertiary)",
          }}>
            {gitData.summary.modified && <span style={{ color: GIT_STATUS_COLORS.modified }}>{gitData.summary.modified} modified</span>}
            {gitData.summary.untracked && <span style={{ color: GIT_STATUS_COLORS.untracked }}>{gitData.summary.untracked} untracked</span>}
            {gitData.summary.added && <span style={{ color: GIT_STATUS_COLORS.added }}>{gitData.summary.added} added</span>}
            {gitData.summary.deleted && <span style={{ color: GIT_STATUS_COLORS.deleted }}>{gitData.summary.deleted} deleted</span>}
          </div>
        )}
      </div>
    </div>
  );
}
