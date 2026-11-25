import {segmentFoot} from './cadPicking';
import {circularPoint,type CircularEdge} from './circularSnap';
import {distance,type MeasurementGeometry,type SnapPoint} from './measurementGeometry';
import type {DrawingPoint as P} from './savedView';

export type SnapKind=SnapPoint['kind']|'edge'|'intersection'|'perpendicular'|'start'|'curve';
export type SnapTarget=
 |{type:'point';point:P;source?:MeasurementGeometry}
 |{type:'segment';a:P;b:P;source:MeasurementGeometry}
 |{type:'arc';arc:CircularEdge;source:MeasurementGeometry}
 |{type:'axis';anchor:P;direction:P;source?:undefined};
export type SnapCandidate={point:P;kind:SnapKind;target:SnapTarget;reach:number};

function project(target:SnapTarget,raw:P):P|null {
 if(target.type==='point')return target.point;
 if(target.type==='segment')return segmentFoot(raw,target.a,target.b);
 if(target.type==='arc')return circularPoint(target.arc,raw);
 const a=target.anchor,u=target.direction,t=(raw.x-a.x)*u.x+(raw.y-a.y)*u.y;
 return{x:a.x+t*u.x,y:a.y+t*u.y};
}
function same(a:SnapCandidate,b:SnapCandidate,epsilon:number):boolean {
 if(a.kind!==b.kind||a.target.type!==b.target.type||a.target.source!==b.target.source)return false;
 const x=a.target,y=b.target;
 if(x.type==='point'&&y.type==='point')return distance(x.point,y.point)<=epsilon;
 if(x.type==='segment'&&y.type==='segment')return distance(x.a,y.a)<=epsilon&&distance(x.b,y.b)<=epsilon||distance(x.a,y.b)<=epsilon&&distance(x.b,y.a)<=epsilon;
 if(x.type==='arc'&&y.type==='arc')return distance(x.arc.center,y.arc.center)<=epsilon&&Math.abs(x.arc.radius-y.arc.radius)<=epsilon&&x.arc.direction===y.arc.direction&&Math.abs(x.arc.start-y.arc.start)<1e-10&&Math.abs(x.arc.sweep-y.arc.sweep)<1e-10;
 return x.type==='axis'&&y.type==='axis'&&distance(x.anchor,y.anchor)<=epsilon&&distance(x.direction,y.direction)<1e-10;
}

/** Hysteresis changes target identity, never averages or delays the picked coordinates.
 * One cached segment/arc projection is constant work; the normal indexed search runs once. */
export class SnapStability {
 private held:SnapCandidate|null=null;
 private tolerance=0;
 reset():void{this.held=null;this.tolerance=0;}
 resolve(candidate:SnapCandidate|null,raw:P,tolerance:number,geometries:readonly MeasurementGeometry[],accept:(p:P,g?:MeasurementGeometry)=>boolean):SnapCandidate|null {
  if(!Number.isFinite(tolerance)||tolerance<=0||![raw.x,raw.y].every(Number.isFinite)){this.reset();return candidate;}
  if(this.tolerance!==tolerance)this.reset();this.tolerance=tolerance;
  const old=this.held,pixel=tolerance/18,previous=old?project(old.target,raw):null;
  const release=old?old.reach+Math.min(pixel*3,old.reach*.5):0;
  if(!old||!previous||old.target.source&&!geometries.includes(old.target.source)||!accept(previous,old.target.source)||distance(previous,raw)>release){this.held=candidate;return candidate;}
  const retained={...old,point:previous};
  if(!candidate){this.held=retained;return retained;}
  if(same(old,candidate,tolerance*1e-8)){this.held=candidate;return candidate;}
  const continuous=(s:SnapCandidate)=>s.kind==='edge'||s.kind==='curve';
  // A deliberately approached characteristic point still wins over a moving edge.
  if(continuous(old)&&!continuous(candidate)&&distance(raw,candidate.point)<=candidate.reach){this.held=candidate;return candidate;}
  if(!continuous(old)&&continuous(candidate)){this.held=retained;return retained;}
  const separation=distance(previous,candidate.point),margin=Math.min(pixel*2.5,separation*.4);
  if(distance(raw,candidate.point)+margin<distance(raw,previous)){this.held=candidate;return candidate;}
  this.held=retained;return retained;
 }
}
