import { useEffect, useState, useCallback } from "react";
import { ChevronRight, FolderOpen, Folder, FileText, FileCode, FileJson, Image, File, RefreshCw, Terminal } from "lucide-react";
import { projects } from "@/lib/api";
import { useTabStore } from "@/stores/tabStore";
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
  const openTab = useTabStore((s) => s.openTab);

  const loadTree = useCallback(() => {
    setLoading(true);
    projects.tree(projectPath).then((data) => {
      setTree(data as unknown as FileNode[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectPath]);

  useEffect(() => {
    loadTree();

    // Live updates via WebSocket
    const url = getWsUrl(`/ws/watch?path=${encodeURIComponent(projectPath)}`);
    const ws = new WebSocket(url);
    ws.onmessage = () => {
      // Debounced reload on any fs_change
      loadTree();
    };
    return () => ws.close();
  }, [projectPath, loadTree]);

  const openFile = (node: FileNode) => {
    openTab({
      id: `file-${projectPath}-${node.path}`,
      type: "file",
      label: node.name,
      projectPath,
      filePath: node.path,
    });
  };

  const openTerminal = () => {
    openTab({
      id: `terminal-${projectPath}-${Date.now()}`,
      type: "terminal",
      label: `Terminal: ${basename(projectPath)}`,
      cwd: projectPath,
    });
  };

  const projectName = basename(projectPath);

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
          <IconButton title="Open terminal" onClick={openTerminal}>
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

      {/* Footer hint */}
      <div style={{
        padding: "8px 16px", fontSize: 11, color: "var(--color-text-tertiary)",
        borderTop: "1px solid var(--color-border-subtle)",
      }}>
        Click files to view · Drag to chat
      </div>
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
