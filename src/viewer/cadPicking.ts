import type { DrawingBounds, DrawingPoint } from "./savedView";
import type { MeasurementGeometry } from "./measurementGeometry";
import {queryEntityIds,querySupplementalIds} from './geometryQuery';
export type Segment = [DrawingPoint, DrawingPoint];
const CHUNK = 16384;
/** Bounds-filter packed data before allocating points; never unpack the complete DWG. */
export function visitCadSegments(g: MeasurementGeometry, box: DrawingBounds, visit: (a: DrawingPoint, b: DrawingPoint) => void, straightOnly = true): void {
  const overlaps = (x0: number,y0: number,x1: number,y1: number) => box.minX<=x1&&box.maxX>=x0&&box.minY<=y1&&box.maxY>=y0;
  const extra=g.packed;
  querySupplementalIds(g,box,i=>{if(i<(extra?.snapSegmentCount??0)){const d=extra!.snapSegments![Math.floor(i/CHUNK)],k=i%CHUNK*4;visit({x:d[k],y:d[k+1]},{x:d[k+2],y:d[k+3]});}else{const[a,b]=g.snapSegments![i-(extra?.snapSegmentCount??0)];visit(a,b);}});
  if (g.packed) {
    const p=g.packed;
    queryEntityIds(g,box,i=>{
      const d=p.data[Math.floor(i/CHUNK)],k=i%CHUNK*7;
      if(!overlaps(d[k],d[k+1],d[k+2],d[k+3])||(straightOnly&&d[k+6]))return;
      const r=p.refs[Math.floor(i/CHUNK)],j=i%CHUNK*3;
      if(straightOnly&&!["LINE","LWPOLYLINE","POLYLINE"].includes(p.kinds[r[j+2]]))return;
      const end=r[j]+r[j+1];
      for(let n=r[j]+1;n<end;n++){
        const a=p.points[Math.floor((n-1)/CHUNK)],ak=(n-1)%CHUNK*2,b=p.points[Math.floor(n/CHUNK)],bk=n%CHUNK*2;
        if(!overlaps(Math.min(a[ak],b[bk]),Math.min(a[ak+1],b[bk+1]),Math.max(a[ak],b[bk]),Math.max(a[ak+1],b[bk+1])))continue;
        visit({x:a[ak],y:a[ak+1]},{x:b[bk],y:b[bk+1]});
      }
    });
  } else queryEntityIds(g,box,i=>{const e=g.entities[i];
    const b=e.bounds;if(!overlaps(b.minX,b.minY,b.maxX,b.maxY)||(straightOnly&&(e.approximate||!["LINE","LWPOLYLINE","POLYLINE"].includes(e.kind))))return;
    for(let i=1;i<e.points.length;i++){const a=e.points[i-1],b=e.points[i];if(overlaps(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.max(a.x,b.x),Math.max(a.y,b.y)))visit(a,b);}
  });
}
export function segmentFoot(p:DrawingPoint,a:DrawingPoint,b:DrawingPoint,clamp=true):DrawingPoint|null{
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<1e-18)return null;
  let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;
  if(!clamp&&(t< -1e-10||t>1+1e-10))return null;
  t=Math.max(0,Math.min(1,t));return{x:a.x+t*dx,y:a.y+t*dy};
}
export function perpendicularSnap(g:MeasurementGeometry,anchor:DrawingPoint,target:DrawingPoint,tolerance:number,accept:(p:DrawingPoint)=>boolean=()=>true):DrawingPoint|null{
  let best=tolerance,point:DrawingPoint|null=null;
  visitCadSegments(g,{minX:target.x-tolerance,minY:target.y-tolerance,maxX:target.x+tolerance,maxY:target.y+tolerance},(a,b)=>{
    const q=segmentFoot(anchor,a,b,false);if(!q||Math.hypot(q.x-anchor.x,q.y-anchor.y)<1e-9||!accept(q))return;
    const d=Math.hypot(q.x-target.x,q.y-target.y);if(d<=best){best=d;point=q;}
  });return point;
}
