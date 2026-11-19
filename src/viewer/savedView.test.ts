import { describe, expect, it } from "vitest";
import {
  normalizeSavedDrawingView,
  resolveSavedDrawingView,
  type DrawingBounds,
} from "./savedView";

const bounds: DrawingBounds = {
  minX: 0,
  minY: 0,
  maxX: 100,
  maxY: 100,
};

describe("saved drawing view", () => {
  it("preserves the complete saved desktop view on a phone canvas", () => {
    const resolved = resolveSavedDrawingView(
      {
        center: { x: 60, y: 40 },
        viewHeight: 40,
        aspectRatio: 2.5,
      },
      bounds,
      { x: 10, y: 5 },
      0.5,
    );

    expect(resolved).toEqual({
      center: { x: 50, y: 35 },
      width: 100,
    });
  });

  it("uses the current canvas when it is wider than the saved view", () => {
    const resolved = resolveSavedDrawingView(
      {
        center: { x: 50, y: 50 },
        viewHeight: 40,
        aspectRatio: 1,
      },
      bounds,
      { x: 0, y: 0 },
      2,
    );

    expect(resolved?.width).toBe(80);
  });

  it("rejects a saved view that is outside the drawing", () => {
    expect(
      resolveSavedDrawingView(
        {
          center: { x: 500, y: 500 },
          viewHeight: 20,
        },
        bounds,
        { x: 0, y: 0 },
        1,
      ),
    ).toBeNull();
  });

  it("rejects invalid view heights", () => {
    expect(
      normalizeSavedDrawingView({
        center: { x: 10, y: 10 },
        viewHeight: 0,
      }),
    ).toBeNull();
  });

  it("keeps a desktop view whose wide rectangle reaches the drawing on a phone", () => {
    expect(resolveSavedDrawingView(
      { center: { x: 140, y: 50 }, viewHeight: 40, aspectRatio: 3 },
      bounds,
      { x: 0, y: 0 },
      0.5,
    )).toEqual({ center: { x: 140, y: 50 }, width: 120 });
  });

  it("rejects invalid bounds, origins and overflowing view dimensions", () => {
    const view = { center: { x: 50, y: 50 }, viewHeight: 40 };
    expect(resolveSavedDrawingView(view, { ...bounds, minX: Infinity }, { x: 0, y: 0 }, 1)).toBeNull();
    expect(resolveSavedDrawingView(view, bounds, { x: NaN, y: 0 }, 1)).toBeNull();
    expect(resolveSavedDrawingView({ ...view, aspectRatio: Number.MAX_VALUE }, bounds, { x: 0, y: 0 }, 1)).toBeNull();
  });

  it("falls back to fitting content when the saved desktop view is vastly zoomed out", () => {
    expect(resolveSavedDrawingView(
      { center: { x: 50, y: 50 }, viewHeight: 20_000, aspectRatio: 2.5 },
      bounds,
      { x: 0, y: 0 },
      0.5,
    )).toBeNull();
  });

  it("preserves a saved view with ordinary surrounding context", () => {
    expect(resolveSavedDrawingView(
      { center: { x: 50, y: 50 }, viewHeight: 100, aspectRatio: 2.5 },
      bounds,
      { x: 0, y: 0 },
      0.5,
    )).toEqual({ center: { x: 50, y: 50 }, width: 250 });
  });

  it("compares an oversized saved view with the whole drawing on a wide canvas", () => {
    expect(resolveSavedDrawingView(
      { center: { x: 50, y: 50 }, viewHeight: 1_000 },
      bounds,
      { x: 0, y: 0 },
      2,
    )).toBeNull();
  });

  it("recenters a saved viewport in an empty gap without changing its zoom or source coordinates", () => {
    const visible = [
      { minX: 10, maxX: 12, minY: 10, maxY: 12 },
      { minX: 12, maxX: 14, minY: 12, maxY: 14 },
      { minX: 900, maxX: 902, minY: 900, maxY: 902 },
    ];
    const resolved = resolveSavedDrawingView(
      { center: { x: 500, y: 500 }, viewHeight: 40, aspectRatio: 2 },
      { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      { x: 5, y: 5 }, 2, visible,
    );
    expect(resolved).toEqual({ center: { x: 7, y: 7 }, width: 80 });
    expect(visible[0]).toEqual({ minX: 10, maxX: 12, minY: 10, maxY: 12 });
  });

  it("keeps a saved viewport that already reaches indexed geometry", () => {
    expect(resolveSavedDrawingView(
      { center: { x: 50, y: 50 }, viewHeight: 40 }, bounds,
      { x: 0, y: 0 }, 1,
      [{ minX: 40, maxX: 45, minY: 40, maxY: 45 }],
    )).toEqual({ center: { x: 50, y: 50 }, width: 40 });
  });
});
