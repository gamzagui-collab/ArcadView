import type {DrawingPoint as P} from "./savedView";
export const TAU=Math.PI*2;
export const normAngle=(n:number)=>((n%TAU)+TAU)%TAU;
export const pointDistance=(a:P,b:P)=>Math.hypot(b.x-a.x,b.y-a.y);
export type CurveShape={kind:string;points:P[];start?:number;sweep?:number;curved?:boolean};
export type Primitive={kind:"line";a:P;b:P;from:number;to:number}|{kind:"arc";center:P;radius:number;start:number;sweep:number;direction:1|-1;from:number;to:number};
export function rectangleCorners(o:CurveShape):P[]{const[a,b]=o.points;return o.points.length===4?o.points:[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];}
export function rotatePoint(p:P,center:P,degrees:number):P{
 const n=((degrees%360)+360)%360,q=n/90,angle=n*Math.PI/180;
 const cos=Number.isInteger(q)?[1,0,-1,0][q]:Math.cos(angle),sin=Number.isInteger(q)?[0,1,0,-1][q]:Math.sin(angle),x=p.x-center.x,y=p.y-center.y;
 return{x:center.x+x*cos-y*sin,y:center.y+x*sin+y*cos};
}
/** Work relative to the first point to avoid squaring large drawing origins. */
export function circleThrough(a:P,b:P,c:P):{center:P;radius:number}|null{
 const u={x:b.x-a.x,y:b.y-a.y},v={x:c.x-a.x,y:c.y-a.y},cross=u.x*v.y-u.y*v.x,scale=Math.hypot(u.x,u.y)*Math.hypot(v.x,v.y);
 if(!scale||Math.abs(cross)<scale*1e-9)return null;
 const u2=u.x*u.x+u.y*u.y,v2=v.x*v.x+v.y*v.y,center={x:a.x+(u2*v.y-v2*u.y)/(2*cross),y:a.y+(u.x*v2-v.x*u2)/(2*cross)},radius=pointDistance(center,a);
 return Number.isFinite(radius)&&radius>1e-9?{center,radius}:null;
}
function arcRun(points:P[],from:number):Extract<Primitive,{kind:"arc"}>|null{
 if(from+4>=points.length)return null;
 const c=circleThrough(points[from],points[from+2],points[from+4]);if(!c)return null;
 const epsilon=Math.max(c.radius*1e-7,Number.EPSILON*Math.max(Math.abs(c.center.x),Math.abs(c.center.y),1)*64),angle=(p:P)=>Math.atan2(p.y-c.center.y,p.x-c.center.x);
 let previous=angle(points[from]),step=0,sweep=0,to=from;
 for(let i=from+1;i<points.length;i++){
  if(Math.abs(pointDistance(points[i],c.center)-c.radius)>epsilon)break;
  const next=angle(points[i]),delta=Math.atan2(Math.sin(next-previous),Math.cos(next-previous));
  // An exact extension may end between samples. All points must stay on the
  // same circle and advance in one direction; their angular spacing may vary.
  if(Math.abs(delta)<1e-9||Math.abs(delta)>Math.PI/2||i>from+1&&Math.sign(delta)!==Math.sign(step))break;
  if(i===from+1)step=delta;sweep+=Math.abs(delta);previous=next;to=i;
 }
 if(to-from<4)return null;
 return{kind:"arc",...c,start:angle(points[from]),sweep,direction:step>0?1:-1,from,to};
}
/** Only marked circular CAD polylines are fitted; ordinary drawn polygons stay lines. */
export function shapePrimitives(o:CurveShape):Primitive[]{
 if(o.kind==="circle"||o.kind==="arc")return[{kind:"arc",center:o.points[0],radius:pointDistance(o.points[0],o.points[1]),start:o.start??0,sweep:o.kind==="circle"?TAU:o.sweep??TAU,direction:1,from:0,to:1}];
 const rectangular=o.kind==="rectangle"||o.kind==="point-rectangle"||o.kind==="point-cloud",p=rectangular?rectangleCorners(o):o.points;
 const points=rectangular?[...p,p[0]]:p,result:Primitive[]=[];
 for(let i=0;i<points.length-1;){const arc=o.curved?arcRun(points,i):null;if(arc){result.push(arc);i=arc.to;}else{result.push({kind:"line",a:points[i],b:points[i+1],from:i,to:i+1});i++;}}
 return result;
}
export function curveLength(o:CurveShape):number{return shapePrimitives(o).reduce((n,p)=>n+(p.kind==="line"?pointDistance(p.a,p.b):p.radius*p.sweep),0);}
export function onArc(arc:Extract<Primitive,{kind:"arc"}>,p:P,epsilon=1e-8):boolean{return arc.sweep>=TAU-epsilon||normAngle((Math.atan2(p.y-arc.center.y,p.x-arc.center.x)-arc.start)*arc.direction)<=arc.sweep+epsilon;}
