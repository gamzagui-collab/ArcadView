import {afterEach,expect,it,vi} from "vitest";
import {objectSize,nearestSizeSegment,resizeObject} from "./objectSizing";
import {annotationPoints,newAnnotationDocument,readAnnotations,saveAnnotations,sourceAnnotation,type Annotation} from "./annotations";
import {rotateObject} from "./objectEditing";
import {distance} from "./measurementGeometry";
import {UndoHistory} from "./undoHistory";
import {annotationUsage} from "../commerce/annotationUsage";
import {POLYLINE_DIRECT_KEY,readPolylineDirect,savePolylineDirect} from "./polylineOptions";
const circle:Annotation={id:"c",kind:"circle",layerId:"base",points:[{x:1e9,y:2e9},{x:1e9+300,y:2e9+400}],color:"#49cfff",screenWidth:3};
afterEach(()=>vi.unstubAllGlobals());
it.each(["circle","arc"]as const)("shows and changes %s radius with a fixed center, style, layer and arc angles",kind=>{
 const o={...circle,kind,start:.3,sweep:1.5},info=objectSize(o)!;expect(info.values).toEqual([500]);const resized=resizeObject(o,[750])!;
 expect(resized.points[0]).toBe(o.points[0]);expect(distance(...resized.points as [typeof circle.points[0],typeof circle.points[0]])).toBeCloseTo(750,6);
 expect({...resized,points:undefined}).toEqual({...o,points:undefined});expect(resizeObject(o,[500])).toBe(o);
});
it("resizes a rotated rectangle in its original local directions without moving the first corner",()=>{
 const r:Annotation={id:"r",layerId:"base",kind:"rectangle",points:[{x:1e9,y:2e9},{x:1e9+300,y:2e9-400}]},o=rotateObject(r,r.points[0],37),p=annotationPoints(o),next=resizeObject(o,[600,900])!,q=annotationPoints(next);
 expect(q[0]).toEqual(p[0]);expect(objectSize(next)!.values[0]).toBeCloseTo(600,5);expect(objectSize(next)!.values[1]).toBeCloseTo(900,5);
 expect((q[1].x-q[0].x)/600).toBeCloseTo((p[1].x-p[0].x)/300,7);expect((q[3].y-q[0].y)/900).toBeCloseTo((p[3].y-p[0].y)/400,7);
});
it("picks and resizes only the chosen polyline segment, keeping its start and unrelated vertices",()=>{
 const o:Annotation={id:"p",layerId:"base",kind:"polyline",points:[{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:800,y:400}]};
 expect(nearestSizeSegment(o,{x:302,y:200})).toBe(1);expect(objectSize(o,1)!.values).toEqual([400]);const n=resizeObject(o,[700],1)!;
 expect(n.points).toEqual([o.points[0],o.points[1],{x:300,y:700},o.points[3]]);expect(o.points[2]).toEqual({x:300,y:400});expect(objectSize(n,1)!.values).toEqual([700]);
});
it("keeps a closed polyline closed when editing its last segment and refuses collapsed neighbors",()=>{
 const o:Annotation={id:"p",layerId:"base",kind:"polyline",points:[{x:0,y:0},{x:300,y:0},{x:300,y:400},{x:0,y:0}]};
 const n=resizeObject(o,[250],2)!;expect(n.points[0]).toEqual(n.points.at(-1));expect(objectSize(n,2)!.values).toEqual([250]);expect(n.points[2]).toEqual(o.points[2]);
 const line={...o,points:[{x:0,y:0},{x:100,y:0},{x:200,y:0}]};expect(resizeObject(line,[200],0)).toBeNull();
});
it("preserves untouched saved values and masks an original only after a real edit",()=>{
 const store=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)});
 const d=newAnnotationDocument(),before={...d,objects:[circle]},next={...d,objects:[resizeObject(circle,[650])!]},h=new UndoHistory<typeof d>();h.record(before);
 expect(annotationUsage(before,next,"select")).toBe("edit.reshape");expect(saveAnnotations("sizing",next)).toBe(true);expect(readAnnotations("sizing")).toEqual(next);expect(h.undo(next)).toEqual(before);expect(h.redo(before)).toEqual(next);
 const entity={kind:"CIRCLE",points:annotationPoints(circle),bounds:{minX:1e9-500,minY:2e9-500,maxX:1e9+500,maxY:2e9+500},length:Math.PI*1000,approximate:false},copy=sourceAnnotation(entity,"base"),original=JSON.stringify(entity);
 expect(objectSize(copy)!.values).toEqual([500]);expect(resizeObject(copy,[750])!.kind).toBe("circle");expect(JSON.stringify(entity)).toBe(original);
});
it("rejects invalid sizes and nonstraight curves without reinterpreting geometry",()=>{
 for(const n of [0,-1,NaN,Infinity,1e13])expect(resizeObject(circle,[n])).toBeNull();
 expect(objectSize({...circle,kind:"polyline",curved:true})).toBeNull();expect(objectSize({...circle,approximate:true})).toBeNull();expect(objectSize({...circle,kind:"text"})).toBeNull();expect(resizeObject(circle,[1,2])).toBeNull();
});
it("defaults to numeric entry, remembers direct mode and tolerates unavailable preference storage",()=>{
 const store=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)});expect(readPolylineDirect()).toBe(false);savePolylineDirect(true);expect(store.get(POLYLINE_DIRECT_KEY)).toBe("true");expect(readPolylineDirect()).toBe(true);savePolylineDirect(false);expect(readPolylineDirect()).toBe(false);
 vi.stubGlobal("localStorage",{getItem:()=>{throw Error("disabled")},setItem:()=>{throw Error("disabled")}});expect(readPolylineDirect()).toBe(false);expect(()=>savePolylineDirect(true)).not.toThrow();
});
