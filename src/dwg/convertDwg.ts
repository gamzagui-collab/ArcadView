import {
  replaceExtension,
  validateDrawingFileSize,
  MAX_CONVERTED_DXF_BYTES,
} from "../files/fileTypes";
import { inspectDwgInput, isLikelyMemoryError } from "./diagnostics";
import {
  AppError,
  type AppErrorCode,
  type DwgDiagnostic,
} from "../types/drawing";
import {
  registerSavedDrawingView,
  type SavedDrawingView,
} from "../viewer/savedView";
import { Capacitor } from "@capacitor/core";
import { convertDwgInProcess, dwgConversionPlugin } from "../native/dwgConversion";
import { convertWithVerifiedDrawingUnits } from "../viewer/verifiedDrawingUnits";
import { cachedDwgConversion } from "./conversionCache";

type DwgWorkerResponse =
  | {
      id: number;
      status: "success";
      output: ArrayBuffer;
      savedView: SavedDrawingView | null;
    }
  | {
      id: number;
      status: "error";
      code: AppErrorCode;
      message: string;
      diagnostic: DwgDiagnostic;
    };

const CONVERSION_TIMEOUT_MS = 10 * 60 * 1000;
let conversionId = 0;

function abortError(): DOMException {
  return new DOMException("DWG conversion was cancelled.", "AbortError");
}

function runConversionWorker(
  input: ArrayBuffer,
  signal?: AbortSignal,
): Promise<{
  output: ArrayBuffer;
  savedView: SavedDrawingView | null;
}> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const id = ++conversionId;
    const diagnostic = inspectDwgInput(input);
    const worker = new Worker(
      new URL("../workers/dwg.worker.ts", import.meta.url),
      {
        type: "module",
        name: "izcad-dwg-converter",
      },
    );
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", handleAbort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };

    const handleAbort = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(abortError());
    };

    const timeout = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(
        new AppError(
          "DWG_CONVERSION_TIMEOUT",
          "DWG conversion timed out.",
          { details: { dwg: diagnostic } },
        ),
      );
    }, CONVERSION_TIMEOUT_MS);

    signal?.addEventListener("abort", handleAbort, { once: true });

    worker.onmessage = (event: MessageEvent<DwgWorkerResponse>) => {
      const response = event.data;
      if (settled || !response || response.id !== id) {
        return;
      }

      settled = true;
      cleanup();
      if (response.status === "success") {
        if (!(response.output instanceof ArrayBuffer) || response.output.byteLength === 0) {
          reject(new AppError("DWG_EXPORT_FAILED", "The DWG worker returned an empty drawing."));
          return;
        }
        resolve({
          output: response.output,
          savedView: response.savedView,
        });
      } else {
        reject(
          new AppError(
            response.code,
            response.message,
            { details: { dwg: response.diagnostic } },
          ),
        );
      }
    };

    worker.onerror = (event) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(
        new AppError(
          isLikelyMemoryError(event.message) ? "DWG_MEMORY_LIMIT" : "DWG_RUNTIME_MISSING",
          event.message || "DWG conversion worker could not start.",
          { details: { dwg: diagnostic } },
        ),
      );
    };

    worker.onmessageerror = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(new AppError("DWG_CONVERSION_FAILED", "The DWG worker response could not be read."));
    };

    try {
      worker.postMessage(
        { id, input, baseUrl: document.baseURI },
        [input],
      );
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
    }
  });
}

export async function convertDwgToDxf(
  file: File,
  signal?: AbortSignal,
  onConversionStart?: () => void,
): Promise<File> {
  return convertWithVerifiedDrawingUnits(file, () => cachedDwgConversion(file, () => convertDwg(file, signal), signal, onConversionStart), signal);
}

async function convertDwg(file: File, signal?: AbortSignal): Promise<File> {
  if (Capacitor.getPlatform() === "android" && (await dwgConversionPlugin.supported()).supported) {
    return convertDwgInProcess(file, signal);
  }
  try {
    if (signal?.aborted) {
      throw abortError();
    }
    validateDrawingFileSize(file.size);
    let input: ArrayBuffer;
    try {
      input = await file.arrayBuffer();
    } catch (error) {
      if (signal?.aborted) {
        throw abortError();
      }
      throw new AppError("FILE_READ_FAILED", "The DWG file could not be read.", { cause: error });
    }
    const { output, savedView } = await runConversionWorker(
      input,
      signal,
    );
    if (signal?.aborted) {
      throw abortError();
    }
    validateDrawingFileSize(output.byteLength, MAX_CONVERTED_DXF_BYTES);

    const renderFile = new File(
      [output],
      replaceExtension(file.name, "dxf"),
      {
        type: "application/dxf",
        lastModified: Date.now(),
      },
    );
    registerSavedDrawingView(renderFile, savedView);
    return renderFile;
  } catch (error) {
    if (
      error instanceof AppError ||
      (error instanceof DOMException && error.name === "AbortError")
    ) {
      throw error;
    }

    throw new AppError(
      "DWG_CONVERSION_FAILED",
      "DWG could not be converted to DXF.",
      { cause: error },
    );
  }
}
