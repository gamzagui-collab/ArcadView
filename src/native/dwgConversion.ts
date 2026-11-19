import { registerPlugin } from "@capacitor/core";
import { AppError, type AppErrorCode, type AppErrorDetails } from "../types/drawing";
import { readIncomingDrawingFile } from "./incomingDrawing";
import { replaceExtension, validateDrawingFileSize } from "../files/fileTypes";
import { normalizeSavedDrawingView, registerSavedDrawingView } from "../viewer/savedView";

interface DwgConversionPlugin {
  supported(): Promise<{ supported: boolean }>;
  begin(): Promise<{ token: string }>;
  append(options: { token: string; data: string }): Promise<void>;
  convert(options: { token: string }): Promise<{ uri: string; size: number; savedView: string }>;
  release(options: { token: string }): Promise<void>;
}
export const dwgConversionPlugin = registerPlugin<DwgConversionPlugin>("DwgConversion");
const cancelled = () => new DOMException("DWG conversion was cancelled.", "AbortError");
let queue: Promise<unknown> = Promise.resolve();

async function convertDrawing(file: File, signal?: AbortSignal): Promise<File> {
  validateDrawingFileSize(file.size);
  if (signal?.aborted) throw cancelled();
  const { token } = await dwgConversionPlugin.begin();
  let releasing: Promise<void> | undefined;
  const release = () => releasing ??= dwgConversionPlugin.release({ token }).catch(() => undefined);
  const abort = () => { void release(); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    for (let offset = 0; offset < file.size; offset += 256 * 1024) {
      if (signal?.aborted) throw cancelled();
      const bytes = new Uint8Array(await file.slice(offset, offset + 256 * 1024).arrayBuffer());
      let text = "";
      for (let start = 0; start < bytes.length; start += 8192) text += String.fromCharCode(...bytes.subarray(start, start + 8192));
      const data = btoa(text);
      const staging = typeof window !== "undefined" ? (window as unknown as {
        IzCadDwgStaging?: { append(token: string, data: string): string | null };
      }).IzCadDwgStaging : undefined;
      if (staging) {
        const error = staging.append(token, data);
        if (error) throw new AppError("FILE_READ_FAILED", error);
      } else {
        await dwgConversionPlugin.append({ token, data });
      }
    }
    if (signal?.aborted) throw cancelled();
    const result = await dwgConversionPlugin.convert({ token });
    if (signal?.aborted) throw cancelled();
    const rendered = await readIncomingDrawingFile({ id: token, uri: result.uri, size: result.size,
      name: replaceExtension(file.name, "dxf"), mimeType: "application/dxf" }, signal);
    const savedView = JSON.parse(result.savedView);
    registerSavedDrawingView(rendered, savedView ? normalizeSavedDrawingView(savedView) : null);
    return rendered;
  } catch (error) {
    if (signal?.aborted) throw cancelled();
    if (error instanceof AppError || error instanceof DOMException) throw error;
    const failure = error as { message?: string; code?: AppErrorCode; data?: AppErrorDetails };
    throw new AppError(failure.code ?? "DWG_CONVERSION_FAILED", failure.message, { details: failure.data, cause: error });
  } finally {
    signal?.removeEventListener("abort", abort);
    await release();
  }
}

export function convertDwgInProcess(file: File, signal?: AbortSignal): Promise<File> {
  const result = queue.then(() => convertDrawing(file, signal));
  queue = result.catch(() => undefined);
  return result;
}
