import type { DrawingPoint as P } from "./savedView";
import type { SnapPoint } from "./measurementGeometry";
export type SplineInterpolator=(t:number,degree:number,points:number[][],knots?:number[]|null,weights?:number[]|null)=>number[];
type Vertex=P&{bulge?:number;startWidth?:number;endWidth?:number};
export type SnapEntity={type?:string;points?:P[];vertices?:Vertex[];controlPoints?:P[];degreeOfSplineCurve?:number;knotValues?:number[];weights?:number[];hatchStyle?:number;boundaryLoops?:Array<{type?:number;isExternal?:boolean;isOutermost?:boolean;polyline?:{vertices:Vertex[];isClosed?:boolean};edges?:Array<{type:number;start?:P;end?:P;radius?:number;startAngle?:number;endAngle?:number;isCcw?:boolean|number;controlPoints?:P[];degreeOfSplineCurve?:number;knotValues?:number[]}>}>};
const TAU=Math.PI*2,valid=(p:P|undefined):p is P=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
/** Feature coordinates, not tessellation vertices or control points. Rendering is unchanged. */
export function collectSnapFeatures(entity:SnapEntity,point:(p:P,kind:SnapPoint["kind"])=>void,line:(a:P,b:P)=>void,interpolate?:SplineInterpolator,angBase=0):boolean{
  let complete=true;
  const edge=(a:P,b:P)=>{if(!valid(a)||!valid(b)){complete=false;return;}point(a,"endpoint");point(b,"endpoint");point({x:(a.x+b.x)/2,y:(a.y+b.y)/2},"midpoint");line(a,b);};
  const bulge=(a:Vertex,b:Vertex)=>{
    if(!valid(a)||!valid(b)){complete=false;return;}
    const v=a.bulge??0;if(!Number.isFinite(v)){complete=false;return;}
    if(Math.abs(v)<1e-10){edge(a,b);return;}
    const chord=Math.hypot(b.x-a.x,b.y-a.y);if(chord<1e-12)return;
    const theta=4*Math.atan(v),r=chord*(1+v*v)/(4*Math.abs(v)),h=chord*(1-v*v)/(4*v),c={x:(a.x+b.x)/2-(b.y-a.y)/chord*h,y:(a.y+b.y)/2+(b.x-a.x)/chord*h},start=Math.atan2(a.y-c.y,a.x-c.x);
    point(a,"endpoint");point(b,"endpoint");point(c,"center");point({x:c.x+r*Math.cos(start+theta/2),y:c.y+r*Math.sin(start+theta/2)},"midpoint");
  };
  const spline=(e:{controlPoints?:P[];degreeOfSplineCurve?:number;knotValues?:number[];weights?:number[]})=>{
    const p=e.controlPoints,degree=e.degreeOfSplineCurve;
    if(!interpolate||!p||p.length<2||p.length>10000||!p.every(valid)||!Number.isInteger(degree)||degree!<1||degree!>=p.length){complete=false;return;}
    try{const values=p.map(v=>[v.x,v.y]);for(const t of[0,1]){const v=interpolate(t,degree!,values,e.knotValues,e.weights);const q={x:v[0],y:v[1]};if(!valid(q))throw Error();point(q,"endpoint");}}
    catch{complete=false;}
  };
  if(entity.type==="SPLINE"){spline(entity);return complete;}
  if(["SOLID","TRACE","3DFACE"].includes(entity.type??"")){
    // The pinned 3DFACE parser can append an empty fifth sentinel. The renderer
    // consumes only four vertices, in this same triangle-strip boundary order.
    let p=(entity.points??entity.vertices??[]).slice(0,4);if(p.length<3||!p.every(valid))return false;
    if(p.length===4)p=[p[0],p[1],p[3],p[2]];
    for(let i=0;i<p.length;i++)edge(p[i],p[(i+1)%p.length]);return complete;
  }
  if(entity.type!=="HATCH")return true;
  let loops=(entity.boundaryLoops??[]).filter(l=>l.polyline?(l.polyline.vertices.length>=3):l.edges?.some(e=>e.type!==1)||new Set(l.edges?.flatMap(e=>[e.start,e.end]).filter(valid).map(p=>`${p.x},${p.y}`)).size>=3);
  // Mirror the pinned renderer's boundary style filtering, including holes.
  loops=[...loops].sort((a,b)=>Number(!!b.isExternal)-Number(!!a.isExternal)||Number(!!b.isOutermost)-Number(!!a.isOutermost));
  if(entity.hatchStyle===2)loops=loops.slice(0,1);
  else if(entity.hatchStyle===1){const selected=loops.filter(l=>l.isExternal||l.isOutermost);if(selected.length)loops=selected;}
  for(const loop of loops){
    if(loop.polyline){const p=loop.polyline.vertices;for(let i=0;i<p.length;i++)bulge(p[i],p[(i+1)%p.length]);continue;}
    for(const e of loop.edges??[]){
      if(e.type===1){if(e.start&&e.end)edge(e.start,e.end);else complete=false;continue;}
      if(e.type===4){spline(e);continue;}
      if((e.type!==2&&e.type!==3)||!valid(e.start)||!Number.isFinite(e.radius)||e.radius!<=0){complete=false;continue;}
      let start=(e.startAngle??0)+angBase,end=(e.endAngle??TAU)+angBase;
      if(!Number.isFinite(start)||!Number.isFinite(end)){complete=false;continue;}
      // Same clockwise normalization as DxfScene._GenerateArcVertices.
      const ccw=e.isCcw??true;if(!ccw){const t=start;start=-end;end=-t;}
      const sweep=((end-start)%TAU+TAU)%TAU||TAU;
      const c=e.start,u=e.type===2?{x:e.radius!,y:0}:e.end;
      if(!valid(u)||Math.hypot(u.x,u.y)===0){complete=false;continue;}
      const v=e.type===2?{x:0,y:e.radius!}:{x:-u.y*e.radius!,y:u.x*e.radius!};
      const at=(t:number)=>{const a=start+(ccw?t:1-t)*sweep;return{x:c.x+u.x*Math.cos(a)+v.x*Math.sin(a),y:c.y+u.y*Math.cos(a)+v.y*Math.sin(a)};};
      point(c,"center");point(at(0),"endpoint");point(at(1),"endpoint");point(at(.5),"midpoint");
      if(Math.abs(sweep-TAU)<1e-8)for(let i=0;i<4;i++)point(at(i/4),"endpoint");
    }
  }
  return complete;
}
