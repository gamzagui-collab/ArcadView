import {dimensionGeometry,type Annotation} from "./annotations";
import {dimensionLabelPoint,isRadialDimension,positionRadialDimension} from "./radialDimensions";
import type {DrawingPoint as P} from "./savedView";
import {detachDimensionSeries} from "./dimensionSeries";

/** Position of the completed dimension, independent of its measurement references. */
export function dimensionPosition(o:Annotation):P|null{
  if(isRadialDimension(o))return dimensionLabelPoint(o);
  if(o.kind!=="dimension-aligned"&&o.kind!=="dimension-linear")return null;
  const g=dimensionGeometry(o,"drawing");
  return g?{x:g.first.x+(g.second.x-g.first.x)/2,y:g.first.y+(g.second.y-g.first.y)/2}:null;
}
export function positionDimension(o:Annotation,target:P):Annotation|null{
  if(!Number.isFinite(target.x)||!Number.isFinite(target.y))return null;
  o=detachDimensionSeries(o);
  if(isRadialDimension(o)){const next=positionRadialDimension(o,target);return next?followDimensionText(o,next):null;}
  // Store only the constrained dimension-line midpoint. Never replace any picked reference.
  const labelPoint=dimensionPosition({...o,labelPoint:target});
  return labelPoint?followDimensionText(o,{...o,labelPoint}):null;
}

function followDimensionText(before:Annotation,after:Annotation):Annotation{
 if(!before.textPoint)return after;const a=dimensionPosition(before),b=dimensionPosition(after);if(!a||!b)return after;
 return{...after,textPoint:{x:before.textPoint.x+(b.x-a.x),y:before.textPoint.y+(b.y-a.y)}};
}
export function dimensionTextPosition(o:Annotation):P|null{return o.textPoint??dimensionPosition(o);}
export function positionDimensionText(o:Annotation,target:P):Annotation|null{
 if(!Number.isFinite(target.x)||!Number.isFinite(target.y)||!dimensionPosition(o))return null;
 return{...o,textPoint:{...target}};
}
