import type { DrawingPoint as P } from "./savedView";
import { annotationPoints, isPointAnnotation, lineIntersection, segments, type Annotation } from "./annotations";
import { distance, UNIT_METERS, type MeasurementUnit } from "./measurementGeometry";
import { segmentFoot } from "./cadPicking";

export type OffsetGuide={anchor:P;normal:P;radial:boolean};
export function offsetGuide(object:Annotation,pick:P):OffsetGuide|null{
  if(isPointAnnotation(object)||["mask","text","dimension-aligned","dimension-linear"].includes(object.kind)||object.approximate)return null;
  if(object.kind==="circle"||object.kind==="arc"){
    const c=object.points[0],r=distance(c,object.points[1]),d=distance(c,pick);
    if(r<1e-10)return null;
    const normal=d>1e-10?{x:(pick.x-c.x)/d,y:(pick.y-c.y)/d}:{x:1,y:0};
    return{anchor:{x:c.x+normal.x*r,y:c.y+normal.y*r},normal,radial:true};
  }
  let best=Infinity,guide:OffsetGuide|null=null;
  for(const[a,b]of segments(annotationPoints(object))){
    const foot=segmentFoot(pick,a,b),length=distance(a,b);if(!foot||length<1e-10)continue;
    const d=distance(foot,pick);if(d<best){best=d;guide={anchor:foot,normal:{x:-(b.y-a.y)/length,y:(b.x-a.x)/length},radial:false};}
  }
  return guide;
}

/** Parallel copies with miter joins, in translated double coordinates. Invalid
 * collapsed/self-crossing offsets are refused instead of saving broken geometry. */
export function offsetAnnotation(object:Annotation,value:number,side:1|-1):Annotation|null{
  if(!Number.isFinite(value)||value<=0||value>1e12||![1,-1].includes(side)||!offsetGuide(object,object.points[0]))return null;
  const signed=value*side;
  if(object.kind==="circle"||object.kind==="arc"){
    const[c,p]=object.points,r=distance(c,p),next=r+signed;
    if(next<=Math.max(1e-9,r*1e-10))return null;
    return{...object,points:[{...c},{x:c.x+(p.x-c.x)/r*next,y:c.y+(p.y-c.y)/r*next}]};
  }
  const raw=annotationPoints(object),origin=raw[0],epsilon=Math.max(1e-9,Number.EPSILON*Math.max(...raw.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]))*16);
  let points=raw.filter((p,i)=>!i||distance(p,raw[i-1])>epsilon).map(p=>({x:p.x-origin.x,y:p.y-origin.y}));
  const closed=points.length>2&&distance(points[0],points.at(-1)!)<=epsilon;if(closed)points=points.slice(0,-1);
  if(points.length<2||points.length>3000)return null;
  const edges=Array.from({length:closed?points.length:points.length-1},(_,i)=>{
    const a=points[i],b=points[(i+1)%points.length],length=distance(a,b),u={x:(b.x-a.x)/length,y:(b.y-a.y)/length},n={x:-u.y*signed,y:u.x*signed};
    return{a:{x:a.x+n.x,y:a.y+n.y},b:{x:b.x+n.x,y:b.y+n.y},u};
  });
  const result:P[]=[];
  for(let i=0;i<points.length;i++){
    if(!closed&&i===0){result.push(edges[0].a);continue;}
    if(!closed&&i===points.length-1){result.push(edges.at(-1)!.b);continue;}
    const previous=edges[(i-1+edges.length)%edges.length],next=edges[i],den=previous.u.x*next.u.y-previous.u.y*next.u.x;
    if(Math.abs(den)<1e-10){if(previous.u.x*next.u.x+previous.u.y*next.u.y<0)return null;result.push(next.a);continue;}
    const delta={x:next.a.x-previous.a.x,y:next.a.y-previous.a.y},t=(delta.x*next.u.y-delta.y*next.u.x)/den;
    const p={x:previous.a.x+t*previous.u.x,y:previous.a.y+t*previous.u.y};
    if(distance(p,points[i])>value*100)return null;
    result.push(p);
  }
  // An inward offset must not reverse any edge or invert a closed ring.
  for(let i=0;i<edges.length;i++){
    const a=result[i],b=result[(i+1)%result.length],u=edges[i].u;
    if((b.x-a.x)*u.x+(b.y-a.y)*u.y<=epsilon)return null;
  }
  if(closed){
    const area=(p:P[])=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.y-a.y*b.x;},0);
    if(area(points)*area(result)<=0)return null;
  }
  const chain=closed?[...result,result[0]]:result,lines=segments(chain);
  for(let i=0;i<lines.length;i++)for(let j=i+2;j<lines.length;j++){
    if(closed&&i===0&&j===lines.length-1)continue;
    if(lineIntersection(...lines[i],...lines[j]))return null;
  }
  return{...object,kind:"polyline",points:chain.map(p=>({x:p.x+origin.x,y:p.y+origin.y}))};
}

const KEY="arcad.offset.distance.v1";
export function readOffsetDistance(unit:MeasurementUnit):number{
  try{const p=JSON.parse(localStorage.getItem(KEY)??"null"),v=unit==="drawing"?p?.drawing:p?.meters/UNIT_METERS[unit];if(Number.isFinite(v)&&v>0&&v<=1e12)return v;}catch{}
  return unit==="drawing"?100:.1/UNIT_METERS[unit];
}
export function saveOffsetDistance(value:number,unit:MeasurementUnit):boolean{
  if(!Number.isFinite(value)||value<=0||value>1e12)return false;
  try{let previous;try{previous=JSON.parse(localStorage.getItem(KEY)??"{}");}catch{}const p={meters:previous?.meters,drawing:previous?.drawing};if(unit==="drawing")p.drawing=value;else p.meters=value*UNIT_METERS[unit];localStorage.setItem(KEY,JSON.stringify(p));return true;}catch{return false;}
}
export const editNumber=(value:number)=>Math.abs(value)<1e-8?"0":Number(Math.abs(value)<.0001?value.toPrecision(6):value.toFixed(4)).toString();
export function parseEditNumber(value:string):number|null{
  const s=value.trim().replace(",",".");if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return null;
  const n=Number(s);return Number.isFinite(n)&&Math.abs(n)<=1e12?n:null;
}
