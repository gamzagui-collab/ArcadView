import { Vector2 } from "three";
import { collectRenderBuffers, retireDrawingBuffers } from "./drawingBufferRelease";

// Adapter for the pinned dxf-viewer 1.0.48. Keep the historical exported names,
// but stage every root primitive and instance translation near a double origin.
// Lines otherwise lose their endpoints before the GPU sees them, and subtracting
// a large camera translation in Float32 makes their screen positions jump on pan.
const patchedScenes = new WeakSet<object>(), patchedViewers = new WeakSet<object>();
const TILE = 16_384;
// Keep line/point batches bounded without creating a draw object for each small
// plan fragment. A 2^18 local range has <=1/32 drawing-unit Float32 spacing;
// glyph triangles retain the finer existing tiles, and measurements stay double.
const PRIMITIVE_TILE = 262_144;
export function installTrianglePrecision(sceneConstructor: object): void {
  if (patchedScenes.has(sceneConstructor)) return;
  const p = (sceneConstructor as { prototype: any }).prototype;
  const getBatch = p._GetBatch, flatten = p._FlattenBatch, point = p._DecomposePoint;
  const tilePoint = Symbol("geometryTile"), tileIds = Symbol("geometryTileIds"), configured = new WeakSet<object>();
  for (const name of ["_ProcessPoints", "_ProcessLineSegments", "_ProcessPolyline", "_ProcessTriangles"]) {
    const process = p[name];
    p[name] = function(entity: any, context: any) {
      const old = this[tilePoint], first = entity.vertices?.[0];
      this[tilePoint] = !context && first ? { x: first.x - (this.origin?.x ?? first.x), y: first.y - (this.origin?.y ?? first.y) } : null;
      try { return process.call(this, entity, context); } finally { this[tilePoint] = old; }
    };
  }
  p._DecomposePoint = function*(entity: any, context: any) {
    const old = this[tilePoint], first = entity.position;
    this[tilePoint] = !context && first ? { x: first.x - (this.origin?.x ?? first.x), y: first.y - (this.origin?.y ?? first.y) } : null;
    try { yield* point.call(this, entity, context); } finally { this[tilePoint] = old; }
  };
  p._FlattenBatch = function(batch: any, layer: any, color: any, lineType: any, transform: any) {
    const old = this[tilePoint], vertices = batch.chunks?.[0]?.vertices ?? batch.vertices;
    this[tilePoint] = vertices?.size ? new Vector2(vertices.Get(0), vertices.Get(1)).applyMatrix3(transform) : null;
    try { return flatten.call(this, batch, layer, color, lineType, transform); } finally { this[tilePoint] = old; }
  };
  p._GetBatch = function(key: any) {
    if (key.geometryType === 5) {
      // Keep block instancing/batching intact. Expanding it into spatial tiles
      // can multiply every block child's draw object on large architectural plans.
      const batch = getBatch.call(this, key);
      if (!configured.has(batch)) {
        configured.add(batch);
        const translations:number[] = [], push=batch.PushInstanceTransform, serialize=batch.Serialize;
        batch.PushInstanceTransform = function(matrix:any) {
          translations.push(matrix.elements[6],matrix.elements[7]);
          return push.call(this,matrix);
        };
        batch.Serialize = function(buffers:any) {
          const result=serialize.call(this,buffers);
          result.izcadInstanceTranslations=new Float64Array(translations);
          return result;
        };
      }
      return batch;
    }
    const root = key.blockName === null || key.geometryType === 6;
    const point = this[tilePoint];
    if (root && point) {
      const grid=key.geometryType===3||key.geometryType===4?TILE:PRIMITIVE_TILE;
      const label = `${grid}:${key.lineType}:${Math.floor(point.x / grid)},${Math.floor(point.y / grid)}`;
      const ids: Map<string, number> = this[tileIds] ??= new Map();
      if (!ids.has(label)) ids.set(label, ids.size + 1);
      key = new key.constructor(key.layerName, key.blockName, key.geometryType, key.color, ids.get(label));
    }
    const batch = getBatch.call(this, key);
    if (!root || !point || configured.has(batch)) return batch;
    configured.add(batch);
    const origin = { x: point.x, y: point.y };
    const push = batch.PushChunk, serialize = batch.Serialize;
    const vertex = batch.PushVertex;
    batch.PushVertex = function(v: {x:number;y:number}) {
      return vertex.call(this, {x:v.x-origin.x,y:v.y-origin.y});
    };
    batch.PushChunk = function(capacity: number) {
      const writer = push.call(this, capacity), vertex = writer.PushVertex;
      writer.PushVertex = function(v: { x: number; y: number }) {
        return vertex.call(this, { x: v.x - origin.x, y: v.y - origin.y });
      };
      return writer;
    };
    batch.Serialize = function(buffers: any) {
      const serialized = serialize.call(this, buffers);
      if (serialized.chunks) for (const chunk of serialized.chunks) chunk.izcadOrigin = origin;
      else serialized.izcadOrigin = origin;
      return serialized;
    };
    return batch;
  };
  patchedScenes.add(sceneConstructor);
}

export function installTrianglePrecisionRendering(viewerConstructor: object): void {
  if (patchedViewers.has(viewerConstructor)) return;
  const p = (viewerConstructor as { prototype: any }).prototype, load = p._LoadBatch, render=p.Render, clear=p.Clear;
  const instances=Symbol("preciseInstances");
  p._LoadBatch = function(scene: any, batch: any) {
    const first = this.scene.children.length;
    load.call(this, scene, batch);
    const objects = this.scene.children.slice(first);
    if (batch.izcadInstanceTranslations && objects.length) {
      const buffer=objects[0].geometry?.attributes.instanceTransform0?.data;
      if(buffer)(this[instances]??=[]).push({objects,buffer,translations:batch.izcadInstanceTranslations,x:NaN,y:NaN});
    }
    for (let i = 0; i < objects.length; i++) {
      const origin = batch.izcadOrigin ?? batch.chunks?.[i]?.izcadOrigin, object = objects[i];
      if (origin && object) { object.position.set(origin.x, origin.y, 0); object.updateMatrix(); }
    }
  };
  if(typeof render==="function")p.Render=function() {
    const camera=this.GetCamera();if(!camera)return render.call(this);
    const x=Math.floor(camera.position.x/TILE)*TILE,y=Math.floor(camera.position.y/TILE)*TILE;
    for(const entry of this[instances]??[]) {
      if((entry.x===x&&entry.y===y)||!entry.objects.some((o:any)=>o.visible&&o.layers.mask))continue;
      const data=entry.buffer.array,t=entry.translations;
      // Upload only when crossing an origin tile, rather than on every pan frame.
      for(let i=0;i<t.length/2;i++){data[i*6+2]=t[i*2]-x;data[i*6+5]=t[i*2+1]-y;}
      entry.buffer.needsUpdate=true;entry.x=x;entry.y=y;
      for(const object of entry.objects){object.position.set(x,y,0);object.updateMatrix();}
    }
    return render.call(this);
  };
  if(typeof clear==="function")p.Clear=function(){
    const buffers=collectRenderBuffers(this.scene);
    for(const entry of this[instances]??[])buffers.add(entry.translations.buffer);
    this[instances]=[];
    try{return clear.call(this);}finally{retireDrawingBuffers(buffers);}
  };
  patchedViewers.add(viewerConstructor);
}
