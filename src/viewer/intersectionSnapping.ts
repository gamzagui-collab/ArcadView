import { visitCadSegments, type Segment } from "./cadPicking";
import { lineIntersection, sourceAnnotation } from "./annotations";
import { distance, pointSegmentDistance, type MeasurableEntity, type MeasurementGeometry } from "./measurementGeometry";
import { packedEntity } from "./packedMeasurement";
import type { DrawingPoint as P } from "./savedView";

/** Work near the pointer, never build or persist all pairs in a large drawing. */
export function intersectionSnap(geometries:MeasurementGeometry[],target:P,tolerance:number,accept:(p:P)=>boolean=()=>true):P|null{
  const box={minX:target.x-tolerance,minY:target.y-tolerance,maxX:target.x+tolerance,maxY:target.y+tolerance};
  const near:Array<{line:Segment;d:number}>=[],curves:Array<{center:P;radius:number;contains(p:P):boolean}>=[],seen=new Set<string>();
  const curve=(e:MeasurableEntity)=>{
    if(e.approximate||!["CIRCLE","ARC"].includes(e.kind)||curves.length>=64)return;
    const o=sourceAnnotation(e,"intersection"),c=o.points[0],r=distance(c,o.points[1]);
    if(!["circle","arc"].includes(o.kind)||Math.abs(distance(c,target)-r)>tolerance)return;
    const tau=Math.PI*2,start=o.start??0,sweep=o.sweep??tau;
    curves.push({center:c,radius:r,contains:p=>o.kind==="circle"||((Math.atan2(p.y-c.y,p.x-c.x)-start+tau*2)%tau)<=sweep+1e-9});
  };
  for(const g of geometries){
    visitCadSegments(g,box,(a,b)=>{
      const d=pointSegmentDistance(target,a,b);if(d>tolerance)return;
      const label=[a.x,a.y,b.x,b.y].join(":");if(seen.has(label))return;seen.add(label);
      near.push({line:[a,b],d});
      // Bound dense hatch work to the closest edges around this screen point.
      if(near.length>256){near.sort((a,b)=>a.d-b.d);near.length=128;}
    });
    if(g.packed){const p=g.packed;for(let i=0;i<p.entityCount;i++){
      const d=p.data[Math.floor(i/16384)],k=i%16384*7;
      if(d[k+6]||d[k]>box.maxX||d[k+2]<box.minX||d[k+1]>box.maxY||d[k+3]<box.minY)continue;
      const refs=p.refs[Math.floor(i/16384)],j=i%16384*3;if(["CIRCLE","ARC"].includes(p.kinds[refs[j+2]]))curve(packedEntity(p,i));
    }}else for(const e of g.entities)if(e.bounds.minX<=box.maxX&&e.bounds.maxX>=box.minX&&e.bounds.minY<=box.maxY&&e.bounds.maxY>=box.minY)curve(e);
  }
  near.sort((a,b)=>a.d-b.d);near.length=Math.min(128,near.length);
  let result:P|null=null,best=tolerance;
  const consider=(p:P|null)=>{if(!p||!accept(p))return;const d=distance(p,target);if(d<=best){result=p;best=d;}};
  for(let i=0;i<near.length;i++)for(let j=i+1;j<near.length;j++)consider(lineIntersection(...near[i].line,...near[j].line));
  for(const c of curves)for(const{line:[a,b]}of near){
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<1e-10)continue;
    // Project relative to the circle centre. A quadratic discriminant subtracts
    // huge near-equal values for long site axes and can shift a small crossing.
    const ux=dx/length,uy=dy/length,ox=a.x-c.center.x,oy=a.y-c.center.y,along=-(ox*ux+oy*uy),fx=ox+along*ux,fy=oy+along*uy,h2=c.radius*c.radius-fx*fx-fy*fy;
    if(h2< -1e-12*c.radius*c.radius)continue;
    const h=Math.sqrt(Math.max(0,h2));
    for(const side of[-1,1]){const t=along+side*h;if(t>=0&&t<=length){const q={x:c.center.x+fx+side*h*ux,y:c.center.y+fy+side*h*uy};if(c.contains(q))consider(q);}}
  }
  for(let i=0;i<curves.length;i++)for(let j=i+1;j<curves.length;j++){
    const a=curves[i],b=curves[j],d=distance(a.center,b.center);if(d<1e-10||d>a.radius+b.radius||d<Math.abs(a.radius-b.radius))continue;
    const t=((a.radius-b.radius)*(a.radius+b.radius)+d*d)/(2*d),h=Math.sqrt(Math.max(0,(a.radius-t)*(a.radius+t))),ux=(b.center.x-a.center.x)/d,uy=(b.center.y-a.center.y)/d;
    for(const s of[-1,1]){const q={x:a.center.x+t*ux-s*h*uy,y:a.center.y+t*uy+s*h*ux};if(a.contains(q)&&b.contains(q))consider(q);}
  }
  return result;
}
