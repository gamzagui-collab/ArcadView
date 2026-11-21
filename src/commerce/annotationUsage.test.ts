import {it,expect} from "vitest";
import { annotationUsage } from "./annotationUsage";
import {newAnnotationDocument,ensurePointLayer,POINT_LAYER_ID,type Annotation} from "../viewer/annotations";
it("select, layer visibility/name, undo and deletion do not become creation debits",()=>{
 const d=newAnnotationDocument();
 expect(annotationUsage(d,{...d,layers:d.layers.map(l=>({...l,name:"typing",visible:false}))},"select")).toBeNull();
 const object:Annotation={id:"one",layerId:d.activeLayer,kind:"polyline",points:[{x:0,y:0},{x:1,y:1}]};
 expect(annotationUsage({...d,objects:[object]},d,"select")).toBeNull();
 expect(annotationUsage(d,{...d,objects:[{...object,kind:"mask"}]},"select")).toBeNull();
 expect(annotationUsage(d,{...d,objects:[object]},"trim")).toBeNull();
});
it("an entire polyline and a point annotation each represent one operation",()=>{
 const d=newAnnotationDocument();
 const o:Annotation={id:"one",layerId:d.activeLayer,kind:"polyline",points:Array.from({length:200},(_,x)=>({x,y:x}))};
 expect(annotationUsage(d,{...d,objects:[o]},"polyline")).toBe("draw.polyline");
 const point=ensurePointLayer(d);
 expect(annotationUsage(d,{...point,objects:[{...o,layerId:POINT_LAYER_ID,kind:"point-cloud"}]},"point-cloud")).toBe("draw.point");
 expect(annotationUsage(d,point,"select")).toBeNull();
});
it("completed move and ordinary layer creation are classified independently of UI selection",()=>{
 const d=newAnnotationDocument(),o:Annotation={id:"one",layerId:d.activeLayer,kind:"circle",points:[{x:0,y:0},{x:1,y:1}]};
 expect(annotationUsage({...d,objects:[o]},{...d,objects:[{...o,points:[{x:2,y:2},{x:3,y:3}]}]},"move")).toBe("edit.move");
 expect(annotationUsage(d,{...d,layers:[...d.layers,{id:"new",name:"2",color:"#ffffff",visible:true}]},"select")).toBe("layer.create");
});

it("charges a new angular or radius dimension once, while label placement does not create a second measurement debit",()=>{
 const d=newAnnotationDocument();
 for(const kind of ["dimension-radius","dimension-angle","dimension-aligned","dimension-linear"]as const){
  const o:Annotation={id:"radial",layerId:"arcad-dimension-layer",kind,points:kind==="dimension-radius"?[{x:0,y:0},{x:500,y:0}]:[{x:500,y:0},{x:0,y:0},{x:0,y:500}],scale:20},before={...d,objects:[o]};
  expect(annotationUsage(d,before,kind)).toBe("draw.dimension");
  expect(annotationUsage(before,{...before,objects:[{...o,labelPoint:{x:1000,y:1000}}]},kind)).toBeNull();
  expect(annotationUsage(before,{...before,objects:[{...o,labelPoint:{x:1000,y:1000}}]},"select")).toBeNull();
  expect(annotationUsage(before,{...before,objects:[{...o,textPoint:{x:1000,y:1000}}]},"select")).toBeNull();
  expect(annotationUsage(before,{...before,objects:[{...o,points:o.points.map(p=>({x:p.x*2,y:p.y*2}))}]},kind)).toBe("draw.dimension");
 }
});
it("uses the existing circular drawing operation for a newly completed arc",()=>{
 const d=newAnnotationDocument(),o:Annotation={id:"arc",layerId:d.activeLayer,kind:"arc",points:[{x:0,y:0},{x:50,y:0}],start:0,sweep:Math.PI};
 expect(annotationUsage(d,{...d,objects:[o]},"arc")).toBe("draw.circle");
});
