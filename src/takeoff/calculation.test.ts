import {expect,it} from "vitest";
import {calculationOf,asAnnotation,fromAnnotation,insidePolygon,KINDS,labelPosition,newTakeoff,quantity,quantityText,selectedLayerTotals,totalText,totals,validateDocument,type TakeoffObject} from "./model";
import {UNIT_METERS,type MeasurementUnit} from "../viewer/measurementGeometry";
import {UndoHistory} from "../viewer/undoHistory";
const drawing={key:"v1-"+"c".repeat(64),name:"mixed.dwg",size:1,lastModified:0};
const area=(kind:TakeoffObject["kind"]="wall"):TakeoffObject=>({id:kind,layerId:"takeoff-default",groupId:kind,kind,calculation:"area",geometry:{type:"polygon",points:[{x:0,y:0},{x:8,y:0},{x:8,y:5},{x:0,y:5}]},dimensions:{},label:{visible:true}});
it.each(["mm","cm","m","in","ft"] as MeasurementUnit[])("calculates all area member kinds in %s without height/thickness or a volume",unit=>{
 for(const kind of KINDS){const a=area(kind);a.geometry.points=a.geometry.points.map(p=>({x:p.x/UNIT_METERS[unit],y:p.y/UNIT_METERS[unit]}));expect(quantity(a,unit).lengthM).toBe(0);expect(quantity(a,unit).areaM2).toBeCloseTo(40,10);expect(quantity(a,unit).volumeM3).toBe(0);expect(quantityText(quantity(a,unit))).toBe("40.000 m²");const d={...newTakeoff(drawing,unit),objects:[a]};validateDocument(d);expect(asAnnotation(a).points.at(-1)).toEqual(a.geometry.points[0]);expect(fromAnnotation(a,asAnnotation(a))).toEqual(a);expect(insidePolygon(labelPosition(a),a.geometry.points)).toBe(true);}
});
it("keeps area and volume separate across layers, visibility, deletion and Undo/Redo",()=>{
 expect(totalText({volumeM3:0,areaOnlyM2:0},"area")).toBe("0.000 m²");expect(totalText({volumeM3:0,areaOnlyM2:0},"volume")).toBe("0.000 m³");
 const d=newTakeoff(drawing,"m"),a=area(),v:TakeoffObject={...area("slab"),id:"volume",calculation:"volume",dimensions:{thicknessMm:180}};d.layers.push({id:"hidden",name:"hidden",visible:false});d.objects=[a,{...area("column"),layerId:"hidden"},v];const t=totals(d);expect(t.volumeM3).toBe(7.2);expect(t.areaOnlyM2).toBe(80);expect(t.visibleAreaM2).toBe(40);expect(t.groups.slab.areaOnlyM2).toBe(0);expect(selectedLayerTotals(d).areaOnlyM2).toBe(40);expect(totalText(t)).toBe("7.200 m³ · 80.000 m²");expect(totalText({...t,volumeM3:0})).toBe("80.000 m²");
 const h=new UndoHistory<typeof d>();h.record(d);const next={...d,objects:d.objects.filter(o=>o.id!==a.id)};expect(totals(next).areaOnlyM2).toBe(40);expect(totals(h.undo(next)!).areaOnlyM2).toBe(80);expect(totals(h.redo(d)!).volumeM3).toBe(7.2);
});
it("retains legacy volume defaults and rejects zero specs, unknown modes and invalid area polygons",()=>{
 const legacy={...area("slab"),calculation:undefined,dimensions:{thicknessMm:180}};expect(calculationOf(legacy)).toBe("volume");expect(quantity(legacy,"m").volumeM3).toBe(7.2);expect(quantity({...legacy,calculation:"area",dimensions:{}},"m").volumeM3).toBe(0);expect(quantity(legacy,"m").volumeM3).toBe(7.2);expect(()=>quantity({...legacy,dimensions:{thicknessMm:0}},"m")).toThrow();
 const d={...newTakeoff(drawing,"m"),objects:[area()]};expect(()=>validateDocument({...d,options:{...d.options,calculation:"other"}})).toThrow();expect(()=>validateDocument({...d,objects:[{...area(),geometry:{type:"path",points:area().geometry.points}}]})).toThrow();expect(()=>quantity({...area(),geometry:{type:"polygon",points:[{x:0,y:0},{x:8,y:5},{x:8,y:0},{x:0,y:5}]}},"m")).toThrow();
});
