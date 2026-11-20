import {ensurePointLayer,isPointAnnotation,POINT_LAYER_ID,type Annotation,type AnnotationDocument} from "./annotations";
import {pointSegmentDistance,type SnapPoint} from "./measurementGeometry";
import type {DrawingBounds,DrawingPoint as P} from "./savedView";
import {rectangleCorners} from "./curveGeometry";
export type PointStyle={width:number;color:string;fontSize:number};
export const DEFAULT_POINT_STYLE:PointStyle={width:3,color:"#ff586d",fontSize:18};
export const pointMoveSnaps=(object:Annotation):SnapPoint[]=>isPointAnnotation(object)?object.points.map(p=>({...p,kind:"endpoint"as const})).sort((a,b)=>a.x-b.x):[];
const KEY="arcad.point-style.v1";
function validStyle(p:PointStyle):boolean{return !!p&&Number.isFinite(p.width)&&p.width>=1&&p.width<=12&&/^#[a-f0-9]{6}$/i.test(p.color)&&Number.isFinite(p.fontSize)&&p.fontSize>=10&&p.fontSize<=48;}
export function readPointStyle():PointStyle{try{const p=JSON.parse(localStorage.getItem(KEY)??"null");if(validStyle(p))return p;}catch{}return{...DEFAULT_POINT_STYLE};}
export function savePointStyle(p:PointStyle):boolean{if(!validStyle(p))return false;try{localStorage.setItem(KEY,JSON.stringify(p));return true;}catch{return false;}}
export function badgeForeground(color:string):string{
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4),light=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
 return light>.179?"#07182b":"#ffffff";
}
export function addPointObject(doc:AnnotationDocument,object:Annotation):AnnotationDocument{
 if(!isPointAnnotation(object)||object.layerId!==POINT_LAYER_ID)throw Error("Point object must use the reserved layer");
 const next=ensurePointLayer(doc);return{...next,layers:next.layers.map(l=>l.id===POINT_LAYER_ID?{...l,color:object.color??l.color}:l),objects:[...next.objects,object]};
}
export type PointTextSession={object:Annotation;originalId?:string};
export function completePointText(doc:AnnotationDocument,session:PointTextSession,text:string):AnnotationDocument{
 const normalized=text.replace(/\r\n?/g,"\n");if(normalized.length>500)throw Error("Point label too long");
 if(!normalized.trim())return doc;
 const object={...session.object,text:normalized};
 if(object.kind!=="point-leader"||object.layerId!==POINT_LAYER_ID)throw Error("Invalid point label");
 if(!session.originalId)return addPointObject(doc,object);
 const original=doc.objects.find(o=>o.id===session.originalId&&o.kind==="point-leader");if(!original)return doc;
 if(JSON.stringify(original)===JSON.stringify(object))return doc;
 return{...doc,objects:doc.objects.map(o=>o.id===session.originalId?object:o)};
}
type Label={point:P;anchor:"start"|"end";fontSize:number;lines:string[];bounds:DrawingBounds};
export type PointScreenGeometry={paths:P[][];path?:string;head?:P[];label?:Label};
let textContext:CanvasRenderingContext2D|null|undefined;
function labelWidth(text:string,size:number):number{
 if(typeof document!=="undefined"){textContext??=document.createElement("canvas").getContext("2d");if(textContext){textContext.font=`${size}px ArcadAnnotation`;return textContext.measureText(text).width;}}
 return[...text].reduce((n,c)=>n+((c.codePointAt(0)??0)>255?1:.65)*size,0);
}
/** Only projection changes with zoom. Widths, arrowheads, cloud lobes and text
 * remain in CSS screen pixels, while both anchors stay in exact drawing units. */
