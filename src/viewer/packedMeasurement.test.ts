import { describe, expect, it } from "vitest";
import { buildMeasurementGeometry, nearestEntity, nearestSnap, pointSegmentDistance, type MeasurementDxf } from "./measurementGeometry";
import { installMeasurementTransfer, measurementBuffers, nearestPackedEntity, nearestPackedSnap, packedEntity } from "./packedMeasurement";

describe("packed drawing measurement", () => {
  it("preserves every double coordinate, length, area, curve, pick and snap of the unpacked index", () => {
    const dxf: MeasurementDxf = { header: { $INSUNITS: 4 }, entities: [
      { type: "LINE", vertices: [{ x: 1e12, y: 1e12 }, { x: 1e12 + 3, y: 1e12 + 4 }] },
      { type: "CIRCLE", center: { x: 20, y: 30 }, radius: 10 },
      { type: "LWPOLYLINE", shape: true, vertices: [{ x: -1, y: 0, bulge: 1 }, { x: 1, y: 0 }] },
    ] };
    const plain = buildMeasurementGeometry(dxf), packed = buildMeasurementGeometry(dxf, {}, undefined, true).packed!;
    for (let i = 0; i < plain.entities.length; i++) expect(packedEntity(packed, i)).toEqual(plain.entities[i]);
    for (const target of [{ x: 20, y: 30 }, { x: 30, y: 30 }, { x: 1e12, y: 1e12 }, { x: 0, y: -1 }]) {
      expect(nearestPackedSnap(packed, target, 0.1)).toEqual(nearestSnap(plain.snaps, target, 0.1));
      expect(nearestPackedEntity(packed, target, 0.1, pointSegmentDistance)).toEqual(nearestEntity(plain.entities, target, 0.1));
    }
  });
  it("indexes objects after the old 600,000 point and 100,000 entity cutoffs", () => {
    const entities: NonNullable<MeasurementDxf["entities"]> = Array.from({ length: 100_001 }, (_, x) => ({ type: "LINE", vertices: [{ x: x * 10, y: 0 }, { x: x * 10 + 3, y: 4 }] }));
    entities.unshift(...Array.from({ length: 4000 }, (_, x) => ({ type: "CIRCLE", center: { x: x * 10, y: -100 }, radius: 1 })));
    const geometry = buildMeasurementGeometry({ entities }, {}, undefined, true), p = geometry.packed!;
    expect(geometry.limited).toBe(false);
    expect(p.entityCount).toBe(104_001);
    expect(p.pointCount).toBeGreaterThan(600_000);
    expect(packedEntity(p, p.entityCount - 1).length).toBe(5);
    expect(nearestPackedSnap(p, { x: 1_000_003, y: 4 }, 0)).toEqual({ x: 1_000_003, y: 4, kind: "endpoint" });
    expect(nearestPackedEntity(p, { x: 1_000_001.5, y: 2 }, 0.001, pointSegmentDistance)?.length).toBe(5);
    expect(geometry.entities).toHaveLength(0);
    expect(geometry.snaps).toHaveLength(0);
  });
  it("keeps explicit work limits and transfers buffer ownership without a second copy", async () => {
    const geometry = buildMeasurementGeometry({ entities: Array.from({ length: 4 }, (_, x) => ({ type: "CIRCLE", center: { x, y: 0 }, radius: 1 })) }, { maxEntities: 2 }, undefined, true);
    expect(geometry.limited).toBe(true);
    const p = geometry.packed!;
    class Worker { async _ProcessRequestMessage() { return { dxf: { izcadMeasurement: geometry } }; } }
    installMeasurementTransfer(Worker); installMeasurementTransfer(Worker);
    const transfers: ArrayBuffer[] = [];
    await (new Worker()._ProcessRequestMessage as (...args: unknown[]) => unknown)("LOAD", {}, transfers, 1);
    expect(transfers).toEqual(measurementBuffers(p));
    expect(new Set(transfers).size).toBe(transfers.length);
    const moved = structuredClone(p, { transfer: transfers });
    expect(transfers.every(b => b.byteLength === 0)).toBe(true);
    expect(packedEntity(moved, 0).area).toBeCloseTo(Math.PI);
  });
});
