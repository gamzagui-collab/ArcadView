import type {DrawingBounds as B,DrawingPoint as P} from "./savedView";
import {annotationPoints,type Annotation} from "./annotations";
import {distance,nearestSnap,type MeasurementGeometry,type SnapPoint} from "./measurementGeometry";
import {nearestPackedSnap} from "./packedMeasurement";
import {segmentFoot,visitCadSegments} from "./cadPicking";
import {visitCircularEdges,type CircularEdge} from "./circularSnap";
import {normAngle,shapePrimitives,TAU} from "./curveGeometry";
import {intersectionSnap} from "./intersectionSnapping";

export type MoveContact={point:P;contact:P;kind:SnapPoint["kind"]|"intersection"|"curve"|"edge"};
type Item<T>={box:B;value:T};
const box=(a:P,b=a):B=>({minX:Math.min(a.x,b.x),minY:Math.min(a.y,b.y),maxX:Math.max(a.x,b.x),maxY:Math.max(a.y,b.y)});
const expand=(b:B,t:number):B=>({minX:b.minX-t,minY:b.minY-t,maxX:b.maxX+t,maxY:b.maxY+t});
const shift=(b:B,d:P):B=>({minX:b.minX+d.x,minY:b.minY+d.y,maxX:b.maxX+d.x,maxY:b.maxY+d.y});
const plus=(a:P,b:P):P=>({x:a.x+b.x,y:a.y+b.y}),minus=(a:P,b:P):P=>({x:a.x-b.x,y:a.y-b.y});
const inBox=(p:P,b:B)=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY;
/** Index only the selected object, never duplicate a large DWG's geometry. */
function index<T>(items:Item<T>[]){
 items.sort((a,b)=>a.box.minX-b.box.minX);const max: number[]=[];let right=-Infinity;for(const i of items){right=Math.max(right,i.box.maxX);max.push(right);}
 return(b:B,visit:(v:T)=>void)=>{let lo=0,hi=items.length;while(lo<hi){const m=(lo+hi)>>>1;if(items[m].box.minX<=b.maxX)lo=m+1;else hi=m;}for(let i=lo-1;i>=0&&max[i]>=b.minX;i--){const q=items[i];if(q.box.maxX>=b.minX&&q.box.minY<=b.maxY&&q.box.maxY>=b.minY)visit(q.value);}};
}
function circularFoot(arc:CircularEdge,p:P):P|null{
 const d=distance(arc.center,p);if(d<1e-12)return null;const v=minus(p,arc.center),angle=Math.atan2(v.y,v.x);
 if(arc.sweep<TAU-1e-8&&normAngle(arc.direction*(angle-arc.start))>arc.sweep+1e-8)return null;
 return{x:arc.center.x+v.x/d*arc.radius,y:arc.center.y+v.y/d*arc.radius};
}
function visitSnaps(g:MeasurementGeometry,region:B,visit:(p:SnapPoint)=>void){
 const kinds=["endpoint","midpoint","center","insertion"]as const;
 const packed=(chunks:Float64Array[],count:number)=>{let lo=0,hi=count;while(lo<hi){const m=(lo+hi)>>>1;if(chunks[Math.floor(m/16384)][m%16384*3]<region.minX)lo=m+1;else hi=m;}for(let i=lo;i<count;i++){const d=chunks[Math.floor(i/16384)],k=i%16384*3,x=d[k],y=d[k+1];if(x>region.maxX)break;if(y>=region.minY&&y<=region.maxY)visit({x,y,kind:kinds[d[k+2]]});}};
 if(g.packed){packed(g.packed.snaps,g.packed.snapCount);if(g.packed.extraSnaps)packed(g.packed.extraSnaps,g.packed.extraSnapCount??0);}
 else for(const p of g.snaps)if(inBox(p,region))visit(p);
}
/** Rigid contact snapping: any moving corner/center/edge can meet stationary CAD
 * geometry. A correction changes translation only, never vertices relative to one
 * another. Targets are queried once per frame and invisible contacts are ignored. */
