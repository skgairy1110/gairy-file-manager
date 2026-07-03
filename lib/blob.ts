import { put, list, del } from "@vercel/blob";

const KEEP_FILE = ".keep";

/** Sanitize a single path segment: no slashes, no traversal, no leading dots (except allowed chars). */
export function sanitizeSegment(segment: string): string {
  const cleaned = segment
    .trim()
    .replace(/[\\/]/g, "")
    .replace(/\.\./g, "")
    .replace(/[^a-zA-Z0-9 _\-.()]/g, "");
  if (!cleaned) throw new Error("Invalid name.");
  return cleaned;
}

/** Normalize a folder path: strip leading/trailing slashes, collapse doubles, block traversal. */
export function normalizePrefix(prefix: string | null | undefined): string {
  if (!prefix) return "";
  const parts = prefix
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== "." && p !== "..");
  return parts.length ? parts.join("/") + "/" : "";
}

export interface FolderEntry {
  name: string;
  path: string; // full prefix including trailing slash
}

export interface FileEntry {
  name: string;
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}

export async function listContents(prefix: string) {
  const normalized = normalizePrefix(prefix);
  const result = await list({ mode: "folded", prefix: normalized });

  const folders: FolderEntry[] = (result.folders || []).map((folderPath) => {
    const trimmed = folderPath.replace(/\/$/, "");
    const name = trimmed.split("/").pop() || trimmed;
    return { name, path: folderPath };
  });

  const files: FileEntry[] = result.blobs
    .filter((b) => !b.pathname.endsWith(`/${KEEP_FILE}`) && !b.pathname.endsWith(KEEP_FILE))
    .map((b) => ({
      name: b.pathname.split("/").pop() || b.pathname,
      url: b.url,
      pathname: b.pathname,
      size: b.size,
      uploadedAt:
        typeof b.uploadedAt === "string" ? b.uploadedAt : new Date(b.uploadedAt).toISOString(),
    }));

  return { folders, files, prefix: normalized };
}

export async function createFolder(prefix: string, name: string) {
  const parent = normalizePrefix(prefix);
  const safeName = sanitizeSegment(name);
  const path = `${parent}${safeName}/${KEEP_FILE}`;
  await put(path, "", {
    access: "public",
    addRandomSuffix: false,
    contentType: "text/plain",
  });
  return { name: safeName, path: `${parent}${safeName}/` };
}

export async function uploadImage(prefix: string, file: File) {
  const parent = normalizePrefix(prefix);
  const safeName = sanitizeSegment(file.name);
  const path = `${parent}${safeName}`;
  const blob = await put(path, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type || undefined,
  });
  return blob;
}

export async function deleteFile(url: string) {
  await del(url);
}

/** Recursively deletes every blob under a folder prefix, including nested folders. */
export async function deleteFolder(prefix: string) {
  const normalized = normalizePrefix(prefix);
  if (!normalized) throw new Error("Refusing to delete the root.");

  let cursor: string | undefined = undefined;
  const urls: string[] = [];
  let hasMore = true;

  while (hasMore) {
    const res: Awaited<ReturnType<typeof list>> = await list({
      prefix: normalized,
      cursor,
      limit: 1000,
    });
    urls.push(...res.blobs.map((b) => b.url));
    hasMore = res.hasMore;
    cursor = res.cursor;
  }

  if (urls.length) {
    await del(urls);
  }
}
