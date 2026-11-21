import {distance,pathLength,polygonArea,pointSegmentDistance,UNIT_METERS,type MeasurementUnit} from "../viewer/measurementGeometry";
import type {DrawingPoint as P} from "../viewer/savedView";
import type {Annotation} from "../viewer/annotations";
export type TakeoffKind="wall"|"beam"|"slab";
export const KINDS:TakeoffKind[]=["wall","beam","slab"];
export const NAMES={wall:"옹벽",beam:"보",slab:"슬래브"};
export type Dimensions={heightMm?:number;thicknessMm?:number;widthMm?:number;depthMm?:number};
export type TakeoffObject={id:string;groupId:TakeoffKind;kind:TakeoffKind;geometry:{type:"path"|"polygon";points:P[]};dimensions:Dimensions;label:{position?:P;visible:boolean}};
export type TakeoffGroup={id:TakeoffKind;visible:boolean;color:string};
export type TakeoffDocument={schemaVersion:1;drawing:{key:string;name:string;size:number;lastModified:number};unit:MeasurementUnit;groups:TakeoffGroup[];objects:TakeoffObject[];defaults:Record<TakeoffKind,Dimensions>;options:{focus:boolean;keepLayers:string[];keepColors:string[];collapsed:boolean;heightUnit:"m"|"mm"};revision:number};
export type Quantity={lengthM:number;areaM2:number;volumeM3:number};
export const knownUnit=(unit:MeasurementUnit)=>unit!=="drawing"&&unit in UNIT_METERS;
export const validPoint=(p:P)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1e12&&Math.abs(p.y)<=1e12;
export function newTakeoff(drawing:TakeoffDocument["drawing"],unit:MeasurementUnit):TakeoffDocument{return{schemaVersion:1,drawing,unit,groups:[{id:"wall",visible:true,color:"#49cfff"},{id:"beam",visible:true,color:"#ffdc63"},{id:"slab",visible:true,color:"#b18bff"}],objects:[],defaults:{wall:{heightMm:3000,thicknessMm:200},beam:{widthMm:300,depthMm:600},slab:{thicknessMm:180}},options:{focus:false,keepLayers:[],keepColors:[],collapsed:false,heightUnit:"m"},revision:0};}
/** Closure is implicit in polygon storage. Remove only consecutive duplicates
 * and the closing alias, never nonconsecutive vertices that may cross. */
