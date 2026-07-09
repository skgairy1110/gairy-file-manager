"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import MoveFolderPicker from "@/components/MoveFolderPicker";
import ImagePreviewModal from "@/components/ImagePreviewModal";

interface FolderEntry {
  name: string;
  path: string;
}

interface FileEntry {
  name: string;
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}

type Toast = { id: number; message: string; tone: "success" | "error" };
type ViewMode = "grid" | "list";
type ItemRef =
  | { kind: "folder"; id: string; name: string }
  | { kind: "file"; id: string; name: string };

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;
const VIEW_STORAGE_KEY = "vault-view-mode";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function FolderIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3.5 6.75c0-.97.78-1.75 1.75-1.75h4.1c.4 0 .78.16 1.06.44l1.44 1.56h6.9c.97 0 1.75.78 1.75 1.75v9.5c0 .97-.78 1.75-1.75 1.75H5.25c-.97 0-1.75-.78-1.75-1.75v-11.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ImageFileIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3.5" y="4" width="17" height="16" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4.5 16.5 8.8 12c.4-.4 1-.4 1.4 0l2.4 2.4M14 13.5l1.2-1.2c.4-.4 1-.4 1.4 0l3 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GridIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ListIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="4.25" width="14" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="9" width="14" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="13.75" width="14" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function KebabIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <circle cx="10" cy="4" r="1.4" />
      <circle cx="10" cy="10" r="1.4" />
      <circle cx="10" cy="16" r="1.4" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M4 10.5l3.5 3.5L16 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Small selection checkbox. Stops propagation so it never triggers the tile/row's own click. */
function SelectCheckbox({
  checked,
  onToggle,
  overlay,
}: {
  checked: boolean;
  onToggle: (shiftKey: boolean) => void;
  overlay?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e.shiftKey);
      }}
      className={`w-5 h-5 rounded-[5px] border flex items-center justify-center transition-colors shrink-0 ${
        checked
          ? "bg-accent border-accent text-white"
          : overlay
          ? "bg-white/85 backdrop-blur border-white/60 text-transparent hover:border-accent/60"
          : "bg-surface border-border text-transparent hover:border-accent/60"
      }`}
      title="Select"
    >
      <CheckIcon className="w-3 h-3" />
    </button>
  );
}

