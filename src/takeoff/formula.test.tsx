import {expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {takeoffFormula} from "./formula";
import {TakeoffFormula} from "../components/TakeoffFormula";
import {UNIT_METERS,type MeasurementUnit} from "../viewer/measurementGeometry";
import type {TakeoffObject} from "./model";
const wall=():TakeoffObject=>({id:"review",layerId:"takeoff-default",kind:"wall",groupId:"wall",geometry:{type:"path",points:[{x:0,y:0},{x:6210.002,y:0}]},dimensions:{heightMm:2640,thicknessMm:200},label:{visible:true}});
it("shows the reported millimetre wall as 6.210002 × 2.64 × 0.2 = 3.279 m³ without modifying saved data",()=>{
 const object=wall(),before=structuredClone(object),f=takeoffFormula(object,"mm");
 expect(f.expression).toBe("6.210002 m × 2.64 m × 0.2 m = 3.279 m³");
 expect(f.factors).toEqual([{name:"길이",value:"6.210002 m",source:"6,210.002 mm"},{name:"높이",value:"2.64 m",source:"2,640 mm"},{name:"두께",value:"0.2 m",source:"200 mm"}]);expect(object).toEqual(before);
});
it("reveals a stored 0.2mm thickness explicitly rather than silently treating it as 0.2m",()=>{
 const object={...wall(),dimensions:{heightMm:2640,thicknessMm:.2}},f=takeoffFormula(object,"mm");
 expect(f.factors[2]).toEqual({name:"두께",value:"0.0002 m",source:"0.2 mm"});expect(f.result).toBe("0.003 m³");
});
it.each(["mm","cm","m","in","ft"] as MeasurementUnit[])("uses the saved coordinate unit %s with explicit metre factors",unit=>{
 const object=wall();object.geometry.points=object.geometry.points.map(p=>({x:p.x*.001/UNIT_METERS[unit],y:p.y}));
 expect(takeoffFormula(object,unit).expression).toBe("6.210002 m × 2.64 m × 0.2 m = 3.279 m³");
});
it("shows beam, slab, column and area-only formulae and recomputes after immutable edits",()=>{
 const beam={...wall(),kind:"beam" as const,groupId:"beam" as const,dimensions:{widthMm:300,depthMm:600}};
 expect(takeoffFormula(beam,"mm").description).toBe("길이 6.210002 m × 폭 0.3 m × 깊이 0.6 m = 1.118 m³");
 const slab={...wall(),kind:"slab" as const,groupId:"slab" as const,geometry:{type:"polygon" as const,points:[{x:0,y:0},{x:8000,y:0},{x:8000,y:5000},{x:0,y:5000}]},dimensions:{thicknessMm:180}};
 expect(takeoffFormula(slab,"mm").expression).toBe("40 m² × 0.18 m = 7.200 m³");
 expect(takeoffFormula({...slab,kind:"column",groupId:"column",dimensions:{heightMm:2640}},"mm").expression).toBe("40 m² × 2.64 m = 105.600 m³");
 expect(takeoffFormula({...slab,calculation:"area",dimensions:{}},"mm").factors).toHaveLength(1);
 expect(takeoffFormula({...slab,dimensions:{thicknessMm:200}},"mm").result).toBe("8.000 m³");expect(takeoffFormula(slab,"mm").result).toBe("7.200 m³");
 expect(takeoffFormula({...slab,geometry:{...slab.geometry,points:slab.geometry.points.map(p=>({x:p.x*2,y:p.y}))}},"mm").result).toBe("14.400 m³");
});
it("keeps small positive specifications visible and shows a mismatch without converting stored values",()=>{
 const object={...wall(),dimensions:{heightMm:2640,thicknessMm:.0002}};
 expect(takeoffFormula(object,"mm").factors[2].value).toBe("2e-7 m");
 const html=renderToStaticMarkup(<TakeoffFormula object={wall()} unit="mm" measurementUnit="m"/>);
 expect(html).toContain("선택 적산 객체 산식");expect(html).toContain("2,640 mm → 2.64 m");expect(html).toContain("측정 도면 단위는 m, 적산 도면 단위는 mm");expect(html).toContain("3.279 m³");
 expect(renderToStaticMarkup(<TakeoffFormula object={wall()} unit="mm" measurementUnit="mm"/>)).not.toContain('role="status"');
});
it("reuses formula text while panning but invalidates it for a different unit or specification",()=>{
 const object=wall(),first=takeoffFormula(object,"mm");expect(takeoffFormula(object,"mm")).toBe(first);
 expect(takeoffFormula(object,"m").result).toBe("3278.881 m³");
 object.dimensions={heightMm:2640,thicknessMm:250};const edited=takeoffFormula(object,"mm");expect(edited).not.toBe(first);expect(edited.result).toBe("4.099 m³");expect(takeoffFormula(object,"mm")).toBe(edited);
});
