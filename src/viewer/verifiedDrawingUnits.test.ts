import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convertWithVerifiedDrawingUnits, resolveDrawingDisplayUnit, resolveDrawingMeasurementUnit } from "./verifiedDrawingUnits";
import { bindDrawingUnitKey, getDrawingUnitKey, saveDrawingUnitPreference } from "./drawingUnitPreferences";
const mocks = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock("./drawingUnitPreferences", async importOriginal => ({
  ...await importOriginal<typeof import("./drawingUnitPreferences")>(), prepareDrawingUnitKey: mocks.prepare,
}));
const knownKey = "v1-c9b45ea3ad4533f563f6f87d8b6ea382693f68e6d4f1a39e3f3bc4a923e3f74d";
const otherKey = "v1-" + "a".repeat(64);
const source = () => new File(["source"], "renamed.dwg");
const output = () => new File(["DXF"], "render.dxf");
beforeEach(() => {
  mocks.prepare.mockReset().mockResolvedValue(knownKey);
  const stored = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) });
});
afterEach(() => vi.unstubAllGlobals());
describe("drawing unit precedence and original DWG identity", () => {
  it("keeps the reviewed COVER mm default, while preserving declared units by default", async () => {
    const render = await convertWithVerifiedDrawingUnits(source(), async () => output());
    expect(getDrawingUnitKey(render)).toBe(knownKey);
    expect(resolveDrawingMeasurementUnit(render, "drawing")).toBe("mm");
    expect(resolveDrawingMeasurementUnit(render, "cm")).toBe("cm");
    expect(resolveDrawingDisplayUnit(render, "mm")).toBe("mm");
  });
  it("gives an explicit saved choice priority over headers and verified defaults", async () => {
    saveDrawingUnitPreference(knownKey, { sourceUnit: "cm", displayUnit: "m" });
    const render = await convertWithVerifiedDrawingUnits(source(), async () => output());
    expect(resolveDrawingMeasurementUnit(render, "mm")).toBe("cm");
    expect(resolveDrawingMeasurementUnit(render, "drawing")).toBe("cm");
    expect(resolveDrawingDisplayUnit(render, "cm")).toBe("m");
  });
  it("persists the explicit unspecified unit instead of restoring a default", () => {
    const render = output(); bindDrawingUnitKey(render, knownKey);
    saveDrawingUnitPreference(knownKey, { sourceUnit: "drawing", displayUnit: "drawing" });
    expect(resolveDrawingMeasurementUnit(render, "mm")).toBe("drawing");
    expect(resolveDrawingDisplayUnit(render, "drawing")).toBe("drawing");
  });
  it("does not apply a different file's choice or guess units for unknown content", async () => {
    saveDrawingUnitPreference(knownKey, { sourceUnit: "ft", displayUnit: "in" });
    mocks.prepare.mockResolvedValue(otherKey);
    const render = await convertWithVerifiedDrawingUnits(source(), async () => output());
    expect(resolveDrawingMeasurementUnit(render, "drawing")).toBe("drawing");
    expect(resolveDrawingMeasurementUnit(render, "mm")).toBe("mm");
  });
  it("preserves converter errors and handles unavailable identification", async () => {
    mocks.prepare.mockResolvedValue(undefined);
    const render = await convertWithVerifiedDrawingUnits(source(), async () => output());
    expect(resolveDrawingMeasurementUnit(render, "drawing")).toBe("drawing");
    const failure = new Error("DWG_PARSE_FAILED");
    await expect(convertWithVerifiedDrawingUnits(source(), async () => { throw failure; })).rejects.toBe(failure);
  });
  it("honors cancellation after identification and during conversion without binding a stale file", async () => {
    const controller = new AbortController(), convert = vi.fn();
    mocks.prepare.mockImplementation(async () => { controller.abort(); return knownKey; });
    await expect(convertWithVerifiedDrawingUnits(source(), convert, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(convert).not.toHaveBeenCalled();
    mocks.prepare.mockResolvedValue(knownKey);
    const during = new AbortController(), render = output();
    await expect(convertWithVerifiedDrawingUnits(source(), async () => { during.abort(); return render; }, during.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(getDrawingUnitKey(render)).toBeUndefined();
  });
});
