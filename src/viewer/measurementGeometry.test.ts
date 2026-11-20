import {measurementFitBounds} from "./packedMeasurement";
import { describe, expect, it } from "vitest";
import DxfParser from "dxf-viewer/src/parser/DxfParser.js";
import { nearestPackedSnap, packedEntity } from "./packedMeasurement";
import { selectInitialDrawingBounds } from "./initialView";
import {
  buildMeasurementGeometry,
  convertMeasurement,
  distance,
  installMeasurementPreparation,
  measuredAngle,
  nearestEntity,
  nearestSnap,
  pathLength,
  pointSegmentDistance,
  polygonArea,
  unitFromInsunits,
  type MeasurementDxf,
} from "./measurementGeometry";

const line = (x = 0): NonNullable<MeasurementDxf["entities"]>[number] => ({
  type: "LINE", vertices: [{ x, y: 0 }, { x: x + 3, y: 4 }],
});
const clipData = (serialized: string) => ({
  IZCAD_XCLIP: { values: [{ code: 1000, value: serialized }] },
});
const clipped = (vertices: Array<{ x: number; y: number }>, serialized = "0,0;10,10"): MeasurementDxf => ({
  entities: [{ type: "INSERT", name: "CLIPPED", position: { x: 0, y: 0 }, xdata: clipData(serialized) }],
  blocks: { CLIPPED: { entities: [{ type: "LINE", vertices }] } },
});

describe("measurement calculations", () => {
  it("calculates distance, accumulated length and a closed perimeter", () => {
    const points = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 0 }];
    expect(distance(points[0], points[1])).toBe(5);
    expect(pathLength(points)).toBe(9);
    expect(pathLength(points, true)).toBe(12);
    expect(pathLength(points.slice(0, 2), true)).toBe(10);
    expect(pointSegmentDistance({ x: 2, y: 5 }, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(5);
  });

  it("retains small area precision at large survey coordinates and reversed winding", () => {
    const points = [
      { x: 1e12, y: 1e12 }, { x: 1e12 + 3, y: 1e12 },
      { x: 1e12 + 3, y: 1e12 + 4 }, { x: 1e12, y: 1e12 + 4 },
    ];
    expect(polygonArea(points)).toBe(12);
    expect(polygonArea([...points].reverse())).toBe(12);
    expect(polygonArea(points.slice(0, 2))).toBe(0);
  });

  it("converts lengths and squared area units while preserving unspecified drawing units", () => {
    expect(convertMeasurement(1_000, "mm", "m")).toBe(1);
    expect(convertMeasurement(1_000_000, "mm", "m", true)).toBe(1);
    expect(convertMeasurement(1, "ft", "in")).toBeCloseTo(12);
    expect(convertMeasurement(1, "ft", "in", true)).toBeCloseTo(144);
    expect(convertMeasurement(5, "drawing", "m")).toBe(5);
    expect(unitFromInsunits(4)).toBe("mm");
    expect(unitFromInsunits(6)).toBe("m");
    expect(unitFromInsunits(0)).toBe("drawing");
  });

  it("measures angles with the middle point as the vertex and handles degenerate arms", () => {
    expect(measuredAngle([{ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }])).toBe(90);
    expect(measuredAngle([{ x: 1e200, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1e200 }])).toBe(90);
    expect(measuredAngle([{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }])).toBe(180);
    expect(measuredAngle([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }])).toBeNull();
    expect(measuredAngle([])).toBeNull();
  });
});

