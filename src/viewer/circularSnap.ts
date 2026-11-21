import type {DrawingBounds,DrawingPoint as P} from "./savedView";
import type {MeasurementGeometry,MeasurableEntity} from "./measurementGeometry";
import {circleThrough,normAngle,TAU} from "./curveGeometry";
import type {PackedMeasurement} from "./packedMeasurement";
const CHUNK=16384;
const circularIndices=new WeakMap<PackedMeasurement,Uint32Array>();
function indices(p:PackedMeasurement):Uint32Array {
  const cached=circularIndices.get(p);if(cached)return cached;
  const circular=(i:number)=>{const d=p.refs[Math.floor(i/CHUNK)],kind=p.kinds[d[i%CHUNK*3+2]];return kind==="CIRCLE"||kind==="ARC";};
  let n=0;for(let i=0;i<p.entityCount;i++)if(circular(i))n++;
  const result=new Uint32Array(n);n=0;for(let i=0;i<p.entityCount;i++)if(circular(i))result[n++]=i;
  circularIndices.set(p,result);return result;
}
export type CircularEdge={center:P;radius:number;start:number;sweep:number;direction:1|-1};
function circle(kind:string,bounds:MeasurableEntity["bounds"],length:number,points:P[]):CircularEdge|null {
  if(kind==="CIRCLE")return{center:{x:(bounds.minX+bounds.maxX)/2,y:(bounds.minY+bounds.maxY)/2},radius:length/TAU,start:0,sweep:TAU,direction:1};
  if(points.length<3)return null;
  const[a,b,c]=points,fit=circleThrough(a,b,c);if(!fit)return null;
  const start=Math.atan2(a.y-fit.center.y,a.x-fit.center.x),end=Math.atan2(c.y-fit.center.y,c.x-fit.center.x),mid=Math.atan2(b.y-fit.center.y,b.x-fit.center.x),ccw=normAngle(end-start),direction=normAngle(mid-start)<=ccw+1e-8?1:-1;
  return{...fit,start,sweep:direction===1?ccw:normAngle(start-end),direction};
}
/** Only circular entities near the pointer are sampled. Packed DWGs stay packed. */
export function snapToCircularEdge(g:MeasurementGeometry,anchor:P,target:P,tolerance:number,accept:(p:P)=>boolean=()=>true):P|null {
  let best=tolerance,found:P|null=null;
  const visit=(arc:CircularEdge|null)=>{
    if(!arc||!Number.isFinite(arc.radius)||arc.radius<=0)return;
    const epsilon=Math.max(arc.radius*1e-7,Number.EPSILON*Math.max(1,Math.abs(arc.center.x),Math.abs(arc.center.y))*64,tolerance*1e-6);
    if(Math.hypot(anchor.x-arc.center.x,anchor.y-arc.center.y)>epsilon)return;
    const dx=target.x-arc.center.x,dy=target.y-arc.center.y,length=Math.hypot(dx,dy);if(length<1e-12)return;
    const angle=Math.atan2(dy,dx),along=normAngle(arc.direction*(angle-arc.start));
    if(arc.sweep<TAU-1e-8&&along>arc.sweep+1e-8)return;
    const p={x:arc.center.x+dx/length*arc.radius,y:arc.center.y+dy/length*arc.radius},d=Math.hypot(target.x-p.x,target.y-p.y);
    if(d<=best&&accept(p)){best=d;found=p;}
  };
  visitCircularEdges(g,{minX:target.x-tolerance,minY:target.y-tolerance,maxX:target.x+tolerance,maxY:target.y+tolerance},visit);
  return found;
}

/** Analytic circles/arcs near a box; retain the packed DWG and cache only circular IDs. */
export function visitCircularEdges(g:MeasurementGeometry,box:DrawingBounds,callback:(arc:CircularEdge)=>void):void {
  const visit=(arc:CircularEdge|null)=>{if(arc&&Number.isFinite(arc.radius)&&arc.radius>0)callback(arc);};
  const nearby=(b:MeasurableEntity["bounds"])=>box.maxX>=b.minX&&box.minX<=b.maxX&&box.maxY>=b.minY&&box.minY<=b.maxY;
  if(g.packed){const p=g.packed;
    const point=(i:number):P=>{const d=p.points[Math.floor(i/CHUNK)],k=i%CHUNK*2;return{x:d[k],y:d[k+1]};};
    for(const i of indices(p)){
      const ref=p.refs[Math.floor(i/CHUNK)],rk=i%CHUNK*3,kind=p.kinds[ref[rk+2]];if(kind!=="CIRCLE"&&kind!=="ARC")continue;
      const d=p.data[Math.floor(i/CHUNK)],k=i%CHUNK*7;if(d[k+6])continue;
      const bounds={minX:d[k],minY:d[k+1],maxX:d[k+2],maxY:d[k+3]};if(!nearby(bounds))continue;
      const from=ref[rk],count=ref[rk+1];visit(circle(kind,bounds,d[k+4],kind==="ARC"&&count>=3?[point(from),point(from+Math.floor((count-1)/2)),point(from+count-1)]:[]));
    }
  }else for(const e of g.entities){if(e.approximate||!['CIRCLE','ARC'].includes(e.kind)||!nearby(e.bounds))continue;visit(circle(e.kind,e.bounds,e.length,e.kind==="ARC"&&e.points.length>=3?[e.points[0],e.points[Math.floor((e.points.length-1)/2)],e.points.at(-1)!]:[]));}
}
