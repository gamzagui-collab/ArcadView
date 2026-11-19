import type { DrawingPoint } from "./savedView";
import type { MeasurableEntity, SnapPoint } from "./measurementGeometry";

const CHUNK = 16_384;
const snapKinds = ["endpoint", "midpoint", "center", "insertion"] as const;
export type PackedMeasurement = {
  entityCount: number; pointCount: number; snapCount: number; kinds: string[];
  data: Float64Array[]; refs: Uint32Array[]; points: Float64Array[]; snaps: Float64Array[];
  extraSnaps?:Float64Array[];extraSnapCount?:number;
  snapSegments?:Float64Array[];snapSegmentCount?:number;
};
function row(chunks: Float64Array[] | Uint32Array[], index: number, stride: number) {
  return { chunk: chunks[Math.floor(index / CHUNK)], offset: index % CHUNK * stride };
}
function append(chunks: Float64Array[], index: number, values: number[]): void {
  if (index % CHUNK === 0) chunks.push(new Float64Array(CHUNK * values.length));
  chunks[chunks.length - 1].set(values, index % CHUNK * values.length);
}

/** Store doubles in transferable chunks, never millions of JS point objects. */
export class MeasurementPacker {
  readonly value: PackedMeasurement = { entityCount: 0, pointCount: 0, snapCount: 0, kinds: [], data: [], refs: [], points: [], snaps: [] };
  addEntity(entity: MeasurableEntity): void {
    const p = this.value, i = p.entityCount;
    let kind = p.kinds.indexOf(entity.kind);
    if (kind < 0) { kind = p.kinds.length; p.kinds.push(entity.kind); }
    if (i % CHUNK === 0) p.refs.push(new Uint32Array(CHUNK * 3));
    p.refs[p.refs.length - 1].set([p.pointCount, entity.points.length, kind], i % CHUNK * 3);
    const b = entity.bounds;
    append(p.data, i, [b.minX, b.minY, b.maxX, b.maxY, entity.length, entity.area ?? NaN, Number(entity.approximate)]);
    for (const point of entity.points) append(p.points, p.pointCount++, [point.x, point.y]);
    p.entityCount++;
  }
  addSnap(point: SnapPoint): void {
    append(this.value.snaps, this.value.snapCount++, [point.x, point.y, snapKinds.indexOf(point.kind)]);
  }
  finish(): PackedMeasurement {
    const p = this.value, original = p.snaps;
    const x = (i: number) => original[Math.floor(i / CHUNK)][i % CHUNK * 3];
    const order = new Uint32Array(p.snapCount);
    for (let i = 0; i < order.length; i++) order[i] = i;
    order.sort((a, b) => x(a) - x(b) || a - b);
    p.snaps = [];
    for (let i = 0; i < order.length; i++) {
      const r = row(original, order[i], 3);
      append(p.snaps, i, [r.chunk[r.offset], r.chunk[r.offset + 1], r.chunk[r.offset + 2]]);
    }
    return p;
  }
}

export function packedEntity(p: PackedMeasurement, index: number): MeasurableEntity {
  const d = row(p.data, index, 7), r = row(p.refs, index, 3), values = d.chunk, k = d.offset;
  const points: DrawingPoint[] = [];
  for (let i = r.chunk[r.offset], end = i + r.chunk[r.offset + 1]; i < end; i++) {
    const q = row(p.points, i, 2); points.push({ x: q.chunk[q.offset], y: q.chunk[q.offset + 1] });
  }
  return { kind: p.kinds[r.chunk[r.offset + 2]], points,
    bounds: { minX: values[k], minY: values[k + 1], maxX: values[k + 2], maxY: values[k + 3] },
    length: values[k + 4], area: Number.isNaN(values[k + 5]) ? undefined : values[k + 5], approximate: !!values[k + 6] };
}

