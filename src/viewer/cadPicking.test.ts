import{expect,it}from"vitest";
import{buildMeasurementGeometry}from"./measurementGeometry";
import{perpendicularSnap}from"./cadPicking";
it("snaps to a perpendicular foot on a rotated segment in packed and unpacked geometry",()=>{
 for(const packed of[false,true]){
  const g=buildMeasurementGeometry({entities:[{type:"LINE",vertices:[{x:0,y:0},{x:100,y:100}]}]}as any,{},undefined,packed);
  const q=perpendicularSnap(g,{x:0,y:100},{x:49,y:52},5)!;expect(q).toEqual({x:50,y:50});
  expect(perpendicularSnap(g,{x:0,y:100},{x:49,y:52},5,()=>false)).toBeNull();
  expect(perpendicularSnap(g,{x:0,y:400},{x:100,y:100},5)).toBeNull();
 }
});
