import { Matrix3, Vector2 } from "three";
import { parseDxfXclip } from "../dwg/xclipMetadata";
import type { DrawingBounds, DrawingPoint } from "./savedView";
import { MeasurementPacker, SupplementalSnaps, type PackedMeasurement } from "./packedMeasurement";
import { collectSnapFeatures, type SnapEntity, type SplineInterpolator } from "./snapFeatures";

export type MeasurementMode = "distance" | "linear" | "path" | "area" | "angle" | "object";
export type LinearAxis = "auto" | "x" | "y";
export type MeasurementUnit = "drawing" | "mm" | "cm" | "m" | "in" | "ft";
export type SnapPoint = DrawingPoint & { kind: "endpoint" | "midpoint" | "center" | "insertion" };
export type MeasurableEntity = {
  kind: string;
  points: DrawingPoint[];
  bounds: DrawingBounds;
  length: number;
  area?: number;
  approximate: boolean;
};
export type MeasurementGeometry = {
  unitPreferenceKey?: string;
  displayUnits?: MeasurementUnit;
  packed?: PackedMeasurement;
  units: MeasurementUnit;
  entities: MeasurableEntity[];
  snaps: SnapPoint[];
  limited: boolean;
  completeBounds: boolean;
  fitBounds: DrawingBounds[];
  fitCompleteBounds: boolean;
  snapSegments?:Array<[DrawingPoint,DrawingPoint]>;
  snapLimited?:boolean;
  snapFeatureCounts?:{blocks:number;hatches:number;faces:number;splines:number};
};
export type MeasurementGeometryLimits = {
  maxEntities?: number;
  maxPoints?: number;
  maxSnaps?: number;
  maxVisits?: number;
  maxSupplementalSnaps?:number;
  maxSnapSegments?:number;
};
export type MeasurementSettings = {
  enabled: boolean;
  mode: MeasurementMode;
  points: DrawingPoint[];
  snapping: boolean;
  entity: MeasurableEntity | null;
  linearAxis?: LinearAxis;
};

