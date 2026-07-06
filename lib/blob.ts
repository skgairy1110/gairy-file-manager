import { put, list, del, copy } from "@vercel/blob";

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
  await put(path, "folder placeholder — safe to ignore", {
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

/** Lists every blob (no folding) under a prefix, paginating through cursors. */
async function listAllBlobs(prefix: string) {
  let cursor: string | undefined = undefined;
  const blobs: Awaited<ReturnType<typeof list>>["blobs"] = [];
  let hasMore = true;

  while (hasMore) {
    const res: Awaited<ReturnType<typeof list>> = await list({
      prefix,
      cursor,
      limit: 1000,
    });
    blobs.push(...res.blobs);
    hasMore = res.hasMore;
    cursor = res.cursor;
  }

  return blobs;
}

/** Renames a file in place (same folder, new filename). */
export async function renameFile(pathname: string, newName: string) {
  const safeName = sanitizeSegment(newName);
  const lastSlash = pathname.lastIndexOf("/");
  const parent = lastSlash >= 0 ? pathname.slice(0, lastSlash + 1) : "";
  const newPathname = `${parent}${safeName}`;

  if (newPathname === pathname) {
    throw new Error("That's already the current name.");
  }

  const result = await copy(pathname, newPathname, {
    access: "public",
    addRandomSuffix: false,
  });
  await del(pathname);
  return result;
}

/** Moves a file into a different folder, keeping its filename. */
export async function moveFile(pathname: string, destPrefix: string) {
  const dest = normalizePrefix(destPrefix);
  const filename = pathname.split("/").pop() || pathname;
  const newPathname = `${dest}${filename}`;

  if (newPathname === pathname) {
    throw new Error("The file is already in that folder.");
  }

  const result = await copy(pathname, newPathname, {
    access: "public",
    addRandomSuffix: false,
  });
  await del(pathname);
  return result;
}

/** Copies every blob under oldPrefix to a new prefix, then deletes the originals. */
async function relocateFolder(oldPrefix: string, newPrefix: string) {
  if (newPrefix === oldPrefix) {
    throw new Error("That's already the current location.");
  }
  if (newPrefix.startsWith(oldPrefix)) {
    throw new Error("Can't move a folder into itself or one of its own subfolders.");
  }

  const blobs = await listAllBlobs(oldPrefix);
  for (const blob of blobs) {
    const relative = blob.pathname.slice(oldPrefix.length);
    const newPathname = `${newPrefix}${relative}`;
    await copy(blob.pathname, newPathname, {
      access: "public",
      addRandomSuffix: false,
    });
  }

  if (blobs.length) {
    await del(blobs.map((b) => b.url));
  }

  return newPrefix;
}

/** Renames a folder (keeps it in the same parent, changes its own name). */
export async function renameFolder(oldPrefix: string, newName: string) {
  const normalized = normalizePrefix(oldPrefix);
  const safeName = sanitizeSegment(newName);
  const trimmed = normalized.replace(/\/$/, "");
  const parent = trimmed.includes("/") ? trimmed.slice(0, trimmed.lastIndexOf("/") + 1) : "";
  const newPrefix = `${parent}${safeName}/`;
  return relocateFolder(normalized, newPrefix);
}

/** Moves a folder into a different parent folder, keeping its own name. */
export async function moveFolder(oldPrefix: string, destPrefix: string) {
  const normalized = normalizePrefix(oldPrefix);
  const dest = normalizePrefix(destPrefix);
  const trimmed = normalized.replace(/\/$/, "");
  const folderName = trimmed.split("/").pop() || trimmed;
  const newPrefix = `${dest}${folderName}/`;
  return relocateFolder(normalized, newPrefix);
}

/** Recursively deletes every blob under a folder prefix, including nested folders. */
export async function deleteFolder(prefix: string) {
  const normalized = normalizePrefix(prefix);
  if (!normalized) throw new Error("Refusing to delete the root.");

  const blobs = await listAllBlobs(normalized);
  if (blobs.length) {
    await del(blobs.map((b) => b.url));
  }
}
