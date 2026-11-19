import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindDrawingUnitKey, prepareDrawingUnitKey, readDrawingUnitPreference, saveDrawingUnitPreference } from "./drawingUnitPreferences";

const PREFIX = "izcad.measurement-units.v1.", CHUNK = 1024 * 1024;
const key = "v1-" + "a".repeat(64), otherKey = "v1-" + "b".repeat(64);
let stored: Map<string, string>;
beforeEach(() => {
  stored = new Map();
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("localStorage", { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => stored.set(k, v) });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("bounded drawing content identity", () => {
  it("matches an independent SHA-256 reference and ignores filename/date/MIME", async () => {
    const digest = createHash("sha256").update(Buffer.concat([
      Buffer.from("izcad-unit-fingerprint-v1\n3\n1048576\n"), createHash("sha256").update("abc").digest(),
    ])).digest("hex");
    const a = new File(["abc"], "same.dxf", { lastModified: 1, type: "application/dxf" });
    const b = new File(["abc"], "renamed.dwg", { lastModified: 999, type: "application/octet-stream" });
    expect(await prepareDrawingUnitKey(a)).toBe("v1-" + digest);
    expect(await prepareDrawingUnitKey(b)).toBe(await prepareDrawingUnitKey(a));
  });
  it("reads at most 1 MiB at a time and distinguishes an edit in the middle of same-size/name files", async () => {
    const bytes = new Uint8Array(CHUNK * 2 + 19).fill(42), changed = bytes.slice(); changed[CHUNK + 17] = 1;
    const a = new File([bytes], "same.dxf"), b = new File([changed], "same.dxf");
    const slice = vi.spyOn(a, "slice"), whole = vi.spyOn(a, "arrayBuffer").mockRejectedValue(new Error("Whole-file reads prohibited"));
    const first = await prepareDrawingUnitKey(a), second = await prepareDrawingUnitKey(b);
    expect(first).toMatch(/^v1-[a-f0-9]{64}$/); expect(first).not.toBe(second);
    expect(slice).toHaveBeenCalledTimes(3); expect(whole).not.toHaveBeenCalled();
    expect(slice.mock.calls.every(([start, end]) => end! - start! <= CHUNK)).toBe(true);
    await prepareDrawingUnitKey(a); expect(slice).toHaveBeenCalledTimes(3);
  });
  it("propagates original DWG identity without reading the generated DXF", async () => {
    const original = new File(["original"], "plan.dwg"), originalKey = await prepareDrawingUnitKey(original);
    const generated = new File(["different converted bytes"], "plan.dxf");
    const read = vi.spyOn(generated, "slice"); bindDrawingUnitKey(generated, originalKey);
    expect(await prepareDrawingUnitKey(generated)).toBe(originalKey); expect(read).not.toHaveBeenCalled();
    const unidentified = new File(["DXF"], "other.dxf");
    const unknownRead = vi.spyOn(unidentified, "slice"); bindDrawingUnitKey(unidentified, undefined);
    expect(await prepareDrawingUnitKey(unidentified)).toBeUndefined(); expect(unknownRead).not.toHaveBeenCalled();
  });
  it("cancels between chunks without caching partial identity", async () => {
    const controller = new AbortController(), file = new File([new Uint8Array(CHUNK + 1)], "plan.dwg");
    const realDigest = webcrypto.subtle.digest.bind(webcrypto.subtle);
    vi.stubGlobal("crypto", { subtle: { digest: async (...args: Parameters<typeof realDigest>) => { const result = await realDigest(...args); controller.abort(); return result; } } });
    await expect(prepareDrawingUnitKey(file, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    vi.stubGlobal("crypto", webcrypto);
    expect(await prepareDrawingUnitKey(file)).toMatch(/^v1-/);
    const early = new AbortController(); early.abort();
    await expect(prepareDrawingUnitKey(file, early.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  it("keeps normal opening possible when identification is unavailable or a read fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const file = new File(["abc"], "plan.dxf"); vi.stubGlobal("crypto", undefined);
    expect(await prepareDrawingUnitKey(file)).toBeUndefined();
    vi.stubGlobal("crypto", webcrypto);
    expect(await prepareDrawingUnitKey(file)).toMatch(/^v1-/);
    const bad = { size: 3, slice: () => ({ arrayBuffer: async () => new ArrayBuffer(1) }) } as unknown as File;
    expect(await prepareDrawingUnitKey(bad)).toBeUndefined();
    expect(await prepareDrawingUnitKey({ size: 129 * CHUNK } as File)).toBeUndefined();
  });
});

describe("per-drawing durable unit preferences", () => {
  it("saves source/display units separately for each drawing", () => {
    expect(saveDrawingUnitPreference(key, { sourceUnit: "cm", displayUnit: "m" })).toBe(true);
    expect(saveDrawingUnitPreference(otherKey, { sourceUnit: "ft", displayUnit: "in" })).toBe(true);
    expect(readDrawingUnitPreference(key)).toEqual({ sourceUnit: "cm", displayUnit: "m" });
    expect(readDrawingUnitPreference(otherKey)).toEqual({ sourceUnit: "ft", displayUnit: "in" });
    expect(stored.size).toBe(2);
  });
  it("restores from durable storage after a fresh module instance and file re-creation", async () => {
    const contentKey = await prepareDrawingUnitKey(new File(["drawing bytes"], "first.dxf"));
    saveDrawingUnitPreference(contentKey, { sourceUnit: "m", displayUnit: "cm" });
    vi.resetModules(); const fresh = await import("./drawingUnitPreferences");
    const reopenedKey = await fresh.prepareDrawingUnitKey(new File(["drawing bytes"], "renamed.dxf"));
    expect(fresh.readDrawingUnitPreference(reopenedKey)).toEqual({ sourceUnit: "m", displayUnit: "cm" });
    expect(fresh.readDrawingUnitPreference(await fresh.prepareDrawingUnitKey(new File(["changed bytes"], "first.dxf")))).toBeUndefined();
  });
  it("remembers a later correction, including the explicitly unspecified unit", () => {
    saveDrawingUnitPreference(key, { sourceUnit: "mm", displayUnit: "m" });
    saveDrawingUnitPreference(key, { sourceUnit: "drawing", displayUnit: "drawing" });
    expect(readDrawingUnitPreference(key)).toEqual({ sourceUnit: "drawing", displayUnit: "drawing" });
  });
  it("ignores invalid keys, corrupt records, unknown units and incompatible display choices", () => {
    for (const raw of ["bad JSON", "null", JSON.stringify({ sourceUnit: "yards", displayUnit: "m" }), JSON.stringify({ sourceUnit: "drawing", displayUnit: "mm" })]) {
      stored.set(PREFIX + key, raw); expect(readDrawingUnitPreference(key)).toBeUndefined();
    }
    expect(saveDrawingUnitPreference("not-a-content-key", { sourceUnit: "mm", displayUnit: "mm" })).toBe(false);
    expect(readDrawingUnitPreference(undefined)).toBeUndefined();
  });
  it("does not delete existing settings or interrupt measurement on storage failure", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    saveDrawingUnitPreference(key, { sourceUnit: "mm", displayUnit: "m" });
    const before = stored.get(PREFIX + key);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("quota"); } });
    expect(readDrawingUnitPreference(key)).toBeUndefined();
    expect(saveDrawingUnitPreference(key, { sourceUnit: "cm", displayUnit: "cm" })).toBe(false);
    expect(stored.get(PREFIX + key)).toBe(before);
  });
});
