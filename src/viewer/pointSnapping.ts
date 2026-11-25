import {segmentFoot,visitCadSegments} from './cadPicking';
import {intersectionSnap} from './intersectionSnapping';
import {distance,type MeasurementGeometry,type SnapPoint} from './measurementGeometry';
import type {DrawingPoint as P} from './savedView';
import {circularPoint,visitCircularEdges} from './circularSnap';
import type {SnapCandidate} from './snapStability';
import type {CircularEdge} from './circularSnap';

export type PointSnap={point:P;kind:SnapPoint['kind']|'intersection'|'edge'};
const kinds=['endpoint','midpoint','center','insertion']as const;
/** One sorted-X pass for all point kinds, including supplemental block features. */
function discrete(g:MeasurementGeometry,target:P,tolerance:number,kind?:SnapPoint['kind']):SnapPoint[]{
 const best=[tolerance*tolerance,tolerance*tolerance,tolerance*tolerance,tolerance*tolerance],found:Array<SnapPoint|undefined>=[];
 const consider=(x:number,y:number,k:number)=>{if(kind&&kinds[k]!==kind||Math.abs(y-target.y)>tolerance)return;
  const d=(x-target.x)**2+(y-target.y)**2;if(d<=best[k]){best[k]=d;found[k]={x,y,kind:kinds[k]};}};
 const packed=(chunks:Float64Array[],count:number)=>{
  let lo=0,hi=count;while(lo<hi){const i=(lo+hi)>>>1;if(chunks[Math.floor(i/16384)][i%16384*3]<target.x-tolerance)lo=i+1;else hi=i;}
  for(let i=lo;i<count;i++){const a=chunks[Math.floor(i/16384)],j=i%16384*3,x=a[j];if(x>target.x+tolerance)break;consider(x,a[j+1],a[j+2]);}
 };
 if(g.packed){packed(g.packed.snaps,g.packed.snapCount);if(g.packed.extraSnaps)packed(g.packed.extraSnaps,g.packed.extraSnapCount??0);}
 else{let lo=0,hi=g.snaps.length;while(lo<hi){const i=(lo+hi)>>>1;if(g.snaps[i].x<target.x-tolerance)lo=i+1;else hi=i;}
  for(let i=lo;i<g.snaps.length;i++){const s=g.snaps[i];if(s.x>target.x+tolerance)break;consider(s.x,s.y,kinds.indexOf(s.kind));}}
 return found.filter((p):p is SnapPoint=>!!p);
}
/** Characteristic points win only within a small screen-distance band; a distant midpoint cannot steal a line projection. */
export function pointSnap(geometries:MeasurementGeometry[],target:P,tolerance:number,
 accept:(p:P,source?:MeasurementGeometry)=>boolean=()=>true,nearest=true,onlyKind?:SnapPoint['kind']):PointSnap|null{
 const result=pointSnapCandidate(geometries,target,tolerance,accept,nearest,onlyKind);
 return result?{point:result.point,kind:result.kind as PointSnap['kind']}:null;
}
export function pointSnapCandidate(geometries:MeasurementGeometry[],target:P,tolerance:number,
 accept:(p:P,source?:MeasurementGeometry)=>boolean=()=>true,nearest=true,onlyKind?:SnapPoint['kind']):SnapCandidate|null{
 if(!Number.isFinite(target.x)||!Number.isFinite(target.y)||!Number.isFinite(tolerance)||tolerance<=0)return null;
 let result:SnapCandidate|null=null,best=Infinity,characteristic:SnapCandidate|null=null,characteristicScore=Infinity;
 const choose=(point:P,kind:PointSnap['kind'],source?:MeasurementGeometry,a?:P,b?:P,arc?:CircularEdge)=>{
  const d=distance(target,point);if(!Number.isFinite(d)||d>tolerance||!accept(point,source))return;
  const rank={endpoint:0,intersection:.25,midpoint:.5,center:.75,insertion:.75,edge:1}[kind],score=d+tolerance*.08*rank;
  if(score>=best&&(kind==='edge'||score>=characteristicScore))return;
  const candidate:SnapCandidate={point,kind,target:arc&&source?{type:'arc',arc,source}:a&&b&&source?{type:'segment',a,b,source}:{type:'point',point,source},reach:nearest&&['endpoint','intersection','midpoint'].includes(kind)?tolerance/3:tolerance};
  if(kind!=='edge'&&score<characteristicScore){characteristicScore=score;characteristic=candidate;}
  if(score<best){best=score;result=candidate;}
 };
 const box={minX:target.x-tolerance,minY:target.y-tolerance,maxX:target.x+tolerance,maxY:target.y+tolerance};
 for(const g of geometries){
  for(const s of discrete(g,target,tolerance,onlyKind))choose(s,s.kind,g);
  if(nearest&&!onlyKind)visitCadSegments(g,box,(a,b)=>{const q=segmentFoot(target,a,b);if(q)choose(q,'edge',g,a,b);});
  if(nearest&&!onlyKind)visitCircularEdges(g,box,arc=>{const q=circularPoint(arc,target);if(q)choose(q,'edge',g,undefined,undefined,arc);});
 }
 if(!onlyKind){const p=intersectionSnap(geometries,target,tolerance,p=>accept(p,geometries[0]));if(p)choose(p,'intersection',geometries[0]);}
 // A narrow six-pixel band (at the viewer's 18px tolerance) lets a nearby
 // midpoint beat a moving edge point, retaining endpoint/intersection priority.
 const picked=result as SnapCandidate|null,feature=characteristic as SnapCandidate|null;
 return picked?.kind==='edge'&&feature&&['midpoint','endpoint','intersection'].includes(feature.kind)&&distance(target,feature.point)<=tolerance/3?feature:picked;
}
