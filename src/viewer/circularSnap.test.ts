import {expect,it} from "vitest";
import {snapToCircularEdge,pickCircularEdge,closestCircularPoint} from "./circularSnap";
import {buildMeasurementGeometry,nearestSnap,type MeasurementGeometry} from "./measurementGeometry";
import {nearestPackedSnap} from "./packedMeasurement";
const geometry=(packed:boolean,arc=false):MeasurementGeometry=>buildMeasurementGeometry({entities:[{type:arc?"ARC":"CIRCLE",center:{x:1e9,y:1e9},radius:500,...(arc?{startAngle:350*Math.PI/180,endAngle:40*Math.PI/180}:{})}]},{},undefined,packed);
it("snaps arbitrary positions to the analytic circle rather than its sampled chords in packed and regular drawings",()=>{
 for(const packed of [false,true]){
  const g=geometry(packed),angle=23.1*Math.PI/180,target={x:1e9+502*Math.cos(angle),y:1e9+502*Math.sin(angle)},snap=snapToCircularEdge(g,{x:1e9,y:1e9},target,3)!;
  expect(Math.hypot(snap.x-1e9,snap.y-1e9)).toBeCloseTo(500,5);
  expect(snapToCircularEdge(g,{x:1e9+20,y:1e9},target,3)).toBeNull();
  expect(snapToCircularEdge(g,{x:1e9,y:1e9},target,1)).toBeNull();
  expect(snapToCircularEdge(g,{x:1e9,y:1e9},target,3,()=>false)).toBeNull();
 }
});
it("retains an arc's angular range across zero and does not snap to the missing half",()=>{
 for(const packed of [false,true]){const g=geometry(packed,true),c={x:1e9,y:1e9},a=23*Math.PI/180;
  expect(snapToCircularEdge(g,c,{x:c.x+501*Math.cos(a),y:c.y+501*Math.sin(a)},3)).not.toBeNull();
  expect(snapToCircularEdge(g,c,{x:c.x-500,y:c.y},10)).toBeNull();
 }
});
it("can prioritize the exact arc center while retaining all ordinary endpoint snap behavior",()=>{
 for(const packed of [false,true]){const g=geometry(packed,true),c={x:1e9,y:1e9},target={x:c.x+.1,y:c.y+.2};
  const snapped=packed?nearestPackedSnap(g.packed!,target,1,'center'):nearestSnap(g.snaps,target,1,'center');
  expect(snapped).toEqual({...c,kind:'center'});
 }
});
it.each([false,true])('selects an actual circle or finite arc edge without asking for its center (packed=%s)',packed=>{
 const c={x:1e9,y:1e9},circle=geometry(packed),arc=geometry(packed,true),a=.2,target={x:c.x+503*Math.cos(a),y:c.y+503*Math.sin(a)};
 for(const g of [circle,arc]){const hit=pickCircularEdge([g],target,5)!;expect(hit.arc.center.x).toBeCloseTo(c.x,5);expect(hit.arc.radius).toBeCloseTo(500,5);expect(Math.hypot(hit.point.x-c.x,hit.point.y-c.y)).toBeCloseTo(500,5);expect(pickCircularEdge([g],c,5)).toBeNull();expect(pickCircularEdge([g],target,5,()=>false)).toBeNull();}
 expect(pickCircularEdge([arc],{x:c.x-500,y:c.y},10)).toBeNull();
 const angle=40*Math.PI/180+.003,end=pickCircularEdge([arc],{x:c.x+500*Math.cos(angle),y:c.y+500*Math.sin(angle)},5)!;
 expect(end.point.x).toBeCloseTo(c.x+500*Math.cos(40*Math.PI/180),5);
 expect(pickCircularEdge([buildMeasurementGeometry({entities:[{type:'LINE',vertices:[c,target]}]}as any,{},undefined,packed)],target,18)).toBeNull();
});
it('keeps a placed leader on the finite arc rather than its missing circle section',()=>{
 const arc={center:{x:0,y:0},radius:50,start:0,sweep:Math.PI/2,direction:1 as const};
 expect(closestCircularPoint(arc,{x:-100,y:100}).x).toBeCloseTo(0,8);expect(closestCircularPoint(arc,{x:-100,y:100}).y).toBeCloseTo(50,8);
});
it('does not label a non-uniformly scaled circle as a circular radius',()=>{
 for(const packed of [false,true]){const g=buildMeasurementGeometry({blocks:{round:{name:'round',position:{x:0,y:0},entities:[{type:'CIRCLE',center:{x:0,y:0},radius:500}]}},entities:[{type:'INSERT',name:'round',position:{x:0,y:0},xScale:2,yScale:1}]}as any,{},undefined,packed);expect(pickCircularEdge([g],{x:1000,y:0},10)).toBeNull();}
});
