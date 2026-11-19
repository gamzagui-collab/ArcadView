import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import {
  detectDrawingFormat,
  fileSizeLimit,
  validateDrawingFileSize,
} from "../files/fileTypes";
import { AppError } from "../types/drawing";

export type IncomingDrawing = {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  size: number;
};

type PendingDrawingResult = {
  drawing: IncomingDrawing | null;
};

type AcknowledgeDrawingResult = {
  acknowledged: boolean;
};

interface IncomingDrawingPlugin {
  getPendingDrawing(): Promise<PendingDrawingResult>;
  exitApp(): Promise<void>;
  acknowledgeDrawing(options: {
    id: string;
  }): Promise<AcknowledgeDrawingResult>;
  addListener(
    eventName: "drawingReceived",
    listener: (drawing: IncomingDrawing) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "backPressed",
    listener: () => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "appStateChange",
    listener: (state: { isActive: boolean }) => void,
  ): Promise<PluginListenerHandle>;
}

export const incomingDrawingPlugin =
  registerPlugin<IncomingDrawingPlugin>("IncomingDrawing");

async function readLocalBlob(response: Response, limit: number): Promise<Blob> {
  const declaredSize = response.headers.get("content-length");
  if (declaredSize && /^\d+$/.test(declaredSize)) {
    validateDrawingFileSize(Number(declaredSize), limit);
  }
  if (!response.body) {
    return response.blob();
  }

  const reader = response.body.getReader();
  const parts: BlobPart[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) { break; }
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        throw new AppError("FILE_TOO_LARGE");
      }
      // Blob storage can spill to disk; do not retain the entire file as JS arrays.
      parts.push(new Blob([value]));
    }
  } finally {
    reader.releaseLock();
  }
  return new Blob(parts, { type: response.headers.get("content-type") || "" });
}

export async function readIncomingDrawingFile(
  drawing: IncomingDrawing,
  signal?: AbortSignal,
  maxBytes?: number,
): Promise<File> {
  const format = detectDrawingFormat(drawing.name);
  if (!format) {
    throw new AppError("UNSUPPORTED_FORMAT");
  }
  if (
    !drawing.id ||
    !/^(?:content:\/\/|file:\/\/|blob:|data:)/i.test(drawing.uri) ||
    /[\\/\u0000-\u001f\u007f]/.test(drawing.name)
  ) {
    throw new AppError("FILE_READ_FAILED");
  }
  const limit = maxBytes ?? fileSizeLimit(format);
  // Android content providers may report -1 when the size is unknown.
  if (drawing.size >= 0) {
    validateDrawingFileSize(drawing.size, limit);
  }
  const localUrl = Capacitor.convertFileSrc(drawing.uri);
  const response = await fetch(localUrl, { signal, cache: "no-store" });
  if (!response.ok) {
    throw new AppError("FILE_READ_FAILED",
      `Incoming drawing could not be read (${response.status}).`);
  }

  const blob = await readLocalBlob(response, limit);
  validateDrawingFileSize(blob.size, limit);
  if (drawing.size > 0 && blob.size !== drawing.size) {
    throw new AppError("FILE_READ_FAILED", "Incoming drawing size changed while reading.");
  }
  return new File([blob], drawing.name, {
    type: drawing.mimeType || blob.type || "application/octet-stream",
    lastModified: Date.now(),
  });
}
