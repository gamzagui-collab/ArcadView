import { Vector2 } from "three";

// Adapter for the pinned dxf-viewer 1.0.48. Stage root triangles relative to
// nearby double origins before their first conversion to Float32.
// This prevents small glyph strokes collapsing at large survey coordinates.
const patchedScenes = new WeakSet<object>(), patchedViewers = new WeakSet<object>();
const TILE = 16_384;
export function installTrianglePrecision(sceneConstructor: object): void {
  if (patchedScenes.has(sceneConstructor)) return;
  const p = (sceneConstructor as { prototype: any }).prototype;
  const getBatch = p._GetBatch, triangles = p._ProcessTriangles, flatten = p._FlattenBatch;
  const tilePoint = Symbol("triangleTile"), tileIds = Symbol("triangleTileIds"), configured = new WeakSet<object>();
  p._ProcessTriangles = function(entity: any, context: any) {
    const old = this[tilePoint], first = entity.vertices?.[0];
    this[tilePoint] = !context && first ? { x: first.x - (this.origin?.x ?? first.x), y: first.y - (this.origin?.y ?? first.y) } : null;
    try { return triangles.call(this, entity, context); } finally { this[tilePoint] = old; }
  };
  p._FlattenBatch = function(batch: any, layer: any, color: any, lineType: any, transform: any) {
    const old = this[tilePoint], vertices = batch.chunks?.[0]?.vertices;
    this[tilePoint] = batch.key.geometryType === 4 && vertices?.size ? new Vector2(vertices.Get(0), vertices.Get(1)).applyMatrix3(transform) : null;
    try { return flatten.call(this, batch, layer, color, lineType, transform); } finally { this[tilePoint] = old; }
  };
  p._GetBatch = function(key: any) {
    if (key.geometryType === 4 && key.blockName === null && this[tilePoint]) {
      const point = this[tilePoint], label = `${Math.floor(point.x / TILE)},${Math.floor(point.y / TILE)}`;
      const ids: Map<string, number> = this[tileIds] ??= new Map();
      if (!ids.has(label)) ids.set(label, ids.size + 1);
      key = new key.constructor(key.layerName, null, key.geometryType, key.color, ids.get(label));
    }
    const batch = getBatch.call(this, key);
    if (key.geometryType !== 4 || configured.has(batch)) return batch;
    configured.add(batch);
    const point = this[tilePoint];
    if (key.blockName !== null || !point) return batch;
    const origin = { x: point.x, y: point.y };
    const push = batch.PushChunk, serialize = batch.Serialize;
    batch.PushChunk = function(capacity: number) {
      const writer = push.call(this, capacity), vertex = writer.PushVertex;
      writer.PushVertex = function(v: { x: number; y: number }) {
        return vertex.call(this, { x: v.x - origin.x, y: v.y - origin.y });
      };
      return writer;
    };
    batch.Serialize = function(buffers: any) {
      const serialized = serialize.call(this, buffers);
      for (let i = 0; i < this.chunks.length; i++) {
        serialized.chunks[i].izcadOrigin = origin;
      }
      return serialized;
    };
    return batch;
  };
  patchedScenes.add(sceneConstructor);
}

export function installTrianglePrecisionRendering(viewerConstructor: object): void {
  if (patchedViewers.has(viewerConstructor)) return;
  const p = (viewerConstructor as { prototype: any }).prototype, load = p._LoadBatch;
  p._LoadBatch = function(scene: any, batch: any) {
    const first = this.scene.children.length;
    load.call(this, scene, batch);
    if (batch.key.blockName !== null || !batch.chunks) return;
    const objects = this.scene.children.slice(first);
    for (let i = 0; i < batch.chunks.length; i++) {
      const origin = batch.chunks[i].izcadOrigin, object = objects[i];
      if (origin && object) { object.position.set(origin.x, origin.y, 0); object.updateMatrix(); }
    }
  };
  patchedViewers.add(viewerConstructor);
}
