import {afterEach,expect,it,vi} from "vitest";
import {addDimensionObject,dimensionGeometry,newAnnotationDocument,readAnnotations,saveAnnotations,type Annotation} from "./annotations";
import {createDimensionSeries,reflowDimensionSeries} from "./dimensionSeries";
import {styleAnnotation} from "./annotationStyle";
import {dimensionTextHeight,parseDimensionTextHeight} from "./dimensionSizing";
import {gripScreenPosition,objectGrips,reshapeObject,rotateObject} from "./objectEditing";
import {positionDimension} from "./dimensionPlacement";
import {radialDimensionGeometry} from "./radialDimensions";
import {UndoHistory} from "./undoHistory";
const template:Annotation={id:"series",layerId:"arcad-dimension-layer",kind:"dimension-linear",scale:20,dimensionTextHeight:180,points:[]};
const picks=[{x:1e9,y:2e9},{x:1e9+3000,y:2e9+400},{x:1e9+7000,y:2e9+500},{x:1e9+12000,y:2e9+800}];
const values=(objects:Annotation[])=>objects.map(o=>dimensionGeometry(o,"mm")!.value);
afterEach(()=>vi.unstubAllGlobals());
it("accepts positive text heights while rejecting empty, zero, negative and non-finite input",()=>{
 for(const text of [""," ","0","-1","NaN","Infinity","1e13"])expect(parseDimensionTextHeight(text)).toBeNull();
 for(const text of ["120","0.18","1e-4"])expect(parseDimensionTextHeight(text)).toBe(Number(text));
});
it("uses a smaller explicit height for both series without changing distances, and tightens baseline steps",()=>{
 for(const mode of ["chain","baseline"]as const){
  const large=createDimensionSeries(template,picks,mode,"x"),small=createDimensionSeries({...template,dimensionTextHeight:60},picks,mode,"x");
  expect(values(small)).toEqual(values(large));expect(small.every(o=>dimensionTextHeight(o,"mm")===60)).toBe(true);
  if(mode==="baseline")expect(small[1].points[2].y-small[0].points[2].y).toBe(120);
 }
});
it("chains consecutive horizontal projected distances and keeps the original picked coordinates",()=>{
 const objects=createDimensionSeries(template,picks,"chain","auto");
 expect(values(objects)).toEqual([3000,4000,5000]);
 expect(objects.map(o=>o.points.slice(0,2))).toEqual([[picks[0],picks[1]],[picks[1],picks[2]],[picks[2],picks[3]]]);
 expect(new Set(objects.map(o=>o.id)).size).toBe(3);
 expect(new Set(objects.map(o=>dimensionGeometry(o,"mm")!.first.y)).size).toBe(1);
});
it("baselines from the first pick, stepping each row by twice the text height",()=>{
 const objects=createDimensionSeries(template,picks,"baseline","auto");
 expect(values(objects)).toEqual([3000,7000,12000]);expect(objects.every(o=>o.points[0]===picks[0])).toBe(true);
 const y=objects.map(o=>dimensionGeometry(o,"mm")!.first.y);expect(y[1]-y[0]).toBe(360);expect(y[2]-y[1]).toBe(360);
});
it.each(["chain","baseline"]as const)("measures vertical projections in %s mode, never diagonal lengths",mode=>{
 const points=picks.map(p=>({x:p.y,y:p.x})),objects=createDimensionSeries(template,points,mode,"auto");
 expect(values(objects)).toEqual(mode==="chain"?[3000,4000,5000]:[3000,7000,12000]);
 expect(objects.every(o=>o.dimensionAxis==="y")).toBe(true);
 const forced=createDimensionSeries(template,picks,mode,"y");expect(values(forced)).toEqual(mode==="chain"?[400,100,300]:[400,500,800]);
});
it("locks auto to the first span, supports the opposite side and rejects zero projected spans",()=>{
 const objects=createDimensionSeries(template,picks,"baseline","x",-1);
 expect(objects[0].points[2].y).toBe(picks[0].y-540);expect(objects[1].points[2].y).toBe(picks[0].y-900);
 expect(createDimensionSeries(template,[picks[0]],"chain","auto")).toEqual([]);
 expect(createDimensionSeries(template,[picks[0],{x:picks[0].x,y:picks[0].y+10}],"chain","x")).toEqual([]);
});
it("enlarges text and arrows with width and reflows all baseline rows without changing measured points",()=>{
 const before=createDimensionSeries(template,picks,"baseline","x"),styled=styleAnnotation(before[1],{screenWidth:8}),after=reflowDimensionSeries(before.map((o,i)=>i===1?styled:o));
 expect(styled.dimensionTextHeight).toBe(360);expect(values(after)).toEqual(values(before));
 expect(after.map(o=>o.points.slice(0,2))).toEqual(before.map(o=>o.points.slice(0,2)));
 expect(after[1].points[2].y-after[0].points[2].y).toBe(720);expect(after[2].points[2].y-after[1].points[2].y).toBe(720);
 expect(before[1].dimensionTextHeight).toBe(180);
 expect(styleAnnotation(styled,{screenWidth:2}).dimensionTextHeight).toBe(180);
});
it("preserves legacy scaled dimensions and unit conversion while linking their text to the width",()=>{
 const legacy={...template,dimensionTextHeight:undefined,points:[{x:0,y:0},{x:300,y:400},{x:0,y:800}]};
 expect(dimensionTextHeight(legacy,"mm")).toBe(50);expect(dimensionTextHeight(legacy,"m")).toBe(.05);
 expect(dimensionGeometry(styleAnnotation(legacy,{screenWidth:8}),"mm")!.textHeight).toBe(100);
 expect(radialDimensionGeometry({...legacy,kind:"dimension-radius",dimensionTextHeight:180,points:legacy.points.slice(0,2)},"mm")!.textHeight).toBe(180);
});
it("keeps manual placement, moves, reshaping and rotation separate from automatic series layout",()=>{
 const [o]=createDimensionSeries(template,picks,"baseline","x");
 for(const changed of [positionDimension(o,{x:0,y:100})!,reshapeObject(o,"vertex:1",{x:1e9+4000,y:2e9})!,rotateObject(o,picks[0],90)])expect(changed.dimensionSeries).toBeUndefined();
 expect(positionDimension(o,{x:0,y:100})!.dimensionAxis).toBe("x");
});
it("places the grip below the dimension anchor without moving text or references",()=>{
 const [o]=createDimensionSeries(template,picks,"baseline","x"),project=(p:readonly {x:number;y:number}[])=>p.map(p=>({x:(p.x-1e9)/20,y:800-(p.y-2e9)/20}));
 const grips=objectGrips(o),position=grips.find(g=>g.id==="dimension-position")!,p=project([position.point])[0];
 expect(gripScreenPosition(position,project)).toEqual({x:p.x,y:p.y+12});expect(gripScreenPosition(grips[0],project)).toEqual(project([picks[0]])[0]);
});
it("saves series metadata, styles and spacing and undoes/redoes the entire created set",()=>{
 const store=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)});
 const before=newAnnotationDocument(),after=createDimensionSeries(template,picks,"baseline","x").reduce(addDimensionObject,before),history=new UndoHistory<typeof before>();
 history.record(before);expect(saveAnnotations("series",after)).toBe(true);expect(readAnnotations("series")).toEqual(after);
 expect(history.undo(after)).toEqual(before);expect(history.redo(before)).toEqual(after);
 for(const dimensionSeries of [null,{...after.objects[0].dimensionSeries,index:-1},{...after.objects[0].dimensionSeries,origin:Infinity},{...after.objects[0].dimensionSeries,mode:"free"}])expect(saveAnnotations("bad",{...after,objects:[{...after.objects[0],dimensionSeries} as Annotation]})).toBe(false);
 expect(saveAnnotations("bad",{...after,objects:[{...after.objects[0],dimensionTextHeight:0}]})).toBe(false);
});
