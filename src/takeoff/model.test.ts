import {expect,it} from "vitest";
import {asAnnotation,cleanPoints,fromAnnotation,geometryError,insidePolygon,labelPosition,migrateTakeoff,moveTakeoffToLayer,newTakeoff,quantity,takeoffVisible,totals,validateDocument,type TakeoffKind,type TakeoffObject} from "./model";
import {takeoffMovePoint} from "./overlay";
import {UndoHistory} from "../viewer/undoHistory";
import {translateAnnotation} from "../viewer/annotations";
import {UNIT_METERS,type MeasurementUnit} from "../viewer/measurementGeometry";
const drawing={key:"v1-"+"a".repeat(64),name:"site.dwg",size:123,lastModified:1};
const obj=(id:string,kind:TakeoffKind,points:Array<{x:number;y:number}>,dimensions:TakeoffObject["dimensions"]):TakeoffObject=>({id,layerId:"takeoff-default",kind,groupId:kind,geometry:{type:kind==="slab"?"polygon":"path",points},dimensions,label:{visible:true}});
const w1=obj("W01","wall",[{x:0,y:0},{x:12000,y:0},{x:12000,y:8000}],{heightMm:3000,thicknessMm:200});
const w2=obj("W02","wall",[{x:0,y:0},{x:10000,y:0}],{heightMm:3200,thicknessMm:250});
const b1=obj("B01","beam",[{x:0,y:0},{x:12000,y:0}],{widthMm:300,depthMm:600});
const s1=obj("S01","slab",[{x:0,y:0},{x:8000,y:0},{x:8000,y:5000},{x:0,y:5000}],{thicknessMm:180});
it("W01=12.000, W02=8.000, B01=2.160, S01=7.200 and concrete total=29.360 m³",()=>{
 expect(quantity(w1,"mm")).toEqual({lengthM:20,areaM2:0,volumeM3:12});expect(quantity(w2,"mm").volumeM3).toBeCloseTo(8,12);expect(quantity(b1,"mm").volumeM3).toBeCloseTo(2.16,12);expect(quantity(s1,"mm")).toEqual({lengthM:0,areaM2:40,volumeM3:7.2});
 const d={...newTakeoff(drawing,"mm"),objects:[w1,w2,b1,s1]},t=totals(d);expect(t.groups.wall).toEqual({count:2,lengthM:30,areaM2:0,volumeM3:20});expect(t.volumeM3).toBeCloseTo(29.36,12);expect(t.groups.slab.areaM2).toBe(40);expect(t.groups.beam.lengthM).toBe(12);validateDocument(d);
});
it.each(["mm","cm","m","in","ft"]as MeasurementUnit[])("converts %s coordinates before computing length, squared area and volume",unit=>{
 const ratio=UNIT_METERS[unit],scale=(o:TakeoffObject)=>({...o,geometry:{...o.geometry,points:o.geometry.points.map(p=>({x:p.x*.001/ratio,y:p.y*.001/ratio}))}});
 expect(quantity(scale(w1),unit).volumeM3).toBeCloseTo(12,10);expect(quantity(scale(s1),unit).areaM2).toBeCloseTo(40,10);expect(quantity(scale(s1),unit).volumeM3).toBeCloseTo(7.2,10);
});
it("keeps closure aliases, winding and large world coordinates from changing area",()=>{
 for(const points of [s1.geometry.points,[...s1.geometry.points].reverse(),[...s1.geometry.points,s1.geometry.points[0]],s1.geometry.points.map(p=>({x:p.x+1e9,y:p.y-2e9}))])expect(quantity({...s1,geometry:{type:"polygon",points}},"mm").areaM2).toBe(40);
 expect(cleanPoints([{x:0,y:0},{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:0,y:0}],true)).toHaveLength(3);
});
it("rejects self intersections, collinear overlaps, nonadjacent repeated points, zero area and invalid numbers",()=>{
 for(const p of [[{x:0,y:0},{x:4,y:4},{x:0,y:4},{x:4,y:0}],[{x:0,y:0},{x:4,y:0},{x:2,y:0},{x:0,y:2}],[{x:0,y:0},{x:1,y:0},{x:2,y:0}],[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:1,y:0},{x:0,y:1}]])expect(geometryError(p,true)).not.toBeNull();
 for(const n of [0,-1,NaN,Infinity,1e8])expect(()=>quantity({...w1,dimensions:{heightMm:n,thicknessMm:200}},"mm")).toThrow();expect(()=>quantity(w1,"drawing")).toThrow(/단위/);expect(geometryError([{x:NaN,y:0},{x:1,y:1}],false)).not.toBeNull();
});
it("places path labels at half cumulative length and concave slab labels inside",()=>{
 expect(labelPosition(w1)).toEqual({x:10000,y:0});const o={...s1,geometry:{type:"polygon"as const,points:[{x:0,y:0},{x:10,y:0},{x:10,y:2},{x:2,y:2},{x:2,y:10},{x:0,y:10}]}};expect(insidePolygon(labelPosition(o),o.geometry.points)).toBe(true);expect(labelPosition({...o,label:{visible:true,position:{x:20,y:20}}})).toEqual({x:20,y:20});
});
it("derives totals after spec/vertex edits, deletion, Undo/Redo and hidden groups without changing ordinary annotations",()=>{
 const before={...newTakeoff(drawing,"mm"),objects:[w1,w2,s1]},h=new UndoHistory<typeof before>();h.record(before);const moved={...before,objects:before.objects.map(o=>o.id===w2.id?{...o,dimensions:{heightMm:4000,thicknessMm:250}}:o)};expect(totals(moved).groups.wall.volumeM3).toBe(22);
 expect(totals(h.undo(moved)!).volumeM3).toBeCloseTo(27.2,10);expect(totals(h.redo(before)!).volumeM3).toBeCloseTo(29.2,10);
 const vertex={...w2,geometry:{...w2.geometry,points:[w2.geometry.points[0],{x:20000,y:0}]}};expect(quantity(vertex,"mm").volumeM3).toBe(16);expect(totals({...before,objects:before.objects.filter(o=>o.id!==w1.id)}).groups.wall.volumeM3).toBe(8);
 const hidden={...before,groups:before.groups.map(g=>({...g,visible:g.id!=="wall"}))};expect(totals(hidden).volumeM3).toBeCloseTo(27.2,10);expect(totals(hidden).visibleVolumeM3).toBe(7.2);expect(before.objects).toEqual([w1,w2,s1]);
 const translated=fromAnnotation(w1,translateAnnotation(asAnnotation(w1),{x:0,y:0},{x:1e9,y:1e9}));expect(quantity(translated,"mm")).toEqual(quantity(w1,"mm"));
});
it("refuses unsupported schemas and foreign drawing identities instead of overwriting data",()=>{
 const d=newTakeoff(drawing,"drawing");validateDocument(d);expect(()=>validateDocument({...d,schemaVersion:3})).toThrow();expect(()=>validateDocument(d,"v1-"+"b".repeat(64))).toThrow();expect(()=>validateDocument({...d,objects:[w1]})).toThrow();
});

