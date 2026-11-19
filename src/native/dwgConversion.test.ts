import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertDwgInProcess } from "./dwgConversion";
import { getSavedDrawingView } from "../viewer/savedView";

const mocks = vi.hoisted(() => ({
  begin: vi.fn(), append: vi.fn(), convert: vi.fn(), release: vi.fn(), read: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => mocks }));
vi.mock("./incomingDrawing", () => ({ readIncomingDrawingFile: mocks.read }));

describe("isolated Android DWG conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.begin.mockResolvedValue({ token: "session" });
    mocks.append.mockResolvedValue(undefined);
    mocks.release.mockResolvedValue(undefined);
    mocks.convert.mockResolvedValue({ uri: "file:///cache/output.dxf", size: 10, savedView: "null" });
    mocks.read.mockImplementation(async ({ name }: { name: string }) => new File(["0\nEOF\n"], name));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("stages bounded chunks, preserves bytes/name and releases its private cache", async () => {
    const bytes = Uint8Array.from({ length: 300000 }, (_, index) => index % 256), file = new File([bytes], "한글.dwg");
    const append = vi.fn().mockReturnValue(null);
    vi.stubGlobal("window", { IzCadDwgStaging: { append } });
    const output = await convertDwgInProcess(file);
    expect(output.name).toBe("한글.dxf");
    expect(append).toHaveBeenCalledTimes(2);
    expect(mocks.append).not.toHaveBeenCalled();
    const staged = append.mock.calls.map(([, data]) => atob(data)).join("");
    expect(staged.length).toBe(bytes.length);
    expect([...staged].every((char, index) => char.charCodeAt(0) === bytes[index])).toBe(true);
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith({ token: "session" });
    expect(getSavedDrawingView(output)).toBeNull();
  });

  it("preserves the original saved view metadata", async () => {
    mocks.convert.mockResolvedValue({ uri: "file:///cache/output.dxf", size: 10,
      savedView: JSON.stringify({ center: { x: 10, y: 20 }, viewHeight: 30 }) });
    const output = await convertDwgInProcess(new File(["AC1032"], "test.dwg"));
    expect(getSavedDrawingView(output)).toMatchObject({ center: { x: 10, y: 20 }, viewHeight: 30 });
  });

  it("does not stage an already cancelled file", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(convertDwgInProcess(new File(["AC1032"], "test.dwg"), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("cancels the active native conversion once and allows the next request", async () => {
    mocks.convert.mockImplementationOnce(() => new Promise((_resolve, reject) => {
      mocks.release.mockImplementationOnce(async () => { reject(new Error("cancelled")); });
    }));
    const controller = new AbortController();
    const first = convertDwgInProcess(new File(["AC1032"], "first.dwg"), controller.signal);
    const stopped = expect(first).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(mocks.convert).toHaveBeenCalledOnce());
    controller.abort(); await stopped;
    expect(mocks.release).toHaveBeenCalledOnce();
    await expect(convertDwgInProcess(new File(["AC1032"], "next.dwg"))).resolves.toBeInstanceOf(File);
  });

  it("serializes requests until the previous process/cache is released", async () => {
    let finish!: () => void;
    mocks.release.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const first = convertDwgInProcess(new File(["AC1032"], "first.dwg"));
    await vi.waitFor(() => expect(mocks.release).toHaveBeenCalledOnce());
    const second = convertDwgInProcess(new File(["AC1032"], "second.dwg"));
    await Promise.resolve(); expect(mocks.begin).toHaveBeenCalledOnce();
    finish(); await first; await second;
    expect(mocks.begin).toHaveBeenCalledTimes(2);
  });

  it("preserves engine diagnostics and releases cache after a native failure", async () => {
    mocks.convert.mockRejectedValueOnce({ code: "DWG_MEMORY_LIMIT", message: "allocation failed", data: { dwg: { engine: "libredwg", version: "AC1032", fileSizeBytes: 6 } } });
    await expect(convertDwgInProcess(new File(["AC1032"], "test.dwg"))).rejects.toMatchObject({ code: "DWG_MEMORY_LIMIT", details: { dwg: { version: "AC1032" } } });
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
