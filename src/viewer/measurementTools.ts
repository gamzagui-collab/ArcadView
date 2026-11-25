import { distance, measuredAngle, pathLength, polygonArea, type LinearAxis, type MeasurementSettings } from "./measurementGeometry";
import type { DrawingPoint } from "./savedView";
import type {CircularSelection} from './circularSnap';

export const isDistanceMode = (mode: MeasurementSettings["mode"]): boolean => mode === "distance" || mode === "linear";
export const measurementPointLimit = (mode: MeasurementSettings["mode"]): number => isDistanceMode(mode)||mode==="radius" ? 2 : mode === "angle" ? 3 : 256;
export function linearMeasurement(points: readonly DrawingPoint[], axis: LinearAxis = "auto") {
  if (points.length < 2) return null;
  const [a, b] = points;
  const direction = axis === "auto" ? (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y) ? "x" : "y") : axis;
  // The dimension ends at the actual second pick. The first pick has an extension line.
  const start = direction === "x" ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
  return { axis: direction, start, end: b, value: Math.abs(direction === "x" ? b.x - a.x : b.y - a.y) };
}
export function measurementValue(settings: MeasurementSettings): number | undefined {
  if (settings.mode === "object") return settings.entity?.length;
  if (settings.mode === "angle") return measuredAngle(settings.points) ?? undefined;
  if (settings.mode === "area") return settings.points.length >= 3 ? polygonArea(settings.points) : undefined;
  if (settings.mode === "linear") return linearMeasurement(settings.points, settings.linearAxis)?.value;
  if (settings.mode === "radius") return settings.radius?.arc.radius??(settings.points.length===2?distance(settings.points[0],settings.points[1]):undefined);
  return settings.points.length >= 2 ? pathLength(settings.points) : undefined;
}
/** Drafts expose only the latest edge; totals become readable after completion is saved. */
export function measurementReadout(settings: MeasurementSettings) {
  const segment = (settings.mode === "path" || settings.mode === "area") && !settings.displayOnly;
  return {
    value: segment ? settings.points.length >= 2 ? distance(settings.points.at(-2)!, settings.points.at(-1)!) : undefined : measurementValue(settings),
    area: settings.mode === "area" && !segment,
    segment,
  };
}
export function canFinishMeasurement(settings: MeasurementSettings): boolean {
  if (settings.displayOnly || (settings.mode !== "path" && settings.mode !== "area")) return false;
  const value = measurementValue(settings);
  return value !== undefined && Number.isFinite(value) && value > 0;
}
const same = (a: DrawingPoint, b: DrawingPoint) => a.x === b.x && a.y === b.y;
export const pathIsClosed = (points: readonly DrawingPoint[]): boolean => points.length >= 4 && same(points[0], points[points.length - 1]);
export function measurementPointsAfterPick(settings: MeasurementSettings, point: DrawingPoint, replaceIndex?: number): DrawingPoint[] {
  if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < settings.points.length) {
    const points = [...settings.points], closed = settings.mode === "path" && pathIsClosed(points);
    points[replaceIndex] = point;
    if (closed && replaceIndex === 0) points[points.length - 1] = point;
    if (closed && replaceIndex === points.length - 1) points[0] = point;
    return points;
  }
  const limit = measurementPointLimit(settings.mode);
  const points = (limit <= 3 && settings.points.length >= limit) || (settings.mode === "path" && pathIsClosed(settings.points)) ? [] : settings.points;
  return points.length >= limit ? [...points] : [...points, point];
}
/** A radius has two actions: choose a real curve, then place its leader/label. */
export function measurementAfterPick(settings:MeasurementSettings,pick:{point:DrawingPoint;radius?:CircularSelection;replaceIndex?:number;entity?:MeasurementSettings['entity']}):MeasurementSettings|null {
 if(settings.mode==='radius'){
  if(settings.radius&&!settings.labelPoint){
   if(![pick.point.x,pick.point.y].every(Number.isFinite)||distance(settings.radius.arc.center,pick.point)<1e-9)return null;
   return{...settings,labelPoint:{...pick.point}};
  }
  if(!pick.radius)return null;
  return{...settings,radius:pick.radius,points:[pick.radius.arc.center,pick.radius.point],labelPoint:undefined,entity:null};
 }
 return settings.mode==='object'?{...settings,entity:pick.entity??null,points:[]}:{...settings,points:measurementPointsAfterPick(settings,pick.point,pick.replaceIndex),entity:null};
}
export function undoMeasurementPoint(settings:MeasurementSettings):MeasurementSettings {
 if(settings.mode==='radius'&&settings.radius)return settings.labelPoint?{...settings,labelPoint:undefined}:{...settings,points:[],radius:undefined,labelPoint:undefined,entity:null};
 return{...settings,points:settings.points.slice(0,-1),entity:null};
}
/** Measurement vertices are snap targets too, even when absent from the CAD file. */
export function snapToPathStart(settings: MeasurementSettings, point: DrawingPoint, tolerance: number, replaceIndex?: number): DrawingPoint | null {
  if (settings.mode !== "path" || !settings.snapping || settings.points.length < 3 || pathIsClosed(settings.points)) return null;
  if (replaceIndex !== undefined && (replaceIndex !== settings.points.length - 1 || settings.points.length < 4)) return null;
  const first = settings.points[0];
  return Math.hypot(point.x - first.x, point.y - first.y) <= tolerance ? { ...first } : null;
}