it("keeps a movement handle away from editable points when the lower toolbar forces clamping",()=>{const points=[{x:84,y:488},{x:156,y:488},{x:228,y:488},{x:228,y:392}],handle=takeoffMovePoint(points,360,616);expect(points.every(p=>Math.hypot(p.x-handle.x,p.y-handle.y)>=30)).toBe(true);expect(handle.y).toBeLessThan(392);});

it("separates regional layers from member types and keeps hidden quantities in the full total",()=>{
 const d={...newTakeoff(drawing,"mm"),layers:[{id:"one-two",name:"2동 1·2호",visible:true},{id:"three-five",name:"2동 3·4·5호",visible:true}],activeLayerId:"one-two",objects:[{...w1,layerId:"one-two"},{...w2,layerId:"three-five"},{...s1,layerId:"three-five"}]};validateDocument(d);
 expect(totals(d).layers["one-two"].volumeM3).toBe(12);expect(totals(d).layers["three-five"].volumeM3).toBeCloseTo(15.2);expect(totals(d).groups.wall.volumeM3).toBe(20);
 const hidden={...d,layers:d.layers.map(l=>({...l,visible:l.id!=="one-two"}))};expect(totals(hidden).volumeM3).toBeCloseTo(27.2);expect(totals(hidden).visibleVolumeM3).toBeCloseTo(15.2);expect(takeoffVisible(hidden,d.objects[0])).toBe(false);
 const history=new UndoHistory<typeof d>();history.record(d);expect(totals(history.undo(hidden)!).visibleVolumeM3).toBeCloseTo(27.2);expect(totals(history.redo(d)!).visibleVolumeM3).toBeCloseTo(15.2);
 expect(()=>validateDocument({...d,objects:[{...w1,layerId:"missing"}]})).toThrow();
});
it("upgrades v1 into a default region without changing original quantities, identities or labels",()=>{
 const original={...newTakeoff(drawing,"mm"),schemaVersion:1,objects:[w1,s1]};
 const upgraded=migrateTakeoff(original);expect(upgraded.schemaVersion).toBe(2);expect(upgraded.layers).toEqual([{id:"takeoff-default",name:"적산 1",visible:true}]);expect(upgraded.objects).toEqual(original.objects);expect(upgraded.drawing).toEqual(drawing);expect(totals(upgraded).volumeM3).toBeCloseTo(19.2);expect(upgraded.options.cadVisible).toBe(true);expect(original.schemaVersion).toBe(1);
 expect(migrateTakeoff(upgraded)).toBe(upgraded);expect(()=>migrateTakeoff({...original,objects:[{...w1,dimensions:{heightMm:0}}]})).toThrow();
});

it("transfers membership without changing quantities or geometry; honors hidden targets and Undo/Redo",()=>{
 const base={...newTakeoff(drawing,"mm"),objects:[{...w1,label:{visible:true,position:{x:111,y:222}}},s1]};base.layers.push({id:"second",name:"3·4·5호",visible:false});
 const before=structuredClone(base),h=new UndoHistory<typeof base>();h.record(base);const next=moveTakeoffToLayer(base,"W01","second");validateDocument(next);
 expect(base).toEqual(before);expect(next.objects[0]).toEqual({...base.objects[0],layerId:"second"});expect(next.objects[0].geometry).toBe(base.objects[0].geometry);expect(next.objects[1]).toBe(base.objects[1]);expect(next.activeLayerId).toBe(base.activeLayerId);
 expect(totals(next).volumeM3).toBeCloseTo(19.2);expect(totals(next).layers.second.volumeM3).toBe(12);expect(totals(next).layers[base.activeLayerId].volumeM3).toBe(7.2);expect(totals(next).visibleVolumeM3).toBe(7.2);
 expect(h.undo(next)).toEqual(base);expect(h.redo(base)).toEqual(next);expect(moveTakeoffToLayer(next,"W01","second")).toBe(next);expect(()=>moveTakeoffToLayer(base,"W01","missing")).toThrow();expect(()=>moveTakeoffToLayer(base,"missing","second")).toThrow();
});
