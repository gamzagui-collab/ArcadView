import { distance, pathLength, pointSegmentDistance, type MeasurableEntity, type MeasurementGeometry, type MeasurementUnit, type SnapPoint, UNIT_METERS } from "./measurementGeometry";
import type { DrawingPoint } from "./savedView";
import { segmentFoot, type Segment } from "./cadPicking";
import {curveLength,rectangleCorners,rotatePoint} from "./curveGeometry";
import {isRadialDimension,radialDimensionGeometry} from "./radialDimensions";
type P = DrawingPoint;
export const POINT_LAYER_ID="arcad-point-layer",POINT_LAYER_NAME="포인트그리기";
export const DIMENSION_LAYER_ID="arcad-dimension-layer",DIMENSION_LAYER_NAME="치수그리기";
export const isDimensionTool=(tool:string)=>["dimension-aligned","dimension-linear","dimension-angle","dimension-radius"].includes(tool);
export const isReservedLayer=(id:string)=>id===POINT_LAYER_ID||id===DIMENSION_LAYER_ID;
export const POINT_TOOLS=["point-text","point-arrow","point-cloud","point-circle","point-rectangle","point-leader"]as const;
export type PointTool=typeof POINT_TOOLS[number];
export const isPointTool=(tool:string):tool is PointTool=>(POINT_TOOLS as readonly string[]).includes(tool);
export type AnnotationTool = "select"|"move"|"rotate"|"extend"|"offset"|"text"|"polyline"|"circle"|"arc"|"rectangle"|"dimension-aligned"|"dimension-linear"|"dimension-angle"|"dimension-radius"|"trim"|PointTool;
export type Annotation = {id:string;layerId:string;kind:"text"|"polyline"|"circle"|"arc"|"rectangle"|"dimension-aligned"|"dimension-linear"|"dimension-angle"|"dimension-radius"|"mask"|PointTool;points:P[];labelPoint?:P;textPoint?:P;scale?:number;start?:number;sweep?:number;text?:string;textHeight?:number;color?:string;approximate?:boolean;curved?:boolean;rotation?:number;screenWidth?:number;screenFontSize?:number};
export const isPointAnnotation=(object:Annotation)=>isPointTool(object.kind);
export type UserLayer = {id:string;name:string;color:string;visible:boolean};
export type AnnotationDocument = {version:1;layers:UserLayer[];activeLayer:string;objects:Annotation[];dimensionScale:number;textHeight?:number};
export const uid=()=>crypto.randomUUID();
export function newAnnotationDocument():AnnotationDocument{return{version:1,layers:[{id:"base",name:"기본",color:"#49cfff",visible:true}],activeLayer:"base",objects:[],dimensionScale:20};}
export const drawingLayers=(doc:AnnotationDocument)=>doc.layers.filter(l=>!isReservedLayer(l.id));
export const pointLayer=(doc:AnnotationDocument):UserLayer=>doc.layers.find(l=>l.id===POINT_LAYER_ID)??{id:POINT_LAYER_ID,name:POINT_LAYER_NAME,color:"#ff586d",visible:true};
export const dimensionLayer=(doc:AnnotationDocument):UserLayer=>doc.layers.find(l=>l.id===DIMENSION_LAYER_ID)??{id:DIMENSION_LAYER_ID,name:DIMENSION_LAYER_NAME,color:"#fa68df",visible:true};
export function ensurePointLayer(doc:AnnotationDocument):AnnotationDocument{return doc.layers.some(l=>l.id===POINT_LAYER_ID)?doc:{...doc,layers:[...drawingLayers(doc),pointLayer(doc),...doc.layers.filter(l=>l.id===DIMENSION_LAYER_ID)]};}
export function ensureDimensionLayer(doc:AnnotationDocument):AnnotationDocument{return doc.layers.some(l=>l.id===DIMENSION_LAYER_ID)?doc:{...doc,layers:[...doc.layers,dimensionLayer(doc)]};}
export function addDimensionObject(doc:AnnotationDocument,object:Annotation):AnnotationDocument {
  if(!isDimensionTool(object.kind)||object.layerId!==DIMENSION_LAYER_ID)throw Error("Dimensions must use the reserved dimension layer");
  const next=ensureDimensionLayer(doc);return{...next,objects:[...next.objects,object]};
}
/** The active drawing layer never becomes the reserved markup layer. */
export function removeDrawingLayer(doc:AnnotationDocument,id:string):AnnotationDocument{
  if(isReservedLayer(id)||!doc.layers.some(l=>l.id===id))return doc;
  const normal=drawingLayers(doc).filter(l=>l.id!==id),layers=[...(normal.length?normal:newAnnotationDocument().layers),...doc.layers.filter(l=>isReservedLayer(l.id))];
  return{...doc,layers,activeLayer:layers.some(l=>l.id===doc.activeLayer&&!isReservedLayer(l.id))?doc.activeLayer:layers[0].id,objects:doc.objects.filter(o=>o.layerId!==id)};
}
export const visibleAnnotations=(d:AnnotationDocument)=>d.objects.filter(o=>d.layers.some(l=>l.id===o.layerId&&l.visible));
export function annotationPoints(o:Annotation):P[]{
  if(o.kind==="rectangle"){const p=rectangleCorners(o);return[...p,p[0]];}
  if(o.kind==="circle"||o.kind==="arc"){
    const[c,r]=o.points,radius=distance(c,r),start=o.start??0,sweep=o.kind==="circle"?Math.PI*2:o.sweep??Math.PI*2;
    const n=Math.max(12,Math.ceil(Math.abs(sweep)/(Math.PI*2)*192));
    return Array.from({length:n+1},(_,i)=>({x:c.x+radius*Math.cos(start+sweep*i/n),y:c.y+radius*Math.sin(start+sweep*i/n)}));
  }return o.points;
}
export const segments=(points:readonly P[]):Segment[]=>points.slice(1).map((p,i)=>[points[i],p]);
export const defaultTextHeight=(unit:MeasurementUnit)=>unit==="drawing"?50:.05/UNIT_METERS[unit];
function textLocalBounds(o:Annotation){
  const p=o.points[0],height=o.textHeight??50,lines=(o.text??"").split("\n");
  let width=0;
  for(const line of lines){
    let units=0;for(const char of line)units+=char==='\t'?2.4:(char.codePointAt(0)??0)>255?1:.65;
    // Use the same bundled font as SVG when the browser font is available.
    if(typeof document!=="undefined"&&document.fonts?.check('100px ArcadAnnotation')){
      const context=textCanvasContext();if(context){context.font='100px ArcadAnnotation';units=context.measureText(line).width/100;}
    }
    width=Math.max(width,units*height);
  }
  return{minX:p.x,maxX:p.x+Math.max(width,height*.25),minY:p.y-(lines.length-1)*height*1.3-height*.25,maxY:p.y+height};
}
let textContext:CanvasRenderingContext2D|null|undefined;
export function textBounds(o:Annotation){const b=textLocalBounds(o);if(!o.rotation)return b;const p=[{x:b.minX,y:b.minY},{x:b.maxX,y:b.minY},{x:b.maxX,y:b.maxY},{x:b.minX,y:b.maxY}].map(p=>rotatePoint(p,o.points[0],o.rotation!));return{minX:Math.min(...p.map(p=>p.x)),maxX:Math.max(...p.map(p=>p.x)),minY:Math.min(...p.map(p=>p.y)),maxY:Math.max(...p.map(p=>p.y))};}
function textCanvasContext(){if(textContext===undefined)textContext=document.createElement('canvas').getContext('2d');return textContext;}
export function translateAnnotation(o:Annotation,base:P,destination:P):Annotation{
  if(o.kind==="mask")throw Error("A source erasure cannot be moved independently");
  const dx=destination.x-base.x,dy=destination.y-base.y;
  return{...o,points:o.points.map(p=>({x:p.x+dx,y:p.y+dy})),...(o.labelPoint?{labelPoint:{x:o.labelPoint.x+dx,y:o.labelPoint.y+dy}}:{}),...(o.textPoint?{textPoint:{x:o.textPoint.x+dx,y:o.textPoint.y+dy}}:{})};
}
/** Moving source geometry adds a reversible erasure and a translated user object. */
export function sourceMoveObjects(entity:MeasurableEntity,layerId:string,base:P,destination:P):Annotation[]{
  const mask:Annotation={id:uid(),layerId,kind:"mask",points:entity.points.map(p=>({...p}))};
  return[mask,translateAnnotation(sourceAnnotation(entity,layerId),base,destination)];
}
/** A separate overlay copy; never changes the original geometry. */
export function sourceAnnotation(entity:MeasurableEntity,layerId:string):Annotation{
  let copy:Annotation={id:uid(),layerId,kind:"polyline",points:entity.points.map(p=>({...p})),approximate:entity.approximate};
  if(["LWPOLYLINE","POLYLINE"].includes(entity.kind)&&!entity.approximate&&entity.length-pathLength(entity.points)>Math.max(1e-7,entity.length*1e-9))copy.curved=true;
  if(entity.kind==="CIRCLE"&&!entity.approximate){const c={x:(entity.bounds.minX+entity.bounds.maxX)/2,y:(entity.bounds.minY+entity.bounds.maxY)/2},r=entity.length/(Math.PI*2);copy={...copy,kind:"circle",points:[c,{x:c.x+r,y:c.y}]};}
  if(entity.kind==="ARC"&&!entity.approximate&&entity.points.length>=3){
    const a=entity.points[0],b=entity.points[Math.floor(entity.points.length/2)],end=entity.points.at(-1)!,u={x:b.x-a.x,y:b.y-a.y},v={x:end.x-a.x,y:end.y-a.y},den=2*(u.x*v.y-u.y*v.x);
    if(Math.abs(den)>1e-12){
      const u2=u.x*u.x+u.y*u.y,v2=v.x*v.x+v.y*v.y,c={x:a.x+(u2*v.y-v2*u.y)/den,y:a.y+(u.x*v2-v.x*u2)/den},radius=distance(c,a),norm=(x:number)=>(x+Math.PI*4)%(Math.PI*2);
      let start=Math.atan2(a.y-c.y,a.x-c.x),sweep=norm(Math.atan2(end.y-c.y,end.x-c.x)-start);
      if(norm(Math.atan2(b.y-c.y,b.x-c.x)-start)>sweep+1e-8){const old=start;start=Math.atan2(end.y-c.y,end.x-c.x);sweep=norm(old-start);}
      copy={...copy,kind:"arc",points:[c,{x:c.x+radius,y:c.y}],start,sweep};
    }else copy.approximate=true;
  }
  return copy;
}
export function annotationGeometry(objects:Annotation[]):MeasurementGeometry{
  const entities:MeasurableEntity[]=[],snaps:SnapPoint[]=[];
  for(const o of objects){if(o.kind==="mask"||isPointAnnotation(o))continue;
    if(isRadialDimension(o)){for(const p of o.points)snaps.push({...p,kind:"endpoint"});continue;}
    if(o.kind.startsWith("dimension")){const d=dimensionGeometry(o,"drawing");for(const p of o.points.slice(0,2))snaps.push({...p,kind:"endpoint"});if(d)snaps.push({...d.first,kind:"endpoint"},{...d.second,kind:"endpoint"},{x:(d.first.x+d.second.x)/2,y:(d.first.y+d.second.y)/2,kind:"midpoint"});continue;}
    if(o.kind==="text"){snaps.push({...o.points[0],kind:"endpoint"});continue;}
    const points=annotationPoints(o);if(!points.length)continue;
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    const radius=(o.kind==="circle"||o.kind==="arc")?distance(o.points[0],o.points[1]):0;
    entities.push({kind:o.kind==="circle"?"CIRCLE":o.kind==="arc"?"ARC":"LWPOLYLINE",points,bounds:{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)},length:o.kind==="circle"?Math.PI*2*radius:o.kind==="arc"?radius*(o.sweep??Math.PI*2):o.curved?curveLength(o):pathLength(points),area:o.kind==="circle"?Math.PI*radius*radius:undefined,approximate:!!o.approximate});
    if(o.kind==="circle"||o.kind==="arc"){
      const[c,r]=o.points,radius=distance(c,r);snaps.push({...c,kind:"center"});
      if(o.kind==="circle")for(let i=0;i<4;i++)snaps.push({x:c.x+radius*Math.cos(i*Math.PI/2),y:c.y+radius*Math.sin(i*Math.PI/2),kind:"endpoint"});
      else snaps.push({...points[0],kind:"endpoint"},{...points[points.length-1],kind:"endpoint"});
    }else for(const[a,b]of segments(points))snaps.push({...a,kind:"endpoint"},{...b,kind:"endpoint"},{x:(a.x+b.x)/2,y:(a.y+b.y)/2,kind:"midpoint"});
  }snaps.sort((a,b)=>a.x-b.x);return{units:"drawing",entities,snaps,limited:false,completeBounds:false,fitBounds:[],fitCompleteBounds:false};
}
export function masked(point:P,objects:Annotation[],tolerance:number):boolean{
  return objects.some(o=>o.kind==="mask"&&segments(o.points).some(([a,b])=>pointSegmentDistance(point,a,b)<=tolerance));
}
/** Return the visible fragment under the pick; never report a trimmed object's full length. */
export function visibleEntityFragment(entity:MeasurableEntity,masks:Annotation[],target:P,tolerance:number):MeasurableEntity|null{
  if(!masks.length)return entity;
  const pieces:P[][]=[];let chain:P[]=[],changed=false;
  const flush=()=>{if(chain.length>1)pieces.push(chain);chain=[];};
  for(const[a,b]of segments(entity.points)){
    const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<1e-20)continue;
    const length=Math.sqrt(l2),intervals:Array<[number,number]>=[];
    for(const mask of masks)for(const[c,d]of segments(mask.points)){
      const epsilon=Math.max(1e-7,Number.EPSILON*Math.max(Math.abs(a.x),Math.abs(a.y),Math.abs(b.x),Math.abs(b.y))*16);
      if(Math.abs(dx*(c.y-a.y)-dy*(c.x-a.x))>epsilon*length||Math.abs(dx*(d.y-a.y)-dy*(d.x-a.x))>epsilon*length)continue;
      const u=((c.x-a.x)*dx+(c.y-a.y)*dy)/l2,v=((d.x-a.x)*dx+(d.y-a.y)*dy)/l2;
      const lo=Math.max(0,Math.min(u,v)),hi=Math.min(1,Math.max(u,v));if(hi-lo>1e-10)intervals.push([lo,hi]);
    }
    const merged:Array<[number,number]>=[];for(const q of intervals.sort((a,b)=>a[0]-b[0])){const prev=merged.at(-1);if(prev&&q[0]<=prev[1]+1e-10)prev[1]=Math.max(prev[1],q[1]);else merged.push([...q]);}
    const at=(t:number)=>({x:a.x+t*dx,y:a.y+t*dy});let from=0;
    for(const[lo,hi]of [...merged,[1,1]as[number,number]]){
      if(lo-from>1e-10){const p=at(from),q=at(lo);if(chain.length&&distance(chain.at(-1)!,p)>1e-7)flush();if(!chain.length)chain.push(p);chain.push(q);}
      if(hi>lo){changed=true;flush();}from=hi;
    }
  }flush();if(!changed)return entity;
  let nearest=tolerance,picked:P[]|null=null;for(const points of pieces)for(const[a,b]of segments(points)){const d=pointSegmentDistance(target,a,b);if(d<=nearest){nearest=d;picked=points;}}
  if(!picked)return null;
  const xs=picked.map(p=>p.x),ys=picked.map(p=>p.y);
  return{kind:picked.length===2?"LINE":"LWPOLYLINE",points:picked,bounds:{minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)},length:pathLength(picked),approximate:entity.approximate||["CIRCLE","ARC","ELLIPSE","SPLINE"].includes(entity.kind)};
}
export function dimensionGeometry(o:Annotation,sourceUnit:MeasurementUnit){
  if(isRadialDimension(o))return null;
  let[a,b,p]=o.points;if(!a||!b||!p)return null;let placement=o.labelPoint??p;const pivot=a,rotation=o.kind==="dimension-linear"?o.rotation??0:0;if(rotation)[a,b,p,placement]=[a,b,p,placement].map(p=>rotatePoint(p,pivot,-rotation));
  const length=distance(a,b);if(length<1e-12)return null;
  let first:P,second:P,value:number;
  if(o.kind==="dimension-linear"){
    // The original third pick fixes the axis; later placement changes only its offset.
    const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
    if(Math.abs(p.y-cy)>=Math.abs(p.x-cx)){first={x:a.x,y:placement.y};second={x:b.x,y:placement.y};value=Math.abs(b.x-a.x);}
    else{first={x:placement.x,y:a.y};second={x:placement.x,y:b.y};value=Math.abs(b.y-a.y);}
  }else{
    const nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length,h=(placement.x-a.x)*nx+(placement.y-a.y)*ny;
    first={x:a.x+nx*h,y:a.y+ny*h};second={x:b.x+nx*h,y:b.y+ny*h};value=length;
  }
  const textHeight=2.5*(o.scale??20)*(sourceUnit==="drawing"?1:.001/UNIT_METERS[sourceUnit]);
  if(rotation)[a,b,first,second]=[a,b,first,second].map(p=>rotatePoint(p,pivot,rotation));
  const middle={x:first.x+(second.x-first.x)/2,y:first.y+(second.y-first.y)/2},textPosition=o.textPoint??middle;
  const dx=second.x-first.x,dy=second.y-first.y,den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((textPosition.x-first.x)*dx+(textPosition.y-first.y)*dy)/den)):.5;
  const leader:Segment|null=o.textPoint?[{x:first.x+t*dx,y:first.y+t*dy},textPosition]:null;
  return{first,second,value,textHeight,textPosition,leader,extensions:[[a,first],[b,second]]as Segment[]};
}
export function annotationHit(objects:Annotation[],point:P,tolerance:number,sourceUnit:MeasurementUnit):Annotation|null{
  let best=tolerance,found:Annotation|null=null;
  for(const o of [...objects].reverse()){
    if(isPointAnnotation(o))continue;
    if(o.kind==="text"){
      const b=textBounds(o),d=Math.hypot(Math.max(b.minX-point.x,0,point.x-b.maxX),Math.max(b.minY-point.y,0,point.y-b.maxY));
      if(d<best){best=d;found=o;}continue;
    }
    const radial=isRadialDimension(o)?radialDimensionGeometry(o,sourceUnit):null;
    if(radial&&distance(radial.label,point)<Math.max(tolerance,radial.textHeight)){found=o;best=0;continue;}
    const dim=o.kind.startsWith("dimension")?dimensionGeometry(o,sourceUnit):null;
    if(dim&&o.textPoint&&distance(dim.textPosition,point)<Math.max(tolerance,dim.textHeight)){found=o;best=0;continue;}
    const lines=radial?[...radial.lines.flatMap(segments),...radial.extensions]:dim?[[dim.first,dim.second],...dim.extensions,...(dim.leader?[dim.leader]:[])]as Segment[]:segments(annotationPoints(o));
    for(const[a,b]of lines){const d=pointSegmentDistance(point,a,b);if(d<best){best=d;found=o;}}
  }return found;
}
const cross=(a:P,b:P)=>a.x*b.y-a.y*b.x;
/** Translation before arithmetic retains precision in large survey coordinates. */
export function lineIntersection(a:P,b:P,c:P,d:P):P|null{
  const u={x:b.x-a.x,y:b.y-a.y},v={x:d.x-c.x,y:d.y-c.y},w={x:c.x-a.x,y:c.y-a.y},den=cross(u,v);
  if(Math.abs(den)<1e-12*Math.max(1,Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y)))return null;
  const t=cross(w,v)/den,s=cross(w,u)/den;if(t< -1e-9||t>1+1e-9||s< -1e-9||s>1+1e-9)return null;
  return{x:a.x+t*u.x,y:a.y+t*u.y};
}
function lineCircle(a:P,b:P,c:P,r:number):P[]{
  const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-c.x,oy=a.y-c.y,A=dx*dx+dy*dy;if(A<1e-18)return[];
  const B=2*(dx*ox+dy*oy),C=ox*ox+oy*oy-r*r,D=B*B-4*A*C;if(D< -1e-8*A*r*r)return[];
  return [...new Set([(-B-Math.sqrt(Math.max(0,D)))/(2*A),(-B+Math.sqrt(Math.max(0,D)))/(2*A)])].filter(t=>t>=-1e-9&&t<=1+1e-9).map(t=>({x:a.x+t*dx,y:a.y+t*dy}));
}
const TAU=Math.PI*2,angle=(p:P,c:P)=>(Math.atan2(p.y-c.y,p.x-c.x)+TAU)%TAU;
function circleCircle(c:P,r:number,d:P,s:number):P[]{
  const l=distance(c,d);if(l<1e-12||l>r+s+1e-9||l<Math.abs(r-s)-1e-9)return[];
  const a=(r*r-s*s+l*l)/(2*l),h=Math.sqrt(Math.max(0,r*r-a*a)),x=c.x+a*(d.x-c.x)/l,y=c.y+a*(d.y-c.y)/l;
  return[{x:x-h*(d.y-c.y)/l,y:y+h*(d.x-c.x)/l},{x:x+h*(d.y-c.y)/l,y:y-h*(d.x-c.x)/l}];
}
export function trimAnnotation(target:Annotation,cutters:Annotation[],cad:Segment[],click:P):{kept:Annotation[];removed:P[]}|null{
  if(target.kind==="mask"||target.kind==="text"||target.kind.startsWith("dimension")||isPointAnnotation(target))return null;
  cutters=cutters.filter(o=>!isPointAnnotation(o));
  const circles=cutters.filter(o=>o.id!==target.id&&o.kind==="circle");
  const lines=[...cad,...cutters.filter(o=>o.id!==target.id&&!o.kind.startsWith("dimension")&&o.kind!=="mask"&&o.kind!=="circle").flatMap(o=>segments(annotationPoints(o)))];
  const points=annotationPoints(target),c=target.points[0];
  const unique=(values:number[])=>values.sort((a,b)=>a-b).filter((v,i,a)=>!i||Math.abs(v-a[i-1])>1e-8);
  if(target.kind==="circle"||target.kind==="arc"){
    const r=distance(c,target.points[1]),start=target.start??0,sweep=target.kind==="circle"?TAU:target.sweep??TAU;
    const param=(p:P)=>(angle(p,c)-start+TAU)%TAU;
    let cuts=lines.flatMap(([a,b])=>lineCircle(a,b,c,r)).concat(circles.flatMap(o=>circleCircle(c,r,o.points[0],distance(o.points[0],o.points[1])))).map(param).filter(t=>t<=sweep+1e-9);
    cuts=unique(cuts);const t=param(click),closed=target.kind==="circle";
    if(closed&&cuts.length<2)return null;if(!closed){cuts=unique([0,...cuts,sweep]);if(cuts.length<3)return null;}
    let lo=cuts.filter(v=>v<t-1e-9).at(-1),hi=cuts.find(v=>v>t+1e-9);
    if(closed){lo??=cuts.at(-1)!-TAU;hi??=cuts[0]+TAU;}else{lo??=0;hi??=sweep;}
    const make=(s:number,w:number):Annotation=>({...target,id:uid(),kind:"arc",start:(s+TAU)%TAU,sweep:w});
    const kept=closed?[make(start+hi,TAU-(hi-lo))]:[...(lo>1e-9?[make(start,lo)]:[]),...(sweep-hi>1e-9?[make(start+hi,sweep-hi)]:[])];
    const removed=annotationPoints(make(start+lo,hi-lo));return{kept,removed};
  }
  const edges=segments(points),lengths=edges.map(([a,b])=>distance(a,b)),offsets=[0];for(const l of lengths)offsets.push(offsets.at(-1)!+l);
  const total=offsets.at(-1)!;if(total<1e-12)return null;
  let cursor=0,best=Infinity,cuts:number[]=[];
  edges.forEach(([a,b],i)=>{
    const foot=segmentFoot(click,a,b);if(foot&&distance(click,foot)<best){best=distance(click,foot);cursor=offsets[i]+distance(a,foot);}
    const intersections=lines.map(([c,d])=>lineIntersection(a,b,c,d)).filter((q):q is P=>!!q).concat(circles.flatMap(o=>lineCircle(a,b,o.points[0],distance(o.points[0],o.points[1]))));
    cuts.push(...intersections.map(q=>offsets[i]+distance(a,q)));
  });
  const closed=distance(points[0],points.at(-1)!)<1e-9;
  cuts=unique(cuts.filter(t=>t>1e-8&&t<total-1e-8));
  if(!cuts.length)return null;
  let lo=cuts.filter(v=>v<cursor-1e-8).at(-1),hi=cuts.find(v=>v>cursor+1e-8);
  if(closed){if(cuts.length<2)return null;lo??=cuts.at(-1)!-total;hi??=cuts[0]+total;}else{lo??=0;hi??=total;}
  const at=(t:number):P=>{t=((t%total)+total)%total;let i=0;while(i<lengths.length-1&&offsets[i+1]<t)i++;const[a,b]=edges[i],f=lengths[i]?(t-offsets[i])/lengths[i]:0;return{x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};};
  const part=(a:number,b:number):P[]=>{const p=[at(a)];for(let wrap=-1;wrap<=1;wrap++)for(let i=1;i<offsets.length;i++){const t=offsets[i]+wrap*total;if(t>a+1e-8&&t<b-1e-8)p.push(at(t));}p.push(b===total&&!closed?points.at(-1)!:at(b));return p;};
  const remaining=closed?[part(hi,lo+total)]:[...(lo>1e-8?[part(0,lo)]:[]),...(hi<total-1e-8?[part(hi,total)]:[])];
  return{kept:remaining.map(p=>({...target,id:uid(),kind:"polyline",points:p})),removed:part(lo,hi)};
}
const PREFIX="arcad.annotations.v1.";
export function validateAnnotationDocument(d:AnnotationDocument):void{
  if(d.version!==1||!Array.isArray(d.layers)||d.layers.length<1||d.layers.length>5||!Array.isArray(d.objects)||d.objects.length>3000||!d.layers.some(l=>l.id===d.activeLayer&&!isReservedLayer(l.id))||drawingLayers(d).length>3||!Number.isFinite(d.dimensionScale)||d.dimensionScale<1||d.dimensionScale>10000)throw Error();
  const ids=new Set(d.layers.map(l=>l.id));if(ids.size!==d.layers.length)throw Error();
  for(const l of d.layers)if(typeof l.id!=="string"||typeof l.name!=="string"||!/^#[a-f0-9]{6}$/i.test(l.color)||typeof l.visible!=="boolean"||(l.id===POINT_LAYER_ID&&(l.name!==POINT_LAYER_NAME||d.layers.indexOf(l)!==d.layers.length-(d.layers.some(l=>l.id===DIMENSION_LAYER_ID)?2:1)))||(l.id===DIMENSION_LAYER_ID&&(l.name!==DIMENSION_LAYER_NAME||l!==d.layers.at(-1))))throw Error();
  if(d.textHeight!==undefined&&(!Number.isFinite(d.textHeight)||d.textHeight<=0||d.textHeight>1e6))throw Error();
  for(const o of d.objects){
    if(!ids.has(o.layerId)||typeof o.id!=="string"||!["text","polyline","circle","arc","rectangle","dimension-aligned","dimension-linear","dimension-angle","dimension-radius","mask",...POINT_TOOLS].includes(o.kind)||!Array.isArray(o.points)||o.points.length<(["text","point-text"].includes(o.kind)?1:2)||o.points.length>30000||o.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||(o.kind==="rectangle"&&![2,4].includes(o.points.length))||((o.kind==="circle"||o.kind==="arc")&&o.points.length!==2)||(o.kind.startsWith("dimension")&&(o.points.length!==(o.kind==="dimension-radius"?2:3)||!Number.isFinite(o.scale)||o.scale!<1||o.scale!>10000))||(o.kind==="arc"&&(!Number.isFinite(o.start)||!Number.isFinite(o.sweep)||o.sweep!<=0||o.sweep!>TAU))||(o.kind==="text"&&(o.points.length!==1||typeof o.text!=="string"||!o.text.trim()||o.text.length>500||!Number.isFinite(o.textHeight)||o.textHeight!<=0||o.textHeight!>1e6)))throw Error();
    if(o.rotation!==undefined&&(!Number.isFinite(o.rotation)||o.rotation<0||o.rotation>=360)||o.curved!==undefined&&typeof o.curved!=="boolean")throw Error();
    for(const p of [o.labelPoint,o.textPoint])if(p!==undefined&&(!isDimensionTool(o.kind)||!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error();
    if(isRadialDimension(o)&&!radialDimensionGeometry(o))throw Error();
    if(o.color!==undefined&&!/^#[a-f0-9]{6}$/i.test(o.color))throw Error();
    if(o.screenWidth!==undefined&&(!Number.isFinite(o.screenWidth)||o.screenWidth<1||o.screenWidth>12))throw Error();
    if(isPointAnnotation(o)!==(o.layerId===POINT_LAYER_ID))throw Error();
    if(o.layerId===DIMENSION_LAYER_ID&&!isDimensionTool(o.kind))throw Error();
    if(isPointAnnotation(o)&&((!(o.kind==="point-text"?[1]:["point-rectangle","point-cloud"].includes(o.kind)?[2,4]:[2]).includes(o.points.length))||!Number.isFinite(o.screenWidth)||o.screenWidth!<1||o.screenWidth!>12||!o.color))throw Error();
    if(["point-leader","point-text"].includes(o.kind)&&(typeof o.text!=="string"||!o.text.trim()||o.text.length>500||!Number.isFinite(o.screenFontSize)||o.screenFontSize!<10||o.screenFontSize!>48))throw Error();
  }
}
export function readAnnotations(key:string|undefined):AnnotationDocument{
  if(!key)return newAnnotationDocument();try{const raw=localStorage.getItem(PREFIX+key);if(!raw||raw.length>4_000_000)return newAnnotationDocument();const d=JSON.parse(raw)as AnnotationDocument;
    validateAnnotationDocument(d);
    return d;
  }catch{return newAnnotationDocument();}
}
export function saveAnnotations(key:string|undefined,doc:AnnotationDocument):boolean{
  if(!key)return false;try{validateAnnotationDocument(doc);const raw=JSON.stringify(doc);if(raw.length>4_000_000)throw Error("Annotation storage limit");localStorage.setItem(PREFIX+key,raw);return true;}catch{return false;}
}
