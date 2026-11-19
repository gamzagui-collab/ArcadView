import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_DRAWING_FILE_BYTES, MAX_CONVERTED_DXF_BYTES } from "../files/fileTypes";
import {
  readIncomingDrawingFile,
  type IncomingDrawing,
} from "./incomingDrawing";

describe("incoming Android drawings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("turns a locally readable URI into a browser File", async () => {
    const drawing: IncomingDrawing = {
      id: "1",
      uri: "data:application/dxf,0%0ASECTION%0A2%0AEOF",
      name: "shared-plan.dxf",
      mimeType: "application/dxf",
      size: -1,
    };

    const file = await readIncomingDrawingFile(drawing);

    expect(file.name).toBe("shared-plan.dxf");
    expect(file.type).toBe("application/dxf");
    expect(await file.text()).toContain("SECTION");
  });

  const drawing: IncomingDrawing = {
    id: "2", uri: "content://cad/drawing", name: "shared.dxf",
    mimeType: "application/dxf", size: -1,
  };

  it("rejects unsupported formats and remote URIs before reading", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(readIncomingDrawingFile({ ...drawing, name: "file.txt" }))
      .rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    await expect(readIncomingDrawingFile({ ...drawing, uri: "https://example.com/file.dxf" }))
      .rejects.toMatchObject({ code: "FILE_READ_FAILED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects empty and oversized metadata before fetching a blob", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(readIncomingDrawingFile({ ...drawing, size: 0 }))
      .rejects.toMatchObject({ code: "EMPTY_FILE" });
    await expect(readIncomingDrawingFile({ ...drawing, size: MAX_DRAWING_FILE_BYTES + 1 }))
      .rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates unknown-size streams once read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob([]))));
    await expect(readIncomingDrawingFile(drawing))
      .rejects.toMatchObject({ code: "EMPTY_FILE" });
  });
  it("cancels an oversized converted stream before reading any body bytes", async () => {
    const blob = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok:true,headers:new Headers({"content-length":String(MAX_CONVERTED_DXF_BYTES+1)}),blob}));
    await expect(readIncomingDrawingFile(drawing,undefined,MAX_CONVERTED_DXF_BYTES)).rejects.toMatchObject({code:"FILE_TOO_LARGE"});
    expect(blob).not.toHaveBeenCalled();
  });

  it.each(["pdf", "zip", "rar"])("accepts a local shared %s document", async (extension) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["document"]))));
    const file = await readIncomingDrawingFile({ ...drawing, name: `document.${extension}` });
    expect(file.name).toBe(`document.${extension}`);
    expect(await file.text()).toBe("document");
  });

  it("does not return an incomplete shared file", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["cad"]))));
    await expect(readIncomingDrawingFile({ ...drawing, size: 8 }))
      .rejects.toMatchObject({ code: "FILE_READ_FAILED" });
  });

  it("forwards cancellation to the local file request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["cad"])));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const file = await readIncomingDrawingFile(drawing, controller.signal);
    expect(await file.text()).toBe("cad");
    expect(fetchMock).toHaveBeenCalledWith(drawing.uri,
      { signal: controller.signal, cache: "no-store" });
  });

  it("cancels unknown-size streams before buffering beyond the memory limit", async () => {
    const cancel = vi.fn();
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(chunk); },
      cancel,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    await expect(readIncomingDrawingFile(drawing))
      .rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
