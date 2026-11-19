import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertDwgToDxf } from "./convertDwg";
import { getSavedDrawingView } from "../viewer/savedView";
import { MAX_DRAWING_FILE_BYTES, MAX_CONVERTED_DXF_BYTES } from "../files/fileTypes";

class FakeWorker {
  static current: FakeWorker;
  static postError: Error | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  request?: { id: number; input: ArrayBuffer };
  terminate = vi.fn();

  constructor() {
    FakeWorker.current = this;
  }

  postMessage(request: { id: number; input: ArrayBuffer }): void {
    if (FakeWorker.postError) {
      throw FakeWorker.postError;
    }
    this.request = request;
  }

  succeed(output = new TextEncoder().encode("0\nSECTION\n0\nEOF\n").buffer): void {
    this.onmessage?.({ data: {
      id: this.request!.id,
      status: "success",
      output,
      savedView: { center: { x: 20, y: 30 }, viewHeight: 40 },
    } } as MessageEvent);
  }
}

function drawing(): File {
  return new File(["AC1032drawing"], "drawing.dwg");
}

async function waitForWorker(): Promise<void> {
  await vi.waitFor(() => expect(FakeWorker.current?.request).toBeDefined());
}

describe("DWG conversion worker lifecycle", () => {
  beforeEach(() => {
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("document", { baseURI: "http://localhost/" });
    FakeWorker.current = undefined as unknown as FakeWorker;
    FakeWorker.postError = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns a DXF with its saved viewport and releases the worker", async () => {
    const result = convertDwgToDxf(drawing());
    await waitForWorker();
    const worker = FakeWorker.current;
    worker.succeed();
    const output = await result;
    expect(output.name).toBe("drawing.dxf");
    expect(getSavedDrawingView(output)?.center).toEqual({ x: 20, y: 30 });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
  });

  it("does not read a drawing when the conversion is already cancelled", async () => {
    const controller = new AbortController();
    const file = drawing();
    const read = vi.spyOn(file, "arrayBuffer");
    controller.abort();
    await expect(convertDwgToDxf(file, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(read).not.toHaveBeenCalled();
    expect(FakeWorker.current).toBeUndefined();
  });

  it("rejects oversized source drawings before allocating their contents", async () => {
    const file = drawing();
    Object.defineProperty(file, "size", { value: MAX_DRAWING_FILE_BYTES + 1 });
    const read = vi.spyOn(file, "arrayBuffer");
    await expect(convertDwgToDxf(file)).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    expect(read).not.toHaveBeenCalled();
    expect(FakeWorker.current).toBeUndefined();
  });

  it("preserves file-read failures instead of reporting them as conversion failures", async () => {
    const file = drawing();
    vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error("Unreadable file"));
    await expect(convertDwgToDxf(file)).rejects.toMatchObject({ code: "FILE_READ_FAILED" });
    expect(FakeWorker.current).toBeUndefined();
  });

  it("terminates an active conversion when cancelled", async () => {
    const controller = new AbortController();
    const result = convertDwgToDxf(drawing(), controller.signal);
    const rejection = expect(result).rejects.toMatchObject({ name: "AbortError" });
    await waitForWorker();
    const worker = FakeWorker.current;
    controller.abort();
    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
  });

  it("releases the worker if sending the transferred input fails", async () => {
    FakeWorker.postError = new Error("DataCloneError");
    await expect(convertDwgToDxf(drawing())).rejects.toMatchObject({ code: "DWG_CONVERSION_FAILED" });
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
  });

  it("terminates and reports a conversion that exceeds its time limit", async () => {
    vi.useFakeTimers();
    const result = convertDwgToDxf(drawing());
    const failed = expect(result).rejects.toMatchObject({ code: "DWG_CONVERSION_TIMEOUT" });
    await waitForWorker();
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    await failed;
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
    expect(FakeWorker.current.onmessage).toBeNull();
  });

  it("rejects empty DXF output and unreadable worker responses", async () => {
    const empty = convertDwgToDxf(drawing());
    const emptyFailure = expect(empty).rejects.toMatchObject({ code: "DWG_EXPORT_FAILED" });
    await waitForWorker();
    FakeWorker.current.succeed(new ArrayBuffer(0));
    await emptyFailure;
    FakeWorker.current = undefined as unknown as FakeWorker;
    const unreadable = convertDwgToDxf(drawing());
    const unreadableFailure = expect(unreadable).rejects.toMatchObject({ code: "DWG_CONVERSION_FAILED" });
    await waitForWorker();
    FakeWorker.current.onmessageerror?.();
    await unreadableFailure;
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
  });

  it("rejects a converted drawing which expands beyond the viewer size limit", async () => {
    const result = convertDwgToDxf(drawing());
    const failed = expect(result).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    await waitForWorker();
    const output = new ArrayBuffer(1);
    Object.defineProperty(output, "byteLength", { value: MAX_CONVERTED_DXF_BYTES + 1 });
    FakeWorker.current.succeed(output);
    await failed;
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
  });
});
