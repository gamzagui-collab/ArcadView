import type{Annotation}from"./annotations";
import{normAngle,onArc,pointDistance,shapePrimitives,TAU,type Primitive}from"./curveGeometry";
import type{DrawingPoint as P}from"./savedView";
type Arc=Extract<Primitive,{kind:"arc"}>;
const cross=(a:P,b:P)=>a.x*b.y-a.y*b.x;
const circleLine=(arc:Arc,a:P,b:P,segment:boolean):P[]=>{
 const dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);if(l<1e-10)return[];
 const x=a.x-arc.center.x,y=a.y-arc.center.y,ux=dx/l,uy=dy/l,along=-(x*ux+y*uy),perp=x*uy-y*ux,h2=arc.radius**2-perp**2,epsilon=Number.EPSILON*Math.max(1,arc.radius**2)*64;
 if(h2< -epsilon)return[];const h=Math.sqrt(Math.max(0,h2));return[along-h,along+h].filter(t=>!segment||t>=-1e-8&&t<=l+1e-8).map(t=>({x:a.x+t*ux,y:a.y+t*uy}));
};
function circleCircle(a:Arc,b:Arc):P[]{
 const dx=b.center.x-a.center.x,dy=b.center.y-a.center.y,d=Math.hypot(dx,dy);if(d<1e-9||d>a.radius+b.radius+1e-8||d<Math.abs(a.radius-b.radius)-1e-8)return[];
 const along=((a.radius-b.radius)*(a.radius+b.radius)+d*d)/(2*d),h2=(a.radius-along)*(a.radius+along);if(h2< -Number.EPSILON*Math.max(1,a.radius*a.radius)*64)return[];const h=Math.sqrt(Math.max(0,h2)),x=a.center.x+dx*along/d,y=a.center.y+dy*along/d;
 return[{x:x-dy*h/d,y:y+dx*h/d},{x:x+dy*h/d,y:y-dx*h/d}];
}
export function extendToBoundary(target:Annotation,boundary:Annotation,pick:P):Annotation|null{
 if(target.id===boundary.id||target.approximate||boundary.approximate||!["polyline","arc"].includes(target.kind)||!["polyline","rectangle","circle","arc"].includes(boundary.kind)||target.points.length>3000||boundary.points.length>3000)return null;
 if(target.kind==="polyline"&&pointDistance(target.points[0],target.points.at(-1)!)<1e-9)return null;
 const parts=shapePrimitives(target),boundaries=shapePrimitives(boundary);if(!parts.length||!boundaries.length)return null;
 const ends=target.kind==="arc"?[{x:target.points[0].x+pointDistance(...target.points as[P,P])*Math.cos(target.start??0),y:target.points[0].y+pointDistance(...target.points as[P,P])*Math.sin(target.start??0)},{x:target.points[0].x+pointDistance(...target.points as[P,P])*Math.cos((target.start??0)+(target.sweep??TAU)),y:target.points[0].y+pointDistance(...target.points as[P,P])*Math.sin((target.start??0)+(target.sweep??TAU))}]:[target.points[0],target.points.at(-1)!];
 const first=pointDistance(pick,ends[0])<pointDistance(pick,ends[1]),part=first?parts[0]:parts.at(-1)!,end=first?ends[0]:ends[1];let best=Infinity,found:P|null=null;
 if(part.kind==="line"){
  const other=first?part.b:part.a,l=pointDistance(end,other);if(l<1e-10)return null;const dir={x:(end.x-other.x)/l,y:(end.y-other.y)/l};
  for(const bound of boundaries){
   let candidates:P[]=[];
   if(bound.kind==="arc")candidates=circleLine(bound,end,{x:end.x+dir.x,y:end.y+dir.y},false).filter(p=>onArc(bound,p));
   else{const v={x:bound.b.x-bound.a.x,y:bound.b.y-bound.a.y},den=cross(dir,v);if(Math.abs(den)>Math.hypot(v.x,v.y)*1e-12){const delta={x:bound.a.x-end.x,y:bound.a.y-end.y},t=cross(delta,v)/den,u=cross(delta,dir)/den;if(u>=-1e-9&&u<=1+1e-9)candidates=[{x:end.x+dir.x*t,y:end.y+dir.y*t}];}}
   for(const p of candidates){const t=(p.x-end.x)*dir.x+(p.y-end.y)*dir.y;if(Number.isFinite(t)&&t>1e-8&&t<=1e12&&t<best){best=t;found=p;}}
  }
  if(!found)return null;return{...target,points:target.points.map((p,i)=>i===(first?0:target.points.length-1)?found!:p)};
 }
 const direction=part.direction*(first?-1:1),endAngle=Math.atan2(end.y-part.center.y,end.x-part.center.x),remaining=TAU-part.sweep;
 for(const bound of boundaries){const candidates=bound.kind==="line"?circleLine(part,bound.a,bound.b,true):circleCircle(part,bound).filter(p=>onArc(bound,p));
  for(const p of candidates){const delta=normAngle((Math.atan2(p.y-part.center.y,p.x-part.center.x)-endAngle)*direction);if(delta>1e-8&&delta<=remaining+1e-8&&delta<best){best=delta;found=p;}}
 }
 if(!found)return null;
 if(target.kind==="arc")return{...target,start:first?normAngle((target.start??0)-best):target.start,sweep:Math.min(TAU,(target.sweep??TAU)+best)};
 const n=Math.max(1,Math.ceil(best/(Math.PI/90))),more=Array.from({length:n},(_,i)=>{const angle=endAngle+direction*best*(i+1)/n;return i===n-1?found!:{x:part.center.x+part.radius*Math.cos(angle),y:part.center.y+part.radius*Math.sin(angle)};});
 return{...target,curved:true,points:first?[...more.reverse(),...target.points]:[...target.points,...more]};
}
