import {lineIntersection}from'./annotations';
import {perpendicularSnap,visitCadSegments}from'./cadPicking';
import {circularPoint,visitCircularEdges}from'./circularSnap';
import {onArc,segmentCircleIntersections}from'./curveGeometry';
import {distance,type MeasurementGeometry}from'./measurementGeometry';
import type{DrawingPoint as P}from'./savedView';
import {isRightAngle}from'./rightAngles';

/** Normals to touching CAD lines/arc tangents at the fixed endpoint, and
 * perpendicular feet on actual geometry at the moving endpoint. */
export function endpointPerpendicularSnap(geometries:MeasurementGeometry[],anchor:P,target:P,tolerance:number,tangents:readonly P[],accept:(p:P,g?:MeasurementGeometry)=>boolean=()=>true,free=true):P|null{
 if(![anchor.x,anchor.y,target.x,target.y,tolerance].every(Number.isFinite)||tolerance<=0)return null;
 const reach=distance(anchor,target)+tolerance*2,box={minX:target.x-tolerance,minY:target.y-tolerance,maxX:target.x+tolerance,maxY:target.y+tolerance};
 const axes=tangents.filter(d=>Number.isFinite(d.x)&&Number.isFinite(d.y)&&Math.hypot(d.x,d.y)>1e-12).map(d=>{
  const l=Math.hypot(d.x,d.y),u={x:-d.y/l,y:d.x/l};return{u,a:{x:anchor.x-u.x*reach,y:anchor.y-u.y*reach},b:{x:anchor.x+u.x*reach,y:anchor.y+u.y*reach}};
 });
 let result:P|null=null,best=tolerance,ends=0;
 const leg=(q:P)=>({x:q.x-anchor.x,y:q.y-anchor.y}),firstRight=(q:P)=>tangents.some(t=>isRightAngle(t,leg(q),1e-8));
 const consider=(q:P|null,g?:MeasurementGeometry,both=false)=>{if(!q||distance(anchor,q)<1e-9||!accept(q,g))return;const d=distance(target,q),count=both?2:1;if(d<=tolerance&&(count>ends||count===ends&&d<=best)){best=d;ends=count;result=q;}};
 for(const g of geometries){
  const foot=perpendicularSnap(g,anchor,target,tolerance,q=>accept(q,g));consider(foot,g,!!foot&&firstRight(foot));
  visitCadSegments(g,box,(a,b)=>{for(const axis of axes){const q=lineIntersection(a,b,axis.a,axis.b);consider(q,g,!!q&&isRightAngle(leg(q),{x:b.x-a.x,y:b.y-a.y},1e-8));}});
  visitCircularEdges(g,box,arc=>{
   const epsilon=Math.max(arc.radius*1e-9,Number.EPSILON*Math.max(1,Math.abs(arc.center.x),Math.abs(arc.center.y))*16);
   const radial=(q:P|null)=>consider(q,g,!!q&&firstRight(q));
   if(distance(anchor,arc.center)<epsilon)radial(circularPoint(arc,target));
   else for(const side of[-1,1])radial(circularPoint(arc,{x:arc.center.x+(anchor.x-arc.center.x)*side,y:arc.center.y+(anchor.y-arc.center.y)*side}));
   for(const axis of axes)for(const q of segmentCircleIntersections(axis.a,axis.b,arc.center,arc.radius))if(onArc(arc,q))consider(q,g,isRightAngle(leg(q),{x:-(q.y-arc.center.y),y:q.x-arc.center.x},1e-8));
  });
 }
 // Only actual source references offer free tracking. A nearby CAD edge stays
 // on its geometry; there is no unrelated horizontal/vertical constraint.
 if(free&&!result)for(const{u}of axes){const d=(target.x-anchor.x)*u.x+(target.y-anchor.y)*u.y;consider({x:anchor.x+u.x*d,y:anchor.y+u.y*d});}
 return result;
}
