import {afterEach,expect,it,vi} from "vitest";
import {offsetAnnotation,offsetGuide,readOffsetDistance,saveOffsetDistance,parseEditNumber,editNumber} from "./offsetGeometry";
import {sourceAnnotation,type Annotation} from "./annotations";
const line=(points:Annotation["points"]):Annotation=>({id:"a",layerId:"base",kind:"polyline",points});
afterEach(()=>vi.unstubAllGlobals());
it("offsets both sides of a diagonal by perpendicular distance, preserving the source",()=>{
 const a=line([{x:1e9,y:1e9},{x:1e9+300,y:1e9+400}]),before=JSON.stringify(a);
 expect(offsetGuide(a,{x:1e9+150,y:1e9+200})?.normal).toEqual({x:-.8,y:.6});
 expect(offsetAnnotation(a,50,1)?.points).toEqual([{x:1e9-40,y:1e9+30},{x:1e9+260,y:1e9+430}]);
 expect(offsetAnnotation(a,50,-1)?.points[0]).toEqual({x:1e9+40,y:1e9-30});expect(JSON.stringify(a)).toBe(before);
});
it("joins adjacent parallel edges at an exact miter, not a translated copy",()=>{
 const a=line([{x:0,y:0},{x:100,y:0},{x:100,y:100}]);
 expect(offsetAnnotation(a,10,1)?.points).toEqual([{x:0,y:10},{x:90,y:10},{x:90,y:100}]);
 expect(offsetAnnotation(a,10,-1)?.points).toEqual([{x:0,y:-10},{x:110,y:-10},{x:110,y:100}]);
});
it("offsets closed rectangles and clockwise rings, rejecting collapsed or reversed interiors",()=>{
 const a:Annotation={...line([{x:0,y:0},{x:100,y:100}]),kind:"rectangle"};
 expect(offsetAnnotation(a,10,1)?.points).toEqual([{x:10,y:10},{x:90,y:10},{x:90,y:90},{x:10,y:90},{x:10,y:10}]);
 expect(offsetAnnotation(a,60,1)).toBeNull();
 const clockwise=line([{x:0,y:0},{x:0,y:100},{x:100,y:100},{x:100,y:0},{x:0,y:0}]);
 expect(offsetAnnotation(clockwise,10,-1)?.points[0]).toEqual({x:10,y:10});
});
it("keeps circles concentric and arcs' angular extent while changing radius",()=>{
 const c:Annotation={...line([{x:100,y:200},{x:130,y:200}]),kind:"circle"};
 expect(offsetAnnotation(c,10,1)?.points).toEqual([{x:100,y:200},{x:140,y:200}]);
 expect(offsetAnnotation(c,10,-1)?.points[1]).toEqual({x:120,y:200});expect(offsetAnnotation(c,30,-1)).toBeNull();
 const arc={...c,kind:"arc"as const,start:Math.PI/4,sweep:Math.PI/2};
 const next=offsetAnnotation(arc,5,-1)!;expect(next.kind).toBe("arc");expect(next.start).toBe(arc.start);expect(next.sweep).toBe(arc.sweep);
 expect(offsetGuide(c,{x:100,y:230})).toEqual({anchor:{x:100,y:230},normal:{x:0,y:1},radial:true});
});
it("refuses unsupported, nonfinite, degenerate and self-crossing shapes",()=>{
 const a=line([{x:0,y:0},{x:100,y:0}]);
 for(const n of[0,-1,Infinity,NaN])expect(offsetAnnotation(a,n,1)).toBeNull();
 expect(offsetAnnotation({...a,kind:"mask"},10,1)).toBeNull();expect(offsetAnnotation({...a,approximate:true},10,1)).toBeNull();
 expect(offsetAnnotation(line([{x:0,y:0},{x:100,y:100},{x:0,y:100},{x:100,y:0}]),5,1)).toBeNull();
 expect(offsetAnnotation(line([{x:0,y:0},{x:0,y:0}]),5,1)).toBeNull();
});
it("copies exact source circles without a mask or any mutation of original data",()=>{
 const e={kind:"CIRCLE",points:[{x:10,y:0},{x:-10,y:0},{x:10,y:0}],bounds:{minX:-10,minY:-10,maxX:10,maxY:10},length:20*Math.PI,approximate:false},before=JSON.stringify(e);
 const copy=sourceAnnotation(e,"base"),result=offsetAnnotation(copy,5,1)!;
 expect(result.kind).toBe("circle");expect(result.points).toEqual([{x:0,y:0},{x:15,y:0}]);expect(JSON.stringify(e)).toBe(before);
});
it("remembers the last applied physical distance across drawings, units and fresh reads",()=>{
 const values=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)});
 expect(readOffsetDistance("mm")).toBe(100);expect(saveOffsetDistance(250,"mm")).toBe(true);
 expect(readOffsetDistance("mm")).toBe(250);expect(readOffsetDistance("m")).toBe(.25);
 expect(saveOffsetDistance(40,"drawing")).toBe(true);expect(readOffsetDistance("drawing")).toBe(40);expect(readOffsetDistance("mm")).toBe(250);
 expect(saveOffsetDistance(-1,"mm")).toBe(false);expect(readOffsetDistance("mm")).toBe(250);
 vi.stubGlobal("localStorage",{getItem:()=>'{broken',setItem:()=>{throw Error("quota");}});expect(readOffsetDistance("mm")).toBe(100);expect(saveOffsetDistance(250,"mm")).toBe(false);
});
it("accepts signed XY decimals and decimal commas, rejecting empty or invalid distance input",()=>{
 expect(parseEditNumber("-125.5")).toBe(-125.5);expect(parseEditNumber("2,5")).toBe(2.5);expect(parseEditNumber("0")).toBe(0);expect(parseEditNumber(editNumber(12.5))).toBe(12.5);
 expect(editNumber(-5.68e-14)).toBe("0");expect(editNumber(250.000016)).toBe("250");expect(editNumber(1e9+.125)).toBe("1000000000.125");
 for(const text of[""," ","Infinity","NaN","1e999","3x","0x10"])expect(parseEditNumber(text)).toBeNull();
});
