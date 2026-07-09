"use client";

import { useEffect } from "react";

interface FileEntry {
  name: string;
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImagePreviewModal({
  file,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
  onCopyLink,
}: {
  file: FileEntry;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCopyLink: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex flex-col animate-fade-up"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-5 h-14 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-white truncate max-w-[60vw]">{file.name}</p>
          <p className="text-[11.5px] text-white/50">{formatSize(file.size)}</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xl leading-none"
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Image area */}
      <div className="flex-1 flex items-center justify-center px-6 relative min-h-0">
        {hasPrev && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            className="absolute left-3 sm:left-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="Previous"
          >
            ‹
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.url}
          alt={file.name}
          className="max-w-full max-h-[70vh] object-contain rounded-sm shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />

        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-3 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            title="Next"
          >
            ›
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-center px-5 py-5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCopyLink}
          className="h-10 px-5 rounded-sm bg-white hover:bg-white/90 text-ink text-[13.5px] font-medium transition-colors flex items-center gap-2"
        >
          <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
            <path
              d="M8 12a3 3 0 0 0 3 3l2.5-2.5a3 3 0 0 0-4.24-4.24l-.5.5M12 8a3 3 0 0 0-3-3L6.5 7.5a3 3 0 0 0 4.24 4.24l.5-.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Copy link
        </button>
      </div>
    </div>
  );
}
