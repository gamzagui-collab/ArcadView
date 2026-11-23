import{annotationPoints,isDimensionTool,isPointAnnotation,textBounds,translateAnnotation,type Annotation}from"./annotations";
import{normAngle,pointDistance,rectangleCorners,rotatePoint,TAU}from"./curveGeometry";
import type{DrawingPoint as P}from"./savedView";
import{isRadialDimension,radialDimensionGeometry}from"./radialDimensions";
import{dimensionPosition,positionDimension}from"./dimensionPlacement";
import{detachDimensionSeries}from"./dimensionSeries";
export type Grip={id:string;point:P};
/** A placement grip sits below the label; its drag still uses the logical anchor. */
export function gripScreenPosition(grip:Grip,project:(p:readonly P[])=>P[]):P {
 const p=project([grip.point])[0];return grip.id==="dimension-position"?{x:p.x,y:p.y+12}:p;
}
/** Moving an existing dimension label changes no measured value. */
export const canPositionObject=(o:Annotation,hasAccess:(tool:string)=>boolean,positionOnly=true):boolean=>positionOnly&&isDimensionTool(o.kind)||hasAccess("edit.reshape");
const rectangular=(o:Annotation)=>["rectangle","point-rectangle","point-cloud"].includes(o.kind);
export function objectGrips(o:Annotation):Grip[]{
 if(o.kind==="mask")return[];
 if(isRadialDimension(o))return[];
 if(isDimensionTool(o.kind)){const point=dimensionPosition(o);return[...o.points.slice(0,2).map((point,i)=>({id:`vertex:${i}`,point})),...(point?[{id:"dimension-position",point}]:[])];}
 if(rectangular(o))return rectangleCorners(o).map((point,i)=>({id:`corner:${i}`,point}));
 if(o.kind==="circle"||o.kind==="point-circle"){
  const c=o.points[0],r=pointDistance(c,o.points[1]);return[{id:"center",point:c},...[0,1,2,3].map(i=>({id:`radius:${i}`,point:{x:c.x+r*Math.cos(i*Math.PI/2),y:c.y+r*Math.sin(i*Math.PI/2)}}))];
 }
 if(o.kind==="arc"){
  const c=o.points[0],r=pointDistance(c,o.points[1]),start=o.start??0,sweep=o.sweep??TAU,at=(a:number)=>({x:c.x+r*Math.cos(a),y:c.y+r*Math.sin(a)});
  return[{id:"center",point:c},{id:"arc-start",point:at(start)},{id:"arc-end",point:at(start+sweep)},{id:"arc-radius",point:at(start+sweep/2)}];
 }
 const closed=o.points.length>2&&pointDistance(o.points[0],o.points.at(-1)!)<1e-9,n=closed?o.points.length-1:o.points.length;
 return o.points.slice(0,n).map((point,i)=>({id:`vertex:${i}`,point}));
}
export function reshapeObject(o:Annotation,grip:string,target:P):Annotation|null{
 if(!Number.isFinite(target.x)||!Number.isFinite(target.y)||o.kind==="mask")return null;
 if(grip==="dimension-position")return positionDimension(o,target);
 o=detachDimensionSeries(o);
 if(grip==="center")return translateAnnotation(o,o.points[0],target);
 if(rectangular(o)&&grip.startsWith("corner:")){
  const p=rectangleCorners(o),i=+grip.split(":")[1],opposite=(i+2)%4,a=p[opposite],b=p[(opposite+1)%4],c=p[(opposite+3)%4],l=pointDistance(a,b),m=pointDistance(a,c);if(!l||!m)return null;
  const u={x:(b.x-a.x)/l,y:(b.y-a.y)/l},v={x:(c.x-a.x)/m,y:(c.y-a.y)/m},dx=target.x-a.x,dy=target.y-a.y,x=dx*u.x+dy*u.y,y=dx*v.x+dy*v.y;
  if(x<=1e-9||y<=1e-9)return null;
  const next=p.map(p=>({...p}));next[i]={x:a.x+u.x*x+v.x*y,y:a.y+u.y*x+v.y*y};next[(opposite+1)%4]={x:a.x+u.x*x,y:a.y+u.y*x};next[(opposite+3)%4]={x:a.x+v.x*y,y:a.y+v.y*y};return{...o,points:next};
 }
 if(grip.startsWith("radius:")||grip==="arc-radius"){
  const c=o.points[0],r=pointDistance(c,target);if(r<1e-9)return null;return{...o,points:[c,{x:c.x+r,y:c.y}]};
 }
 if(grip==="arc-start"||grip==="arc-end"){
  const c=o.points[0];if(pointDistance(c,target)<1e-9)return null;const angle=Math.atan2(target.y-c.y,target.x-c.x),start=o.start??0,end=start+(o.sweep??TAU),sweep=grip==="arc-start"?normAngle(end-angle):normAngle(angle-start);if(sweep<1e-8)return null;
  return{...o,start:grip==="arc-start"?angle:start,sweep};
 }
 if(grip.startsWith("vertex:")){
  const i=+grip.split(":")[1];if(!o.points[i])return null;const closed=o.points.length>2&&pointDistance(o.points[0],o.points.at(-1)!)<1e-9,points=o.points.map((p,j)=>j===i||closed&&i===0&&j===o.points.length-1?{...target}:p);
  if(points.length>1&&points.some((p,j)=>j>0&&pointDistance(p,points[j-1])<1e-9))return null;
  return{...o,points,...(o.curved?{curved:false,approximate:true}:{})};
 }return null;
}
export function rotateObject(o:Annotation,center:P,degrees:number):Annotation{
 if(o.kind==="mask")throw Error("Erasures cannot rotate independently");
 if(!Number.isFinite(degrees)||!Number.isInteger(degrees))throw Error("Rotation requires integer degrees");
 if(degrees%360===0)return o;
 o=detachDimensionSeries(o);
 const points=(rectangular(o)?rectangleCorners(o):o.points).map(p=>rotatePoint(p,center,degrees)),next={...o,points,...(o.labelPoint?{labelPoint:rotatePoint(o.labelPoint,center,degrees)}:{}),...(o.textPoint?{textPoint:rotatePoint(o.textPoint,center,degrees)}:{})};
 if(o.kind==="arc")next.start=normAngle((o.start??0)+degrees*Math.PI/180);
 if(o.kind==="text"||o.kind==="dimension-linear")next.rotation=(((o.rotation??0)+degrees)%360+360)%360;
 return next;
}
export function rotationReference(o:Annotation,center:P):P|null{return objectGrips(o).map(g=>g.point).find(p=>pointDistance(p,center)>1e-8)??null;}
export function rotationDegrees(center:P,reference:P,target:P):number|null{
 const a={x:reference.x-center.x,y:reference.y-center.y},b={x:target.x-center.x,y:target.y-center.y};if(Math.hypot(a.x,a.y)<1e-9||Math.hypot(b.x,b.y)<1e-9)return null;
 return Math.round(normAngle(Math.atan2(a.x*b.y-a.y*b.x,a.x*b.x+a.y*b.y))*180/Math.PI)%360;
}
export function selectionPoints(o:Annotation):P[]{
 if(isRadialDimension(o)){const g=radialDimensionGeometry(o);if(g)return[...g.lines.flat(),g.label];}
 if(rectangular(o))return rectangleCorners(o);
 if(o.kind==="point-circle"){const[c,p]=o.points,r=pointDistance(c,p);return[{x:c.x-r,y:c.y-r},{x:c.x+r,y:c.y+r}];}
 if(o.kind==="text"){const b=textBounds(o);return[{x:b.minX,y:b.minY},{x:b.maxX,y:b.maxY}];}
 return isPointAnnotation(o)?o.points:annotationPoints(o);
}
export function moveHandlePosition(o:Annotation,project:(p:readonly P[])=>P[],width:number,height:number):P|null{
 if(isDimensionTool(o.kind)){const label=dimensionPosition(o);if(!label)return null;const p=project([label])[0];return{x:Math.max(22,Math.min(width-22,p.x)),y:Math.max(22,Math.min(height-112,p.y+30))};}
 const p=project(selectionPoints(o)),x=p.map(p=>p.x),y=p.map(p=>p.y),minX=Math.min(...x),maxX=Math.max(...x),minY=Math.min(...y),maxY=Math.max(...y);
 if(maxX<0||minX>width||maxY<0||minY>height)return null;
 return{x:Math.max(22,Math.min(width-22,(Math.max(0,minX)+Math.min(width,maxX))/2)),y:Math.max(22,Math.min(height-112,maxY+30))};
}
