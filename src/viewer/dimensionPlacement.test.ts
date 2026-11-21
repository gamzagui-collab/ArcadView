import {afterEach,expect,it,vi} from "vitest";
import {addDimensionObject,annotationHit,dimensionGeometry,DIMENSION_LAYER_ID,newAnnotationDocument,readAnnotations,saveAnnotations,translateAnnotation,type Annotation} from "./annotations";
import {dimensionPosition,positionDimension} from "./dimensionPlacement";
import {canPositionObject,moveHandlePosition,objectGrips,reshapeObject,rotateObject} from "./objectEditing";
import {UndoHistory} from "./undoHistory";
const origin={x:1e9,y:2e9};
const aligned:Annotation={id:"a",kind:"dimension-aligned",layerId:DIMENSION_LAYER_ID,scale:20,points:[origin,{x:origin.x+300,y:origin.y+400},{x:origin.x-80,y:origin.y+60}]};
const linear:Annotation={...aligned,id:"l",kind:"dimension-linear",points:[origin,{x:origin.x+300,y:origin.y+400},{x:origin.x+150,y:origin.y+700}]};
afterEach(()=>vi.unstubAllGlobals());
it("places a diagonal aligned dimension perpendicular to its baseline without changing any picks or its 500-unit value",()=>{
 const target={x:origin.x+1000,y:origin.y-700},moved=positionDimension(aligned,target)!,g=dimensionGeometry(moved,"mm")!;
 expect(moved.points).toBe(aligned.points);expect(g.value).toBe(500);expect(g.extensions.map(e=>e[0])).toEqual(aligned.points.slice(0,2));
 expect((g.first.x-origin.x)*300+(g.first.y-origin.y)*400).toBeCloseTo(0,3);
 expect(dimensionPosition(moved)).toEqual(moved.labelPoint);expect(annotationHit([moved],moved.labelPoint!,1,"mm")?.id).toBe("a");
 expect(aligned.labelPoint).toBeUndefined();
});
it.each([false,true])("keeps the original linear axis even when dragged across the opposite side: vertical=%s",vertical=>{
 const o=vertical?{...linear,points:[...linear.points.slice(0,2),{x:origin.x+700,y:origin.y+200}]}:linear;
 const g=dimensionGeometry(positionDimension(o,{x:origin.x-9000,y:origin.y-8000})!,"drawing")!;
 expect(g.value).toBe(vertical?400:300);
 expect(vertical?g.first.x:g.first.y).toBe(vertical?origin.x-9000:origin.y-8000);
 expect(vertical?g.second.x:g.second.y).toBe(vertical?g.first.x:g.first.y);
 expect(g.extensions.map(e=>e[0])).toEqual(o.points.slice(0,2));
});
it("retains a rotated linear axis and placed label through whole-object move and rotation",()=>{
 const rotated=rotateObject(linear,origin,37),moved=positionDimension(rotated,{x:origin.x+9000,y:origin.y-8000})!,g=dimensionGeometry(moved,"mm")!;
 expect(g.value).toBeCloseTo(300,5);expect(moved.points).toBe(rotated.points);
 const translated=translateAnnotation(moved,origin,{x:origin.x+50,y:origin.y-70});
 expect(dimensionGeometry(translated,"mm")!.value).toBeCloseTo(300,5);
 expect(translated.labelPoint).toEqual({x:moved.labelPoint!.x+50,y:moved.labelPoint!.y-70});
 expect(dimensionGeometry(rotateObject(moved,origin,90),"mm")!.value).toBeCloseTo(300,5);
});
it("uses the cross and placement grip for positioning; reference grips still require metered editing access",()=>{
 const denied=vi.fn(()=>false);
 for(const o of [aligned,linear]){
  expect(canPositionObject(o,denied)).toBe(true);expect(denied).not.toHaveBeenCalled();
  const grips=objectGrips(o);expect(grips.map(g=>g.id)).toEqual(["vertex:0","vertex:1","dimension-position"]);
  const moved=reshapeObject(o,"dimension-position",{x:origin.x+2000,y:origin.y+2000})!;expect(moved.points).toBe(o.points);
  const project=(p:readonly {x:number;y:number}[])=>p.map(p=>({x:(p.x-origin.x)/10,y:300-(p.y-origin.y)/10}));
  const middle=project([dimensionPosition(o)!])[0];expect(moveHandlePosition(o,project,1000,1000)).toEqual({x:Math.max(22,middle.x),y:middle.y+30});
 }
 expect(canPositionObject(linear,denied,false)).toBe(false);expect(denied).toHaveBeenCalledWith("edit.reshape");
 expect(canPositionObject({...linear,kind:"polyline"},denied)).toBe(false);
});
it("persists new and legacy-layer dimension positions, including undo/redo, without moving references",()=>{
 const store=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)});
 const original=addDimensionObject(addDimensionObject(newAnnotationDocument(),aligned),linear),history=new UndoHistory<typeof original>();
 const next={...original,objects:original.objects.map(o=>positionDimension(o,{x:origin.x+200,y:origin.y+900})!)};
 history.record(original);expect(saveAnnotations("placement",next)).toBe(true);expect(readAnnotations("placement")).toEqual(next);
 const undone=history.undo(next)!;expect(undone).toEqual(original);expect(history.redo(undone)).toEqual(next);
 const legacy={...next,objects:next.objects.map(o=>({...o,layerId:next.activeLayer}))};expect(saveAnnotations("legacy",legacy)).toBe(true);expect(readAnnotations("legacy")).toEqual(legacy);
 expect(positionDimension(linear,{x:Infinity,y:0})).toBeNull();
 expect(saveAnnotations("invalid",{...next,objects:[{...linear,labelPoint:{x:NaN,y:0}}]})).toBe(false);
 expect(positionDimension({...linear,kind:"polyline"},{x:0,y:0})).toBeNull();
});