describe("measurement source geometry", () => {
  it("indexes exact line length, sorted endpoint/midpoint snaps and tolerance-based picking", () => {
    const geometry = buildMeasurementGeometry({ header: { $INSUNITS: 4 }, entities: [line()] });
    expect(geometry).toMatchObject({ units: "mm", limited: false, completeBounds: true });
    expect(geometry.entities[0]).toMatchObject({ length: 5, approximate: false });
    expect(nearestSnap(geometry.snaps, { x: 1.51, y: 2 }, 0.02)).toMatchObject({ x: 1.5, y: 2, kind: "midpoint" });
    expect(nearestSnap(geometry.snaps, { x: 1.51, y: 2 }, 0.001)).toBeNull();
    expect(nearestEntity(geometry.entities, { x: 1.5, y: 2.001 }, 0.01)).toBe(geometry.entities[0]);
    expect(nearestEntity(geometry.entities, { x: 100, y: 100 }, 1)).toBeNull();
    expect(nearestSnap(geometry.snaps, { x: 0, y: 0 }, Infinity)).toBeNull();
  });

  it("applies nested block base points, rotation and scale in model coordinates", () => {
    const geometry = buildMeasurementGeometry({
      entities: [{ type: "INSERT", name: "PARENT", position: { x: 100, y: 200 }, xScale: 2, yScale: 2, rotation: 90 }],
      blocks: {
        PARENT: { position: { x: 10, y: 20 }, entities: [{ type: "INSERT", name: "CHILD", position: { x: 11, y: 22 }, xScale: 2, yScale: 2 }] },
        CHILD: { position: { x: 5, y: 5 }, entities: [{ type: "LINE", vertices: [{ x: 5, y: 5 }, { x: 8, y: 9 }] }] },
      },
    });
    const entity = geometry.entities[0];
    expect(entity.points[0].x).toBeCloseTo(96);
    expect(entity.points[0].y).toBeCloseTo(202);
    expect(entity.points[1].x).toBeCloseTo(80);
    expect(entity.points[1].y).toBeCloseTo(214);
    expect(entity.length).toBeCloseTo(20);
    expect(geometry.completeBounds).toBe(true);
  });

  it("applies mirrored inserts and source entity extrusion without changing lengths", () => {
    const geometry = buildMeasurementGeometry({
      entities: [
        { type: "INSERT", name: "MIRROR", position: { x: 100, y: 200 }, xScale: -2, yScale: 2 },
        { type: "INSERT", name: "MIRROR", position: { x: 100, y: 200 }, extrusionDirection: { x: 0, y: 0, z: -1 } },
        { type: "ARC", center: { x: 2, y: 0 }, radius: 1, startAngle: 0, endAngle: Math.PI / 2, extrusionDirection: { x: 0, y: 0, z: -1 } },
      ],
      blocks: { MIRROR: { position: { x: 10, y: 20 }, entities: [{ type: "LINE", vertices: [{ x: 10, y: 20 }, { x: 11, y: 20 }] }] } },
    });
    expect(geometry.entities[0].points).toEqual([{ x: 100, y: 200 }, { x: 98, y: 200 }]);
    expect(geometry.entities[1].points).toEqual([{ x: -100, y: 200 }, { x: -101, y: 200 }]);
    expect(geometry.entities[2].points[0]).toEqual({ x: -3, y: 0 });
    expect(geometry.entities[2].length).toBeCloseTo(Math.PI / 2);
  });

  it("measures semicircular bulges analytically, including the closed chord and area", () => {
    for (const bulge of [1, -1]) {
      const geometry = buildMeasurementGeometry({ entities: [{ type: "LWPOLYLINE", shape: true, vertices: [{ x: -1, y: 0, bulge }, { x: 1, y: 0 }] }] });
      expect(geometry.entities[0].length).toBeCloseTo(Math.PI + 2, 12);
      expect(geometry.entities[0].area).toBeCloseTo(Math.PI / 2, 12);
      expect(geometry.entities[0].approximate).toBe(false);
    }
  });

  it("scales closed polyline area by the determinant even with nonuniform mirrored blocks", () => {
    const geometry = buildMeasurementGeometry({
      entities: [{ type: "INSERT", name: "AREA", position: { x: 1e12, y: 1e12 }, xScale: -2, yScale: 3 }],
      blocks: { AREA: { entities: [{ type: "LWPOLYLINE", shape: true, vertices: [{ x: -1, y: 0, bulge: 1 }, { x: 1, y: 0 }] }] } },
    });
    expect(geometry.entities[0].area).toBeCloseTo(3 * Math.PI, 12);
    expect(geometry.entities[0].approximate).toBe(true);
  });

  it("measures circles exactly and labels nonuniform transformed curves as approximate", () => {
    const geometry = buildMeasurementGeometry({
      entities: [
        { type: "CIRCLE", center: { x: 0, y: 0 }, radius: 10 },
        { type: "INSERT", name: "ELLIPTIC", position: { x: 0, y: 0 }, xScale: 2, yScale: 1 },
      ],
      blocks: { ELLIPTIC: { entities: [{ type: "CIRCLE", center: { x: 0, y: 0 }, radius: 10 }, { type: "ARC", center: { x: 0, y: 0 }, radius: 1, startAngle: 0, endAngle: Math.PI / 2 }] } },
    });
    expect(geometry.entities[0]).toMatchObject({ approximate: false });
    expect(geometry.entities[0].length).toBeCloseTo(20 * Math.PI);
    expect(geometry.entities[0].area).toBeCloseTo(100 * Math.PI);
    expect(geometry.entities[1].length).toBeCloseTo(96.884482205, 1);
    expect(geometry.entities[1].area).toBeCloseTo(200 * Math.PI);
    expect(geometry.entities[1].approximate).toBe(true);
    expect(geometry.entities[2].length).toBeCloseTo(2.422112055, 3);
  });

  it("includes exact arc cardinal extrema that fall between tessellation samples", () => {
    const geometry = buildMeasurementGeometry({ entities: [{ type: "ARC", center: { x: 0, y: 0 }, radius: 10, startAngle: 7 * Math.PI / 180, endAngle: 101 * Math.PI / 180 }] });
    expect(geometry.entities[0].bounds.maxY).toBe(10);
    expect(geometry.entities[0].bounds.minX).toBeCloseTo(10 * Math.cos(101 * Math.PI / 180));
    expect(geometry.entities[0].length).toBeCloseTo(10 * 94 * Math.PI / 180);
  });

  it("retains nonuniform scaling classification even with tiny block scale factors", () => {
    const geometry = buildMeasurementGeometry({
      entities: [{ type: "INSERT", name: "SMALL_SCALE", position: { x: 0, y: 0 }, xScale: 2e-12, yScale: 1e-12 }],
      blocks: { SMALL_SCALE: { entities: [{ type: "CIRCLE", center: { x: 0, y: 0 }, radius: 1e12 }] } },
    });
    expect(geometry.entities[0].approximate).toBe(true);
    expect(geometry.entities[0].length).toBeCloseTo(9.6884482205, 2);
    expect(geometry.entities[0].area).toBeCloseTo(2 * Math.PI);
  });

  it("indexes rotated ellipses with approximate circumference and exact area/bounds", () => {
    const geometry = buildMeasurementGeometry({ entities: [{ type: "ELLIPSE", center: { x: 10, y: 20 }, majorAxisEndPoint: { x: 3, y: 4 }, axisRatio: 0.5, startAngle: 0, endAngle: Math.PI * 2 }] });
    const ellipse = geometry.entities[0];
    expect(ellipse.approximate).toBe(true);
    expect(ellipse.length).toBeCloseTo(24.221120551, 2);
    expect(ellipse.area).toBeCloseTo(12.5 * Math.PI);
    expect(ellipse.bounds.maxX).toBeCloseTo(10 + Math.sqrt(13));
    expect(ellipse.bounds.maxY).toBeCloseTo(20 + Math.sqrt(18.25));
  });

  it("excludes hidden/off/frozen entities while visible unsupported types disable bounds trimming", () => {
    const geometry = buildMeasurementGeometry({
      tables: { layer: { layers: { OFF: { visible: false }, FROZEN: { frozen: true } } } },
      entities: [line(), { ...line(10), layer: "OFF" }, { ...line(20), layer: "FROZEN" }, { type: "TEXT", hidden: true }],
    });
    expect(geometry.entities).toHaveLength(1);
    expect(geometry.completeBounds).toBe(true);
    expect(buildMeasurementGeometry({ entities: [line(), { type: "TEXT" }] }).completeBounds).toBe(false);
    expect(buildMeasurementGeometry({ entities: [{ ...line(), inPaperSpace: true }] }).completeBounds).toBe(false);
    expect(buildMeasurementGeometry({ entities: [{ type: "POINT", position: { x: 0, y: 0 } }] }).completeBounds).toBe(false);
  });

  it("normalizes two-point clips, omits partial object measurements and retains visible snaps", () => {
    const complete = buildMeasurementGeometry(clipped([{ x: 1, y: 1 }, { x: 9, y: 1 }]));
    expect(complete.entities[0].length).toBe(8);
    expect(complete.completeBounds).toBe(false);
    const partial = buildMeasurementGeometry(clipped([{ x: 5, y: 5 }, { x: 15, y: 5 }]));
    expect(partial.entities).toHaveLength(0);
    expect(partial.snaps.some((snap) => snap.x === 5)).toBe(true);
    expect(partial.snaps.some((snap) => snap.x === 15)).toBe(false);
  });

  it("rejects a line crossing a concave clipped gap even when both endpoints are visible", () => {
    const geometry = buildMeasurementGeometry(clipped([{ x: 0.5, y: 3 }, { x: 3.5, y: 3 }], "0,0;4,0;4,4;3,4;3,1;1,1;1,4;0,4"));
    expect(geometry.entities).toHaveLength(0);
    expect(geometry.snaps.filter(p=>p.kind!=="insertion")).toHaveLength(2);
  });

  it("bounds points, snaps, recursion and tessellation work without returning a partial object length", () => {
    const longPolyline = { type: "LWPOLYLINE", vertices: Array.from({ length: 31 }, (_, x) => ({ x, y: 0 })) };
    const points = buildMeasurementGeometry({ entities: [longPolyline] }, { maxPoints: 30 });
    expect(points).toMatchObject({ limited: true, completeBounds: false, entities: [] });
    const snaps = buildMeasurementGeometry({ entities: Array.from({ length: 20 }, (_, x) => ({ type: "POINT", position: { x, y: 0 } })) }, { maxSnaps: 3 });
    expect(snaps.snaps).toHaveLength(3);
    expect(snaps.limited).toBe(true);
    const entityLimit = buildMeasurementGeometry({ entities: [line(), line(10), line(20)] }, { maxEntities: 2 });
    expect(entityLimit.entities).toHaveLength(2);
    expect(entityLimit.limited).toBe(true);
    const cycle = buildMeasurementGeometry({ entities: [{ type: "INSERT", name: "LOOP", position: { x: 0, y: 0 } }], blocks: { LOOP: { entities: [{ type: "INSERT", name: "LOOP", position: { x: 0, y: 0 } }] } } });
    expect(cycle.completeBounds).toBe(false);
    expect(cycle.entities).toHaveLength(0);
  });

  it("rejects malformed points and handles enormous negative sweeps without a wrapping loop", () => {
    const geometry = buildMeasurementGeometry({ entities: [
      { type: "LINE", vertices: [{ x: NaN, y: 0 }, { x: 1, y: 1 }] },
      { type: "ARC", center: { x: 0, y: 0 }, radius: 1, startAngle: 0, endAngle: -1e300 },
      { type: "CIRCLE", center: { x: 1e308, y: 0 }, radius: 1e308 },
    ] });
    expect(geometry.completeBounds).toBe(false);
    expect(geometry.entities).toHaveLength(1);
    expect(geometry.entities[0].points.length).toBeLessThanOrEqual(181);
    expect(geometry.snaps.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });

  it("uses real DXF parser properties for units, degree-based arc angles, bulge and closed flags", () => {
    const source = [
      "0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC",
      "0", "SECTION", "2", "ENTITIES",
      "0", "ARC", "10", "0", "20", "0", "30", "0", "40", "10", "50", "0", "51", "90",
      "0", "LWPOLYLINE", "90", "2", "70", "1", "10", "-1", "20", "0", "42", "1", "10", "1", "20", "0",
      "0", "ENDSEC", "0", "EOF", "",
    ].join("\n");
    const parsed = new DxfParser().parseSync(source) as MeasurementDxf;
    const geometry = buildMeasurementGeometry(parsed);
    expect(geometry.units).toBe("mm");
    expect(geometry.entities[0].length).toBeCloseTo(5 * Math.PI);
    expect(geometry.entities[1].length).toBeCloseTo(Math.PI + 2);
    expect(geometry.entities[1].area).toBeCloseTo(Math.PI / 2);
  });
});

describe("measurement worker preparation", () => {
  it("wraps Build once and discards raw DXF only after the scene has consumed it", async () => {
    class FakeScene {
      calls = 0;
      async Build(dxf: MeasurementDxf): Promise<void> {
        this.calls += 1;
        expect(dxf.entities).toHaveLength(1);
        await Promise.resolve();
        expect(dxf.entities).toHaveLength(1);
      }
    }
    installMeasurementPreparation(FakeScene);
    installMeasurementPreparation(FakeScene);
    const scene = new FakeScene();
    const dxf: MeasurementDxf & { izcadMeasurement?: ReturnType<typeof buildMeasurementGeometry> } = { header: { $INSUNITS: 4 }, entities: [line()] };
    await scene.Build(dxf);
    expect(scene.calls).toBe(1);
    expect(Object.keys(dxf)).toEqual(["izcadMeasurement"]);
    expect(packedEntity(dxf.izcadMeasurement!.packed!, 0).length).toBe(5);
  });

  it("captures actual decomposed text triangles once and transforms nested text fit bounds", async () => {
    type SourceEntity = NonNullable<MeasurementDxf["entities"]>[number];
    class GlyphScene {
      decompositions = 0;
      *_DecomposeText(entity: SourceEntity) {
        this.decompositions += 1;
        yield { vertices: entity.vertices?.slice(0, 3) ?? [] };
        yield { vertices: entity.vertices?.slice(3) ?? [] };
      }
      *_DecomposeMText(entity: SourceEntity) {
        yield { vertices: entity.vertices ?? [] };
      }
      async Build(dxf: MeasurementDxf): Promise<void> {
        const sources = [...dxf.entities ?? [], ...Object.values(dxf.blocks ?? {}).flatMap((block) => block.entities ?? [])];
        for (const entity of sources) {
          if (entity.type === "TEXT") Array.from(this._DecomposeText(entity));
          if (entity.type === "MTEXT") Array.from(this._DecomposeMText(entity));
        }
      }
    }
    installMeasurementPreparation(GlyphScene);
    installMeasurementPreparation(GlyphScene);
    const scene = new GlyphScene();
    const dxf: MeasurementDxf & { izcadMeasurement?: ReturnType<typeof buildMeasurementGeometry> } = {
      entities: [
        { type: "INSERT", name: "TEXT_BLOCK", position: { x: 100, y: 200 }, xScale: 2, yScale: 2, rotation: 90 },
        { type: "MTEXT", vertices: [{ x: 0, y: 0 }, { x: 3, y: -4 }, { x: 5, y: -2 }] },
        { type: "POINT", position: { x: 50, y: 60 } },
      ],
      blocks: { TEXT_BLOCK: { position: { x: 10, y: 20 }, entities: [{ type: "TEXT", vertices: [
        { x: 10, y: 20 }, { x: 14, y: 20 }, { x: 12, y: 21 },
        { x: 10, y: 20 }, { x: 12, y: 21 }, { x: 10, y: 22 },
      ] }] } },
    };
    await scene.Build(dxf);
    const geometry = dxf.izcadMeasurement!;
    expect(scene.decompositions).toBe(1);
    expect(geometry.completeBounds).toBe(false);
    expect(geometry.fitCompleteBounds).toBe(true);
    expect([...measurementFitBounds(geometry)][0].minX).toBeCloseTo(96);
    expect([...measurementFitBounds(geometry)][0].maxX).toBeCloseTo(100);
    expect([...measurementFitBounds(geometry)][0].minY).toBeCloseTo(200);
    expect([...measurementFitBounds(geometry)][0].maxY).toBeCloseTo(208);
    expect([...measurementFitBounds(geometry)][1]).toEqual({ minX: 0, minY: -4, maxX: 5, maxY: 0 });
    expect([...measurementFitBounds(geometry)][2]).toEqual({ minX: 50, minY: 60, maxX: 50, maxY: 60 });
    expect(geometry.entities).toHaveLength(0);
    expect(nearestPackedSnap(geometry.packed!, { x: 50, y: 60 }, 0)).toEqual({ x: 50, y: 60, kind: "endpoint" });
  });

  it("fits normal text-bearing CAD around a remote point while keeping a significant text-only sheet", () => {
    const main = Array.from({ length: 100 }, (_, index) => ({
      type: "LINE", vertices: [
        { x: index % 10 * 100, y: Math.floor(index / 10) * 70 },
        { x: (index % 10 + 1) * 100, y: (Math.floor(index / 10) + 1) * 70 },
      ],
    }));
    const text = { type: "TEXT" };
    const remoteSheet = { type: "MTEXT" };
    const rendered = new WeakMap<object, { minX: number; minY: number; maxX: number; maxY: number } | null>();
    rendered.set(text, { minX: 20, minY: 20, maxX: 30, maxY: 24 });
    rendered.set(remoteSheet, { minX: 100_000, minY: 0, maxX: 100_900, maxY: 700 });
    const geometry = buildMeasurementGeometry({ entities: [...main, text, { type: "POINT", position: { x: 100_000, y: 0 } }] }, {}, rendered);
    expect(geometry.fitCompleteBounds).toBe(true);
    expect(selectInitialDrawingBounds({ minX: 0, minY: 0, maxX: 100_000, maxY: 700 }, geometry.fitBounds)).toEqual({ minX: 0, minY: 0, maxX: 1_000, maxY: 700 });
    const multipleSheets = buildMeasurementGeometry({ entities: [...main, text, remoteSheet] }, {}, rendered);
    const full = { minX: 0, minY: 0, maxX: 100_900, maxY: 700 };
    expect(multipleSheets.fitCompleteBounds).toBe(true);
    expect(selectInitialDrawingBounds(full, multipleSheets.fitBounds)).toBe(full);
  });

  it("does not claim fit completeness without rendered text bounds or after a fit-bound cap", () => {
    const text = { type: "TEXT" };
    expect(buildMeasurementGeometry({ entities: [text] }).fitCompleteBounds).toBe(false);
    const rendered = new WeakMap<object, { minX: number; minY: number; maxX: number; maxY: number } | null>();
    rendered.set(text, { minX: 0, minY: 0, maxX: 1, maxY: 1 });
    const geometry = buildMeasurementGeometry({ entities: [text, text, text] }, { maxEntities: 2 }, rendered);
    expect(geometry.fitBounds).toHaveLength(2);
    expect(geometry.fitCompleteBounds).toBe(false);
    expect(geometry.limited).toBe(true);
  });
});
