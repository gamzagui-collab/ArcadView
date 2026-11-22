import {expect,it} from "vitest";
import {dimensionCandidate,dimensionInputs,convertDimensionInput} from "./dimensionInputs";
import {quantity,newTakeoff,totals,type TakeoffObject} from "./model";
import {UndoHistory} from "../viewer/undoHistory";
const wall=():TakeoffObject=>({id:"review",layerId:"takeoff-default",kind:"wall",groupId:"wall",geometry:{type:"path",points:[{x:0,y:0},{x:6210.002,y:0}]},dimensions:{heightMm:2640,thicknessMm:200},label:{visible:true,position:{x:3000,y:100}}});
it("opens the clicked factor in metres without parsing the rounded displayed formula",()=>{
 const object=wall();object.dimensions.thicknessMm=200.123456789;
 const input=dimensionInputs(object,"mm","thicknessMm");expect(input.units).toEqual(["mm","m"]);expect(input.focus).toBe(1);expect(input.values).toEqual(["2640","0.200123456789"]);
 expect(dimensionCandidate(object,input.values,input.units)).toEqual(object);
});
it.each([["2.64","0.2","m","m"],["2640","200","mm","mm"],["2640","0.2","mm","m"],["2.64","200","m","mm"]] as const)("normalizes wall %s/%s %s/%s to exactly 2640mm and 200mm",(height,thickness,hUnit,tUnit)=>{
 const original=wall(),before=structuredClone(original),next=dimensionCandidate(original,[height,thickness],[hUnit,tUnit]);expect(next.dimensions).toEqual({heightMm:2640,thicknessMm:200});expect(quantity(next,"mm").volumeM3).toBeCloseTo(3.278881056,12);expect(original).toEqual(before);expect(next.geometry).toBe(original.geometry);expect(next.label).toBe(original.label);
});
it("preserves beam/slab/column defaults and accepts explicit m/mm for every field",()=>{
 const beam={...wall(),kind:"beam" as const,groupId:"beam" as const,dimensions:{widthMm:300,depthMm:600}};expect(dimensionInputs(beam,"m").units).toEqual(["mm","mm"]);expect(dimensionCandidate(beam,["0.3","600"],["m","mm"]).dimensions).toEqual(beam.dimensions);
 const footprint={type:"polygon" as const,points:[{x:0,y:0},{x:8000,y:0},{x:8000,y:5000},{x:0,y:5000}]},slab={...wall(),kind:"slab" as const,groupId:"slab" as const,geometry:footprint,dimensions:{thicknessMm:180}};
 expect(quantity(dimensionCandidate(slab,[".2"],["m"]),"mm").volumeM3).toBe(8);
 const column={...slab,kind:"column" as const,groupId:"column" as const,dimensions:{heightMm:2640}};expect(dimensionInputs(column,"mm").values).toEqual(["2640"]);expect(quantity(dimensionCandidate(column,["3"],["m"]),"mm").volumeM3).toBe(120);
});
it("converts only the changed unit while retaining invalid partial input for validation",()=>{
 expect(convertDimensionInput("200","mm","m")).toBe("0.2");expect(convertDimensionInput("2.64","m","mm")).toBe("2640");expect(convertDimensionInput("-","mm","m")).toBe("-");expect(convertDimensionInput("200","mm","mm")).toBe("200");
});
it("rejects missing, nonfinite, zero, negative or oversized specifications and area-only edits",()=>{
 for(const value of ["","abc","NaN","Infinity","0","-1","10000001"])expect(()=>dimensionCandidate(wall(),["2640",value],["mm","mm"])).toThrow();
 expect(()=>dimensionCandidate(wall(),["2640"],["mm"])).toThrow();expect(()=>dimensionCandidate({...wall(),calculation:"area",dimensions:{}},["2640","200"],["mm","mm"])).toThrow();
});
it("updates derived member/layer totals and restores specifications with Undo/Redo",()=>{
 const before={...newTakeoff({key:"v1-"+"c".repeat(64),name:"review.dwg",size:1,lastModified:0},"mm"),objects:[wall()]},h=new UndoHistory<typeof before>();h.record(before);
 const next={...before,objects:[dimensionCandidate(before.objects[0],["3",".25"],["m","m"])]};expect(totals(next).volumeM3).toBeCloseTo(4.6575015,12);expect(totals(next).layers['takeoff-default'].volumeM3).toBeCloseTo(4.6575015,12);expect(totals(h.undo(next)!).volumeM3).toBeCloseTo(3.278881056,12);expect(h.redo(before)).toEqual(next);
});
