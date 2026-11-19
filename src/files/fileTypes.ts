import type { DrawingFile, DrawingFormat } from "../types/drawing";
import { AppError } from "../types/drawing";

const SUPPORTED_EXTENSIONS = new Set<DrawingFormat>(["dxf", "dwg", "pdf", "zip", "rar"]);

// Admission/storage limits, not a promise that every drawing fits in RAM.
export const MAX_DRAWING_FILE_BYTES = 512 * 1024 * 1024;
export const MAX_CONVERTED_DXF_BYTES = 1024 * 1024 * 1024;
export const MAX_DERIVED_CACHE_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_PDF_FILE_BYTES = 128 * 1024 * 1024;
export const MAX_ARCHIVE_FILE_BYTES = 64 * 1024 * 1024;

export const DRAWING_FILE_ACCEPT =
  ".dxf,.dwg,.pdf,.zip,.rar,application/dxf,application/acad,application/x-acad,application/autocad_dwg,image/vnd.dwg,application/pdf,application/zip,application/x-zip-compressed,application/vnd.rar,application/x-rar-compressed,application/octet-stream";

export function isCadFormat(format: DrawingFormat): format is "dxf" | "dwg" {
  return format === "dxf" || format === "dwg";
}

export function isArchiveFormat(format: DrawingFormat): format is "zip" | "rar" {
  return format === "zip" || format === "rar";
}

export function fileSizeLimit(format: DrawingFormat): number {
  return isArchiveFormat(format) ? MAX_ARCHIVE_FILE_BYTES : format === "pdf" ? MAX_PDF_FILE_BYTES : MAX_DRAWING_FILE_BYTES;
}

export function getFileExtension(fileName: string): string {
  const name = fileName.trim();
  const lastDot = name.lastIndexOf(".");
  if (lastDot < 0 || lastDot === name.length - 1) {
    return "";
  }

  return name.slice(lastDot + 1).toLowerCase();
}

export function detectDrawingFormat(fileName: string): DrawingFormat | null {
  const extension = getFileExtension(fileName);
  return SUPPORTED_EXTENSIONS.has(extension as DrawingFormat)
    ? (extension as DrawingFormat)
    : null;
}

export function toDrawingFile(file: File): DrawingFile {
  const format = detectDrawingFormat(file.name);
  if (!format || /[\\/\u0000-\u001f\u007f]/.test(file.name)) {
    throw new AppError("UNSUPPORTED_FORMAT");
  }

  validateDrawingFileSize(file.size, fileSizeLimit(format));

  return {
    file,
    name: file.name,
    format,
    size: file.size,
  };
}

export function validateDrawingFileSize(size: number, limit = MAX_DRAWING_FILE_BYTES): void {
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new AppError("FILE_READ_FAILED");
  }
  if (size === 0) {
    throw new AppError("EMPTY_FILE");
  }
  if (size > limit) {
    throw new AppError("FILE_TOO_LARGE");
  }
}

export function replaceExtension(fileName: string, extension: string): string {
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return `${baseName}.${extension.replace(/^\./, "")}`;
}
