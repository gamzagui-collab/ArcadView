import {expect,it}from'vitest';
import {buildMeasurementGeometry}from'./measurementGeometry';
import {referenceDirections,rightAngleCorners}from'./rightAngles';
import {endpointPerpendicularSnap}from'./perpendicularSnapping';
import {pointSnap}from'./pointSnapping';
const line=(a:{x:number;y:number},b:{x:number;y:number})=>({type:'LINE',vertices:[a,b]});
const geometry=(entities:any[],packed:boolean)=>buildMeasurementGeometry({entities}as any,{},undefined,packed);
const close=(p:any,q:{x:number;y:number})=>{expect(p).not.toBeNull();expect(p.x).toBeCloseTo(q.x,5);expect(p.y).toBeCloseTo(q.y,5);};
it.each([false,true])('snaps first-end, second-end and both-end right angles to the touching lines (%s)',packed=>{
 const g=geometry([line({x:0,y:0},{x:10000,y:0}),line({x:0,y:10000},{x:10000,y:0})],packed),anchor={x:2000,y:0},refs=referenceDirections(g,anchor,1);
 const first=endpointPerpendicularSnap([g],anchor,{x:2020,y:7990},60,refs,()=>true,false)!;
 close(first,{x:2000,y:8000});expect(rightAngleCorners([anchor,first],'distance',refs,'auto',referenceDirections(g,first,1)).map(m=>m[1])).toEqual([anchor]);
 const second=endpointPerpendicularSnap([g],anchor,{x:6020,y:3980},60,refs,()=>true,false)!;
 close(second,{x:6000,y:4000});expect(rightAngleCorners([anchor,second],'distance',refs,'auto',referenceDirections(g,second,1)).map(m=>m[1])).toEqual([second]);
 const parallel=geometry([line({x:0,y:0},{x:10000,y:0}),line({x:0,y:4000},{x:10000,y:4000})],packed);
 close(endpointPerpendicularSnap([parallel],anchor,{x:2030,y:4000},60,referenceDirections(parallel,anchor,1),()=>true,false),{x:2000,y:4000});
});
it.each([false,true])('uses arc tangents at either endpoint and preserves the actual arc range (%s)',packed=>{
 const arc={type:'ARC',center:{x:0,y:0},radius:1000,startAngle:Math.PI/9,endAngle:Math.PI*4/9},anchor={x:Math.SQRT1_2*1000,y:Math.SQRT1_2*1000};
 const start=geometry([arc,line({x:0,y:3000},{x:5000,y:3000})],packed),refs=referenceDirections(start,anchor,.1);
 expect(refs).toHaveLength(1);close(endpointPerpendicularSnap([start],anchor,{x:3020,y:2990},60,refs,()=>true,false),{x:3000,y:3000});
 const end=geometry([{type:'ARC',center:{x:0,y:0},radius:1000,startAngle:Math.PI/2,endAngle:Math.PI}],packed),from={x:-3000,y:1000},l=Math.hypot(from.x,from.y),q={x:from.x/l*1000,y:from.y/l*1000};
 close(endpointPerpendicularSnap([end],from,{x:q.x+20,y:q.y-10},60,[],()=>true,false),q);
 // The near radial foot lies outside this arc, but the opposite foot is valid.
 close(endpointPerpendicularSnap([end],{x:3000,y:-1000},{x:q.x+10,y:q.y},60,[],()=>true,false),q);
 expect(endpointPerpendicularSnap([end],from,{x:-q.x,y:-q.y},60,[],()=>true,false)).toBeNull();
});
it.each([false,true])('keeps normals exact on concentric arcs at large site coordinates (%s)',packed=>{
 const center={x:1e9,y:-1e9},a=.63,u={x:Math.cos(a),y:Math.sin(a)},anchor={x:center.x+u.x*1000,y:center.y+u.y*1000},end={x:center.x+u.x*2000,y:center.y+u.y*2000};
 const g=geometry([1000,2000].map(radius=>({type:'ARC',center,radius,startAngle:.1,endAngle:1.4})),packed),refs=referenceDirections(g,anchor,.01);
 const q=endpointPerpendicularSnap([g],anchor,{x:end.x+2,y:end.y-3},6,refs,()=>true,false)!;close(q,end);
 expect(rightAngleCorners([anchor,q],'distance',refs,'auto',referenceDirections(g,q,.01))).toHaveLength(2);
});
it('offers source normals only for touching geometry, stays weak, bounded and mask-aware',()=>{
 const g=geometry([line({x:0,y:0},{x:10000,y:0})],false),anchor={x:2000,y:0},refs=referenceDirections(g,anchor,1);
 close(endpointPerpendicularSnap([g],anchor,{x:2030,y:3000},60,refs),{x:2000,y:3000});
 expect(endpointPerpendicularSnap([g],anchor,{x:2070,y:3000},60,refs)).toBeNull();
 expect(endpointPerpendicularSnap([g],anchor,{x:2030,y:3000},60,[])).toBeNull();
 expect(endpointPerpendicularSnap([g],anchor,{x:2030,y:3000},60,refs,()=>false)).toBeNull();
 expect(endpointPerpendicularSnap([g],anchor,{x:2030,y:3000},60,refs,()=>true,false)).toBeNull();
 const short=geometry([line({x:1000,y:0},{x:2000,y:0})],false);
 expect(endpointPerpendicularSnap([short],{x:0,y:1000},{x:1000,y:0},60,[],()=>true,false)).toBeNull();
 expect(endpointPerpendicularSnap([g],anchor,{x:NaN,y:0},60,refs)).toBeNull();
});
it('prefers a nearby exact normal at both endpoints when the first point is on a line through the circle centre',()=>{
 const g=geometry([line({x:-500,y:0},{x:500,y:0}),{type:'CIRCLE',center:{x:0,y:0},radius:1000}],true),anchor={x:0,y:0};
 close(endpointPerpendicularSnap([g],anchor,{x:30,y:1000},60,referenceDirections(g,anchor,1),()=>true,false),{x:0,y:1000});
});
it.each([false,true])('weakly catches midpoints without stealing distant nearest positions and snaps analytically to arcs (%s)',packed=>{
 const g=geometry([line({x:0,y:0},{x:10000,y:0})],packed);
 expect(pointSnap([g],{x:5030,y:0},180)).toMatchObject({point:{x:5000,y:0},kind:'midpoint'});
 expect(pointSnap([g],{x:5070,y:0},180)).toMatchObject({point:{x:5070,y:0},kind:'edge'});
 expect(pointSnap([g],{x:30,y:0},180)).toMatchObject({point:{x:0,y:0},kind:'endpoint'});
 const c=geometry([{type:'ARC',center:{x:0,y:0},radius:1000,startAngle:.1,endAngle:1.4}],packed),a=.37,p={x:1002*Math.cos(a),y:1002*Math.sin(a)},q=pointSnap([c],p,5)!;
 expect(q.kind).toBe('edge');expect(Math.hypot(q.point.x,q.point.y)).toBeCloseTo(1000,7);
 expect(pointSnap([c],p,5,()=>true,false)).toBeNull();expect(pointSnap([c],{x:-1000,y:0},5)).toBeNull();
});
