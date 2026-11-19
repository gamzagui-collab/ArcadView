import {
  classifyEngineError,
  engineErrorName,
  inspectDwgInput,
  isLikelyMemoryError,
} from "../dwg/diagnostics";
import {
  restoreDxfLayerStates,
  type SavedDwgLayerState,
  type SavedDwgLayerStates,
} from "../dwg/layerVisibility";
import { annotateDxfXclips, type SavedDwgSpatialFilters } from "../dwg/xclipMetadata";
import { MAX_CONVERTED_DXF_BYTES } from "../files/fileTypes";
import type {
  AppErrorCode,
  DwgDiagnostic,
} from "../types/drawing";
import {
  normalizeSavedDrawingView,
  type DrawingPoint,
  type SavedDrawingView,
} from "../viewer/savedView";

type DwgRequest = {
  id: number;
  input: ArrayBuffer;
  baseUrl: string;
};

type DwgSuccess = {
  id: number;
  status: "success";
  output: ArrayBuffer;
  savedView: SavedDrawingView | null;
};

type DwgFailure = {
  id: number;
  status: "error";
  code: AppErrorCode;
  message: string;
  diagnostic: DwgDiagnostic;
};

type LibreDwgFileSystem = {
  writeFile(path: string, data: Uint8Array, options?: { canOwn: boolean }): void;
  readFile(path: string): Uint8Array;
  stat(path: string): { size: number };
  unlink(path: string): void;
};

type LibreDwgModule = {
  HEAPU8: Uint8Array;
  FS: LibreDwgFileSystem;
  dwg_abandon(data: number): void;
  dwg_dynapi_entity_value(
    object: number,
    field: string,
  ): { data?: unknown } | null;
  dwg_free(data: number): void;
  dwg_get_num_objects(data: number): number;
  dwg_get_object(data: number, index: number): number;
  dwg_obj_layer_get_name(layer: number): string;
  dwg_obj_table_get_name(table: number): string;
  dwg_object_get_fixedtype(object: number): number;
  dwg_object_get_dxfname(object: number): string;
  dwg_object_get_handle_object(object: number): { value: bigint | number };
  dwg_ptr_to_double_array(pointer: number, count: number): number[];
  dwg_object_to_object_tio(object: number): number;
  dwg_read_file(inputPath: string): {
    data: number;
    error: number;
  };
  dwg_write_dxf(inputPath: string, outputPath: string): number;
};

type LibreDwgFactory = (options: {
  locateFile(path: string): string;
  print(message: string): void;
  printErr(message: string): void;
  onMemoryGrowthFailed(bytes: number): void;
}) => Promise<LibreDwgModule>;

const workerScope = self as DedicatedWorkerGlobalScope;

class DwgWorkerError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly diagnostic: DwgDiagnostic,
  ) {
    super(message);
    this.name = "DwgWorkerError";
  }
}

