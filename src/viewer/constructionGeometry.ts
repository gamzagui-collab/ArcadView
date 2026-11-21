import type {DrawingPoint as P} from "./savedView";
import {distance} from "./measurementGeometry";
import {normAngle} from "./curveGeometry";
export type ConstructionKind="circle"|"arc"|"rectangle"|"polyline";
const finite=(p:P)=>Number.isFinite(p.x)&&Number.isFinite(p.y);
function chordFrame(points:readonly P[]){
 const[a,b,hint]=points;if(!a||!b||!hint||!points.every(finite))return null;
 const length=distance(a,b);if(length<1e-9)return null;
 const middle={x:a.x+(b.x-a.x)/2,y:a.y+(b.y-a.y)/2},normal={x:-(b.y-a.y)/length,y:(b.x-a.x)/length};
 return{a,b,middle,normal,half:length/2,height:(hint.x-middle.x)*normal.x+(hint.y-middle.y)*normal.y};
}
export function constructionDefaults(kind:ConstructionKind,points:readonly P[]):number[]|null{
 if(kind==="arc"){const f=chordFrame(points);return f?[Math.hypot(f.half,f.height)]:null;}
 const a=kind==="polyline"?points.at(-2):points[0],b=points.at(-1);if(!a||!b||!points.every(finite))return null;
 return kind==="rectangle"?[Math.abs(b.x-a.x),Math.abs(b.y-a.y)]:[distance(a,b)];
}
/** Input distances use drawing units and preserve the picked direction/corner quadrant. */
export function constructGeometry(kind:ConstructionKind,points:readonly P[],values:readonly number[]):{points:P[];start?:number;sweep?:number}|null{
 if(!values.length||values.some(v=>!Number.isFinite(v)||v<=0||v>1e12)||!points.every(finite))return null;
 if(kind==="arc"){
  const f=chordFrame(points),r=values[0];if(!f||r<f.half)return null;
  const h=Math.sqrt(r-f.half)*Math.sqrt(r+f.half)*(f.height<0?-1:1),c={x:f.middle.x+f.normal.x*h,y:f.middle.y+f.normal.y*h};
  const start=normAngle(Math.atan2(f.a.y-c.y,f.a.x-c.x)),sweep=normAngle(Math.atan2(f.b.y-c.y,f.b.x-c.x)-start);
  if(sweep<1e-9)return null;
  return{points:[c,{x:c.x+r,y:c.y}],start,sweep};
 }
 const a=kind==="polyline"?points.at(-2):points[0],b=points.at(-1);if(!a||!b)return null;
 if(kind==="rectangle"){
  if(values.length!==2)return null;
  return{points:[a,{x:a.x+(Math.sign(b.x-a.x)||1)*values[0],y:a.y+(Math.sign(b.y-a.y)||-1)*values[1]}]};
 }
 const length=distance(a,b);if(length<1e-9)return null;
 const end={x:a.x+(b.x-a.x)*values[0]/length,y:a.y+(b.y-a.y)*values[0]/length};
 return{points:kind==="polyline"?[...points.slice(0,-1),end]:[a,end]};
}
