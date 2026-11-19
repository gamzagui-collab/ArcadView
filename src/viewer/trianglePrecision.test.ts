import { expect, it } from "vitest";
import { DxfScene } from "dxf-viewer/src/DxfScene.js";
import { Matrix3 } from "three";
import { installTrianglePrecision, installTrianglePrecisionRendering } from "./trianglePrecision";
installTrianglePrecision(DxfScene);
it("preserves sub-unit triangle strokes near 1e8 drawing coordinates including flattened blocks", () => {
  const scene: any = new (DxfScene as any)({}); scene.origin = { x: 0, y: 0 };
  const triangle = { layer: "TEXT", color: 0xffffff, vertices: [{ x: 135913541.8, y: 76530380.1 }, { x: 135913541.9, y: 76530380.1 }, { x: 135913541.8, y: 76530380.2 }], indices: [0, 1, 2] };
  scene._ProcessTriangles(triangle);
  // Root geometry is already local before its first Float32 write.
  let batch: any; scene.batches.each((b: any) => { batch ??= b; });
  expect(batch.chunks[0].vertices.buffer).toBeInstanceOf(Float32Array);
  // A block definition stages glyphs near zero; flattening must also rebase
  // before the transformed vertices reach the destination Float32 buffer.
  const localScene: any = new (DxfScene as any)({}); localScene.origin = { x: 0, y: 0 };
  localScene._ProcessTriangles({ ...triangle, vertices: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0, y: 0.1 }] });
  let localBatch: any; localScene.batches.each((b: any) => { localBatch = b; });
  scene._FlattenBatch(localBatch, "COPY", 0xffffff, 0, new Matrix3().makeTranslation(135913541.8, 76530380.1));
  const built = scene._BuildScene();
  const vertices = new Float32Array(built.vertices);
  for (const b of built.batches) {
    const c = b.chunks[0], offset = c.verticesOffset;
    expect(c.izcadOrigin).toBeDefined();
    expect(vertices[offset + 2] - vertices[offset]).toBeCloseTo(0.1, 5);
    expect(vertices[offset + 5] - vertices[offset + 1]).toBeCloseTo(0.1, 5);
  }
});
it("sets per-chunk double origins on rendered objects without changing block instances", () => {
  class Viewer { scene = { children: [] as any[] }; _LoadBatch(_scene: any, _batch: any) { this.scene.children.push({ position: { set: (...v: number[]) => { this.position = v; } }, updateMatrix: () => { this.updated = true; } }); } position: number[] = []; updated = false; }
  installTrianglePrecisionRendering(Viewer); const viewer = new Viewer();
  viewer._LoadBatch({}, { key: { blockName: null }, chunks: [{ izcadOrigin: { x: 1e8 + 0.125, y: 2e8 + 0.25 } }] });
  expect(viewer.position).toEqual([1e8 + 0.125, 2e8 + 0.25, 0]); expect(viewer.updated).toBe(true);
});
