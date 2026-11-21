import {dimensionGeometry,type Annotation} from "./annotations";
import {dimensionLabelPoint,isRadialDimension,positionRadialDimension} from "./radialDimensions";
import type {DrawingPoint as P} from "./savedView";

/** Position of the completed dimension, independent of its measurement references. */
export function dimensionPosition(o:Annotation):P|null{
  if(isRadialDimension(o))return dimensionLabelPoint(o);
  if(o.kind!=="dimension-aligned"&&o.kind!=="dimension-linear")return null;
  const g=dimensionGeometry(o,"drawing");
  return g?{x:g.first.x+(g.second.x-g.first.x)/2,y:g.first.y+(g.second.y-g.first.y)/2}:null;
}
export function positionDimension(o:Annotation,target:P):Annotation|null{
  if(!Number.isFinite(target.x)||!Number.isFinite(target.y))return null;
  if(isRadialDimension(o))return positionRadialDimension(o,target);
  // Store only the constrained dimension-line midpoint. Never replace any picked reference.
  const labelPoint=dimensionPosition({...o,labelPoint:target});
  return labelPoint?{...o,labelPoint}:null;
}
