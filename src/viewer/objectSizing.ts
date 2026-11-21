import type {Annotation} from "./annotations";
import type {DrawingPoint as P} from "./savedView";
import {distance,pointSegmentDistance} from "./measurementGeometry";
import {rectangleCorners} from "./curveGeometry";
export type ObjectSize={kind:"radius"|"rectangle"|"segment";values:number[];segments:number[];segment:number};
/** Exact straight segments only; never reinterpret a fitted CAD curve as a line. */
export function objectSize(o:Annotation,segment=0):ObjectSize|null{
 if(o.approximate)return null;
 if(o.kind==="circle"||o.kind==="arc")return{kind:"radius",values:[distance(o.points[0],o.points[1])],segments:[],segment:0};
 if(o.kind==="rectangle"){const p=rectangleCorners(o);return{kind:"rectangle",values:[distance(p[0],p[1]),distance(p[0],p[3])],segments:[],segment:0};}
 if(o.kind!=="polyline"||o.curved)return null;
 const segments=o.points.slice(1).flatMap((p,i)=>distance(o.points[i],p)>1e-9?[i]:[]);if(!segments.length)return null;
 const i=segments.includes(segment)?segment:segments[0];return{kind:"segment",values:[distance(o.points[i],o.points[i+1])],segments,segment:i};
}
export function nearestSizeSegment(o:Annotation,point:P):number{
 const info=objectSize(o);if(info?.kind!=="segment")return 0;
 let best=Infinity,index=info.segment;for(const i of info.segments){const d=pointSegmentDistance(point,o.points[i],o.points[i+1]);if(d<best){best=d;index=i;}}return index;
}
/** Preserve layer/style and the local anchor. Only the requested size changes. */
export function resizeObject(o:Annotation,values:readonly number[],segment=0):Annotation|null{
 const info=objectSize(o,segment);if(!info||values.length!==info.values.length||values.some(v=>!Number.isFinite(v)||v<=1e-9||v>1e12))return null;
 if(values.every((v,i)=>v===info.values[i]))return o;
 if(info.kind==="radius"){
  const[c,p]=o.points,r=distance(c,p);if(r<1e-9)return null;
  return{...o,points:[c,{x:c.x+(p.x-c.x)*values[0]/r,y:c.y+(p.y-c.y)*values[0]/r}]};
 }
 if(info.kind==="rectangle"){
  const p=rectangleCorners(o),a=p[0],[width,height]=info.values;if(width<1e-9||height<1e-9)return null;
  const u={x:(p[1].x-a.x)/width*values[0],y:(p[1].y-a.y)/width*values[0]},v={x:(p[3].x-a.x)/height*values[1],y:(p[3].y-a.y)/height*values[1]};
  return{...o,points:[a,{x:a.x+u.x,y:a.y+u.y},{x:a.x+u.x+v.x,y:a.y+u.y+v.y},{x:a.x+v.x,y:a.y+v.y}]};
 }
 const i=info.segment,a=o.points[i],b=o.points[i+1],ratio=values[0]/info.values[0],end={x:a.x+(b.x-a.x)*ratio,y:a.y+(b.y-a.y)*ratio},closed=o.points.length>2&&distance(o.points[0],o.points.at(-1)!)<1e-9;
 const points=o.points.map((p,j)=>j===i+1||closed&&i+1===o.points.length-1&&j===0?end:p);
 // Avoid collapsing an adjacent edge after moving the common vertex.
 if(points.some((p,j)=>j>0&&distance(points[j-1],p)<1e-9))return null;
 return{...o,points};
}