type Point = DrawingPoint & { bulge?: number; startWidth?: number; endWidth?: number };
type Entity = SnapEntity & {
  type?: string; layer?: string; hidden?: boolean; inPaperSpace?: boolean;
  vertices?: Point[]; position?: Point; center?: Point; name?: string;
  radius?: number; startAngle?: number; endAngle?: number; rotation?: number;
  xScale?: number; yScale?: number; shape?: boolean; width?: number;
  columnCount?: number; rowCount?: number;
  includesCurveFitVertices?: boolean; includesSplineFitVertices?: boolean;
  isPolyfaceMesh?: boolean; is3dPolygonMesh?: boolean;
  extrusionDirection?: { x: number; y: number; z: number };
  majorAxisEndPoint?: Point; axisRatio?: number;
  xdata?: Record<string, { values?: Array<{ code: number; value: unknown }> }>;
};
export type MeasurementDxf = {
  header?: Record<string, unknown>;
  entities?: Entity[];
  blocks?: Record<string, { name?: string; position?: Point; entities?: Entity[] }>;
  tables?: { layer?: { layers?: Record<string, { visible?: boolean; frozen?: boolean }> } };
};
const TAU = Math.PI * 2;
const MAX_ENTITIES = 100_000;
const MAX_POINTS = 600_000;
const validPoint = (p: Point | undefined): p is Point => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const transformed = (p: DrawingPoint, m: Matrix3): DrawingPoint => {
  const v = new Vector2(p.x, p.y).applyMatrix3(m);
  return { x: v.x, y: v.y };
};
export function distance(a: DrawingPoint, b: DrawingPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
export function pathLength(points: readonly DrawingPoint[], closed = false): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i]);
  if (closed && points.length > 1) length += distance(points[points.length - 1], points[0]);
  return length;
}
export function polygonArea(points: readonly DrawingPoint[]): number {
  if (points.length < 3) return 0;
  // Translate to the first vertex to retain precision for survey coordinates.
  const origin = points[0];
  let twiceArea = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    twiceArea += (a.x - origin.x) * (b.y - origin.y) - (b.x - origin.x) * (a.y - origin.y);
  }
  return Math.abs(twiceArea) / 2;
}
export function measuredAngle(points: readonly DrawingPoint[]): number | null {
  if (points.length !== 3) return null;
  const [a, vertex, b] = points;
  const u = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v = { x: b.x - vertex.x, y: b.y - vertex.y };
  const uLength = Math.hypot(u.x, u.y), vLength = Math.hypot(v.x, v.y);
  if (!Number.isFinite(uLength) || !Number.isFinite(vLength) || uLength === 0 || vLength === 0) return null;
  return Math.acos(Math.min(1, Math.max(-1, u.x / uLength * (v.x / vLength) + u.y / uLength * (v.y / vLength)))) * 180 / Math.PI;
}
export function unitFromInsunits(code: unknown): MeasurementUnit {
  return ({ 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" } as Record<number, MeasurementUnit>)[Number(code)] ?? "drawing";
}
export const UNIT_METERS: Record<MeasurementUnit, number> = { drawing: 1, mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048 };
export function convertMeasurement(value: number, source: MeasurementUnit, target: MeasurementUnit, area = false): number {
  const ratio = source === "drawing" || target === "drawing" ? 1 : UNIT_METERS[source] / UNIT_METERS[target];
  return value * (area ? ratio * ratio : ratio);
}
function boundsOf(points: readonly DrawingPoint[]): DrawingBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  return { minX, minY, maxX, maxY };
}
function contains(p: DrawingPoint, polygon: DrawingPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    if (pointSegmentDistance(p, a, b) < 1e-8) return true;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function pointSegmentDistance(p: DrawingPoint, a: DrawingPoint, b: DrawingPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const segmentLength = Math.hypot(dx, dy);
  const t = segmentLength === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * (dx / segmentLength) + (p.y - a.y) * (dy / segmentLength)) / segmentLength));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function normalizeClip(points: DrawingPoint[]): DrawingPoint[] {
  if (points.length !== 2 && points.length <= 32) return points;
  const bounds = boundsOf(points);
  return [
    { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY },
  ];
}
function segmentInsideClip(a: DrawingPoint, b: DrawingPoint, polygon: DrawingPoint[]): boolean {
  if (!contains(a, polygon) || !contains(b, polygon)) return false;
  const dx = b.x - a.x, dy = b.y - a.y;
  const parameters = [0, 1];
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i], d = polygon[(i + 1) % polygon.length];
    const ex = d.x - c.x, ey = d.y - c.y;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-12) continue;
    const cx = c.x - a.x, cy = c.y - a.y;
    const t = (cx * ey - cy * ex) / denominator;
    const u = (cx * dy - cy * dx) / denominator;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) parameters.push(t);
  }
  parameters.sort((left, right) => left - right);
  return parameters.slice(1).every((end, index) => {
    const t = (parameters[index] + end) / 2;
    return contains({ x: a.x + dx * t, y: a.y + dy * t }, polygon);
  });
}
function extendBounds(target: DrawingBounds, source: DrawingBounds): void {
  target.minX = Math.min(target.minX, source.minX); target.minY = Math.min(target.minY, source.minY);
  target.maxX = Math.max(target.maxX, source.maxX); target.maxY = Math.max(target.maxY, source.maxY);
}
const positiveAngle = (angle: number): number => (angle % TAU + TAU) % TAU;
function curveBounds(center: DrawingPoint, u: DrawingPoint, v: DrawingPoint, start: number, sweep: number): DrawingBounds {
  const at = (angle: number) => ({ x: center.x + u.x * Math.cos(angle) + v.x * Math.sin(angle), y: center.y + u.y * Math.cos(angle) + v.y * Math.sin(angle) });
  const points = [at(start), at(start + sweep)];
  for (const angle of [Math.atan2(v.x, u.x), Math.atan2(v.x, u.x) + Math.PI, Math.atan2(v.y, u.y), Math.atan2(v.y, u.y) + Math.PI]) {
    const offset = sweep >= 0 ? positiveAngle(angle - start) : positiveAngle(start - angle);
    if (offset <= Math.abs(sweep) + 1e-12) points.push(at(angle));
  }
  return boundsOf(points);
}
function transformedCurveBounds(center: DrawingPoint, radius: number, start: number, sweep: number, matrix: Matrix3): DrawingBounds {
  const e = matrix.elements;
  return curveBounds(transformed(center, matrix), { x: e[0] * radius, y: e[1] * radius }, { x: e[3] * radius, y: e[4] * radius }, start, sweep);
}