function ItemMenu({
  isFile,
  onRename,
  onMove,
  onCopyLink,
  onDelete,
  onClose,
}: {
  isFile: boolean;
  onRename: () => void;
  onMove: () => void;
  onCopyLink?: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-20 w-40 bg-surface border border-border rounded-sm shadow-lg py-1 animate-fade-up"
    >
      {isFile && onCopyLink && (
        <button
          onClick={onCopyLink}
          className="w-full text-left px-3 py-2 text-[12.5px] text-ink hover:bg-bg transition-colors"
        >
          Copy link
        </button>
      )}
      <button
        onClick={onRename}
        className="w-full text-left px-3 py-2 text-[12.5px] text-ink hover:bg-bg transition-colors"
      >
        Rename
      </button>
      <button
        onClick={onMove}
        className="w-full text-left px-3 py-2 text-[12.5px] text-ink hover:bg-bg transition-colors"
      >
        Move to…
      </button>
      <div className="h-px bg-border my-1" />
      <button
        onClick={onDelete}
        className="w-full text-left px-3 py-2 text-[12.5px] text-danger hover:bg-danger/5 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}

export default function FileManager({
  userName,
  userImage,
}: {
  userName: string;
  userImage: string | null;
}) {
  const [prefix, setPrefixState] = useState("");
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<ItemRef | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [moving, setMoving] = useState<ItemRef | null>(null);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Preview lightbox
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  function setPrefix(p: string) {
    setSelected(new Set());
    setLastSelectedIndex(null);
    setPreviewIndex(null);
    setPrefixState(p);
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "grid" || stored === "list") setViewMode(stored);
  }, []);

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  }

  const pushToast = useCallback((message: string, tone: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/folders?prefix=${encodeURIComponent(p)}`);
      if (!res.ok) throw new Error("Failed to load.");
      const data = await res.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch {
      pushToast("Couldn't load this folder.", "error");
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    load(prefix);
  }, [prefix, load]);

  const crumbs = prefix ? prefix.replace(/\/$/, "").split("/") : [];

  function goTo(index: number) {
    setPrefix(index < 0 ? "" : crumbs.slice(0, index + 1).join("/") + "/");
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, name: newFolderName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create folder.");
      setNewFolderName("");
      setShowNewFolder(false);
      pushToast(`Created "${data.name}"`);
      load(prefix);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Could not create folder.", "error");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleDeleteFolder(folder: FolderEntry) {
    setOpenMenu(null);
    if (!confirm(`Delete "${folder.name}" and everything inside it? This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/folders?prefix=${encodeURIComponent(folder.path)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete folder.");
      pushToast(`Deleted "${folder.name}"`);
      load(prefix);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Could not delete folder.", "error");
    }
  }

  async function handleDeleteFile(file: FileEntry) {
    setOpenMenu(null);
    if (!confirm(`Delete "${file.name}"?`)) return;
    try {
      const res = await fetch(`/api/files?url=${encodeURIComponent(file.url)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete file.");
      pushToast(`Deleted "${file.name}"`);
      load(prefix);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Could not delete file.", "error");
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const arr = Array.from(fileList).filter((f) => IMAGE_EXT.test(f.name) || f.type.startsWith("image/"));
    if (!arr.length) {
      pushToast("Only image files can be uploaded.", "error");
      return;
    }
    setUploading(true);
    let successCount = 0;
    for (const file of arr) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("prefix", prefix);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to upload ${file.name}`);
        successCount++;
      } catch (err) {
        pushToast(err instanceof Error ? err.message : `Failed to upload ${file.name}`, "error");
      }
    }
    setUploading(false);
    if (successCount) {
      pushToast(successCount === 1 ? "Image uploaded" : `${successCount} images uploaded`);
      load(prefix);
    }
  }

  async function copyLink(file: FileEntry) {
    setOpenMenu(null);
    try {
      await navigator.clipboard.writeText(file.url);
      pushToast("Link copied to clipboard");
    } catch {
      pushToast("Couldn't copy link", "error");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }

  // --- Rename ---
  function startRename(item: ItemRef) {
    setOpenMenu(null);
    setRenaming(item);
    setRenameValue(item.name);
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renaming || !renameValue.trim()) return;
    setRenameLoading(true);
    try {
      const endpoint = renaming.kind === "file" ? "/api/files" : "/api/folders";
      const body =
        renaming.kind === "file"
          ? { action: "rename", pathname: renaming.id, newName: renameValue }
          : { action: "rename", path: renaming.id, newName: renameValue };
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rename failed.");
      pushToast("Renamed successfully");
      setRenaming(null);
      load(prefix);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Rename failed.", "error");
    } finally {
      setRenameLoading(false);
    }
  }

  // --- Move (single item) ---
  function startMove(item: ItemRef) {
    setOpenMenu(null);
    setMoving(item);
  }

  async function confirmMove(destPrefix: string) {
    if (!moving) return;
    const endpoint = moving.kind === "file" ? "/api/files" : "/api/folders";
    const body =
      moving.kind === "file"
        ? { action: "move", pathname: moving.id, destPrefix }
        : { action: "move", path: moving.id, destPrefix };
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Move failed.");
    pushToast(`Moved "${moving.name}"`);
    setMoving(null);
    load(prefix);
  }

  // --- Multi-select for images ---
  function toggleSelect(pathname: string, index: number, shiftKey: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedIndex !== null) {
        const [start, end] = [Math.min(lastSelectedIndex, index), Math.max(lastSelectedIndex, index)];
        for (let i = start; i <= end; i++) {
          next.add(files[i].pathname);
        }
      } else if (next.has(pathname)) {
        next.delete(pathname);
      } else {
        next.add(pathname);
      }
      return next;
    });
    setLastSelectedIndex(index);
  }

  function handleTileClick(file: FileEntry, index: number, e: React.MouseEvent) {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleSelect(file.pathname, index, e.shiftKey);
    } else if (selected.size > 0) {
      // While a selection is active, plain clicks toggle instead of opening the preview.
      toggleSelect(file.pathname, index, false);
    } else {
      setPreviewIndex(index);
    }
  }

  function clearSelection() {
    setSelected(new Set());
    setLastSelectedIndex(null);
  }

  async function bulkCopyLinks() {
    const items = files.filter((f) => selected.has(f.pathname));
    if (!items.length) return;
    try {
      await navigator.clipboard.writeText(items.map((f) => f.url).join("\n"));
      pushToast(`Copied ${items.length} link${items.length > 1 ? "s" : ""}`);
    } catch {
      pushToast("Couldn't copy links", "error");
    }
  }

  async function bulkDelete() {
    const items = files.filter((f) => selected.has(f.pathname));
    if (!items.length) return;
    if (!confirm(`Delete ${items.length} selected image${items.length > 1 ? "s" : ""}? This can't be undone.`)) return;
    let successCount = 0;
    for (const file of items) {
      try {
        const res = await fetch(`/api/files?url=${encodeURIComponent(file.url)}`, { method: "DELETE" });
        if (res.ok) successCount++;
      } catch {
        // continue with remaining items
      }
    }
    pushToast(`Deleted ${successCount} image${successCount === 1 ? "" : "s"}`);
    clearSelection();
    load(prefix);
  }

  async function bulkMove(destPrefix: string) {
    const items = files.filter((f) => selected.has(f.pathname));
    let successCount = 0;
    for (const file of items) {
      try {
        const res = await fetch("/api/files", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "move", pathname: file.pathname, destPrefix }),
        });
        if (res.ok) successCount++;
      } catch {
        // continue with remaining items
      }
    }
    pushToast(`Moved ${successCount} image${successCount === 1 ? "" : "s"}`);
    setBulkMoveOpen(false);
    clearSelection();
    load(prefix);
  }

  const isEmpty = !loading && folders.length === 0 && files.length === 0;

  return (
    <div
      className="min-h-screen bg-bg"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-ink flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3 6.5C3 5.67 3.67 5 4.5 5H8l1.5 2H15.5c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5h-11C3.67 16 3 15.33 3 14.5v-8Z"
                  stroke="#FAFAF8"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-semibold text-[14px] text-ink">Vault</span>
          </div>

          <div className="flex items-center gap-3">
            {userImage ? (
              <Image
                src={userImage}
                alt=""
                width={26}
                height={26}
                className="rounded-full border border-border"
              />
            ) : (
              <div className="w-[26px] h-[26px] rounded-full bg-accent-soft text-accent flex items-center justify-center text-[11px] font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-[13px] text-muted hidden sm:inline">{userName}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-[12.5px] text-muted hover:text-ink border border-border rounded-sm px-2.5 py-1.5 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-8 pb-24">
        {/* Breadcrumb + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="font-mono text-[13px] text-muted flex items-center flex-wrap gap-1 min-w-0">
            <button
              onClick={() => goTo(-1)}
              className={`hover:text-accent transition-colors ${prefix === "" ? "text-ink font-medium" : ""}`}
            >
              ~
            </button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-border">/</span>
                <button
                  onClick={() => goTo(i)}
                  className={`hover:text-accent transition-colors truncate max-w-[140px] ${
                    i === crumbs.length - 1 ? "text-ink font-medium" : ""
                  }`}
                >
                  {c}
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View toggle */}
            <div className="flex items-center bg-surface border border-border rounded-sm p-0.5">
              <button
                onClick={() => changeViewMode("grid")}
                className={`h-8 w-8 flex items-center justify-center rounded-sm transition-colors ${
                  viewMode === "grid" ? "bg-ink text-white" : "text-muted hover:text-ink"
                }`}
                title="Thumbnail view"
              >
                <GridIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => changeViewMode("list")}
                className={`h-8 w-8 flex items-center justify-center rounded-sm transition-colors ${
                  viewMode === "list" ? "bg-ink text-white" : "text-muted hover:text-ink"
                }`}
                title="List view"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setShowNewFolder((s) => !s)}
              className="h-9 px-3.5 rounded-sm border border-border bg-surface hover:bg-white text-[13px] font-medium text-ink transition-colors"
            >
              New folder
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-9 px-3.5 rounded-sm bg-accent hover:bg-accent/90 text-[13px] font-medium text-white transition-colors disabled:opacity-60"
            >
              {uploading ? "Uploading…" : "Upload images"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        {/* New folder inline form */}
        {showNewFolder && (
          <form
            onSubmit={handleCreateFolder}
            className="mb-6 flex items-center gap-2 bg-surface border border-border rounded-sm p-2 animate-fade-up"
          >
            <FolderIcon className="w-4 h-4 text-muted ml-1.5 shrink-0" />
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 h-8 px-1 text-[13.5px] bg-transparent focus:outline-none"
            />
            <button
              type="submit"
              disabled={creatingFolder}
              className="h-8 px-3 rounded-sm bg-ink text-white text-[12.5px] font-medium disabled:opacity-60"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderName("");
              }}
              className="h-8 px-3 rounded-sm text-[12.5px] text-muted hover:text-ink"
            >
              Cancel
            </button>
          </form>
        )}

        {/* Content */}
        {loading ? (
          <div className="py-24 text-center text-[13px] text-muted">Loading…</div>
        ) : isEmpty ? (
          <div className="py-24 flex flex-col items-center text-center border border-dashed border-border rounded-lg">
            <ImageFileIcon className="w-8 h-8 text-border mb-3" />
            <p className="text-[14px] text-ink font-medium mb-1">Nothing here yet</p>
            <p className="text-[13px] text-muted max-w-xs">
              Create a folder to organize your files, or drop images anywhere on this page to upload.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {folders.map((folder) => {
              const menuId = `folder:${folder.path}`;
              return (
                <div
                  key={folder.path}
                  className="group relative bg-surface border border-border rounded-lg p-3.5 hover:border-accent/40 transition-colors cursor-pointer"
                  onClick={() => setPrefix(folder.path)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenu(openMenu === menuId ? null : menuId);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-sm flex items-center justify-center text-muted hover:text-ink hover:bg-bg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <KebabIcon className="w-4 h-4" />
                  </button>
                  {openMenu === menuId && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <ItemMenu
                        isFile={false}
                        onRename={() => startRename({ kind: "folder", id: folder.path, name: folder.name })}
                        onMove={() => startMove({ kind: "folder", id: folder.path, name: folder.name })}
                        onDelete={() => handleDeleteFolder(folder)}
                        onClose={() => setOpenMenu(null)}
                      />
                    </div>
                  )}
                  <FolderIcon className="w-6 h-6 text-accent mb-2" />
                  <p className="text-[13px] font-medium text-ink truncate pr-4">{folder.name}</p>
                  <p className="text-[11px] text-muted mt-0.5">Folder</p>
                </div>
              );
            })}

            {files.map((file, index) => {
              const menuId = `file:${file.pathname}`;
              const isSelected = selected.has(file.pathname);
              return (
                <div
                  key={file.url}
                  className={`group relative bg-surface border rounded-lg overflow-hidden transition-colors ${
                    isSelected ? "border-accent ring-1 ring-accent/40" : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="absolute top-2 left-2 z-10">
                    <SelectCheckbox
                      overlay
                      checked={isSelected}
                      onToggle={(shiftKey) => toggleSelect(file.pathname, index, shiftKey)}
                    />
                  </div>
                  <button
                    onClick={() => setOpenMenu(openMenu === menuId ? null : menuId)}
                    className="absolute top-2 right-2 z-10 w-6 h-6 rounded-sm bg-white/90 backdrop-blur flex items-center justify-center text-muted hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <KebabIcon className="w-4 h-4" />
                  </button>
                  {openMenu === menuId && (
                    <ItemMenu
                      isFile
                      onRename={() => startRename({ kind: "file", id: file.pathname, name: file.name })}
                      onMove={() => startMove({ kind: "file", id: file.pathname, name: file.name })}
                      onCopyLink={() => copyLink(file)}
                      onDelete={() => handleDeleteFile(file)}
                      onClose={() => setOpenMenu(null)}
                    />
                  )}
                  <button
                    onClick={(e) => handleTileClick(file, index, e)}
                    className="w-full text-left"
                    title={selected.size > 0 ? "Click to select" : "View image"}
                  >
                    <div className="aspect-square bg-bg flex items-center justify-center overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="p-2.5">
                      <p className="text-[12.5px] font-medium text-ink truncate">{file.name}</p>
                      <p className="text-[11px] text-muted mt-0.5">{formatSize(file.size)}</p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          // LIST VIEW
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[24px_1fr_90px_110px_40px] sm:grid-cols-[24px_1fr_100px_130px_40px] items-center px-4 py-2 border-b border-border bg-bg/50 gap-2">
              <span />
              <span className="text-[11px] font-medium text-muted uppercase tracking-wide">Name</span>
              <span className="text-[11px] font-medium text-muted uppercase tracking-wide">Size</span>
              <span className="text-[11px] font-medium text-muted uppercase tracking-wide hidden sm:block">
                Modified
              </span>
              <span />
            </div>

            {folders.map((folder) => {
              const menuId = `folder:${folder.path}`;
              return (
                <div
                  key={folder.path}
                  className="group relative grid grid-cols-[24px_1fr_90px_110px_40px] sm:grid-cols-[24px_1fr_100px_130px_40px] items-center px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-bg/60 cursor-pointer transition-colors gap-2"
                  onClick={() => setPrefix(folder.path)}
                >
                  <span />
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderIcon className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-[13px] text-ink truncate">{folder.name}</span>
                  </div>
                  <span className="text-[12px] text-muted">—</span>
                  <span className="text-[12px] text-muted hidden sm:block">—</span>
                  <div className="relative flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenu(openMenu === menuId ? null : menuId);
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-white transition-colors"
                    >
                      <KebabIcon className="w-4 h-4" />
                    </button>
                    {openMenu === menuId && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <ItemMenu
                          isFile={false}
                          onRename={() => startRename({ kind: "folder", id: folder.path, name: folder.name })}
                          onMove={() => startMove({ kind: "folder", id: folder.path, name: folder.name })}
                          onDelete={() => handleDeleteFolder(folder)}
                          onClose={() => setOpenMenu(null)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {files.map((file, index) => {
              const menuId = `file:${file.pathname}`;
              const isSelected = selected.has(file.pathname);
              return (
                <div
                  key={file.url}
                  className={`group relative grid grid-cols-[24px_1fr_90px_110px_40px] sm:grid-cols-[24px_1fr_100px_130px_40px] items-center px-4 py-2.5 border-b border-border last:border-b-0 transition-colors gap-2 ${
                    isSelected ? "bg-accent-soft/60" : "hover:bg-bg/60"
                  }`}
                >
                  <SelectCheckbox
                    checked={isSelected}
                    onToggle={(shiftKey) => toggleSelect(file.pathname, index, shiftKey)}
                  />
                  <button
                    onClick={(e) => handleTileClick(file, index, e)}
                    className="flex items-center gap-2.5 min-w-0 text-left"
                    title={selected.size > 0 ? "Click to select" : "View image"}
                  >
                    <div className="w-7 h-7 rounded-sm overflow-hidden bg-bg shrink-0 border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={file.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <span className="text-[13px] text-ink truncate">{file.name}</span>
                  </button>
                  <span className="text-[12px] text-muted">{formatSize(file.size)}</span>
                  <span className="text-[12px] text-muted hidden sm:block">{formatDate(file.uploadedAt)}</span>
                  <div className="relative flex justify-end">
                    <button
                      onClick={() => setOpenMenu(openMenu === menuId ? null : menuId)}
                      className="w-7 h-7 flex items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-white transition-colors"
                    >
                      <KebabIcon className="w-4 h-4" />
                    </button>
                    {openMenu === menuId && (
                      <ItemMenu
                        isFile
                        onRename={() => startRename({ kind: "file", id: file.pathname, name: file.name })}
                        onMove={() => startMove({ kind: "file", id: file.pathname, name: file.name })}
                        onCopyLink={() => copyLink(file)}
                        onDelete={() => handleDeleteFile(file)}
                        onClose={() => setOpenMenu(null)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Bulk selection bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-ink border-t border-black/20 animate-fade-up">
          <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={clearSelection}
                className="w-7 h-7 rounded-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title="Clear selection"
              >
                ×
              </button>
              <span className="text-[13px] text-white font-medium">
                {selected.size} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={bulkCopyLinks}
                className="h-8 px-3 rounded-sm text-[12.5px] font-medium text-white/90 hover:bg-white/10 transition-colors"
              >
                Copy links
              </button>
              <button
                onClick={() => setBulkMoveOpen(true)}
                className="h-8 px-3 rounded-sm text-[12.5px] font-medium text-white/90 hover:bg-white/10 transition-colors"
              >
                Move to…
              </button>
              <button
                onClick={bulkDelete}
                className="h-8 px-3 rounded-sm text-[12.5px] font-medium text-white hover:bg-danger/80 bg-danger/70 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renaming && (
        <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-center justify-center px-4">
          <form
            onSubmit={submitRename}
            className="w-full max-w-sm bg-surface rounded-lg border border-border shadow-xl p-4 animate-fade-up"
          >
            <p className="text-[13.5px] font-semibold text-ink mb-3">Rename &ldquo;{renaming.name}&rdquo;</p>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="w-full h-10 px-3 rounded-sm border border-border bg-surface text-[13.5px] text-ink focus:border-accent transition-colors mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenaming(null)}
                className="h-9 px-3.5 rounded-sm text-[13px] text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renameLoading}
                className="h-9 px-4 rounded-sm bg-accent hover:bg-accent/90 text-[13px] font-medium text-white transition-colors disabled:opacity-60"
              >
                {renameLoading ? "Renaming…" : "Rename"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Move modal (single item) */}
      {moving && (
        <MoveFolderPicker
          title={`Move "${moving.name}"`}
          excludePrefixes={moving.kind === "folder" ? [moving.id] : []}
          currentParent={prefix}
          onCancel={() => setMoving(null)}
          onConfirm={confirmMove}
        />
      )}

      {/* Move modal (bulk) */}
      {bulkMoveOpen && (
        <MoveFolderPicker
          title={`Move ${selected.size} image${selected.size > 1 ? "s" : ""}`}
          excludePrefixes={[]}
          currentParent={prefix}
          onCancel={() => setBulkMoveOpen(false)}
          onConfirm={bulkMove}
        />
      )}

      {/* Image preview */}
      {previewIndex !== null && files[previewIndex] && (
        <ImagePreviewModal
          file={files[previewIndex]}
          hasPrev={previewIndex > 0}
          hasNext={previewIndex < files.length - 1}
          onClose={() => setPreviewIndex(null)}
          onPrev={() => setPreviewIndex((i) => (i !== null ? i - 1 : i))}
          onNext={() => setPreviewIndex((i) => (i !== null ? i + 1 : i))}
          onCopyLink={() => copyLink(files[previewIndex])}
        />
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-30 bg-accent/5 backdrop-blur-[1px] border-4 border-accent/30 flex items-center justify-center pointer-events-none">
          <div className="bg-surface border border-accent/30 rounded-lg px-6 py-4 shadow-lg">
            <p className="text-[14px] font-medium text-ink">Drop images to upload</p>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 items-center">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-toast px-4 py-2.5 rounded-sm text-[13px] font-medium shadow-lg ${
              t.tone === "success" ? "bg-ink text-white" : "bg-danger text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
