"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";

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

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function FileManager({
  userName,
  userImage,
}: {
  userName: string;
  userImage: string | null;
}) {
  const [prefix, setPrefix] = useState("");
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const crumbs = prefix
    ? prefix.replace(/\/$/, "").split("/")
    : [];

  function goTo(index: number) {
    if (index < 0) {
      setPrefix("");
    } else {
      setPrefix(crumbs.slice(0, index + 1).join("/") + "/");
    }
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

      <main className="max-w-5xl mx-auto px-5 py-8">
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

        {/* Grid */}
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
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {folders.map((folder) => (
              <div
                key={folder.path}
                className="group relative bg-surface border border-border rounded-lg p-3.5 hover:border-accent/40 transition-colors cursor-pointer"
                onClick={() => setPrefix(folder.path)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder);
                  }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-sm flex items-center justify-center text-muted hover:text-danger hover:bg-danger/5 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete folder"
                >
                  ×
                </button>
                <FolderIcon className="w-6 h-6 text-accent mb-2" />
                <p className="text-[13px] font-medium text-ink truncate pr-4">{folder.name}</p>
                <p className="text-[11px] text-muted mt-0.5">Folder</p>
              </div>
            ))}

            {files.map((file) => (
              <div
                key={file.url}
                className="group relative bg-surface border border-border rounded-lg overflow-hidden hover:border-accent/40 transition-colors"
              >
                <button
                  onClick={() => handleDeleteFile(file)}
                  className="absolute top-2 right-2 z-10 w-6 h-6 rounded-sm bg-white/90 backdrop-blur flex items-center justify-center text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete image"
                >
                  ×
                </button>
                <button
                  onClick={() => copyLink(file)}
                  className="w-full text-left"
                  title="Copy public link"
                >
                  <div className="aspect-square bg-bg flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="text-[12.5px] font-medium text-ink truncate">{file.name}</p>
                    <p className="text-[11px] text-muted mt-0.5">{formatSize(file.size)}</p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Drag overlay */}
      {dragOver && (
        <div
          className="fixed inset-0 z-30 bg-accent/5 backdrop-blur-[1px] border-4 border-accent/30 flex items-center justify-center pointer-events-none"
        >
          <div className="bg-surface border border-accent/30 rounded-lg px-6 py-4 shadow-lg">
            <p className="text-[14px] font-medium text-ink">Drop images to upload</p>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 items-center">
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
