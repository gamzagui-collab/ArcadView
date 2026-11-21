import {afterEach,expect,it,vi} from "vitest";
import {addDimensionObject,annotationHit,DIMENSION_LAYER_ID,newAnnotationDocument,readAnnotations,saveAnnotations,translateAnnotation,type Annotation} from "./annotations";
import {dimensionLabelPoint,positionRadialDimension,radialDimensionGeometry} from "./radialDimensions";
import {rotateObject} from "./objectEditing";
const center={x:1e9,y:1e9},radius:Annotation={id:'r',kind:'dimension-radius',layerId:DIMENSION_LAYER_ID,points:[center,{x:center.x+1000,y:center.y}],scale:20};
const angle:Annotation={...radius,id:'a',kind:'dimension-angle',points:[{x:center.x+1000,y:center.y},center,{x:center.x,y:center.y+1000}]};
afterEach(()=>vi.unstubAllGlobals());
it("moves a radius label without moving the center, changing its radius or detaching its arrow from the picked arc point",()=>{
 const moved=positionRadialDimension(radius,{x:center.x+400,y:center.y+1800})!,g=radialDimensionGeometry(moved,'mm')!;
 expect(moved.points).toBe(radius.points);expect(g.value).toBe(1000);expect(g.center).toEqual(center);expect(g.arrows[0].tip).toEqual(radius.points[1]);expect(g.label).toEqual(moved.labelPoint);
 expect(positionRadialDimension(radius,center)).toBeNull();
});
it("moves the angular arc outward from the second-point vertex while retaining its measured 90 degrees",()=>{
 const before=radialDimensionGeometry(angle,'mm')!,moved=positionRadialDimension(angle,{x:center.x+1500,y:center.y+1500})!,after=radialDimensionGeometry(moved,'mm')!;
 expect(moved.points).toBe(angle.points);expect(before.value).toBe(90);expect(after.value).toBe(90);expect(after.center).toEqual(center);
 expect(Math.hypot(after.label.x-center.x,after.label.y-center.y)).toBeGreaterThan(Math.hypot(before.label.x-center.x,before.label.y-center.y));
 expect(after.extensions[0][0]).toEqual(center);expect(after.lines[0]).toHaveLength(before.lines[0].length);
});
it("preserves per-drawing units, label positions and reserved layer ownership through save/reopen, move and rotation",()=>{
 const store=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)});
 const moved=positionRadialDimension(radius,{x:center.x+1200,y:center.y+800})!,doc=addDimensionObject(addDimensionObject(newAnnotationDocument(),moved),angle);
 expect(saveAnnotations('radial',doc)).toBe(true);expect(readAnnotations('radial')).toEqual(doc);
 expect(radialDimensionGeometry(radius,'m')!.textHeight).toBe(.05);
 const shifted=translateAnnotation(moved,center,{x:center.x+20,y:center.y-30});expect(shifted.labelPoint).toEqual({x:moved.labelPoint!.x+20,y:moved.labelPoint!.y-30});expect(radialDimensionGeometry(shifted)!.value).toBe(1000);
 const rotated=rotateObject(moved,center,90);expect(rotated.labelPoint).toEqual({x:center.x-800,y:center.y+1200});expect(radialDimensionGeometry(rotated)!.value).toBe(1000);
});
it("selects the rendered angular arc, rejects invalid references and invalid saved label coordinates",()=>{
 const g=radialDimensionGeometry(angle)!,middle=g.lines[0][Math.floor(g.lines[0].length/2)];expect(annotationHit([angle],middle,1,'drawing')?.id).toBe('a');
 expect(dimensionLabelPoint({...radius,points:[center,center]})).toBeNull();expect(radialDimensionGeometry({...angle,points:[angle.points[0],center,angle.points[0]]})).toBeNull();
 vi.stubGlobal('localStorage',{setItem:vi.fn()});expect(saveAnnotations('bad',addDimensionObject(newAnnotationDocument(),{...radius,labelPoint:{x:NaN,y:0}}))).toBe(false);
});
