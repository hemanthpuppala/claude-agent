import { useEffect, useState } from "react";
import { Plus, FolderOpen, Star } from "lucide-react";
import { projects as projectsApi } from "@/lib/api";
import { useOpenTab } from "@/hooks/useOpenTab";
import type { Project } from "@/lib/types";

export function SidebarProjects() {
  const [saved, setSaved] = useState<Project[]>([]);
  const [discovered, setDiscovered] = useState<{ name: string; path: string }[]>([]);
  const { openSession } = useOpenTab();

  useEffect(() => {
    projectsApi.list().then((data) => setSaved(data as unknown as Project[]));
    projectsApi.discover().then(setDiscovered);
  }, []);

  const allPaths = new Set(saved.map((p) => p.path));
  const unsaved = discovered.filter((d) => !allPaths.has(d.path));

  const createSession = async (path: string) => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: path }),
      });
      const data = await res.json();
      openSession(data.session_id, path, "New session");
    } catch (e) {
      console.error("Failed to create session:", e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--color-border-subtle)]">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Projects
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {saved.map((p) => (
          <div key={p.path} className="px-3 py-2 hover:bg-[var(--color-bg-surface)] group">
            <div className="flex items-center gap-2">
              {p.pinned ? (
                <Star size={14} className="text-[var(--color-accent)] fill-current" />
              ) : (
                <FolderOpen size={14} className="text-[var(--color-text-tertiary)]" />
              )}
              <span className="text-[13px] text-[var(--color-text)] truncate flex-1">
                {p.name}
              </span>
            </div>
            <div className="text-[11px] text-[var(--color-text-tertiary)] truncate mt-0.5 pl-5">
              {p.path}
            </div>
            <button
              onClick={() => createSession(p.path)}
              className="mt-1 ml-5 text-[11px] text-[var(--color-accent)] hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
            >
              + New Session
            </button>
          </div>
        ))}

        {unsaved.length > 0 && (
          <>
            <div className="px-4 pt-4 pb-1 text-[11px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider">
              Discovered
            </div>
            {unsaved.map((d) => (
              <div key={d.path} className="px-3 py-2 hover:bg-[var(--color-bg-surface)] group">
                <div className="flex items-center gap-2">
                  <FolderOpen size={14} className="text-[var(--color-text-tertiary)]" />
                  <span className="text-[13px] text-[var(--color-text)] truncate flex-1">
                    {d.name}
                  </span>
                </div>
                <button
                  onClick={() => createSession(d.path)}
                  className="mt-1 ml-5 text-[11px] text-[var(--color-accent)] hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  + New Session
                </button>
              </div>
            ))}
          </>
        )}

        <div className="px-3 py-3 border-t border-[var(--color-border-subtle)] mt-2">
          <button className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors">
            <Plus size={14} />
            Add project path
          </button>
        </div>
      </div>
    </div>
  );
}
