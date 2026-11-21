import {expect,it} from "vitest";
import {constructGeometry,constructionDefaults} from "./constructionGeometry";
import {annotationGeometry,annotationPoints,addDimensionObject,annotationHit,DIMENSION_LAYER_ID,dimensionGeometry,newAnnotationDocument,readAnnotations,saveAnnotations,translateAnnotation,type Annotation} from "./annotations";
import {dimensionPosition,dimensionTextPosition,positionDimension,positionDimensionText} from "./dimensionPlacement";
import {radialDimensionGeometry} from "./radialDimensions";
import {rotateObject} from "./objectEditing";
import {distance} from "./measurementGeometry";
import {vi,afterEach} from "vitest";
afterEach(()=>vi.unstubAllGlobals());
it("prefills radius, width/height and only the last polyline segment, then preserves directions at exact sizes",()=>{
 const c=[{x:10,y:20},{x:13,y:24}];expect(constructionDefaults("circle",c)).toEqual([5]);expect(constructGeometry("circle",c,[10])!.points).toEqual([c[0],{x:16,y:28}]);
 const r=[{x:100,y:300},{x:20,y:100}];expect(constructionDefaults("rectangle",r)).toEqual([80,200]);expect(constructGeometry("rectangle",r,[50,70])!.points).toEqual([r[0],{x:50,y:230}]);
 const p=[{x:-10,y:0},{x:0,y:0},{x:3,y:4}];expect(constructionDefaults("polyline",p)).toEqual([5]);expect(constructGeometry("polyline",p,[10])!.points).toEqual([p[0],p[1],{x:6,y:8}]);expect(p.at(-1)).toEqual({x:3,y:4});
});
it.each([1,-1])("keeps two arc endpoints, chooses the indicated center side and honors the radius: side=%s",side=>{
 const p=[{x:1e9,y:2e9},{x:1e9+600,y:2e9},{x:1e9+270,y:2e9+side*400}];expect(constructionDefaults("arc",p)).toEqual([500]);
 for(const radius of [300,500,700]){
  const g=constructGeometry("arc",p,[radius])!,o:Annotation={id:"arc",layerId:"base",kind:"arc",...g},ends=annotationPoints(o);
  expect(distance(ends[0],p[0])).toBeLessThan(1e-5);expect(distance(ends.at(-1)!,p[1])).toBeLessThan(1e-5);expect(distance(g.points[0],g.points[1])).toBeCloseTo(radius,5);
  expect(Math.sign(g.points[0].y-p[0].y)).toBe(radius===300?0:side);expect(annotationGeometry([o]).entities[0].kind).toBe("ARC");expect(annotationGeometry([o]).snaps.some(s=>s.kind==="center")).toBe(true);
 }
 expect(constructGeometry("arc",p,[299])).toBeNull();
});
it("rejects invalid sizes and coincident arc endpoints without mutating prior picks",()=>{
 const p=[{x:0,y:0},{x:0,y:0},{x:0,y:10}];expect(constructionDefaults("arc",p)).toBeNull();expect(constructGeometry("arc",p,[10])).toBeNull();
 for(const value of [0,-1,NaN,Infinity,1e13])expect(constructGeometry("circle",[{x:0,y:0},{x:5,y:0}],[value])).toBeNull();
 expect(constructGeometry("rectangle",p.slice(0,2),[10])).toBeNull();
});
it.each(["dimension-aligned","dimension-linear","dimension-angle","dimension-radius"]as const)("moves only dimension text and connects it to unchanged geometry: %s",kind=>{
 const o:Annotation={id:kind,layerId:DIMENSION_LAYER_ID,kind,points:kind==="dimension-radius"?[{x:0,y:0},{x:300,y:0}]:kind==="dimension-angle"?[{x:300,y:0},{x:0,y:0},{x:0,y:400}]:[{x:0,y:0},{x:300,y:400},{x:150,y:800}],scale:20};
 const before=kind==="dimension-angle"||kind==="dimension-radius"?radialDimensionGeometry(o)!:dimensionGeometry(o,"mm")!,moved=positionDimensionText(o,{x:900,y:1100})!;
 expect(moved.points).toBe(o.points);expect(moved.labelPoint).toBe(o.labelPoint);expect(dimensionTextPosition(moved)).toEqual({x:900,y:1100});expect(dimensionPosition(moved)).toEqual(dimensionPosition(o));
 const after=kind==="dimension-angle"||kind==="dimension-radius"?radialDimensionGeometry(moved)!:dimensionGeometry(moved,"mm")!;expect(after.value).toBe(before.value);expect(annotationHit([moved],{x:900,y:1100},1,"mm")?.id).toBe(o.id);
 if("leader"in after){expect(after.leader?.[1]).toEqual(moved.textPoint);expect(after.first).toEqual((before as typeof after).first);expect(after.second).toEqual((before as typeof after).second);}
 else {expect(after.lines.at(-1)!.at(-1)).toEqual(moved.textPoint);expect(after.arrows.map(a=>a.tip)).toEqual((before as typeof after).arrows.map(a=>a.tip));}
 const positioned=positionDimension(moved,{x:0,y:1500})!,a=dimensionPosition(moved)!,b=dimensionPosition(positioned)!;expect(positioned.textPoint).toEqual({x:900+(b.x-a.x),y:1100+(b.y-a.y)});
 const shifted=translateAnnotation(moved,{x:0,y:0},{x:10,y:20});expect(shifted.textPoint).toEqual({x:910,y:1120});expect(rotateObject(moved,{x:0,y:0},90).textPoint).toEqual({x:-1100,y:900});
 const store=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)});const doc=addDimensionObject(newAnnotationDocument(),moved);expect(saveAnnotations(kind,doc)).toBe(true);expect(readAnnotations(kind)).toEqual(doc);
});
