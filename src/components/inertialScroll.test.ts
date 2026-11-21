import {expect,it} from "vitest";
import {coastScroll,releaseScrollVelocity} from "./inertialScroll";
it("caps fast flicks and drops momentum after a deliberate hold",()=>{
 expect(releaseScrollVelocity(9,100,120)).toBe(1.1);expect(releaseScrollVelocity(-9,100,120)).toBe(-1.1);expect(releaseScrollVelocity(.8,100,250)).toBe(0);
});
it("coasts briefly after release with frame-independent exponential braking",()=>{
 const once=coastScroll(100,1,160,1000);let position=100,velocity=1;
 for(let n=0;n<10;n++){const next=coastScroll(position,velocity,16,1000);position=next.position;velocity=next.velocity;}
 expect(position).toBeCloseTo(once.position);expect(velocity).toBeCloseTo(once.velocity);
 expect(position).toBeGreaterThan(180);expect(position).toBeLessThan(200);expect(coastScroll(100,1,500,1000).position).toBeLessThan(240);
});
it("stops at either edge without bounce or a delayed reverse movement",()=>{
 expect(coastScroll(90,1,30,100)).toEqual({position:100,velocity:0});expect(coastScroll(10,-1,30,100)).toEqual({position:0,velocity:0});expect(coastScroll(100,0,100,1000)).toEqual({position:100,velocity:0});
});