export function cleanPoints(raw:readonly P[],polygon=false):P[]{
 const points:P[]=[];for(const p of raw)if(!points.length||distance(points.at(-1)!,p)>1e-8)points.push({...p});
 if(polygon&&points.length>1&&distance(points[0],points.at(-1)!)<=1e-8)points.pop();return points;
}
function intersects(a:P,b:P,c:P,d:P){
 const cross=(p:P,q:P,r:P)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x),u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),z=cross(c,d,b);
 const eps=1e-8;if((u>0&&v<0||u<0&&v>0)&&(w>0&&z<0||w<0&&z>0))return true;
 return Math.abs(u)<eps&&pointSegmentDistance(c,a,b)<eps||Math.abs(v)<eps&&pointSegmentDistance(d,a,b)<eps||Math.abs(w)<eps&&pointSegmentDistance(a,c,d)<eps||Math.abs(z)<eps&&pointSegmentDistance(b,c,d)<eps;
}
export function geometryError(raw:readonly P[],polygon:boolean):string|null{
 if(raw.length>4096||raw.some(p=>!validPoint(p)))return"좌표 또는 점 개수가 유효하지 않습니다.";
 const p=cleanPoints(raw,polygon);if(p.length<(polygon?3:2))return polygon?"서로 다른 점이 3개 이상 필요합니다.":"서로 다른 점이 2개 이상 필요합니다.";
 if(pathLength(p,polygon)<=1e-8)return"길이가 0인 객체는 만들 수 없습니다.";
 if(polygon){
  for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
   if(j===i+1||i===0&&j===p.length-1)continue;
   if(intersects(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return"경계가 서로 교차하거나 겹칩니다. 점을 수정하세요.";
  }
  // Adjacent edges must not turn back over each other.
  for(let i=0;i<p.length;i++){const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length];if(pointSegmentDistance(c,a,b)<1e-8||pointSegmentDistance(a,b,c)<1e-8)return"겹치거나 너무 짧은 변이 있습니다.";}
  if(polygonArea(p)<=1e-12)return"면적이 0인 영역은 만들 수 없습니다.";
 }return null;
}
export function dimensionsError(kind:TakeoffKind,d:Dimensions):string|null{
 const values=kind==="wall"?[d.heightMm,d.thicknessMm]:kind==="beam"?[d.widthMm,d.depthMm]:[d.thicknessMm];
 return values.some(v=>typeof v!=="number"||!Number.isFinite(v)||v<=0||v>1e7)?"규격은 0보다 크고 10,000,000mm 이하인 숫자로 입력하세요.":null;
}
const quantities=new WeakMap<TakeoffObject["geometry"],{unit:MeasurementUnit;kind:TakeoffKind;dimensions:string;value:Quantity}>();
/** Objects are immutable editor snapshots; avoid revalidating every polygon on every pan frame. */
export function quantity(o:TakeoffObject,unit:MeasurementUnit):Quantity{
 const dimensions=JSON.stringify(o.dimensions),cached=quantities.get(o.geometry);if(cached&&cached.unit===unit&&cached.kind===o.kind&&cached.dimensions===dimensions)return cached.value;
 if(!knownUnit(unit))throw Error("도면 단위를 확인한 후 물량을 확정하세요.");
 const error=geometryError(o.geometry.points,o.kind==="slab")??dimensionsError(o.kind,o.dimensions);if(error)throw Error(error);
 const ratio=UNIT_METERS[unit],p=cleanPoints(o.geometry.points,o.kind==="slab"),lengthM=o.kind==="slab"?0:pathLength(p)*ratio,areaM2=o.kind==="slab"?polygonArea(p)*ratio*ratio:0,d=o.dimensions;
 const volumeM3=o.kind==="wall"?lengthM*d.heightMm!*.001*d.thicknessMm!*.001:o.kind==="beam"?lengthM*d.widthMm!*.001*d.depthMm!*.001:areaM2*d.thicknessMm!*.001;
 if(!Number.isFinite(volumeM3)||volumeM3<=0||volumeM3>1e15)throw Error("계산 가능한 물량 범위를 벗어났습니다.");const value={lengthM,areaM2,volumeM3};quantities.set(o.geometry,{unit,kind:o.kind,dimensions,value});return value;
}
export function totals(doc:TakeoffDocument){
 const groups=Object.fromEntries(KINDS.map(k=>[k,{count:0,lengthM:0,areaM2:0,volumeM3:0}]))as Record<TakeoffKind,Quantity&{count:number}>;
 for(const o of doc.objects){const q=quantity(o,doc.unit),g=groups[o.kind];g.count++;g.lengthM+=q.lengthM;g.areaM2+=q.areaM2;g.volumeM3+=q.volumeM3;}
 return{groups,volumeM3:KINDS.reduce((n,k)=>n+groups[k].volumeM3,0),visibleVolumeM3:doc.groups.filter(g=>g.visible).reduce((n,g)=>n+groups[g.id].volumeM3,0)};
}
export function insidePolygon(p:P,points:readonly P[]):boolean{
 let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];if(pointSegmentDistance(p,a,b)<1e-8)return true;
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;
}
export function labelPosition(o:TakeoffObject):P{
 if(o.label.position)return o.label.position;const p=o.geometry.points;
 if(o.kind!=="slab"){let left=pathLength(p)/2;for(let i=1;i<p.length;i++){const l=distance(p[i-1],p[i]);if(left<=l&&l>0)return{x:p[i-1].x+(p[i].x-p[i-1].x)*left/l,y:p[i-1].y+(p[i].y-p[i-1].y)*left/l};left-=l;}return p[0];}
 // Find the widest interior scan-line interval. Works for concave polygons
 // whose ordinary centroid lies outside; no triangulation dependency needed.
 const ys=[...new Set(p.map(v=>v.y))].sort((a,b)=>a-b);let best=0,result=p[0];
 for(let i=1;i<ys.length;i++){const y=ys[i-1]+(ys[i]-ys[i-1])/2,xs:number[]=[];for(let j=0;j<p.length;j++){const a=p[j],b=p[(j+1)%p.length];if((a.y>y)!==(b.y>y))xs.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));}xs.sort((a,b)=>a-b);for(let j=1;j<xs.length;j+=2){const width=xs[j]-xs[j-1];if(width>best){best=width;result={x:xs[j-1]+width/2,y};}}}return result;
}
export function asAnnotation(o:TakeoffObject,color?:string):Annotation{return{id:o.id,layerId:o.groupId,kind:"polyline",points:o.kind==="slab"?[...o.geometry.points,o.geometry.points[0]]:o.geometry.points,...o.label.position?{labelPoint:o.label.position}:{},...color?{color}:{}};}
export function fromAnnotation(o:TakeoffObject,a:Annotation):TakeoffObject{return{...o,geometry:{...o.geometry,points:cleanPoints(a.points,o.kind==="slab")},...o.label.position&&a.labelPoint?{label:{...o.label,position:a.labelPoint}}:{}};}
export function validateDocument(value:unknown,key?:string):asserts value is TakeoffDocument{
 const d=value as TakeoffDocument;
 if(!d||d.schemaVersion!==1||!d.drawing||!/^v1-[a-f0-9]{64}$/.test(d.drawing.key)||key&&d.drawing.key!==key||typeof d.drawing.name!=="string"||!Number.isFinite(d.drawing.size)||!Number.isFinite(d.drawing.lastModified)||!Object.keys(UNIT_METERS).includes(d.unit)||!Array.isArray(d.groups)||d.groups.length!==3||new Set(d.groups.map(g=>g.id)).size!==3||d.groups.some(g=>!KINDS.includes(g.id)||typeof g.visible!=="boolean"||!/^#[a-f0-9]{6}$/i.test(g.color))||!Array.isArray(d.objects)||!d.defaults||!d.options||!Number.isSafeInteger(d.revision)||d.revision<0)throw Error("적산 문서 형식 또는 버전이 유효하지 않습니다. 기존 자료를 덮어쓰지 않았습니다.");
 if(!Array.isArray(d.options.keepLayers)||d.options.keepLayers.some(v=>typeof v!=="string")||!Array.isArray(d.options.keepColors)||d.options.keepColors.some(v=>!/^#[a-f0-9]{6}$/i.test(v))||typeof d.options.focus!=="boolean"||typeof d.options.collapsed!=="boolean"||!["m","mm"].includes(d.options.heightUnit))throw Error("적산 표시 설정이 유효하지 않습니다.");
 for(const k of KINDS)if(dimensionsError(k,d.defaults[k]??{}))throw Error("적산 기본 규격이 유효하지 않습니다.");
 const ids=new Set<string>();for(const o of d.objects){if(!o||typeof o.id!=="string"||!o.id||ids.has(o.id)||!KINDS.includes(o.kind)||o.groupId!==o.kind||o.geometry?.type!==(o.kind==="slab"?"polygon":"path")||!Array.isArray(o.geometry.points)||!o.label||typeof o.label.visible!=="boolean"||o.label.position&&!validPoint(o.label.position))throw Error("적산 객체 형식이 유효하지 않습니다.");ids.add(o.id);quantity(o,d.unit);}
}