export function createMoveSnap(object:Annotation,base:P){
 const primitives=shapePrimitives(object.kind==="point-circle"?{...object,kind:"circle"}:object),circles=primitives.filter(p=>p.kind==="arc"),lines=object.kind==="text"?[]:primitives.filter(p=>p.kind==="line"),anchors:P[]=[];
 if(object.kind==="circle"||object.kind==="arc"||object.kind==="point-circle"){
  const c=object.points[0],r=distance(c,object.points[1]);anchors.push(c);
  if(object.kind==="arc"){anchors.push(...annotationPoints(object).filter((_,i,a)=>i===0||i===a.length-1));}
  else for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5])anchors.push({x:c.x+r*Math.cos(a),y:c.y+r*Math.sin(a)});
 }else{anchors.push(...annotationPoints(object));for(const p of lines)anchors.push(p.a,p.b,{x:(p.a.x+p.b.x)/2,y:(p.a.y+p.b.y)/2});}
 const points=index(anchors.map(p=>({box:box(p),value:p}))),edges=index(lines.map(l=>({box:box(l.a,l.b),value:l})));
 const bounds=anchors.reduce((b,p)=>({minX:Math.min(b.minX,p.x),minY:Math.min(b.minY,p.y),maxX:Math.max(b.maxX,p.x),maxY:Math.max(b.maxY,p.y)}),box(base));
 for(const c of circles){bounds.minX=Math.min(bounds.minX,c.center.x-c.radius);bounds.maxX=Math.max(bounds.maxX,c.center.x+c.radius);bounds.minY=Math.min(bounds.minY,c.center.y-c.radius);bounds.maxY=Math.max(bounds.maxY,c.center.y+c.radius);}
 return(target:P,geometries:MeasurementGeometry[],tolerance:number,accept:(p:P)=>boolean=()=>true,viewport?:B):MoveContact|null=>{
  const delta=minus(target,base),inverse={x:-delta.x,y:-delta.y},region=expand(shift(bounds,delta),tolerance);
  if(viewport){region.minX=Math.max(region.minX,viewport.minX);region.minY=Math.max(region.minY,viewport.minY);region.maxX=Math.min(region.maxX,viewport.maxX);region.maxY=Math.min(region.maxY,viewport.maxY);}
  let best:MoveContact|null=null,score=Infinity,nearAnchor:P|null=null,edgeScore=Infinity;
  const consider=(moving:P,contact:P,kind:MoveContact["kind"],discrete=false)=>{
   const d=distance(moving,contact);if(d>tolerance||!inBox(contact,region)||!accept(contact))return;
   const rank=d+(discrete?0:tolerance*.55);if(rank>=score)return;score=rank;best={point:plus(target,minus(contact,moving)),contact,kind};
   if(!discrete&&d<edgeScore){edgeScore=d;nearAnchor=moving;}
  };
  for(const p of anchors){const q=plus(p,delta);if(!inBox(q,expand(region,tolerance)))continue;
   for(const g of geometries){const s=g.packed?nearestPackedSnap(g.packed,q,tolerance):nearestSnap(g.snaps,q,tolerance);if(s)consider(q,s,s.kind,true);}
  }
  // Target endpoints can meet the middle of a moving edge, too. This also locks
  // overlapping parallel lines without requiring matching endpoint positions.
  const stationaryPoint=(p:P,kind:SnapPoint["kind"]="endpoint")=>{
   if(!inBox(p,region)||!accept(p))return;
   const local=plus(p,inverse);points(expand(box(local),tolerance),q=>consider(plus(q,delta),p,kind,true));
   edges(expand(box(local),tolerance),l=>{const f=segmentFoot(local,l.a,l.b);if(f)consider(plus(f,delta),p,kind);});
   for(const c of circles){const f=circularFoot(c,local);if(f)consider(plus(f,delta),p,"curve");}
  };
  for(const g of geometries){
   visitCadSegments(g,region,(a,b)=>{
    points(shift(expand(box(a,b),tolerance),inverse),p=>{const q=plus(p,delta),f=segmentFoot(q,a,b);if(f)consider(q,f,"edge");});
    stationaryPoint(a);stationaryPoint(b);stationaryPoint({x:(a.x+b.x)/2,y:(a.y+b.y)/2},"midpoint");
    for(const c of circles){const center=plus(c.center,delta),f=segmentFoot(center,a,b,false);if(!f)continue;const d=distance(center,f);if(d<1e-12)continue;const local=circularFoot(c,plus(f,inverse));if(local)consider(plus(local,delta),f,"curve");}
   });
   visitCircularEdges(g,region,c=>{
    points(shift(expand({minX:c.center.x-c.radius,minY:c.center.y-c.radius,maxX:c.center.x+c.radius,maxY:c.center.y+c.radius},tolerance),inverse),p=>{const q=plus(p,delta),f=circularFoot(c,q);if(f)consider(q,f,"curve");});
    stationaryPoint(c.center,"center");
    const localCenter=plus(c.center,inverse);edges(expand(box(localCenter),c.radius+tolerance),l=>{const f=segmentFoot(localCenter,l.a,l.b,false);if(!f)return;const q=plus(f,delta),p=circularFoot(c,q);if(p)consider(q,p,"curve");});
    for(const moving of circles){const mc=plus(moving.center,delta),d=distance(mc,c.center);if(d<1e-12)continue;const ux=(mc.x-c.center.x)/d,uy=(mc.y-c.center.y)/d;
     for(const side of[-1,1]){const p={x:c.center.x+ux*c.radius*side,y:c.center.y+uy*c.radius*side},q=circularFoot(moving,plus(p,inverse));if(circularFoot(c,p)&&q)consider(plus(q,delta),p,"curve");}
    }
   });
   visitSnaps(g,region,p=>stationaryPoint(p,p.kind));
  }
  // One local intersection query rather than one full CAD scan per moving grip.
  if(nearAnchor){const p=intersectionSnap(geometries,nearAnchor,tolerance,accept);if(p)consider(nearAnchor,p,"intersection",true);}
  return best;
 };
}
