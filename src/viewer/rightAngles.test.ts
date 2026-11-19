import {expect,it}from"vitest";
import {isRightAngle,rightAngleCorners,referenceDirections}from"./rightAngles";
import {buildMeasurementGeometry}from"./measurementGeometry";
it("marks axis and rotated right angles but never zero-length or non-right angles",()=>{
 expect(isRightAngle({x:1,y:1},{x:-1,y:1})).toBe(true);expect(isRightAngle({x:0,y:0},{x:1,y:1})).toBe(false);
 expect(rightAngleCorners([{x:0,y:0},{x:1,y:1},{x:0,y:2}],"angle")).toHaveLength(1);
 expect(rightAngleCorners([{x:0,y:0},{x:1,y:1},{x:2,y:1}],"angle")).toHaveLength(0);
 expect(rightAngleCorners([{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}],"area")).toHaveLength(4);
});
it("finds a diagonal CAD reference in packed data without materializing its full entity",()=>{
 const g=buildMeasurementGeometry({entities:[{type:"LINE",layer:"0",vertices:[{x:0,y:0},{x:100,y:100}]}]}as any,{},undefined,true);
 // LINE parser representation uses vertices in this adapter.
 const refs=referenceDirections(g,{x:0,y:0},.1);
 expect(refs).toHaveLength(1);expect(rightAngleCorners([{x:0,y:0},{x:-10,y:10}],"distance",refs)).toHaveLength(1);
});
it("marks either or both endpoints only with their own perpendicular reference",()=>{
 const points=[{x:0,y:0},{x:-10,y:10}];
 const mark=rightAngleCorners(points,"distance",[],"auto",[{x:1,y:1}])[0];
 expect(mark[1]).toEqual(points[1]);expect(mark[2]).toEqual(points[0]);
 expect(isRightAngle({x:mark[0].x-mark[1].x,y:mark[0].y-mark[1].y},{x:mark[2].x-mark[1].x,y:mark[2].y-mark[1].y})).toBe(true);
 for(const axis of ["x","y"]as const){const m=rightAngleCorners(points,"linear",[],axis)[0];expect(m[1]).toEqual(points[1]);}
 const axisMarks=rightAngleCorners([{x:0,y:0},{x:100,y:0}],"distance");expect(axisMarks.map(m=>m[1])).toEqual([{x:0,y:0},{x:100,y:0}]);
 expect(rightAngleCorners(points,"distance",[{x:1,y:1}],"auto",[{x:1,y:1}])).toHaveLength(2);
 expect(rightAngleCorners([{x:0,y:0},{x:1,y:1}],"distance")).toHaveLength(0);
});
