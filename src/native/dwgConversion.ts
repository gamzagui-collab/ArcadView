import { Capacitor, registerPlugin } from "@capacitor/core";
import { registerNativeDwgMetadata, validateNativeDwgMetadata } from "../dwg/nativeMetadata";
import { AppError, type AppErrorCode, type AppErrorDetails } from "../types/drawing";
import { readIncomingDrawingFile } from "./incomingDrawing";
import { replaceExtension, validateDrawingFileSize, MAX_CONVERTED_DXF_BYTES } from "../files/fileTypes";
import { isLikelyMemoryError } from "../dwg/diagnostics";
import { normalizeSavedDrawingView, registerSavedDrawingView } from "../viewer/savedView";

interface DwgConversionPlugin {
  supported(): Promise<{ supported: boolean }>;
  begin(): Promise<{ token: string }>;
  append(options: { token: string; data: string }): Promise<void>;
  convert(options: { token: string }): Promise<{ uri: string; size: number; savedView: string; metadataUri?:string }>;
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
      name: replaceExtension(file.name, "dxf"), mimeType: "application/dxf" }, signal, MAX_CONVERTED_DXF_BYTES);
    const savedView = JSON.parse(result.savedView);
    registerSavedDrawingView(rendered, savedView ? normalizeSavedDrawingView(savedView) : null);
    if(result.metadataUri){
      const response=await fetch(Capacitor.convertFileSrc(result.metadataUri),{signal,cache:"no-store"});
      if(!response.ok)throw new AppError("DWG_EXPORT_FAILED","Native metadata could not be read.");
      const text=await response.text();if(text.length>16*1024*1024)throw new AppError("DWG_EXPORT_FAILED","Native metadata too large.");
      registerNativeDwgMetadata(rendered,validateNativeDwgMetadata(JSON.parse(text)));
    }
    return rendered;
  } catch (error) {
    if (signal?.aborted) throw cancelled();
    if (isLikelyMemoryError(error)) throw new AppError("DWG_MEMORY_LIMIT", undefined, {cause:error});
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
