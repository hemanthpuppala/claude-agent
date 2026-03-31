import { useEffect, useState, useCallback } from "react";
import { ChevronRight, FolderOpen, Folder, FileText, FileCode, FileJson, Image, File, RefreshCw, Terminal, Plus, GitBranch } from "lucide-react";
import { projects, terminals as terminalsApi } from "@/lib/api";
import { useOpenTab } from "@/hooks/useOpenTab";
import { TerminalNamePrompt } from "@/components/terminal/TerminalNamePrompt";
import { getWsUrl, basename } from "@/lib/utils";
import type { FileNode } from "@/lib/types";

// Git status colors matching VS Code
const GIT_STATUS_COLORS: Record<string, string> = {
  modified: "#E2C08D",    // yellow-ish
  added: "#73C991",       // green
  untracked: "#73C991",   // green
  deleted: "#C74E39",     // red
  renamed: "#73C991",     // green
  conflict: "#E51400",    // bright red
  ignored: "#6B6B6B",     // gray
};

const GIT_STATUS_LETTERS: Record<string, string> = {
  modified: "M",
  added: "A",
  untracked: "U",
  deleted: "D",
  renamed: "R",
  conflict: "!",
};

/** Check if any descendant of a path has git changes */
function hasDescendantChanges(dirPath: string, gitFiles: Record<string, string>): string | null {
  for (const [filePath, status] of Object.entries(gitFiles)) {
    if (status === "ignored") continue;
    if (filePath.startsWith(dirPath + "/")) return status;
  }
  return null;
}

const EXT_ICONS: Record<string, typeof FileText> = {
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode,
  py: FileCode, go: FileCode, rs: FileCode, rb: FileCode,
  json: FileJson, yaml: FileJson, yml: FileJson, toml: FileJson,
  png: Image, jpg: Image, jpeg: Image, gif: Image, svg: Image, webp: Image,
};

