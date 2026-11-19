import { expect, it } from "vitest";
import type { MeasurementSettings } from "./measurementGeometry";
import { linearMeasurement, measurementPointsAfterPick, measurementValue, pathIsClosed, snapToPathStart } from "./measurementTools";
const settings = (changes: Partial<MeasurementSettings> = {}): MeasurementSettings => ({ enabled: true, mode: "distance", points: [], snapping: true, entity: null, ...changes });
const triangle = [{ x: 1e9, y: 1e9 }, { x: 1e9 + 3, y: 1e9 }, { x: 1e9 + 3, y: 1e9 + 4 }];
it("distinguishes aligned distance from both linear projections in any quadrant", () => {
  for (const signX of [-1, 1]) for (const signY of [-1, 1]) {
    const points = [{ x: 1e9, y: 1e9 }, { x: 1e9 + signX * 3, y: 1e9 + signY * 4 }];
    expect(measurementValue(settings({ points }))).toBe(5);
    expect(measurementValue(settings({ points, mode: "linear", linearAxis: "x" }))).toBe(3);
    expect(measurementValue(settings({ points, mode: "linear", linearAxis: "y" }))).toBe(4);
    expect(linearMeasurement(points)?.axis).toBe("y");
    expect(linearMeasurement(points, "x")?.end).toEqual(points[1]);
    expect(linearMeasurement(points, "x")?.start).toEqual({ x: points[0].x, y: points[1].y });
  }
  expect(measurementValue(settings({ mode: "linear" }))).toBeUndefined();
  expect(linearMeasurement([{ x: 0, y: 0 }, { x: 0, y: 0 }])?.value).toBe(0);
});
it("snaps to an exact measurement start without needing a drawing endpoint", () => {
  const s = settings({ mode: "path", points: triangle });
  expect(snapToPathStart(s, { x: 1e9 + .5, y: 1e9 + .4 }, 1)).toEqual(triangle[0]);
  expect(snapToPathStart(s, { x: 1e9 + 2, y: 1e9 }, 1)).toBeNull();
  expect(snapToPathStart({ ...s, snapping: false }, triangle[0], 1)).toBeNull();
  expect(snapToPathStart({ ...s, points: triangle.slice(0, 2) }, triangle[0], 1)).toBeNull();
  expect(snapToPathStart(s, triangle[0], 1, 0)).toBeNull();
  const points = measurementPointsAfterPick(s, triangle[0]);
  expect(pathIsClosed(points)).toBe(true);
  expect(measurementValue({ ...s, points })).toBe(12);
  expect(snapToPathStart({ ...s, points }, triangle[0], 1)).toBeNull();
});
it("restarts after a closed path, reopens with undo and keeps closure when editing its endpoint", () => {
  const points = [...triangle, triangle[0]], s = settings({ mode: "path", points });
  expect(measurementPointsAfterPick(s, { x: 10, y: 20 })).toEqual([{ x: 10, y: 20 }]);
  expect(pathIsClosed(points.slice(0, -1))).toBe(false);
  const edited = measurementPointsAfterPick(s, { x: 1e9 - 1, y: 1e9 }, 0);
  expect(edited[0]).toEqual(edited[3]);
  expect(pathIsClosed(edited)).toBe(true);
  expect(s.points[0]).toEqual(triangle[0]);
});
it("uses the same two-point reset for linear and aligned measurements", () => {
  for (const mode of ["linear", "distance"] as const) expect(measurementPointsAfterPick(settings({ mode, points: triangle.slice(0, 2) }), triangle[2])).toEqual([triangle[2]]);
});
