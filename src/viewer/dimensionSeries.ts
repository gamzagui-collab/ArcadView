import type {Annotation} from "./annotations";
import {dimensionTextHeight} from "./dimensionSizing";
import type {MeasurementUnit} from "./measurementGeometry";
import type {DrawingPoint as P} from "./savedView";

export type DimensionAxis="x"|"y";
export type DimensionSeriesMode="chain"|"baseline";
export type DimensionSeries={id:string;mode:DimensionSeriesMode;index:number;origin:number;side:1|-1};
export const seriesAxis=(points:readonly P[],axis:DimensionAxis|"auto"):DimensionAxis=>axis!=="auto"?axis:Math.abs(points[1].x-points[0].x)>=Math.abs(points[1].y-points[0].y)?"x":"y";

/** Members remain ordinary editable, durable linear dimensions. */
export function createDimensionSeries(template:Annotation,points:readonly P[],mode:DimensionSeriesMode,axis:DimensionAxis|"auto",side:1|-1=1):Annotation[] {
  if(points.length<2)return[];
  const direction=seriesAxis(points,axis),cross=direction==="x"?"y":"x";
  const origin=side===1?Math.max(...points.map(p=>p[cross])):Math.min(...points.map(p=>p[cross]));
  const members:Annotation[]=points.slice(1).map((b,index)=>{
    const a=points[mode==="baseline"?0:index];
    return {...template,id:`${template.id}:${index}`,kind:"dimension-linear",points:[a,b,{x:(a.x+b.x)/2,y:(a.y+b.y)/2}],dimensionAxis:direction,dimensionSeries:{id:template.id,mode,index,origin,side},labelPoint:undefined,textPoint:undefined};
  });
  return members.some(o=>Math.abs(o.points[1][direction]-o.points[0][direction])<1e-9)?[]:reflowDimensionSeries(members);
}

/** The largest text sets the group's spacing; unrelated objects retain identity. */
export function reflowDimensionSeries(objects:Annotation[],source:MeasurementUnit="drawing"):Annotation[] {
  const heights=new Map<string,number>();
  for(const o of objects)if(o.dimensionSeries)heights.set(o.dimensionSeries.id,Math.max(heights.get(o.dimensionSeries.id)??0,dimensionTextHeight(o,source)));
  return objects.map(o=>{
    const s=o.dimensionSeries;if(!s)return o;
    const height=heights.get(s.id)!,offset=s.origin+s.side*height*(3+(s.mode==="baseline"?s.index*2:0));
    const [a,b]=o.points,point=o.dimensionAxis==="x"?{x:(a.x+b.x)/2,y:offset}:{x:offset,y:(a.y+b.y)/2};
    return {...o,points:[a,b,point],labelPoint:undefined};
  });
}

/** Manual placement detaches a member from automatic placement, preserving its axis. */
export function detachDimensionSeries(o:Annotation):Annotation {
  if(!o.dimensionSeries)return o;
  const {dimensionSeries:_,...next}=o;return next;
}
