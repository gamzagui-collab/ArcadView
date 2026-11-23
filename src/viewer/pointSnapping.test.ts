import {expect,it} from 'vitest';
import {buildMeasurementGeometry,type MeasurementGeometry} from './measurementGeometry';
import {pointSnap} from './pointSnapping';
import {annotationGeometry} from './annotations';
import {queryEntityIds,releaseGeometryQuery} from './geometryQuery';
const line=(a:{x:number;y:number},b:{x:number;y:number})=>({type:'LINE',vertices:[a,b]});
const geometry=(entities:any[],packed=false)=>buildMeasurementGeometry({entities}as any,{},undefined,packed);
it.each([false,true])('projects a single line and diagonal accurately without jumping to their midpoint (packed %s)',packed=>{
 const g=geometry([line({x:0,y:0},{x:10000,y:0})],packed);
 expect(pointSnap([g],{x:3700,y:80},200)).toEqual({point:{x:3700,y:0},kind:'edge'});
 const diagonal=geometry([line({x:0,y:0},{x:10000,y:10000})],packed);
 expect(pointSnap([diagonal],{x:5000,y:5200},300)).toEqual({point:{x:5100,y:5100},kind:'edge'});
 expect(pointSnap([g],{x:3700,y:80},200,()=>true,false)).toBeNull();
 expect(pointSnap([g],{x:3700,y:80},200,()=>false)).toBeNull();
});
it.each([false,true])('preserves characteristic points, intersections and segment bounds (%s)',packed=>{
 const g=geometry([line({x:0,y:0},{x:10000,y:0}),line({x:3700,y:-1000},{x:3700,y:1000}),{type:'CIRCLE',center:{x:20000,y:20000},radius:1000}],packed);
 for(const[p,q,kind]of[[{x:1,y:1},{x:0,y:0},'endpoint'],[{x:5001,y:1},{x:5000,y:0},'midpoint'],[{x:3701,y:1},{x:3700,y:0},'intersection']]as const)
  expect(pointSnap([g],p,50)).toEqual({point:expect.objectContaining(q),kind});
 expect(pointSnap([g],{x:20001,y:20001},50,()=>true,true,'center')?.point).toMatchObject({x:20000,y:20000});
 expect(pointSnap([g],{x:10020,y:20},40)?.point).toMatchObject({x:10000,y:0});
 expect(pointSnap([g],{x:12000,y:0},100)).toBeNull();
 const invalid=geometry([line({x:0,y:0},{x:0,y:0}),line({x:0,y:0},{x:10000,y:0}),line({x:0,y:0},{x:10000,y:0})],packed);
 expect(pointSnap([invalid],{x:3700,y:80},200)?.point).toEqual({x:3700,y:0});
 expect(pointSnap([g],{x:NaN,y:0},100)).toBeNull();
});
it('uses every polyline segment and transformed block coordinates in packed and unpacked geometry',()=>{
 for(const packed of[false,true]){
  const g=buildMeasurementGeometry({blocks:{B:{position:{x:0,y:0},entities:[line({x:0,y:0},{x:10000,y:0})]}},entities:[
   {type:'INSERT',name:'B',position:{x:20000,y:30000},xScale:2,yScale:3,rotation:90},
   {type:'LWPOLYLINE',vertices:[{x:0,y:0},{x:10000,y:0},{x:10000,y:10000}]}]}as any,{},undefined,packed);
  const q=pointSnap([g],{x:20030,y:37400},100)!.point;expect(q.x).toBeCloseTo(20000,7);expect(q.y).toBeCloseTo(37400,7);
  expect(pointSnap([g],{x:10020,y:3700},50)?.point).toEqual({x:10000,y:3700});
 }
});
it('keeps screen tolerance stable through zoom and uses exact overlay doubles',()=>{
 const g=annotationGeometry([{id:'user',layerId:'one',kind:'polyline',points:[{x:1e9,y:100},{x:1e9+10000,y:100}]}]);
 for(const scale of[.01,.1,1,10]){
  expect(pointSnap([g],{x:1e9+3700,y:100+8/scale},18/scale)?.point).toEqual({x:1e9+3700,y:100});
  expect(pointSnap([g],{x:1e9+3700,y:100+22/scale},18/scale)).toBeNull();
 }
});
it('reuses spatial queries on 100000 entities instead of scanning all bounds on each pointer event',()=>{
 const g=geometry(Array.from({length:100000},(_,i)=>line({x:i*20,y:0},{x:i*20+10,y:10})),true);
 const region={minX:37000,minY:0,maxX:37020,maxY:10},ids:number[]=[];
 queryEntityIds(g,region,i=>ids.push(i));expect(ids.length).toBeLessThanOrEqual(2);
 const start=performance.now();for(let i=0;i<300;i++)expect(pointSnap([g],{x:37002,y:3},10)).not.toBeNull();
 expect(performance.now()-start).toBeLessThan(3000);releaseGeometryQuery(g);
});