/** Build a bounded, double-precision index in the worker, before discarding the parsed document. */
export function buildMeasurementGeometry(
  dxf: MeasurementDxf,
  requestedLimits: MeasurementGeometryLimits = {},
  renderedEntityBounds?: WeakMap<object, DrawingBounds | null>,
  packed = false,
  interpolateSpline?:SplineInterpolator,
  consumeSource = false,
): MeasurementGeometry {
  const limit = (requested: number | undefined, maximum: number) => Number.isFinite(requested) && requested! > 0 ? Math.min(maximum, Math.floor(requested!)) : maximum;
  // Packed doubles have a bounded byte cost without a retained point-object graph.
  const maxEntities = limit(requestedLimits.maxEntities, packed ? 2_000_000 : MAX_ENTITIES);
  // Correct XCLIP transforms expose 15,919,696 outline points / 2,221,046
  // snaps in the reviewed BASE drawing. Packed buffers keep this bounded
  // (about 325 MiB for its complete index) without a point-object graph.
  const maxPoints = limit(requestedLimits.maxPoints, packed ? 64_000_000 : MAX_POINTS);
  const maxSnaps = limit(requestedLimits.maxSnaps, packed ? 10_000_000 : MAX_POINTS);
  const maxVisits = limit(requestedLimits.maxVisits, packed ? 16_000_000 : MAX_ENTITIES * 4);
  const packer = packed ? new MeasurementPacker() : null;
  let unpackedSnapCount=0;
  const supplement=new SupplementalSnaps(limit(requestedLimits.maxSupplementalSnaps,750000),limit(requestedLimits.maxSnapSegments,300000));
  let extraCount=0,extraLines=0;
  const entityCount = () => packer ? packer.value.entityCount : result.entities.length;
  const snapCount = () => packer ? packer.value.snapCount : unpackedSnapCount;
  const result: MeasurementGeometry = { units: unitFromInsunits(dxf.header?.$INSUNITS), entities: [], snaps: [], limited: false, completeBounds: true, fitBounds: [], fitCompleteBounds: true };
  const layers = dxf.tables?.layer?.layers ?? {};
  result.snapFeatureCounts={blocks:0,hatches:0,faces:0,splines:0};
  const supplementalPoint=(p:DrawingPoint,kind:SnapPoint["kind"],matrix:Matrix3,clips:DrawingPoint[][])=>{
    const q=transformed(p,matrix);if(!validPoint(q)||!clips.every(c=>contains(q,c)))return;
    if(packer)supplement.add({...q,kind});else if(extraCount++<supplement.maxSnaps)result.snaps.push({...q,kind});else supplement.limited=true;
  };
  const supplementalLine=(a:DrawingPoint,b:DrawingPoint,clips:DrawingPoint[][])=>{
    if(!validPoint(a)||!validPoint(b)||distance(a,b)<1e-10)return;
    let spans:Array<[DrawingPoint,DrawingPoint]>=[[a,b]];
    for(const clip of clips){const visible:Array<[DrawingPoint,DrawingPoint]>=[];
      for(const [a,b]of spans){const dx=b.x-a.x,dy=b.y-a.y,values=[0,1];
        for(let i=0;i<clip.length;i++){const c=clip[i],d=clip[(i+1)%clip.length],ex=d.x-c.x,ey=d.y-c.y,den=dx*ey-dy*ex;if(Math.abs(den)<1e-12)continue;const cx=c.x-a.x,cy=c.y-a.y,t=(cx*ey-cy*ex)/den,u=(cx*dy-cy*dx)/den;if(t>0&&t<1&&u>=0&&u<=1)values.push(t);}
        values.sort((a,b)=>a-b);const at=(t:number)=>({x:a.x+dx*t,y:a.y+dy*t});
        for(let i=1;i<values.length;i++)if(values[i]-values[i-1]>1e-12&&contains(at((values[i]+values[i-1])/2),clip))visible.push([at(values[i-1]),at(values[i])]);
      }spans=visible;
    }
    for(const[a,b]of spans){if(packer)supplement.line(a,b);else if(extraLines++<supplement.maxSegments)(result.snapSegments??=[]).push([a,b]);else supplement.limited=true;}
  };
  let totalPoints = 0;
  let visited = 0;
  const incomplete = () => { result.completeBounds = false; result.fitCompleteBounds = false; };
  const reachedLimit = () => { result.limited = true; incomplete(); };
  const addFitBounds = (bounds: DrawingBounds) => {
    if (!Object.values(bounds).every(Number.isFinite)) { incomplete(); return; }
    if ((packer?.value.fitCount??result.fitBounds.length) >= maxEntities) { reachedLimit(); return; }
    if(packer)packer.addBounds(bounds);else result.fitBounds.push(bounds);
  };
  const addSnaps = (snaps: SnapPoint[], clips: DrawingPoint[][]) => {
    for (const point of snaps) {
      if (!validPoint(point) || !clips.every((clip) => contains(point, clip))) continue;
      if (snapCount() >= maxSnaps) { reachedLimit(); break; }
      if (packer) packer.addSnap(point); else {result.snaps.push(point);unpackedSnapCount++;}
    }
  };
  const add = (entity: MeasurableEntity, snaps: SnapPoint[], clips: DrawingPoint[][], curved: boolean) => {
    const visible = (p: DrawingPoint) => clips.every((clip) => contains(p, clip));
    if (entityCount() >= maxEntities || totalPoints + entity.points.length > maxPoints) { reachedLimit(); return; }
    if (!entity.points.every(validPoint) || !Number.isFinite(entity.length) || (entity.area !== undefined && !Number.isFinite(entity.area)) || !Object.values(entity.bounds).every(Number.isFinite)) { incomplete(); return; }
    addSnaps(snaps, clips);
    // A clipped object's full length would describe hidden content. Keep taps/snaps available,
    // but omit object measurements unless its sampled outline lies within every clip boundary.
    if (!entity.points.every(visible) || !clips.every((clip) => entity.points.slice(1).every((point, index) => segmentInsideClip(entity.points[index], point, clip)))) {
      if(!curved)for(let i=1;i<entity.points.length;i++)supplementalLine(entity.points[i-1],entity.points[i],clips);
      incomplete(); return;
    }
    if (curved && clips.length > 0) {
      // A chord approximation can fit inside a boundary while the actual arc
      // between samples crosses it. Require its entire analytic box to fit.
      const box = normalizeClip([{ x: entity.bounds.minX, y: entity.bounds.minY }, { x: entity.bounds.maxX, y: entity.bounds.maxY }]);
      if (!clips.every((clip) => box.every((point, index) => segmentInsideClip(point, box[(index + 1) % box.length], clip)))) { incomplete(); return; }
    }
    if (clips.length > 0) incomplete();
    if (packer) packer.addEntity(entity); else result.entities.push(entity);
    addFitBounds(entity.bounds);
    totalPoints += entity.points.length;
  };
  const visit = (entity: Entity, parent: Matrix3, inheritedLayer: string, clips: DrawingPoint[][], stack: string[]) => {
    if (++visited > maxVisits) { reachedLimit(); return; }
    const layerName = entity.layer && entity.layer !== "0" ? entity.layer : inheritedLayer;
    const layer = layers[layerName];
    if (entity.hidden) return;
    if (layer?.visible === false || layer?.frozen) {
      // The pinned renderer deliberately bypasses layer-0 filtering; do not
      // claim full coverage when its visible bounds could still contain it.
      if (layerName === "0") incomplete();
      return;
    }
    if (entity.inPaperSpace) { incomplete(); return; }
    const extrusion = entity.extrusionDirection;
    if (extrusion && (![extrusion.x, extrusion.y, extrusion.z].every(Number.isFinite) || Math.abs(extrusion.x) > 1e-9 || Math.abs(extrusion.y) > 1e-9)) { incomplete(); return; }
    if (entity.type === "INSERT") {
      if (!entity.name || !validPoint(entity.position) || stack.includes(entity.name) || stack.length >= 24) { incomplete(); return; }
      if((entity.columnCount??1)>1||(entity.rowCount??1)>1)incomplete(); // Pinned renderer draws the first MINSERT cell.
      const block = dxf.blocks?.[entity.name] ?? Object.values(dxf.blocks ?? {}).find((b) => b.name === entity.name);
      if (!block) { incomplete(); return; }
      if (![entity.xScale ?? 1, entity.yScale ?? 1, entity.rotation ?? 0].every(Number.isFinite) || entity.xScale === 0 || entity.yScale === 0) { incomplete(); return; }
      const base = validPoint(block.position) ? block.position : { x: 0, y: 0 };
      const insert = new Matrix3().translate(-base.x, -base.y)
        .scale(entity.xScale ?? 1, entity.yScale ?? 1)
        .rotate(-(entity.rotation ?? 0) * Math.PI / 180)
        .translate(entity.position.x, entity.position.y);
      if (extrusion && extrusion.z < 0) insert.scale(-1, 1);
      const matrix = new Matrix3().multiplyMatrices(parent, insert);
      const clip = parseDxfXclip(entity);
      const nextClips = clip ? [...clips, normalizeClip(clip).map((p) => transformed(p, matrix))] : clips;
      result.snapFeatureCounts!.blocks++;
      supplementalPoint(base,"insertion",matrix,nextClips);
      if (clip) incomplete();
      for (const child of block.entities ?? []) {
        if (result.limited) break;
        visit(child, matrix, layerName, nextClips, [...stack, entity.name]);
      }
      return;
    }
    if (entity.type === "TEXT" || entity.type === "MTEXT") {
      result.completeBounds = false;
      if (!renderedEntityBounds?.has(entity)) { result.fitCompleteBounds = false; return; }
      const localBounds = renderedEntityBounds.get(entity);
      if (localBounds) {
        const corners = normalizeClip([{ x: localBounds.minX, y: localBounds.minY }, { x: localBounds.maxX, y: localBounds.maxY }]);
        addFitBounds(boundsOf(corners.map((point) => transformed(point, parent))));
      }
      return;
    }
    let matrix = parent;
    if (extrusion && extrusion.z < 0 && entity.type !== "LINE") matrix = parent.clone().multiply(new Matrix3().scale(-1, 1));
    if(["HATCH","SOLID","TRACE","3DFACE","SPLINE"].includes(entity.type??"")){
      const key=entity.type==="HATCH"?"hatches":entity.type==="SPLINE"?"splines":"faces";
      result.snapFeatureCounts![key]++;
      const complete=collectSnapFeatures(entity,(p,kind)=>supplementalPoint(p,kind,matrix,clips),(a,b)=>supplementalLine(transformed(a,matrix),transformed(b,matrix),clips),interpolateSpline,Number(dxf.header?.$ANGBASE??0));
      if(!complete)supplement.limited=true;
      incomplete();return;
    }
    const e = matrix.elements;
    const scaleX = Math.hypot(e[0], e[1]), scaleY = Math.hypot(e[3], e[4]);
    const uniform = scaleX > 0 && scaleY > 0 &&
      Math.abs(scaleX - scaleY) <= 1e-9 * Math.max(scaleX, scaleY) &&
      Math.abs(e[0] / scaleX * (e[3] / scaleY) + e[1] / scaleX * (e[4] / scaleY)) <= 1e-9;
    const determinant = Math.abs(e[0] * e[4] - e[1] * e[3]);
    const snaps: SnapPoint[] = [];
    const snap = (p: DrawingPoint, kind: SnapPoint["kind"]) => {
      if (snaps.length >= maxSnaps - snapCount()) { reachedLimit(); return; }
      const point = transformed(p, matrix);
      if (validPoint(point)) snaps.push({ ...point, kind });
    };
    let points: DrawingPoint[] = [], length = 0, area: number | undefined, approximate = false;
    let measuredBounds: DrawingBounds | undefined;
    let curved = false;
    if (entity.type === "POINT" && validPoint(entity.position)) {
      if (extrusion && extrusion.z < 0) { incomplete(); return; }
      const pointMode = Number(dxf.header?.$PDMODE ?? 0);
      if (pointMode === 1 || (pointMode !== 0 && Number(dxf.header?.$PDSIZE ?? 0) <= 0)) return;
      snap(entity.position, "endpoint");
      addSnaps(snaps, clips);
      result.completeBounds = false;
      if (pointMode === 0 && clips.length === 0) {
        const position = transformed(entity.position, matrix);
        addFitBounds({ minX: position.x, minY: position.y, maxX: position.x, maxY: position.y });
      } else result.fitCompleteBounds = false;
      return;
    }
    if (["LINE", "LWPOLYLINE", "POLYLINE"].includes(entity.type ?? "")) {
      const vertices = entity.vertices;
      if (!vertices || vertices.length < 2 || !vertices.every(validPoint) || entity.isPolyfaceMesh || entity.is3dPolygonMesh || entity.includesCurveFitVertices || entity.includesSplineFitVertices) { incomplete(); return; }
      if (vertices.length > maxPoints - totalPoints) { reachedLimit(); return; }
      if (entity.width || vertices.some((vertex) => vertex.startWidth || vertex.endWidth)) incomplete();
      if (extrusion && extrusion.z < 0 && vertices.some((vertex) => Math.abs(vertex.bulge ?? 0) > 1e-10)) { incomplete(); return; }
      const closed = entity.type !== "LINE" && entity.shape === true;
      const count = closed ? vertices.length : vertices.length - 1;
      let signedArea = 0;
      for (let i = 0; i < count; i++) {
        const a = vertices[i], b = vertices[(i + 1) % vertices.length];
        snap(a, "endpoint");
        const bulge = entity.type === "LINE" ? 0 : (a.bulge ?? 0);
        if (!Number.isFinite(bulge)) { incomplete(); return; }
        const chord = distance(a, b);
        const segment: DrawingPoint[] = [a];
        let analyticLength = chord, segmentArea = 0;
        if (Math.abs(bulge) > 1e-10 && chord > 0) {
          curved = true;
          const theta = 4 * Math.atan(bulge);
          const radius = chord * (1 + bulge * bulge) / (4 * Math.abs(bulge));
          const offset = chord * (1 - bulge * bulge) / (4 * bulge);
          const center = { x: (a.x + b.x) / 2 - (b.y - a.y) / chord * offset, y: (a.y + b.y) / 2 + (b.x - a.x) / chord * offset };
          const start = Math.atan2(a.y - center.y, a.x - center.x);
          const steps = Math.max(8, Math.ceil(Math.abs(theta) / (Math.PI / 90)));
          if (points.length + steps + 1 > maxPoints - totalPoints) { reachedLimit(); return; }
          for (let j = 1; j < steps; j++) segment.push({ x: center.x + radius * Math.cos(start + theta * j / steps), y: center.y + radius * Math.sin(start + theta * j / steps) });
          snap({ x: center.x + radius * Math.cos(start + theta / 2), y: center.y + radius * Math.sin(start + theta / 2) }, "midpoint");
          analyticLength = radius * Math.abs(theta);
          segmentArea = radius * radius * (theta - Math.sin(theta)) / 2;
          const arcBounds = transformedCurveBounds(center, radius, start, theta, matrix);
          if (measuredBounds) extendBounds(measuredBounds, arcBounds); else measuredBounds = arcBounds;
        } else snap({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, "midpoint");
        segment.push(b);
        const world = segment.map((p) => transformed(p, matrix));
        if (result.limited || points.length + world.length > maxPoints - totalPoints) { reachedLimit(); return; }
        length += Math.abs(bulge) <= 1e-10 ? distance(world[0], world[world.length - 1]) : uniform ? analyticLength * scaleX : pathLength(world);
        approximate ||= Math.abs(bulge) > 1e-10 && !uniform;
        for (let j = i === 0 ? 0 : 1; j < world.length; j++) points.push(world[j]);
        // Use translated coordinates, as above, for stable polygon area.
        const origin = vertices[0];
        signedArea += ((a.x - origin.x) * (b.y - origin.y) - (b.x - origin.x) * (a.y - origin.y)) / 2 + segmentArea;
      }
      if (!closed) snap(vertices[vertices.length - 1], "endpoint");
      if (closed) area = Math.abs(signedArea) * determinant;
    } else if (entity.type === "CIRCLE" || entity.type === "ARC") {
      if (!validPoint(entity.center) || !Number.isFinite(entity.radius) || entity.radius! <= 0 || (entity.type === "ARC" && Number(dxf.header?.$ANGBASE ?? 0) !== 0)) { incomplete(); return; }
      curved = true;
      const radius = entity.radius!;
      const start = entity.type === "ARC" ? entity.startAngle ?? 0 : 0;
      let sweep = entity.type === "CIRCLE" ? TAU : (entity.endAngle ?? 0) - (entity.startAngle ?? 0);
      if (!Number.isFinite(start) || !Number.isFinite(sweep)) { incomplete(); return; }
      sweep = positiveAngle(sweep) || TAU;
      const at = (angle: number) => ({ x: entity.center!.x + radius * Math.cos(angle), y: entity.center!.y + radius * Math.sin(angle) });
      const steps = Math.max(8, Math.ceil(sweep / (Math.PI / 90)));
      if (steps + 1 > maxPoints - totalPoints) { reachedLimit(); return; }
      for (let i = 0; i <= steps; i++) points.push(transformed(at(start + sweep * i / steps), matrix));
      snap(entity.center, "center");
      if (entity.type === "ARC") { snap(at(start), "endpoint"); snap(at(start + sweep), "endpoint"); snap(at(start + sweep / 2), "midpoint"); }
      else for (let i = 0; i < 4; i++) snap(at(i * Math.PI / 2), "endpoint");
      length = uniform ? radius * sweep * scaleX : pathLength(points);
      approximate = !uniform;
      if (entity.type === "CIRCLE") area = Math.PI * radius * radius * determinant;
      measuredBounds = transformedCurveBounds(entity.center, radius, start, sweep, matrix);
    } else if (entity.type === "ELLIPSE") {
      if (!validPoint(entity.center) || !validPoint(entity.majorAxisEndPoint) || !Number.isFinite(entity.axisRatio) || entity.axisRatio! <= 0 || (extrusion && extrusion.z < 0) || Number(dxf.header?.$ANGBASE ?? 0) !== 0) { incomplete(); return; }
      const major = entity.majorAxisEndPoint, ratio = entity.axisRatio!;
      curved = true;
      const localU = major, localV = { x: -major.y * ratio, y: major.x * ratio };
      const worldCenter = transformed(entity.center, matrix);
      const u = { x: e[0] * localU.x + e[3] * localU.y, y: e[1] * localU.x + e[4] * localU.y };
      const v = { x: e[0] * localV.x + e[3] * localV.y, y: e[1] * localV.x + e[4] * localV.y };
      const start = entity.startAngle ?? 0, rawSweep = (entity.endAngle ?? start + TAU) - start;
      if (!Number.isFinite(start) || !Number.isFinite(rawSweep) || Math.hypot(major.x, major.y) === 0) { incomplete(); return; }
      const sweep = positiveAngle(rawSweep) || TAU;
      const at = (angle: number) => ({ x: entity.center!.x + localU.x * Math.cos(angle) + localV.x * Math.sin(angle), y: entity.center!.y + localU.y * Math.cos(angle) + localV.y * Math.sin(angle) });
      const steps = Math.max(8, Math.ceil(sweep / (Math.PI / 180)));
      if (steps + 1 > maxPoints - totalPoints) { reachedLimit(); return; }
      for (let i = 0; i <= steps; i++) points.push(transformed(at(start + sweep * i / steps), matrix));
      length = pathLength(points); approximate = true;
      if (Math.abs(sweep - TAU) < 1e-10) area = Math.PI * (major.x * major.x + major.y * major.y) * ratio * determinant;
      snap(entity.center, "center");
      snap(at(start), "endpoint"); snap(at(start + sweep), "endpoint"); snap(at(start + sweep / 2), "midpoint");
      measuredBounds = curveBounds(worldCenter, u, v, start, sweep);
    } else { incomplete(); return; }
    if (points.length > 1) {
      const bounds = boundsOf(points);
      if (measuredBounds) extendBounds(bounds, measuredBounds);
      add({ kind: entity.type!, points, bounds, length, area, approximate }, snaps, clips, curved);
    } else incomplete();
  };
  // Rendering is finished before the worker builds this index. Release each
  // parsed definition after its last model/paper use instead of retaining the
  // entire DXF object graph beside the growing double-precision index.
  const sourceEntities=dxf.entities??[];
  const retire=new Map<number,Array<{entities?:Entity[]}>>();
  if(consumeSource){
    const definitions=Object.values(dxf.blocks??{}),byName=new Map<string|undefined,(typeof definitions)[number]>();
    for(const b of definitions)if(b.name&&!byName.has(b.name))byName.set(b.name,b);
    for(const[name,b]of Object.entries(dxf.blocks??{}))byName.set(name,b);
    const dependencies=new Map(definitions.map(b=>[b,[...new Set((b.entities??[]).filter(e=>e.type==='INSERT').map(e=>byName.get(e.name)))].filter(Boolean)]));
    const last=new Map<(typeof definitions)[number],number>();
    for(let i=0;i<sourceEntities.length;i++){
      const first=byName.get(sourceEntities[i].name),todo=first?[first]:[];
      while(todo.length){const block=todo.pop()!;if(last.get(block)===i)continue;last.set(block,i);for(const child of dependencies.get(block)??[])if(child)todo.push(child);}
    }
    for(const[block,index]of last){const list=retire.get(index)??[];list.push(block);retire.set(index,list);}
    for(const block of definitions)if(!last.has(block))delete block.entities;
  }
  for (let i=0;i<sourceEntities.length;i++) {
    if (result.limited) break;
    visit(sourceEntities[i], new Matrix3(), "0", [], []);
    if(consumeSource){for(const block of retire.get(i)??[])delete block.entities;(sourceEntities as Array<Entity|null>)[i]=null;}
  }
  result.snaps.sort((a, b) => a.x - b.x);
  if (packer){result.packed = packer.finish();supplement.finish(result.packed);}
  result.snapLimited=supplement.limited;
  return result;
}

export function nearestSnap(points: readonly SnapPoint[], target: DrawingPoint, tolerance: number): SnapPoint | null {
  if (!validPoint(target) || !Number.isFinite(tolerance) || tolerance < 0) return null;
  let low = 0, high = points.length;
  while (low < high) { const mid = (low + high) >>> 1; if (points[mid].x < target.x - tolerance) low = mid + 1; else high = mid; }
  let closest: SnapPoint | null = null, best = tolerance;
  for (let i = low; i < points.length && points[i].x <= target.x + tolerance; i++) {
    const d = distance(points[i], target);
    if (d <= best) { best = d; closest = points[i]; }
  }
  return closest;
}
export function nearestEntity(entities: readonly MeasurableEntity[], target: DrawingPoint, tolerance: number): MeasurableEntity | null {
  if (!validPoint(target) || !Number.isFinite(tolerance) || tolerance < 0) return null;
  let closest: MeasurableEntity | null = null, best = tolerance;
  for (const entity of entities) {
    const b = entity.bounds;
    if (target.x < b.minX - best || target.x > b.maxX + best || target.y < b.minY - best || target.y > b.maxY + best) continue;
    for (let i = 1; i < entity.points.length; i++) {
      const d = pointSegmentDistance(target, entity.points[i - 1], entity.points[i]);
      if (d <= best) { best = d; closest = entity; }
    }
  }
  return closest;
}

/** The vendor worker returns retained DXF; replace it with only the compact index after rendering. */
const patchedConstructors = new WeakSet<object>();
const RENDERED_ENTITY_BOUNDS = Symbol("izcadRenderedEntityBounds");
const RENDERED_BOUND_COUNT = Symbol("izcadRenderedBoundCount");
type MeasurementScene = {
  Build(dxf: MeasurementDxf, fonts: unknown): Promise<void>;
  [RENDERED_ENTITY_BOUNDS]?: WeakMap<object, DrawingBounds | null>;
  [RENDERED_BOUND_COUNT]?: number;
  _DecomposeText?(entity: Entity, context: unknown): Iterable<{ vertices?: DrawingPoint[] }>;
  _DecomposeMText?(entity: Entity, context: unknown): Iterable<{ vertices?: DrawingPoint[] }>;
  _InterpolateSpline?:SplineInterpolator;
};
export function installMeasurementPreparation(constructor: object): void {
  if (patchedConstructors.has(constructor)) return;
  const prototype = (constructor as { prototype: MeasurementScene }).prototype;
  // Record actual glyph geometry after font layout and text alignment. Guesses
  // based on character count cannot safely account for arbitrary glyph widths,
  // MTEXT formatting or fitted/aligned text, especially inside nested blocks.
  for (const method of ["_DecomposeText", "_DecomposeMText"] as const) {
    const decompose = prototype[method];
    if (!decompose) continue;
    prototype[method] = function* (this: MeasurementScene, entity: Entity, context: unknown) {
      const captured = this[RENDERED_ENTITY_BOUNDS];
      const canCapture = !!captured && (captured.has(entity) || (this[RENDERED_BOUND_COUNT] ?? 0) < MAX_ENTITIES);
      let bounds: DrawingBounds | null = null;
      if (canCapture && !captured.has(entity)) this[RENDERED_BOUND_COUNT] = (this[RENDERED_BOUND_COUNT] ?? 0) + 1;
      for (const primitive of decompose.call(this, entity, context)) {
        if (canCapture) {
          for (const point of primitive.vertices ?? []) {
            const vertexBounds = { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y };
            if (bounds) extendBounds(bounds, vertexBounds); else bounds = vertexBounds;
          }
        }
        yield primitive;
      }
      if (canCapture) captured.set(entity, bounds);
    };
  }
  const original = prototype.Build;
  prototype.Build = async function(this: MeasurementScene, dxf: MeasurementDxf, fonts: unknown) {
    this[RENDERED_ENTITY_BOUNDS] = new WeakMap();
    this[RENDERED_BOUND_COUNT] = 0;
    await original.call(this, dxf, fonts);
    (this as unknown as {inserts?:Map<unknown,unknown>}).inserts?.clear();
    console.info("[arcad-index] start");
    const geometry = buildMeasurementGeometry(dxf, {}, this[RENDERED_ENTITY_BOUNDS], true,this._InterpolateSpline?.bind(this),true);
    console.info("[arcad-index] complete",geometry.packed?.entityCount,geometry.packed?.pointCount,geometry.limited,geometry.snapLimited);
    for (const key of Object.keys(dxf)) delete (dxf as Record<string, unknown>)[key];
    (dxf as Record<string, unknown>).izcadMeasurement = geometry;
    delete this[RENDERED_ENTITY_BOUNDS];
    delete this[RENDERED_BOUND_COUNT];
  };
  patchedConstructors.add(constructor);
}
