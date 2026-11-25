import {expect,it} from 'vitest';
import {buildMeasurementGeometry,type MeasurementGeometry} from './measurementGeometry';
import {pointSnapCandidate} from './pointSnapping';
import {endpointPerpendicularCandidate} from './perpendicularSnapping';
import {SnapStability,type SnapCandidate} from './snapStability';
const geometry=(packed=false)=>buildMeasurementGeometry({entities:[0,6].map(y=>({type:'LINE',vertices:[{x:0,y},{x:1000,y}]}))}as any,{},undefined,packed);
const resolve=(s:SnapStability,g:MeasurementGeometry,x:number,y:number)=>s.resolve(pointSnapCandidate([g],{x,y},18),{x,y},18,[g],()=>true);
it.each([false,true])('holds the same nearby line through boundary noise and follows it without coordinate lag (packed=%s)',packed=>{
 const g=geometry(packed),s=new SnapStability();expect(resolve(s,g,100,2.8)?.point.y).toBe(0);
 for(let i=0;i<100;i++){const x=100+i*.5;expect(resolve(s,g,x,i%2?3.4:2.6)?.point).toEqual({x,y:0});}
 expect(resolve(s,g,200,5.7)?.point).toEqual({x:200,y:6});
 for(let i=0;i<100;i++)expect(resolve(s,g,201+i,i%2?3.4:2.6)?.point.y).toBe(6);
 expect(resolve(s,g,350,.2)?.point.y).toBe(0);
});
it('allows deliberately selecting lines even when less than a pixel apart',()=>{
 const g=buildMeasurementGeometry({entities:[0,.5].map(y=>({type:'LINE',vertices:[{x:0,y},{x:1000,y}]}))}as any,{},undefined,true),s=new SnapStability();
 expect(resolve(s,g,100,.1)?.point.y).toBe(0);expect(resolve(s,g,100,.48)?.point.y).toBe(.5);expect(resolve(s,g,100,.01)?.point.y).toBe(0);
});
it('adds a bounded release band but never retains a line indefinitely or across a reset',()=>{
 const g=geometry(),s=new SnapStability();resolve(s,g,100,0);expect(resolve(s,g,110,-19)?.point).toEqual({x:110,y:0});expect(resolve(s,g,120,-22)).toBeNull();
 resolve(s,g,100,2.8);s.reset();expect(resolve(s,g,100,3.4)?.point.y).toBe(6);
});
it('catches an approached midpoint, retains it past the entry boundary, and releases cleanly',()=>{
 const g=geometry(),s=new SnapStability();resolve(s,g,480,0);expect(resolve(s,g,505,0)?.kind).toBe('midpoint');
 for(const x of [507,505.5,507.8,506.2])expect(resolve(s,g,x,0)).toMatchObject({kind:'midpoint',point:{x:500,y:0}});
 expect(resolve(s,g,510,0)).toMatchObject({kind:'edge',point:{x:510,y:0}});
});
it('projects along the retained analytic arc rather than holding an obsolete point on the arc',()=>{
 const g=buildMeasurementGeometry({entities:[1000,1006].map(radius=>({type:'ARC',center:{x:0,y:0},radius,startAngle:.1,endAngle:1.4}))}as any,{},undefined,true),s=new SnapStability();
 const pick=(radius:number,a:number)=>{const raw={x:radius*Math.cos(a),y:radius*Math.sin(a)};return s.resolve(pointSnapCandidate([g],raw,18),raw,18,[g],()=>true)!;};
 expect(Math.hypot(pick(1002.8,.3).point.x,pick(1002.8,.3).point.y)).toBeCloseTo(1000,7);
 for(let i=0;i<40;i++){const a=.3+i*.01,p=pick(i%2?1003.4:1002.6,a).point;expect(p.x).toBeCloseTo(1000*Math.cos(a),7);expect(p.y).toBeCloseTo(1000*Math.sin(a),7);}
 const p=pick(1005.8,.8).point;expect(Math.hypot(p.x,p.y)).toBeCloseTo(1006,7);
});
it('retains the normal tracking axis while continuously updating its position',()=>{
 const g=geometry(),s=new SnapStability(),anchor={x:100,y:0};
 const pick=(x:number,y:number)=>{const raw={x,y},q=endpointPerpendicularCandidate([g],anchor,raw,6,[{x:1,y:0}]);return s.resolve(q,raw,18,[g],()=>true);};
 expect(pick(104,100)?.point).toEqual({x:100,y:100});expect(pick(107,130)?.point).toEqual({x:100,y:130});expect(pick(110,160)).toBeNull();
});
it('drops deleted/hidden/masked sources, changed zoom and invalid coordinates immediately',()=>{
 const g=geometry(),s=new SnapStability(),raw={x:100,y:2.8};resolve(s,g,raw.x,raw.y);expect(s.resolve(null,raw,18,[],()=>true)).toBeNull();
 resolve(s,g,raw.x,raw.y);expect(s.resolve(null,raw,18,[g],()=>false)).toBeNull();resolve(s,g,raw.x,raw.y);expect(s.resolve(null,raw,9,[g],()=>true)).toBeNull();
 resolve(s,g,raw.x,raw.y);expect(s.resolve(null,{x:NaN,y:0},18,[g],()=>true)).toBeNull();
});
it('lets an exact new endpoint override a nearby retained edge',()=>{
 const g=geometry(),s=new SnapStability();resolve(s,g,10,0);const endpoint:SnapCandidate={point:{x:0,y:0},kind:'endpoint',target:{type:'point',point:{x:0,y:0},source:g},reach:6};
 expect(s.resolve(endpoint,{x:.5,y:0},18,[g],()=>true)).toBe(endpoint);
});