export function pointScreenGeometry(o:Annotation,project:(p:readonly P[])=>P[]):PointScreenGeometry{
 const[a,b]=project(o.points),width=o.screenWidth??3,paths:P[][]=[];if(!a||!b)return{paths};
 const head=(tip:P,tail:P):P[]|undefined=>{const dx=tip.x-tail.x,dy=tip.y-tail.y,l=Math.hypot(dx,dy);if(l<1)return;const n=Math.min(l*.7,Math.max(11,width*3+5)),x=dx/l,y=dy/l;return[tip,{x:tip.x-x*n-y*n*.4,y:tip.y-y*n+x*n*.4},{x:tip.x-x*n+y*n*.4,y:tip.y-y*n-x*n*.4},tip];};
 if(o.kind==="point-arrow")return{paths:[[a,b]],head:head(b,a)};
 if(o.kind==="point-circle"){
  const r=Math.hypot(b.x-a.x,b.y-a.y);return{paths:[Array.from({length:97},(_,i)=>({x:a.x+r*Math.cos(i*Math.PI/48),y:a.y+r*Math.sin(i*Math.PI/48)}))]};
 }
 if(o.kind==="point-rectangle"||o.kind==="point-cloud"){
  const raw=project(rectangleCorners(o)),x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),right=Math.max(a.x,b.x),bottom=Math.max(a.y,b.y),p=o.points.length===2?[{x,y},{x:right,y},{x:right,y:bottom},{x,y:bottom}]:raw;
  const corners=[...p,p[0]],area=p.reduce((n,a,i)=>{const b=p[(i+1)%4];return n+(a.x-p[0].x)*(b.y-p[0].y)-(a.y-p[0].y)*(b.x-p[0].x);},0),sign=area>=0?1:-1;
  if(o.kind==="point-rectangle"||Math.abs(area)<1)return{paths:[corners]};
  const points:P[]=[corners[0]],commands=[`M${p[0].x},${p[0].y}`];
  for(let i=0;i<4;i++){
   const p=corners[i],q=corners[i+1],length=Math.hypot(q.x-p.x,q.y-p.y),count=Math.min(80,Math.max(2,Math.ceil(length/20))),nx=(q.y-p.y)/length*sign,ny=-(q.x-p.x)/length*sign,lobe=Math.min(16,length/count*.85);
   for(let j=0;j<count;j++){
    const a={x:p.x+(q.x-p.x)*j/count,y:p.y+(q.y-p.y)*j/count},b={x:p.x+(q.x-p.x)*(j+1)/count,y:p.y+(q.y-p.y)*(j+1)/count},c={x:(a.x+b.x)/2+nx*lobe,y:(a.y+b.y)/2+ny*lobe};commands.push(`Q${c.x},${c.y} ${b.x},${b.y}`);
    for(let k=1;k<=4;k++){const t=k/4;points.push({x:(1-t)**2*a.x+2*(1-t)*t*c.x+t*t*b.x,y:(1-t)**2*a.y+2*(1-t)*t*c.y+t*t*b.y});}
   }
  }return{paths:[points],path:commands.join(" ")+" Z"};
 }
 if(o.kind==="point-leader"){
  const sign=b.x>=a.x?1:-1,elbow={x:b.x-sign*Math.min(18,Math.abs(b.x-a.x)/2),y:b.y},fontSize=o.screenFontSize??18,point={x:b.x+sign*7,y:b.y-5},lines=(o.text??"").split("\n"),w=Math.max(fontSize*.5,...lines.map(t=>labelWidth(t,fontSize))),anchor=sign===1?"start":"end";
  const bounds={minX:point.x-(sign===1?0:w)-4,maxX:point.x+(sign===1?w:0)+4,minY:point.y-fontSize,maxY:point.y+(lines.length-1)*fontSize*1.3+4};
  return{paths:[[a,elbow,b]],head:head(a,elbow),label:{point,anchor,fontSize,lines,bounds}};
 }
 return{paths};
}
export function pointHit(objects:Annotation[],point:P,tolerance:number,project:(p:readonly P[])=>P[],labelOnly=false):Annotation|null{
 const p=project([point])[0];let best=tolerance,found:Annotation|null=null;
 for(const o of [...objects].reverse()){
  if(!isPointAnnotation(o)||(labelOnly&&o.kind!=="point-leader"))continue;
  const g=pointScreenGeometry(o,project),b=g.label?.bounds;
  if(b){const d=Math.hypot(Math.max(b.minX-p.x,0,p.x-b.maxX),Math.max(b.minY-p.y,0,p.y-b.maxY));if(d<=best){best=d;found=o;}}
  if(labelOnly)continue;
  for(const chain of [...g.paths,...(g.head?[g.head]:[])])for(let i=1;i<chain.length;i++){const d=pointSegmentDistance(p,chain[i-1],chain[i]);if(d<=best+(o.screenWidth??3)/2){best=d;found=o;}}
 }return found;
}
export function drawPointAnnotation(o:Annotation,project:(p:readonly P[])=>P[],el:(tag:string,attrs:Record<string,string|number>)=>SVGElement):void{
 const g=pointScreenGeometry(o,project),color=o.color??"#ff586d",width=o.screenWidth??3;
 const attr={fill:"none","stroke-linecap":"round","stroke-linejoin":"round","data-object":o.id};
 for(const p of g.paths){
  let strokePoints=p;
  if(g.head){const base={x:(g.head[1].x+g.head[2].x)/2,y:(g.head[1].y+g.head[2].y)/2};strokePoints=o.kind==="point-arrow"?[...p.slice(0,-1),base]:[base,...p.slice(1)];}
  const tag=g.path?"path":"polyline",shape:Record<string,string|number>=g.path?{d:g.path}:{points:strokePoints.map(q=>`${q.x},${q.y}`).join(" ")};
  el(tag,{...attr,...shape,stroke:"#03101d","stroke-width":width+3,class:"point-mark-halo"});
  el(tag,{...attr,...shape,stroke:color,"stroke-width":width,class:"point-mark","data-width":width});
 }
 if(g.head)el("polygon",{points:g.head.map(p=>`${p.x},${p.y}`).join(" "),fill:color,stroke:"#03101d","stroke-width":1.5,"stroke-linejoin":"round","data-object":o.id,class:"point-mark-head"});
 if(g.label&&o.text){const l=g.label,t=el("text",{x:l.point.x,y:l.point.y,fill:color,"font-size":l.fontSize,"text-anchor":l.anchor,"data-object":o.id,class:"point-mark-text"});
  for(const[s,line]of l.lines.entries()){const span=document.createElementNS("http://www.w3.org/2000/svg","tspan");span.setAttribute("x",String(l.point.x));span.setAttribute("dy",s?String(l.fontSize*1.3):"0");span.textContent=line||" ";t.append(span);}
 }
}
