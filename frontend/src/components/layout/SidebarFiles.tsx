import { useEffect, useState, useCallback } from "react";
import { ChevronRight, FolderOpen, Folder, FileText, FileCode, FileJson, Image, File, RefreshCw, Terminal, Plus } from "lucide-react";
import { projects, terminals as terminalsApi } from "@/lib/api";
import { useOpenTab } from "@/hooks/useOpenTab";
import { TerminalNamePrompt } from "@/components/terminal/TerminalNamePrompt";
import { getWsUrl, basename } from "@/lib/utils";
import type { FileNode } from "@/lib/types";

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
  const { openFile: openFileTab, openTerminal: openTerminalTab } = useOpenTab();

  const loadTree = useCallback(() => {
    setLoading(true);
    projects.tree(projectPath).then((data) => {
      setTree(data as unknown as FileNode[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectPath]);

  const loadTerminals = useCallback(() => {
    terminalsApi.list().then((all) => {
      setTermSessions(all.filter((t) => t.cwd === projectPath || t.project === basename(projectPath)));
    }).catch(() => {});
  }, [projectPath]);

  useEffect(() => {
    loadTree();
    loadTerminals();

    const url = getWsUrl(`/ws/watch?path=${encodeURIComponent(projectPath)}`);
    const ws = new WebSocket(url);
    ws.onmessage = () => loadTree();
    const termInterval = setInterval(loadTerminals, 5000);
    return () => { ws.close(); clearInterval(termInterval); };
  }, [projectPath, loadTree, loadTerminals]);

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
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {projectName}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <IconButton title="New terminal" onClick={() => setShowNamePrompt(true)}>
            <Terminal size={14} />
          </IconButton>
          <IconButton title="Refresh" onClick={loadTree}>
            <RefreshCw size={13} />
          </IconButton>
        </div>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {loading && (
          <div style={{ padding: "20px 16px", fontSize: 12, color: "var(--color-text-tertiary)" }}>
            Loading...
          </div>
        )}
        {!loading && tree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} onFileClick={openFile} />
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

function TreeNode({ node, depth, onFileClick }: { node: FileNode; depth: number; onFileClick: (n: FileNode) => void }) {
  const [expanded, setExpanded] = useState(depth < 1);

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
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </span>
        </button>
        {expanded && node.children?.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} />
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
      <IconComp size={14} color="var(--color-text-tertiary)" style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {node.name}
      </span>
    </button>
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