function assetUrl(baseUrl: string, path: string): string {
  return new URL(`wasm/${path}`, baseUrl).href;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const needle = new TextEncoder().encode(value);
  outer: for (let offset = 0; offset <= bytes.length - needle.length; offset += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (bytes[offset + index] !== needle[index]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

function unlinkIfPresent(
  fileSystem: LibreDwgFileSystem,
  path: string,
): void {
  try {
    fileSystem.unlink(path);
  } catch {
    // The conversion may fail before a temporary file is created.
  }
}

function dynapiBoolean(
  runtime: LibreDwgModule,
  object: number,
  field: string,
): boolean {
  return Boolean(
    runtime.dwg_dynapi_entity_value(object, field)?.data,
  );
}

function dynapiData(
  runtime: LibreDwgModule,
  object: number,
  field: string,
): unknown {
  return runtime.dwg_dynapi_entity_value(object, field)?.data;
}

function dynapiNumber(
  runtime: LibreDwgModule,
  object: number,
  field: string,
): number | undefined {
  const value = dynapiData(runtime, object, field);
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function dynapiPoint(
  runtime: LibreDwgModule,
  object: number,
  field: string,
): DrawingPoint | null {
  const value = dynapiData(runtime, object, field);
  if (!value || typeof value !== "object") {
    return null;
  }

  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    typeof point.y === "number" &&
    Number.isFinite(point.y)
    ? { x: point.x, y: point.y }
    : null;
}

type SavedDwgMetadata = {
  layerStates: SavedDwgLayerStates | null;
  savedView: SavedDrawingView | null;
  spatialFilters: SavedDwgSpatialFilters | null;
};

function readSavedDwgMetadata(
  runtime: LibreDwgModule,
  inputPath: string,
): SavedDwgMetadata {
  const layerType = 51;
  const viewportType = 65;
  let data = 0;

  try {
    const result = runtime.dwg_read_file(inputPath);
    data = result.data;
    if (result.error & 8192) throw new RangeError("DWG metadata allocation failed.");
    // LibreDWG defines CLASSESNOTFOUND (128) and larger codes as critical.
    // Optional layer/view metadata must not traverse an incomplete database.
    if (!data || result.error >= 128) {
      return {
        layerStates: null,
        savedView: null,
        spatialFilters: null,
      };
    }

    const states = new Map<string, SavedDwgLayerState>();
    const spatialFilters = new Map<string, { inverseTransform: number[]; transform: number[]; enabled: boolean }>();
    let savedView: SavedDrawingView | null = null;
    let activeViewportView: SavedDrawingView | null = null;
    const objectCount = runtime.dwg_get_num_objects(data);
    for (let index = 0; index < objectCount; index += 1) {
      const object = runtime.dwg_get_object(data, index);
      const fixedType = runtime.dwg_object_get_fixedtype(object);
      if (fixedType > 500 && runtime.dwg_object_get_dxfname(object) === "SPATIAL_FILTER") {
        const filter = runtime.dwg_object_to_object_tio(object);
        const array = (field: string) => { const pointer = dynapiNumber(runtime, filter, field); return pointer ? runtime.dwg_ptr_to_double_array(pointer, 12) : []; };
        const inverseTransform = array("inverse_transform"), transform = array("transform");
        if (inverseTransform.length === 12 && transform.length === 12 && [...inverseTransform, ...transform].every(Number.isFinite)) {
          const handle = runtime.dwg_object_get_handle_object(object).value.toString(16).toUpperCase();
          spatialFilters.set(handle, { inverseTransform, transform, enabled: dynapiBoolean(runtime, filter, "display_boundary_on") });
        }
        continue;
      }
      if (fixedType === viewportType) {
        const viewport = runtime.dwg_object_to_object_tio(object);
        const center = dynapiPoint(runtime, viewport, "VIEWCTR");
        const viewHeight = dynapiNumber(
          runtime,
          viewport,
          "VIEWSIZE",
        );
        if (!center || viewHeight === undefined) {
          continue;
        }

        const candidate = normalizeSavedDrawingView({
          center,
          viewHeight,
          aspectRatio: dynapiNumber(
            runtime,
            viewport,
            "aspect_ratio",
          ),
          twistAngle: dynapiNumber(
            runtime,
            viewport,
            "view_twist",
          ),
        });
        if (!candidate) {
          continue;
        }

        savedView ??= candidate;
        const name = runtime.dwg_obj_table_get_name(viewport);
        const lowerLeft = dynapiPoint(
          runtime,
          viewport,
          "lower_left",
        );
        const upperRight = dynapiPoint(
          runtime,
          viewport,
          "upper_right",
        );
        const coversModelWindow =
          lowerLeft?.x === 0 &&
          lowerLeft.y === 0 &&
          upperRight?.x === 1 &&
          upperRight.y === 1;
        if (
          name.trim().toLocaleLowerCase() === "*active" ||
          coversModelWindow
        ) {
          activeViewportView = candidate;
        }
        continue;
      }

      if (fixedType !== layerType) {
        continue;
      }

      const layer = runtime.dwg_object_to_object_tio(object);
      const name = runtime.dwg_obj_layer_get_name(layer);
      if (!name) {
        continue;
      }

      states.set(name, {
        off: dynapiBoolean(runtime, layer, "off"),
        frozen: dynapiBoolean(runtime, layer, "frozen"),
        frozenInNewViewport: dynapiBoolean(
          runtime,
          layer,
          "frozen_in_new",
        ),
      });
    }

    return {
      layerStates: states.size > 0 ? states : null,
      savedView: activeViewportView ?? savedView,
      spatialFilters,
    };
  } catch (error) {
    if (isLikelyMemoryError(error)) throw error;
    return {
      layerStates: null,
      savedView: null,
      spatialFilters: null,
    };
  } finally {
    if (data) {
      try {
        runtime.dwg_free(data);
      } catch {
        try {
          runtime.dwg_abandon(data);
        } catch {
          // The runtime will be discarded with the conversion worker.
        }
      }
    }
  }
}

async function loadRuntime(
  baseUrl: string,
  diagnostic: DwgDiagnostic,
  onNativeError: (message: string) => void,
): Promise<LibreDwgModule> {
  const moduleUrl = assetUrl(baseUrl, "libredwg-web.js");
  let factory: LibreDwgFactory | undefined;

  try {
    const imported = (await import(
      /* @vite-ignore */ moduleUrl
    )) as { default?: LibreDwgFactory } | LibreDwgFactory;
    factory =
      typeof imported === "function" ? imported : imported.default;
  } catch (error) {
    throw new DwgWorkerError(
      isLikelyMemoryError(error)
        ? "DWG_MEMORY_LIMIT"
        : "DWG_RUNTIME_MISSING",
      errorMessage(error),
      diagnostic,
    );
  }

  if (!factory) {
    throw new DwgWorkerError(
      "DWG_RUNTIME_MISSING",
      "LibreDWG module factory was not exported.",
      diagnostic,
    );
  }

  try {
    return await factory({
      locateFile: (path) => assetUrl(baseUrl, path),
      print: () => {
        // LibreDWG CLI output is not needed in the application.
      },
      printErr: onNativeError,
      onMemoryGrowthFailed: (bytes) => {
        throw new RangeError(`DWG memory allocation failed (${bytes} bytes requested).`);
      },
    });
  } catch (error) {
    throw new DwgWorkerError(
      isLikelyMemoryError(error)
        ? "DWG_MEMORY_LIMIT"
        : "DWG_RUNTIME_MISSING",
      errorMessage(error),
      diagnostic,
    );
  }
}

async function convertWithLibreDwg(
  input: ArrayBuffer,
  baseUrl: string,
): Promise<{
  output: ArrayBuffer;
  savedView: SavedDrawingView | null;
}> {
  const diagnostic = inspectDwgInput(input);
  let nativeError = "";
  let memoryFailure = false;
  const runtime = await loadRuntime(
    baseUrl,
    diagnostic,
    (message) => {
      // Native output can contain drawing metadata. Keep it inside the worker
      // and use it only to recognize memory failures.
      nativeError = String(message).slice(0, 512);
      memoryFailure ||= isLikelyMemoryError(message);
    },
  );
  const inputPath = "/tmp/izcad-input.dwg";
  const outputPath = "/tmp/izcad-output.dxf";
  let phase = "read";

  try {
    // Keep the input stable while the runtime reads both geometry and metadata.
    runtime.FS.writeFile(inputPath, new Uint8Array(input));
    phase = "export";
    const errorValue = runtime.dwg_write_dxf(inputPath, outputPath);
    const diagnosticWithEngineCode: DwgDiagnostic = {
      ...diagnostic,
      engineCode: engineErrorName(errorValue),
    };

    if (errorValue !== 0) {
      throw new DwgWorkerError(
        classifyEngineError(errorValue),
        `LibreDWG conversion failed with ${engineErrorName(errorValue)}.`,
        diagnosticWithEngineCode,
      );
    }

    if (runtime.FS.stat(outputPath).size > MAX_CONVERTED_DXF_BYTES) {
      throw new DwgWorkerError(
        "FILE_TOO_LARGE",
        "The converted drawing exceeds the viewer's file size limit.",
        diagnosticWithEngineCode,
      );
    }
    phase = "read-output";
    const rawOutput = runtime.FS.readFile(outputPath);
    // Export from a fresh runtime before optional metadata decoding/freeing.
    // Release the MEMFS copy before reading the source a second time.
    unlinkIfPresent(runtime.FS, outputPath);
    phase = "metadata";
    const savedMetadata = readSavedDwgMetadata(runtime, inputPath);
    phase = "annotate";
    const output = annotateDxfXclips(
      restoreDxfLayerStates(
        rawOutput,
        savedMetadata.layerStates,
      ),
      savedMetadata.spatialFilters,
    );
    const outputPrefix = output.subarray(
      0,
      Math.min(output.byteLength, 4096),
    );
    const outputSuffix = output.subarray(
      Math.max(0, output.byteLength - 4096),
    );
    if (output.byteLength > MAX_CONVERTED_DXF_BYTES) {
      throw new DwgWorkerError("FILE_TOO_LARGE", "Annotated DXF exceeds the conversion size limit.", diagnosticWithEngineCode);
    }
    if (
      output.byteLength === 0 ||
      !containsAscii(outputPrefix, "SECTION") ||
      !containsAscii(outputSuffix, "EOF")
    ) {
      throw new DwgWorkerError(
        "DWG_EXPORT_FAILED",
        "LibreDWG did not create a valid DXF document.",
        diagnosticWithEngineCode,
      );
    }

    const outputBuffer = (
      output.byteOffset === 0 &&
      output.byteLength === output.buffer.byteLength
        ? output.buffer
        : output.slice().buffer
    ) as ArrayBuffer;
    return {
      output: outputBuffer,
      savedView: savedMetadata.savedView,
    };
  } catch (error) {
    if (error instanceof DwgWorkerError) {
      throw error;
    }

    throw new DwgWorkerError(
      isLikelyMemoryError(error) ||
      memoryFailure || isLikelyMemoryError(nativeError)
        ? "DWG_MEMORY_LIMIT"
        : "DWG_CONVERSION_FAILED",
      `${phase}: ${errorMessage(error)} (heapBytes=${runtime.HEAPU8.byteLength})`,
      diagnostic,
    );
  } finally {
    unlinkIfPresent(runtime.FS, inputPath);
    unlinkIfPresent(runtime.FS, outputPath);
  }
}

workerScope.onmessage = async (event: MessageEvent<DwgRequest>) => {
  const { id, input, baseUrl } = event.data;

  try {
    const { output, savedView } = await convertWithLibreDwg(
      input,
      baseUrl,
    );
    const response: DwgSuccess = {
      id,
      status: "success",
      output,
      savedView,
    };
    workerScope.postMessage(response, [output]);
  } catch (error) {
    const failure =
      error instanceof DwgWorkerError
        ? error
        : new DwgWorkerError(
            isLikelyMemoryError(error)
              ? "DWG_MEMORY_LIMIT"
              : "DWG_CONVERSION_FAILED",
            errorMessage(error),
            inspectDwgInput(input),
          );
    const response: DwgFailure = {
      id,
      status: "error",
      code: failure.code,
      message: failure.message,
      diagnostic: failure.diagnostic,
    };
    workerScope.postMessage(response);
  }
};

export {};
