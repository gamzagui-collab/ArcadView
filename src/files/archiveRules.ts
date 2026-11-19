import { detectDrawingFormat, MAX_ARCHIVE_FILE_BYTES } from "./fileTypes";
import type { DrawingFormat } from "../types/drawing";

export const ARCHIVE_LIMITS = {
  compressedBytes: MAX_ARCHIVE_FILE_BYTES,
  entryBytes: 128 * 1024 * 1024,
  expandedBytes: 128 * 1024 * 1024,
  entries: 1000,
  depth: 16,
} as const;

export type ArchiveErrorCode = "OPEN_FAILED" | "ENCRYPTED" | "LIMIT_EXCEEDED" | "INVALID_PATH";
export class ArchiveError extends Error {
  constructor(public readonly code: ArchiveErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "ArchiveError";
  }
}

export type ArchiveEntry = {
  path: string;
  size: number;
  directory: boolean;
  supported: boolean;
  format: DrawingFormat | null;
};
export type ExtractedArchiveFile = { path: string; file: File };

export function throwIfArchiveAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("Archive operation cancelled.", "AbortError");
}

/** Archive names are always relative to a new library folder. */
export function normalizeArchivePath(name: string): string {
  if (!name || name.length > 2048 || /^[\\/]/.test(name) || /[\u0000-\u001f\u007f:]/.test(name)) {
    throw new ArchiveError("INVALID_PATH");
  }
  const parts = name.replace(/\\/g, "/").split("/")
    .filter((part) => part !== "" && part !== ".")
    .map((part) => part.normalize("NFC").trim().replace(/\s+/g, " "));
  if (parts.length === 0 || parts.length > ARCHIVE_LIMITS.depth ||
      parts.some((part) => part === ".." || part === "." || !part || part.length > 220)) {
    throw new ArchiveError("INVALID_PATH");
  }
  return parts.join("/");
}

export function archiveEntry(path: string, size: number, directory = false, regular = true): ArchiveEntry {
  const normalized = normalizeArchivePath(path);
  const format = directory || !regular ? null : detectDrawingFormat(normalized);
  return {
    path: normalized, size, directory, format,
    supported: regular && !directory && size > 0 &&
      (format === "dxf" || format === "dwg" || format === "pdf"),
  };
}

export function validateArchiveEntries(entries: readonly ArchiveEntry[]): void {
  if (entries.length > ARCHIVE_LIMITS.entries) throw new ArchiveError("LIMIT_EXCEEDED");
  let total = 0;
  const names = new Set<string>();
  for (const entry of entries) {
    const path = normalizeArchivePath(entry.path).toLocaleLowerCase("en-US");
    if (names.has(path)) throw new ArchiveError("INVALID_PATH");
    names.add(path);
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > ARCHIVE_LIMITS.entryBytes) {
      throw new ArchiveError("LIMIT_EXCEEDED");
    }
    if (!entry.directory) total += entry.size;
    if (total > ARCHIVE_LIMITS.expandedBytes) throw new ArchiveError("LIMIT_EXCEEDED");
  }
}
