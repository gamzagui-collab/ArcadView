import {afterEach,expect,it,vi} from "vitest";
import {addDimensionObject,dimensionLayer,DIMENSION_LAYER_ID,drawingLayers,ensureDimensionLayer,ensurePointLayer,newAnnotationDocument,POINT_LAYER_ID,readAnnotations,removeDrawingLayer,saveAnnotations,visibleAnnotations,type Annotation} from "./annotations";
import {annotationUsage} from "../commerce/annotationUsage";
const dimension=():Annotation=>({id:"dim",kind:"dimension-aligned",layerId:DIMENSION_LAYER_ID,points:[{x:0,y:0},{x:3000,y:4000},{x:100,y:100}],scale:20});
const storage=()=>{const map=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>map.get(k),setItem:(k:string,v:string)=>map.set(k,v)});return map;};
afterEach(()=>vi.unstubAllGlobals());

it("adds dimensions to protected layer 5 without changing the last drawing layer or existing objects",()=>{
 const doc=newAnnotationDocument();doc.layers.push({id:"second",name:"2",color:"#ffffff",visible:true},{id:"third",name:"3",color:"#ffffff",visible:true});doc.activeLayer="second";
 const before=JSON.stringify(doc),next=addDimensionObject(ensurePointLayer(doc),dimension());
 expect(JSON.stringify(doc)).toBe(before);expect(next.activeLayer).toBe("second");expect(drawingLayers(next)).toHaveLength(3);
 expect(next.layers.map(l=>l.id)).toEqual(["base","second","third",POINT_LAYER_ID,DIMENSION_LAYER_ID]);expect(dimensionLayer(next).name).toBe("치수그리기");
 expect(ensureDimensionLayer(next)).toBe(next);expect(ensurePointLayer(ensureDimensionLayer(doc)).layers.map(l=>l.id)).toEqual(next.layers.map(l=>l.id));
});
it("round trips five layers, preserves legacy dimensions and rejects non-dimensions on layer 5",()=>{
 const store=storage(),legacy=newAnnotationDocument();legacy.objects.push({...dimension(),layerId:"base"});
 expect(saveAnnotations("legacy",legacy)).toBe(true);expect(readAnnotations("legacy")).toEqual(legacy);expect(store.get("arcad.annotations.v1.legacy")).toBe(JSON.stringify(legacy));
 const next=addDimensionObject(ensurePointLayer(legacy),dimension());expect(saveAnnotations("new",next)).toBe(true);expect(readAnnotations("new")).toEqual(next);
 for(const bad of [{...next,activeLayer:DIMENSION_LAYER_ID},{...next,layers:next.layers.map(l=>l.id===DIMENSION_LAYER_ID?{...l,name:"other"}:l)},{...next,objects:[{...dimension(),kind:"polyline" as const}]}])expect(saveAnnotations("new",bad)).toBe(false);
 expect(readAnnotations("new")).toEqual(next);expect(()=>addDimensionObject(next,{...dimension(),kind:"rectangle"})).toThrow();expect(()=>addDimensionObject(next,{...dimension(),layerId:"base"})).toThrow();
});
it("preserves both reserved layers when an ordinary layer is deleted and supports hiding dimensions",()=>{
 const doc=addDimensionObject(ensurePointLayer(newAnnotationDocument()),dimension());
 expect(removeDrawingLayer(doc,DIMENSION_LAYER_ID)).toBe(doc);expect(removeDrawingLayer(doc,POINT_LAYER_ID)).toBe(doc);
 const next=removeDrawingLayer(doc,"base");expect(next.objects).toEqual(doc.objects);expect(next.activeLayer).toBe("base");expect(next.layers.map(l=>l.id)).toEqual(doc.layers.map(l=>l.id));
 const hidden={...next,layers:next.layers.map(l=>l.id===DIMENSION_LAYER_ID?{...l,visible:false}:l)};expect(visibleAnnotations(hidden)).toEqual([]);expect(next.objects).toHaveLength(1);
});
it("charges a completed dimension once, without treating the automatic reserved layer as a paid layer creation",()=>{
 const doc=newAnnotationDocument(),next=addDimensionObject(doc,dimension());
 expect(annotationUsage(doc,next,"dimension-aligned")).toBe("draw.dimension");
 expect(annotationUsage(doc,ensureDimensionLayer(doc),"select")).toBeNull();
 const ordinary={...doc,layers:[...doc.layers,{id:"new",name:"2",color:"#ffffff",visible:true}]};expect(annotationUsage(doc,ordinary,"select")).toBe("layer.create");
});
