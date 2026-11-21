import type {Annotation} from "./annotations";
import type {DrawingPoint as P} from "./savedView";
import {distance,measuredAngle,UNIT_METERS,type MeasurementUnit} from "./measurementGeometry";
export const isRadialDimension=(o:{kind:string})=>o.kind==="dimension-radius"||o.kind==="dimension-angle";
export function dimensionLabelPoint(o:Annotation):P|null {
  if(o.labelPoint)return o.labelPoint;
  if(o.kind==="dimension-radius"){
    const[c,p]=o.points,r=c&&p?distance(c,p):0;if(r<1e-9)return null;
    return{x:c.x+(p.x-c.x)*1.35,y:c.y+(p.y-c.y)*1.35};
  }
  if(o.kind==="dimension-angle"){
    const[a,c,b]=o.points;if(!a||!c||!b)return null;const la=distance(a,c),lb=distance(b,c);if(la<1e-9||lb<1e-9)return null;
    const start=Math.atan2(a.y-c.y,a.x-c.x),sweep=Math.atan2((a.x-c.x)*(b.y-c.y)-(a.y-c.y)*(b.x-c.x),(a.x-c.x)*(b.x-c.x)+(a.y-c.y)*(b.y-c.y)),angle=start+sweep/2,r=Math.min(la,lb)*.65;
    return{x:c.x+r*Math.cos(angle),y:c.y+r*Math.sin(angle)};
  }return null;
}
/** Only the label/arc position moves; the measured references remain fixed. */
export function positionRadialDimension(o:Annotation,target:P):Annotation|null {
  if(!isRadialDimension(o)||!Number.isFinite(target.x)||!Number.isFinite(target.y))return null;
  const center=o.points[o.kind==="dimension-angle"?1:0];if(distance(center,target)<1e-9)return null;
  if(o.kind==="dimension-radius")return{...o,labelPoint:{...target}};
  const base=dimensionLabelPoint({...o,labelPoint:undefined});if(!base)return null;
  const length=distance(center,base),r=distance(center,target);return{...o,labelPoint:{x:center.x+(base.x-center.x)*r/length,y:center.y+(base.y-center.y)*r/length}};
}
export function radialDimensionGeometry(o:Annotation,source:MeasurementUnit="drawing") {
  const label=dimensionLabelPoint(o);if(!label)return null;
  const textHeight=2.5*(o.scale??20)*(source==="drawing"?1:.001/UNIT_METERS[source]);
  const lines:P[][]=[],extensions:Array<[P,P]>=[],arrows:Array<{tip:P;tail:P}>=[];
  if(o.kind==="dimension-radius"){
    const[center,rim]=o.points,r=distance(center,rim);if(r<1e-9)return null;
    lines.push([center,rim],[rim,label]);arrows.push({tip:rim,tail:center});return{center,label,textHeight,value:r,lines,extensions,arrows};
  }
  if(o.kind==="dimension-angle"){
    const[a,center,b]=o.points,value=measuredAngle(o.points);if(value===null||value<1e-8)return null;
    const start=Math.atan2(a.y-center.y,a.x-center.x),sweep=Math.atan2((a.x-center.x)*(b.y-center.y)-(a.y-center.y)*(b.x-center.x),(a.x-center.x)*(b.x-center.x)+(a.y-center.y)*(b.y-center.y)),r=distance(center,label);if(r<1e-9)return null;
    const n=Math.max(12,Math.ceil(Math.abs(sweep)*48)),arc=Array.from({length:n+1},(_,i)=>({x:center.x+r*Math.cos(start+sweep*i/n),y:center.y+r*Math.sin(start+sweep*i/n)}));
    const headStep=Math.max(1,Math.ceil(n/5));lines.push(arc);extensions.push([center,arc[0]],[center,arc.at(-1)!]);arrows.push({tip:arc[0],tail:arc[headStep]},{tip:arc.at(-1)!,tail:arc[n-headStep]});return{center,label,textHeight,value,lines,extensions,arrows};
  }return null;
}
