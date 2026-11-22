import {expect,it} from "vitest";
import {reviewDimensions} from "./dimensionWarnings";
import type {TakeoffObject} from "./model";
const wall:TakeoffObject={id:"wall",layerId:"takeoff-default",kind:"wall",groupId:"wall",geometry:{type:"path",points:[{x:0,y:0},{x:16000,y:0}]},dimensions:{heightMm:2640,thicknessMm:200},label:{visible:true}};
it("warns about m/mm mixing and shows the real normalized values",()=>{
 const r=reviewDimensions(wall,["2.64","200"],["m","mm"],"mm",wall.dimensions);expect(r.error).toBe("");expect(r.candidate?.dimensions).toEqual(wall.dimensions);expect(r.warnings.map(w=>w.code)).toEqual(["mixed-units"]);expect(r.warnings[0].message).toContain("높이 m · 두께 mm");
});
it("compares physical dimensions rather than input formatting or unit choice",()=>{
 expect(reviewDimensions(wall,["2.64",".2"],["m","m"],"mm",wall.dimensions).warnings).toEqual([]);
 const r=reviewDimensions(wall,["26400","200"],["mm","mm"],"mm",wall.dimensions);expect(r.warnings.map(w=>w.code)).toContain("previous-size");expect(r.warnings.find(w=>w.code==="previous-size")?.message).toContain("2,640 mm → 26,400 mm");expect(wall.dimensions.heightMm).toBe(2640);
});
it("flags a kilometre-scale height against a sixteen-metre path",()=>{
 const r=reviewDimensions(wall,["2640",".2"],["m","m"],"mm",wall.dimensions);expect(r.candidate?.dimensions.heightMm).toBe(2640000);expect(r.warnings.find(w=>w.code==="large-size")?.message).toContain("도형 길이 16 m에 높이 2,640 m");
});
it("rejects the reported 2640000m example before confirmation or save",()=>{
 const r=reviewDimensions(wall,["2640000",".2"],["m","m"],"mm");expect(r.candidate).toBeNull();expect(r.error).toContain("높이 2640000 m");expect(r.error).toContain("10,000,000mm");
});
it("does not treat factory defaults as a previous entry when no reference is provided",()=>{
 expect(reviewDimensions(wall,["3000","200"],["mm","mm"],"mm").warnings).toEqual([]);expect(reviewDimensions(wall,["3000","200"],["mm","mm"],"mm",wall.dimensions).warnings.map(w=>w.code)).toEqual(["previous-size"]);
});
it.each(["beam","slab","column"] as const)("checks changed and oversized %s dimensions",kind=>{
 const polygon={type:"polygon" as const,points:[{x:0,y:0},{x:8000,y:0},{x:8000,y:5000},{x:0,y:5000}]},dimensions=kind==="beam"?{widthMm:300,depthMm:600}:kind==="slab"?{thicknessMm:180}:{heightMm:3000},o={...wall,kind,groupId:kind,geometry:kind==="beam"?wall.geometry:polygon,dimensions};
 const r=reviewDimensions(o,kind==="beam"?["30",".6"]:kind==="slab"?["180"]:["3000"],kind==="beam"?["m","m"]:["m"],"mm",dimensions);expect(r.warnings.map(w=>w.code)).toContain("large-size");expect(r.warnings.map(w=>w.code)).toContain("previous-size");
});
it("retains invalid-input protection and unknown drawing-unit errors",()=>{
 for(const n of ["0","-1","NaN","Infinity",""])expect(reviewDimensions(wall,[n,"200"],["mm","mm"],"mm").candidate).toBeNull();expect(reviewDimensions(wall,["2640","200"],["mm","mm"],"drawing").error).toContain("단위");
});
