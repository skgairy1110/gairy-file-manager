"use client";

import { useCallback, useEffect, useState } from "react";

interface FolderEntry {
  name: string;
  path: string;
}

export default function MoveFolderPicker({
  title,
  excludePrefixes,
  currentParent,
  onCancel,
  onConfirm,
}: {
  title: string;
  /** Folder paths (with trailing slash) that must not be offered as a destination — the item(s) being
   * moved, plus their own descendants, so you can't move a folder into itself. */
  excludePrefixes: string[];
  /** The folder the item(s) currently live in, so we can disable "move here" when nothing would change. */
  currentParent: string;
  onCancel: () => void;
  onConfirm: (destPrefix: string) => Promise<void>;
}) {
  const [browsePrefix, setBrowsePrefix] = useState("");
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (p: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/folders?prefix=${encodeURIComponent(p)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load folders.");
      const filtered = (data.folders || []).filter(
        (f: FolderEntry) => !excludePrefixes.some((ex) => f.path.startsWith(ex)),
      );
      setFolders(filtered);
      setBrowsePrefix(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folders.");
    } finally {
      setLoading(false);
    }
  }, [excludePrefixes]);

  useEffect(() => {
    load("");
  }, [load]);

  const crumbs = browsePrefix ? browsePrefix.replace(/\/$/, "").split("/") : [];
  const isSameLocation = browsePrefix === currentParent;

  async function handleConfirm() {
    setMoving(true);
    setError("");
    try {
      await onConfirm(browsePrefix);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed.");
      setMoving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface rounded-lg border border-border shadow-xl animate-fade-up">
        <div className="p-4 border-b border-border">
          <p className="text-[13.5px] font-semibold text-ink">{title}</p>
          <p className="text-[12px] text-muted mt-0.5">Choose a destination folder</p>
        </div>

        {/* Breadcrumb */}
        <div className="px-4 py-2.5 border-b border-border font-mono text-[12.5px] text-muted flex items-center flex-wrap gap-1 bg-bg/50">
          <button onClick={() => load("")} className="hover:text-accent transition-colors">
            ~
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-border">/</span>
              <button
                onClick={() => load(crumbs.slice(0, i + 1).join("/") + "/")}
                className="hover:text-accent transition-colors truncate max-w-[100px]"
              >
                {c}
              </button>
            </span>
          ))}
        </div>

        {/* Folder list */}
        <div className="max-h-64 overflow-y-auto p-2">
          {loading ? (
            <p className="text-[13px] text-muted text-center py-8">Loading…</p>
          ) : folders.length === 0 ? (
            <p className="text-[13px] text-muted text-center py-8">No subfolders here</p>
          ) : (
            folders.map((f) => (
              <button
                key={f.path}
                onClick={() => load(f.path)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm hover:bg-bg text-left transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-accent shrink-0">
                  <path
                    d="M3.5 6.75c0-.97.78-1.75 1.75-1.75h4.1c.4 0 .78.16 1.06.44l1.44 1.56h6.9c.97 0 1.75.78 1.75 1.75v9.5c0 .97-.78 1.75-1.75 1.75H5.25c-.97 0-1.75-.78-1.75-1.75v-11.5Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-[13px] text-ink truncate">{f.name}</span>
              </button>
            ))
          )}
        </div>

        {error && (
          <p className="mx-4 mb-2 text-[12.5px] text-danger bg-danger/5 border border-danger/20 rounded-sm px-3 py-2">
            {error}
          </p>
        )}

        <div className="p-3 border-t border-border flex items-center justify-between gap-2">
          <button
            onClick={onCancel}
            className="h-9 px-3.5 rounded-sm text-[13px] text-muted hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={moving || isSameLocation}
            className="h-9 px-4 rounded-sm bg-accent hover:bg-accent/90 text-[13px] font-medium text-white transition-colors disabled:opacity-40"
            title={isSameLocation ? "Already in this folder" : undefined}
          >
            {moving ? "Moving…" : browsePrefix ? "Move here" : "Move to root"}
          </button>
        </div>
      </div>
    </div>
  );
}
