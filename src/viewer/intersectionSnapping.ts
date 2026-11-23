import { visitCadSegments, type Segment } from "./cadPicking";
import { lineIntersection } from "./annotations";
import { distance, pointSegmentDistance, type MeasurementGeometry } from "./measurementGeometry";
import {visitCircularEdges} from './circularSnap';
import {segmentCircleIntersections} from './curveGeometry';
import type { DrawingPoint as P } from "./savedView";

/** Work near the pointer, never build or persist all pairs in a large drawing. */
export function intersectionSnap(geometries:MeasurementGeometry[],target:P,tolerance:number,accept:(p:P)=>boolean=()=>true):P|null{
  const box={minX:target.x-tolerance,minY:target.y-tolerance,maxX:target.x+tolerance,maxY:target.y+tolerance};
  const near:Array<{line:Segment;d:number;key:string}>=[],curves:Array<{center:P;radius:number;contains(p:P):boolean}>=[],seen=new Set<string>();
  const siftDown=(i:number)=>{for(;;){let child=i*2+1;if(child>=near.length)return;if(child+1<near.length&&near[child+1].d>near[child].d)child++;if(near[i].d>=near[child].d)return;[near[i],near[child]]=[near[child],near[i]];i=child;}};
  for(const g of geometries){
    visitCadSegments(g,box,(a,b)=>{
      const d=pointSegmentDistance(target,a,b);if(d>tolerance||near.length===128&&d>=near[0].d)return;
      const key=[a.x,a.y,b.x,b.y].join(":");if(seen.has(key))return;
      const item={line:[a,b]as Segment,d,key};seen.add(key);
      // Keep the same closest-128 budget in a max heap, without sorting or retaining every rejected edge.
      if(near.length===128){seen.delete(near[0].key);near[0]=item;siftDown(0);}
      else{near.push(item);let i=near.length-1;while(i>0){const parent=(i-1)>>>1;if(near[parent].d>=near[i].d)break;[near[parent],near[i]]=[near[i],near[parent]];i=parent;}}
    });
    visitCircularEdges(g,box,arc=>{if(curves.length>=64||Math.abs(distance(arc.center,target)-arc.radius)>tolerance)return;
      const tau=Math.PI*2;curves.push({center:arc.center,radius:arc.radius,contains:p=>arc.sweep>=tau-1e-8||((arc.direction*(Math.atan2(p.y-arc.center.y,p.x-arc.center.x)-arc.start)+tau*2)%tau)<=arc.sweep+1e-9});});
  }
  near.sort((a,b)=>a.d-b.d);near.length=Math.min(128,near.length);
  let result:P|null=null,best=tolerance;
  const consider=(p:P|null)=>{if(!p||!accept(p))return;const d=distance(p,target);if(d<=best){result=p;best=d;}};
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++)consider(lineIntersection(...near[i].line,...near[j].line));
  for(const c of curves)for(const{line:[a,b]}of near){
    for(const q of segmentCircleIntersections(a,b,c.center,c.radius))if(c.contains(q))consider(q);
  }
  for(let i=0;i<curves.length;i++)for(let j=i+1;j<curves.length;j++){
    const a=curves[i],b=curves[j],d=distance(a.center,b.center);if(d<1e-10||d>a.radius+b.radius||d<Math.abs(a.radius-b.radius))continue;
    const t=((a.radius-b.radius)*(a.radius+b.radius)+d*d)/(2*d),h=Math.sqrt(Math.max(0,(a.radius-t)*(a.radius+t))),ux=(b.center.x-a.center.x)/d,uy=(b.center.y-a.center.y)/d;
    for(const s of[-1,1]){const q={x:a.center.x+t*ux-s*h*uy,y:a.center.y+t*uy+s*h*ux};if(a.contains(q)&&b.contains(q))consider(q);}
  }
  return result;
}
