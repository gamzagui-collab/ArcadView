import { describe, expect, it } from "vitest";
import { DxfScene } from "dxf-viewer/src/DxfScene.js";
import DxfParser from "dxf-viewer/src/parser/DxfParser.js";
import { installHatchSplineCompatibility, recoverHatchSpline } from "./hatchSpline";

const weight = Math.SQRT1_2;
const knots = [0, 0, 0, 1, 1, 1];
const points = [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
const edge = () => ({ type: 4, rational: 1, degreeOfSplineCurve: 2,
  controlPoints: points, knotValues: [...knots, 1, weight, 1] });

describe("LibreDWG rational hatch compatibility", () => {
  it("recovers weights without changing the parsed source edge", () => {
    const source = edge();
    expect(recoverHatchSpline(source)).toEqual({ knots, weights: [1, weight, 1] });
    expect(source.knotValues).toHaveLength(9);
  });

  it("leaves correctly sized and nonrational splines alone", () => {
    expect(recoverHatchSpline({ ...edge(), knotValues: knots })).toBeNull();
    expect(recoverHatchSpline({ ...edge(), rational: 0 })).toBeNull();
  });

  it("does not guess missing knots or accept invalid domains and weights", () => {
    expect(recoverHatchSpline({ ...edge(), knotValues: [0, 1] })).toBeNull();
    expect(recoverHatchSpline({ ...edge(), knotValues: [0, 0, 0, 0, 0, 0, 1, 1, 1] })).toBeNull();
    expect(recoverHatchSpline({ ...edge(), knotValues: [0, 0, 0, 1, 1, 1, 1, 0, 1] })).toBeNull();
    expect(recoverHatchSpline({ ...edge(), knotValues: [0, 0, 0, 1, 1, 1, 1, NaN, 1] })).toBeNull();
  });
});

type TestScene = {
  _GetHatchBoundaryLoops(entity: object): Array<{ vertices: Array<{ x: number; y: number }> }>;
  _InterpolateSpline(t: number, degree: number, points: number[][], knots: number[]): number[];
};

describe("real dxf-viewer hatch rendering", () => {
  it("parses legacy DXF and preserves a rational quarter circle instead of dropping its hatch", () => {
    // Actual group-40 weight layout produced by the bundled LibreDWG writer.
    const source = [
      "0", "SECTION", "2", "ENTITIES", "0", "HATCH", "5", "A1", "8", "0",
      "2", "SOLID", "70", "1", "71", "0", "91", "1", "92", "1", "93", "2",
      "72", "4", "94", "2", "73", "1", "74", "0", "95", "6", "96", "3",
      ...knots.flatMap(value => ["40", String(value)]),
      "10", "1", "20", "0", "40", "1",
      "10", "1", "20", "1", "40", String(weight),
      "10", "0", "20", "1", "40", "1", "97", "0",
      "72", "1", "10", "0", "20", "1", "11", "1", "21", "0", "97", "0",
      "75", "0", "76", "1", "98", "0", "0", "ENDSEC", "0", "EOF", "",
    ].join("\n");
    const dxf = new DxfParser().parseSync(source);
    installHatchSplineCompatibility(DxfScene);
    installHatchSplineCompatibility(DxfScene);
    const scene = new DxfScene() as unknown as TestScene;
    const loops = scene._GetHatchBoundaryLoops(dxf.entities[0]);
    expect(loops).toHaveLength(1);
    expect(loops[0].vertices[6].x).toBeCloseTo(Math.SQRT1_2, 10);
    expect(loops[0].vertices[6].y).toBeCloseTo(Math.SQRT1_2, 10);
    expect(loops[0].vertices.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });

  it("keeps ordinary spline interpolation and errors intact", () => {
    installHatchSplineCompatibility(DxfScene);
    const scene = new DxfScene() as unknown as TestScene;
    expect(scene._InterpolateSpline(0.5, 2, points.map(p => [p.x, p.y]), knots)).toEqual([0.75, 0.75]);
    expect(() => scene._InterpolateSpline(0.5, 2, points.map(p => [p.x, p.y]), [0, 1])).toThrow("Bad knot vector length");
  });
});
