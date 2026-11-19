import type { DrawingPoint } from "./savedView";
import type { LinearAxis, MeasurementGeometry, MeasurementMode } from "./measurementGeometry";
import { linearMeasurement } from "./measurementTools";
import {visitCadSegments}from"./cadPicking";
const TOLERANCE = Math.sin(0.2 * Math.PI / 180);
export function isRightAngle(a:DrawingPoint,b:DrawingPoint):boolean {
  const la=Math.hypot(a.x,a.y),lb=Math.hypot(b.x,b.y);
  return la>1e-9&&lb>1e-9&&Math.abs(a.x*b.x+a.y*b.y)<=la*lb*TOLERANCE;
}
/** Read straight-edge directions once per committed anchor, never per camera frame. */
export function referenceDirections(g:MeasurementGeometry,point:DrawingPoint,tolerance:number):DrawingPoint[] {
  const directions:DrawingPoint[]=[];
  const segment=(ax:number,ay:number,bx:number,by:number)=>{
    const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;if(l2<1e-12)return;
    const t=Math.max(0,Math.min(1,((point.x-ax)*dx+(point.y-ay)*dy)/l2));
    if(Math.hypot(point.x-ax-t*dx,point.y-ay-t*dy)>tolerance)return;
    const sign=Math.hypot(point.x-ax,point.y-ay)>Math.hypot(point.x-bx,point.y-by)?-1:1,l=Math.sqrt(l2),d={x:sign*dx/l,y:sign*dy/l};
    if(!directions.some(v=>Math.abs(v.x*d.y-v.y*d.x)<1e-6)&&directions.length<12)directions.push(d);
  };
  visitCadSegments(g,{minX:point.x-tolerance,minY:point.y-tolerance,maxX:point.x+tolerance,maxY:point.y+tolerance},(a,b)=>segment(a.x,a.y,b.x,b.y));
  return directions;
}
export function rightAngleCorners(points:readonly DrawingPoint[],mode:MeasurementMode,references:readonly DrawingPoint[]=[],linearAxis:LinearAxis="auto",endReferences:readonly DrawingPoint[]=[]):Array<[DrawingPoint,DrawingPoint,DrawingPoint]> {
  const marks:Array<[DrawingPoint,DrawingPoint,DrawingPoint]>=[];
  const add=(a:DrawingPoint,v:DrawingPoint,b:DrawingPoint)=>{if(isRightAngle({x:a.x-v.x,y:a.y-v.y},{x:b.x-v.x,y:b.y-v.y}))marks.push([a,v,b]);};
  if(mode==="linear"&&points.length===2){
    const m=linearMeasurement(points,linearAxis)!;const v=m.end,a=points[0];
    const d=m.axis==="x"?{x:0,y:Math.sign(a.y-v.y)||1}:{x:Math.sign(a.x-v.x)||1,y:0};
    add({x:v.x+d.x,y:v.y+d.y},v,m.start);
    add({x:m.start.x+d.x,y:m.start.y+d.y},m.start,v);
  }
  else if(mode==="distance"&&points.length===2){
    for(const [v,a,refs]of [[points[0],points[1],references],[points[1],points[0],endReferences]]as const){
      const d=[...refs,{x:1,y:0},{x:0,y:1}].find(d=>isRightAngle(d,{x:a.x-v.x,y:a.y-v.y}));
      if(d)add({x:v.x+d.x,y:v.y+d.y},v,a);
    }
  }
  else if(mode==="area"&&points.length>=3)for(let i=0;i<points.length;i++)add(points[(i+points.length-1)%points.length],points[i],points[(i+1)%points.length]);
  else if(mode!=="object")for(let i=1;i<points.length-1;i++)add(points[i-1],points[i],points[i+1]);
  return marks;
}