export function nearestPackedSnap(p: PackedMeasurement, target: DrawingPoint, tolerance: number): SnapPoint | null {
  if (![target.x, target.y, tolerance].every(Number.isFinite) || tolerance < 0) return null;
  let low = 0, high = p.snapCount;
  while (low < high) { const mid = (low + high) >>> 1, r = row(p.snaps, mid, 3); if (r.chunk[r.offset] < target.x - tolerance) low = mid + 1; else high = mid; }
  let closest: SnapPoint | null = null, best = tolerance;
  for (let i = low; i < p.snapCount; i++) {
    const r = row(p.snaps, i, 3), x = r.chunk[r.offset], y = r.chunk[r.offset + 1];
    if (x > target.x + tolerance) break;
    const d = Math.hypot(x - target.x, y - target.y);
    if (d <= best) { best = d; closest = { x, y, kind: snapKinds[r.chunk[r.offset + 2]] }; }
  }
  if(p.extraSnaps&&p.extraSnapCount){
    const extra=nearestPackedSnap({...p,snaps:p.extraSnaps,snapCount:p.extraSnapCount,extraSnaps:undefined,extraSnapCount:0},target,best);
    if(extra&&(!closest||Math.hypot(extra.x-target.x,extra.y-target.y)<best))closest=extra;
  }
  return closest;
}

export function nearestPackedEntity(p: PackedMeasurement, target: DrawingPoint, tolerance: number,
  segmentDistance: (target: DrawingPoint, a: DrawingPoint, b: DrawingPoint) => number): MeasurableEntity | null {
  if (![target.x, target.y, tolerance].every(Number.isFinite) || tolerance < 0) return null;
  let selected = -1, best = tolerance;
  for (let i = 0; i < p.entityCount; i++) {
    const d = row(p.data, i, 7), b = d.chunk, k = d.offset;
    if (target.x < b[k] - best || target.x > b[k + 2] + best || target.y < b[k + 1] - best || target.y > b[k + 3] + best) continue;
    const r = row(p.refs, i, 3), start = r.chunk[r.offset], end = start + r.chunk[r.offset + 1];
    let a = row(p.points, start, 2), previous = { x: a.chunk[a.offset], y: a.chunk[a.offset + 1] };
    for (let j = start + 1; j < end; j++) {
      a = row(p.points, j, 2);
      const point = { x: a.chunk[a.offset], y: a.chunk[a.offset + 1] }, distance = segmentDistance(target, previous, point);
      if (distance <= best) { best = distance; selected = i; }
      previous = point;
    }
  }
  return selected < 0 ? null : packedEntity(p, selected);
}

export function measurementBuffers(p: PackedMeasurement): ArrayBuffer[] {
  return [...p.data, ...p.refs, ...p.points, ...p.snaps,...p.extraSnaps??[],...p.snapSegments??[]].map(a => a.buffer as ArrayBuffer);
}

/** Separate budget: new snap-only features never truncate the existing measurement index. */
export class SupplementalSnaps{
  readonly packer=new MeasurementPacker();readonly segments:Float64Array[]=[];segmentCount=0;limited=false;
  constructor(readonly maxSnaps=750000,readonly maxSegments=300000){}
  add(point:SnapPoint):void{if(this.packer.value.snapCount>=this.maxSnaps){this.limited=true;return;}this.packer.addSnap(point);}
  line(a:DrawingPoint,b:DrawingPoint):void{if(this.segmentCount>=this.maxSegments){this.limited=true;return;}append(this.segments,this.segmentCount++,[a.x,a.y,b.x,b.y]);}
  finish(p:PackedMeasurement):void{const s=this.packer.finish();p.extraSnaps=s.snaps;p.extraSnapCount=s.snapCount;p.snapSegments=this.segments;p.snapSegmentCount=this.segmentCount;}
}

const patched = new WeakSet<object>();
/** Add our index to the vendor worker's existing scene transfer list. */
export function installMeasurementTransfer(constructor: object): void {
  if (patched.has(constructor)) return;
  type Worker = { _ProcessRequestMessage(type: unknown, data: unknown, transfers: ArrayBuffer[], seq: unknown): Promise<{ dxf?: { izcadMeasurement?: { packed?: PackedMeasurement } } }> };
  const p = (constructor as { prototype: Worker }).prototype, original = p._ProcessRequestMessage;
  p._ProcessRequestMessage = async function(type, data, transfers, seq) {
    const result = await original.call(this, type, data, transfers, seq);
    const packed = result?.dxf?.izcadMeasurement?.packed;
    if (packed) transfers.push(...measurementBuffers(packed));
    return result;
  };
  patched.add(constructor);
}