export function SidebarFiles({ projectPath }: { projectPath: string }) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [termSessions, setTermSessions] = useState<{ name: string; created_at: number; cwd: string }[]>([]);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [gitStatus, setGitStatus] = useState<{ branch: string | null; files: Record<string, string>; summary?: Record<string, number> } | null>(null);
  const { openFile: openFileTab, openTerminal: openTerminalTab } = useOpenTab();

  const loadTree = useCallback(() => {
    setLoading(true);
    projects.tree(projectPath).then((data) => {
      setTree(data as unknown as FileNode[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectPath]);

  const loadGitStatus = useCallback(() => {
    projects.gitStatus(projectPath).then((data) => {
      if (data.is_git) {
        setGitStatus({ branch: data.branch, files: data.files, summary: data.summary });
      } else {
        setGitStatus(null);
      }
    }).catch(() => {});
  }, [projectPath]);

  const loadTerminals = useCallback(() => {
    terminalsApi.list().then((all) => {
      setTermSessions(all.filter((t) => t.cwd === projectPath || t.project === basename(projectPath)));
    }).catch(() => {});
  }, [projectPath]);

  useEffect(() => {
    loadTree();
    loadGitStatus();
    loadTerminals();

    const url = getWsUrl(`/ws/watch?path=${encodeURIComponent(projectPath)}`);
    const ws = new WebSocket(url);
    ws.onmessage = () => { loadTree(); loadGitStatus(); };
    const termInterval = setInterval(loadTerminals, 5000);
    return () => { ws.close(); clearInterval(termInterval); };
  }, [projectPath, loadTree, loadGitStatus, loadTerminals]);

  const openFile = (node: FileNode) => {
    openFileTab(projectPath, node.path, node.name);
  };

  const openTerminalWithName = (name: string) => {
    openTerminalTab(name, projectPath);
  };

  const projectName = basename(projectPath);
  const defaultTermName = `${projectName}-${termSessions.length + 1}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 44, flexShrink: 0,
        borderBottom: "1px solid var(--color-border-subtle)",
      }}>
        <div style={{ overflow: "hidden", minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
            {projectName}
          </span>
          {gitStatus?.branch && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 1 }}>
              <GitBranch size={10} />
              {gitStatus.branch}
              {gitStatus.summary && Object.keys(gitStatus.summary).length > 0 && (
                <span style={{ marginLeft: 4, display: "flex", gap: 4 }}>
                  {gitStatus.summary.modified && <span style={{ color: GIT_STATUS_COLORS.modified }}>{gitStatus.summary.modified}M</span>}
                  {gitStatus.summary.untracked && <span style={{ color: GIT_STATUS_COLORS.untracked }}>{gitStatus.summary.untracked}U</span>}
                  {gitStatus.summary.added && <span style={{ color: GIT_STATUS_COLORS.added }}>{gitStatus.summary.added}A</span>}
                  {gitStatus.summary.deleted && <span style={{ color: GIT_STATUS_COLORS.deleted }}>{gitStatus.summary.deleted}D</span>}
                </span>
              )}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <IconButton title="New terminal" onClick={() => setShowNamePrompt(true)}>
            <Terminal size={14} />
          </IconButton>
          <IconButton title="Refresh" onClick={loadTree}>
            <RefreshCw size={13} />
          </IconButton>
        </div>
      </div>

      {/* Git Changes section */}
      {gitStatus && Object.keys(gitStatus.files).filter(f => gitStatus.files[f] !== "ignored").length > 0 && (
        <GitChangesSection
          files={gitStatus.files}
          onFileClick={(path) => {
            const name = path.split("/").pop() || path;
            openFileTab(projectPath, path, name);
          }}
        />
      )}

      {/* Tree */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {loading && (
          <div style={{ padding: "20px 16px", fontSize: 12, color: "var(--color-text-tertiary)" }}>
            Loading...
          </div>
        )}
        {!loading && tree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} onFileClick={openFile} gitFiles={gitStatus?.files || {}} />
        ))}
      </div>

      {/* Terminal Sessions */}
      {termSessions.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: "1px solid var(--color-border-subtle)" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 16px 4px",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-text-tertiary)" }}>
              Terminals
            </span>
            <button
              onClick={() => setShowNamePrompt(true)}
              style={{
                width: 20, height: 20, borderRadius: 4, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", color: "var(--color-text-tertiary)", cursor: "pointer",
              }}
            >
              <Plus size={12} />
            </button>
          </div>
          {termSessions.map((t) => (
            <button
              key={t.name}
              onClick={() => openTerminalWithName(t.name)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "6px 16px", border: "none", background: "transparent",
                cursor: "pointer", textAlign: "left", transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <Terminal size={13} color="var(--color-tool-execute)" />
              <span style={{ fontSize: 12, color: "var(--color-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.name}
              </span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--color-text-tertiary)" }}>
                {new Date(t.created_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: "8px 16px", fontSize: 11, color: "var(--color-text-tertiary)",
        borderTop: "1px solid var(--color-border-subtle)", flexShrink: 0,
      }}>
        Click files to view · Drag to chat
      </div>

      {/* Terminal Name Prompt */}
      {showNamePrompt && (
        <TerminalNamePrompt
          defaultName={defaultTermName}
          onConfirm={(name) => {
            setShowNamePrompt(false);
            openTerminalWithName(name);
          }}
          onCancel={() => setShowNamePrompt(false)}
        />
      )}
    </div>
  );
}

function TreeNode({ node, depth, onFileClick, gitFiles }: {
  node: FileNode; depth: number; onFileClick: (n: FileNode) => void;
  gitFiles: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const fileStatus = gitFiles[node.path];
  const isIgnored = fileStatus === "ignored";
  const statusColor = fileStatus ? GIT_STATUS_COLORS[fileStatus] : undefined;
  const statusLetter = fileStatus ? GIT_STATUS_LETTERS[fileStatus] : undefined;

  // For directories: check deep descendants for changes
  const descendantStatus = node.type === "directory" ? hasDescendantChanges(node.path, gitFiles) : null;
  const dirColor = descendantStatus ? GIT_STATUS_COLORS[descendantStatus] : undefined;

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: "flex", alignItems: "center", gap: 4, width: "100%",
            padding: `5px 12px 5px ${12 + depth * 16}px`,
            border: "none", background: "transparent", cursor: "pointer",
            fontSize: 13, color: "var(--color-text)", textAlign: "left",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <ChevronRight
            size={12} color="var(--color-text-tertiary)"
            style={{ transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}
          />
          {expanded
            ? <FolderOpen size={14} color="var(--color-accent)" style={{ flexShrink: 0 }} />
            : <Folder size={14} color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />
          }
          <span style={{
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
            color: dirColor || "var(--color-text)",
          }}>
            {node.name}
          </span>
          {descendantStatus && (
            <span style={{
              width: 7, height: 7, borderRadius: 99,
              background: dirColor, flexShrink: 0,
              opacity: 0.8,
            }} />
          )}
        </button>
        {expanded && node.children?.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} gitFiles={gitFiles} />
        ))}
      </div>
    );
  }

  const IconComp = EXT_ICONS[node.extension || ""] || File;

  return (
    <button
      onClick={() => onFileClick(node)}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", node.path);
        e.dataTransfer.setData("application/x-file-path", node.path);
      }}
      style={{
        display: "flex", alignItems: "center", gap: 6, width: "100%",
        padding: `5px 12px 5px ${12 + (depth + 1) * 16}px`,
        border: "none", background: "transparent", cursor: "pointer",
        fontSize: 13, color: "var(--color-text-secondary)", textAlign: "left",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <IconComp size={14}
        color={isIgnored ? "var(--color-text-disabled)" : statusColor || "var(--color-text-tertiary)"}
        style={{ flexShrink: 0, opacity: isIgnored ? 0.4 : 1 }}
      />
      <span style={{
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
        color: isIgnored ? "var(--color-text-disabled)" : statusColor || "var(--color-text-secondary)",
        opacity: isIgnored ? 0.5 : 1,
        fontStyle: isIgnored ? "italic" : "normal",
      }}>
        {node.name}
      </span>
      {statusLetter && (
        <span style={{
          fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
          color: statusColor, flexShrink: 0, marginRight: 4,
          opacity: 0.9,
        }}>
          {statusLetter}
        </span>
      )}
    </button>
  );
}

function GitChangesSection({ files, onFileClick }: {
  files: Record<string, string>;
  onFileClick: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const changedFiles = Object.entries(files).filter(([, s]) => s !== "ignored");

  if (changedFiles.length === 0) return null;

  return (
    <div style={{ flexShrink: 0, borderBottom: "1px solid var(--color-border-subtle)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 6, width: "100%",
          padding: "6px 12px", border: "none", background: "transparent",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <ChevronRight
          size={12} color="var(--color-text-tertiary)"
          style={{ transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", flexShrink: 0 }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-tertiary)", flex: 1 }}>
          Changes
        </span>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 99,
          background: "var(--color-bg-surface)", color: "var(--color-text-secondary)",
        }}>
          {changedFiles.length}
        </span>
      </button>

      {expanded && (
        <div style={{ paddingBottom: 4 }}>
          {changedFiles.map(([path, status]) => {
            const name = path.split("/").pop() || path;
            const dir = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
            const color = GIT_STATUS_COLORS[status] || "var(--color-text-secondary)";
            const letter = GIT_STATUS_LETTERS[status] || "";

            return (
              <button
                key={path}
                onClick={() => onFileClick(path)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, width: "100%",
                  padding: "4px 12px 4px 28px",
                  border: "none", background: "transparent", cursor: "pointer",
                  textAlign: "left", fontSize: 12, transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg-surface)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ color, fontWeight: 500, flexShrink: 0 }}>{name}</span>
                {dir && (
                  <span style={{ color: "var(--color-text-tertiary)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {dir}
                  </span>
                )}
                <span style={{
                  fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
                  color, flexShrink: 0,
                }}>
                  {letter}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 26, height: 26, borderRadius: 6, border: "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", background: "transparent", color: "var(--color-text-tertiary)",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--color-bg-surface)";
        e.currentTarget.style.color = "var(--color-text)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--color-text-tertiary)";
      }}
    >
      {children}
    </button>
  );
}
