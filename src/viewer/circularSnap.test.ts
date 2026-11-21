import {expect,it} from "vitest";
import {snapToCircularEdge} from "./circularSnap";
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
