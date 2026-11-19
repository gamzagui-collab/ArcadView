import {afterEach,expect,it,vi}from"vitest";
import {nearestSnap}from"./measurementGeometry";
import {annotationGeometry,annotationHit,annotationPoints,defaultTextHeight,dimensionGeometry,lineIntersection,masked,newAnnotationDocument,readAnnotations,saveAnnotations,sourceMoveObjects,textBounds,translateAnnotation,trimAnnotation,visibleAnnotations,visibleEntityFragment,type Annotation}from"./annotations";
const line=(id:string,points:{x:number;y:number}[]):Annotation=>({id,layerId:"base",kind:"polyline",points});
afterEach(()=>vi.unstubAllGlobals());
it("removes only the interval between cutting lines, retaining both ends",()=>{
 const target=line("a",[{x:0,y:0},{x:100,y:0}]),cutters=[line("b",[{x:30,y:-10},{x:30,y:10}]),line("c",[{x:70,y:-10},{x:70,y:10}])];
 const r=trimAnnotation(target,cutters,[],{x:50,y:0})!;
 expect(r.removed).toEqual([{x:30,y:0},{x:70,y:0}]);expect(r.kept.map(o=>o.points)).toEqual([[{x:0,y:0},{x:30,y:0}],[{x:70,y:0},{x:100,y:0}]]);
 expect(target.points).toHaveLength(2);
 expect(trimAnnotation(target,[],[],{x:50,y:0})).toBeNull();
});
it("trims an open tail at one boundary and preserves large-coordinate precision",()=>{
 const x=1e9,t=line("a",[{x,y:x},{x:x+100,y:x}]);
 const r=trimAnnotation(t,[],[[{x:x+40,y:x-10},{x:x+40,y:x+10}]],{x:x+80,y:x})!;
 expect(r.kept[0].points).toEqual([{x,y:x},{x:x+40,y:x}]);
 expect(lineIntersection({x,y:x},{x:x+100,y:x},{x:x+40,y:x-10},{x:x+40,y:x+10})).toEqual({x:x+40,y:x});
});
it("uses an exact circular boundary and converts a trimmed circle to an arc",()=>{
 const circle:Annotation={id:"c",layerId:"base",kind:"circle",points:[{x:50,y:0},{x:70,y:0}]};
 const r=trimAnnotation(line("a",[{x:0,y:0},{x:100,y:0}]),[circle],[],{x:50,y:0})!;
 expect(r.removed).toEqual([{x:30,y:0},{x:70,y:0}]);
 const arc=trimAnnotation(circle,[],[[{x:50,y:-50},{x:50,y:50}]],{x:70,y:0})!;
 expect(arc.kept).toHaveLength(1);expect(arc.kept[0].kind).toBe("arc");expect(arc.kept[0].sweep).toBeCloseTo(Math.PI);
 const p=annotationPoints(arc.kept[0]);expect(p.every(p=>p.x<=50+1e-7)).toBe(true);
});
it("retains a connected remainder across a closed polyline's start point",()=>{
 const target:Annotation={id:"r",layerId:"base",kind:"rectangle",points:[{x:0,y:0},{x:100,y:100}]};
 const r=trimAnnotation(target,[],[[{x:20,y:-10},{x:20,y:10}],[{x:80,y:-10},{x:80,y:10}]],{x:50,y:0})!;
 expect(r.removed).toEqual([{x:20,y:0},{x:80,y:0}]);expect(r.kept).toHaveLength(1);
 expect(r.kept[0].points).toEqual([{x:80,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100},{x:0,y:0},{x:20,y:0}]);
});
it("makes masking reversible through layer visibility without changing source geometry",()=>{
 const doc=newAnnotationDocument(),original=[{x:0,y:0},{x:100,y:0}];doc.objects.push({...line("m",original),kind:"mask"});
 expect(masked({x:50,y:0},visibleAnnotations(doc),.01)).toBe(true);
 doc.layers[0].visible=false;expect(masked({x:50,y:0},visibleAnnotations(doc),.01)).toBe(false);
 expect(original).toEqual([{x:0,y:0},{x:100,y:0}]);
});
it("computes fixed world-scale dimensions and both projection orientations",()=>{
 const dim:Annotation={id:"d",layerId:"base",kind:"dimension-aligned",points:[{x:0,y:0},{x:300,y:400},{x:0,y:100}],scale:20};
 expect(dimensionGeometry(dim,"mm")?.value).toBe(500);expect(dimensionGeometry(dim,"mm")?.textHeight).toBe(50);
 const horizontal=dimensionGeometry({...dim,kind:"dimension-linear",points:[dim.points[0],dim.points[1],{x:150,y:1000}]},"mm")!;
 expect(horizontal.value).toBe(300);expect(horizontal.first.y).toBe(1000);
 const vertical=dimensionGeometry({...dim,kind:"dimension-linear",points:[dim.points[0],dim.points[1],{x:1000,y:200}]},"mm")!;
 expect(vertical.value).toBe(400);expect(vertical.first.x).toBe(1000);
});
it("round trips document layers and masks, rejects invalid persisted content, reports storage failure",()=>{
 const store=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)});
 const doc=newAnnotationDocument();doc.objects.push({...line("m",[{x:0,y:0},{x:1,y:0}]),kind:"mask"});
 expect(saveAnnotations("file-a",doc)).toBe(true);expect(readAnnotations("file-a")).toEqual(doc);expect(readAnnotations("file-b").objects).toHaveLength(0);
 store.set("arcad.annotations.v1.file-b",JSON.stringify({...doc,layers:Array(4).fill(doc.layers[0])}));expect(readAnnotations("file-b").layers).toHaveLength(1);
 vi.stubGlobal("localStorage",{setItem:()=>{throw Error("quota");}});expect(saveAnnotations("file-a",doc)).toBe(false);
});
it("indexes endpoints, midpoints and circle centres for drawing and measuring",()=>{
 const g=annotationGeometry([line("l",[{x:0,y:0},{x:10,y:0}]),{id:"c",layerId:"base",kind:"circle",points:[{x:100,y:100},{x:110,y:100}]}]);
 expect(g.snaps).toContainEqual({x:5,y:0,kind:"midpoint"});expect(g.snaps).toContainEqual({x:100,y:100,kind:"center"});expect(g.entities).toHaveLength(2);
});
it("measures only the visible fragment after an original line is trimmed",()=>{
 const e=annotationGeometry([line("l",[{x:0,y:0},{x:100,y:0}])]).entities[0];
 const masks:Annotation[]=[{...line("m",[{x:30,y:0},{x:70,y:0}]),kind:"mask"}];
 expect(visibleEntityFragment(e,masks,{x:50,y:0},1)).toBeNull();
 expect(visibleEntityFragment(e,masks,{x:10,y:0},1)?.length).toBe(30);
 expect(visibleEntityFragment(e,masks,{x:90,y:0},1)?.length).toBe(30);
 expect(visibleEntityFragment(e,[],{x:50,y:0},1)?.length).toBe(100);
});
it("selects multiline Korean text by its bounds, with insertion snapping and no false length entity",()=>{
 const t:Annotation={id:"t",layerId:"base",kind:"text",points:[{x:100,y:200}],text:"현장 A\n치수 <123>",textHeight:50};
 const b=textBounds(t);expect(b.maxX).toBeGreaterThan(200);expect(b.minY).toBeLessThan(150);
 expect(annotationHit([t],{x:120,y:210},1,"mm")?.id).toBe("t");
 expect(annotationHit([t],{x:0,y:0},1,"mm")).toBeNull();
 const g=annotationGeometry([t]);expect(g.entities).toHaveLength(0);expect(g.snaps).toEqual([{x:100,y:200,kind:"endpoint"}]);
 expect(trimAnnotation(t,[],[],{x:100,y:200})).toBeNull();
});
it("moves text, shapes and dimensions in exact drawing coordinates without changing size or source points",()=>{
 const objects:Annotation[]=[{id:"t",layerId:"base",kind:"text",points:[{x:1e9,y:1e9}],text:"한글",textHeight:25},{id:"d",layerId:"base",kind:"dimension-aligned",points:[{x:0,y:0},{x:300,y:400},{x:0,y:100}],scale:20},{id:"c",layerId:"base",kind:"circle",points:[{x:100,y:100},{x:120,y:100}]}];
 const originals=JSON.stringify(objects);
 for(const o of objects){const moved=translateAnnotation(o,{x:1000,y:2000},{x:1025.25,y:1980.5});expect(moved.points).toEqual(o.points.map(p=>({x:p.x+25.25,y:p.y-19.5})));expect(moved.id).toBe(o.id);expect(moved.textHeight).toBe(o.textHeight);expect(moved.scale).toBe(o.scale);}
 expect(JSON.stringify(objects)).toBe(originals);
 expect(dimensionGeometry(translateAnnotation(objects[1],{x:0,y:0},{x:500,y:600}),"mm")?.value).toBe(500);
});
it("moves original geometry through a separate mask and copy, restoring it when the layer is hidden",()=>{
 const original=annotationGeometry([line("l",[{x:0,y:0},{x:100,y:0}])]).entities[0];
 const objects=sourceMoveObjects(original,"base",{x:0,y:0},{x:200,y:300});
 expect(objects[0].kind).toBe("mask");expect(objects[1].points).toEqual([{x:200,y:300},{x:300,y:300}]);
 expect(original.points).toEqual([{x:0,y:0},{x:100,y:0}]);
 expect(masked({x:50,y:0},objects,.1)).toBe(true);expect(visibleEntityFragment(original,objects.filter(o=>o.kind==="mask"),{x:50,y:0},1)).toBeNull();
 const doc=newAnnotationDocument();doc.objects=objects;doc.layers[0].visible=false;expect(visibleAnnotations(doc)).toHaveLength(0);
 expect(()=>translateAnnotation(objects[0],{x:0,y:0},{x:1,y:1})).toThrow();
});
it("preserves an original circle as a circle when moving it",()=>{
 const e={kind:"CIRCLE",points:[{x:10,y:0},{x:-10,y:0},{x:10,y:0}],bounds:{minX:-10,minY:-10,maxX:10,maxY:10},length:20*Math.PI,approximate:false};
 const [,copy]=sourceMoveObjects(e,"base",{x:0,y:0},{x:50,y:60});expect(copy.kind).toBe("circle");expect(copy.points).toEqual([{x:50,y:60},{x:60,y:60}]);
});
it("preserves arc length and mirrored winding when moving native arcs",()=>{
 const points=Array.from({length:17},(_,i)=>({x:1e8+10*Math.cos(i*Math.PI/32),y:1e8+10*Math.sin(i*Math.PI/32)}));
 for(const p of[points,[...points].reverse()]){
  const entity={kind:"ARC",points:p,bounds:{minX:1e8,minY:1e8,maxX:1e8+10,maxY:1e8+10},length:5*Math.PI,approximate:false};
  const [,arc]=sourceMoveObjects(entity,"base",{x:0,y:0},{x:50,y:60});expect(arc.kind).toBe("arc");
  expect(annotationGeometry([arc]).entities[0].length).toBeCloseTo(entity.length,5);
 }
});
it("retains old documents and persists text sizes and contents with existing masks",()=>{
 const store=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)});
 const old=newAnnotationDocument();old.objects.push({...line("m",[{x:0,y:0},{x:100,y:0}]),kind:"mask"});saveAnnotations("old",old);expect(readAnnotations("old")).toEqual(old);
 const doc={...old,textHeight:75,objects:[...old.objects,{id:"t",layerId:"base",kind:"text"as const,points:[{x:10,y:20}],text:"한글 <b>\n두 번째 줄",textHeight:75}]};
 expect(saveAnnotations("new",doc)).toBe(true);expect(readAnnotations("new")).toEqual(doc);
 store.set("arcad.annotations.v1.invalid",JSON.stringify({...doc,objects:[{...doc.objects[1],textHeight:0}]}));expect(readAnnotations("invalid").objects).toHaveLength(0);
 expect(defaultTextHeight("mm")).toBe(50);expect(defaultTextHeight("cm")).toBe(5);expect(defaultTextHeight("m")).toBe(.05);
});
it("snaps to dimension references and arrow ends without measuring dimension graphics as extra geometry",()=>{
 const d:Annotation={id:"d",layerId:"base",kind:"dimension-aligned",points:[{x:0,y:0},{x:100,y:0},{x:50,y:30}],scale:20};
 const g=annotationGeometry([d]);expect(g.entities).toHaveLength(0);expect(g.snaps).toContainEqual({x:0,y:0,kind:"endpoint"});expect(g.snaps).toContainEqual({x:100,y:30,kind:"endpoint"});expect(g.snaps).toContainEqual({x:50,y:30,kind:"midpoint"});
});
it("keeps the shared binary snap search valid across multiple unsorted user objects",()=>{
 const objects:Annotation[]=[line("far",[{x:6000,y:3000},{x:6000,y:3500}]),{id:"d",layerId:"base",kind:"dimension-aligned",points:[{x:4000,y:2000},{x:5000,y:2000},{x:4500,y:2400}],scale:20},{id:"t",layerId:"base",kind:"text",points:[{x:1000,y:1000}],text:"현장",textHeight:80}];
 const g=annotationGeometry(objects);expect(g.snaps.every((p,i,a)=>!i||a[i-1].x<=p.x)).toBe(true);
 expect(nearestSnap(g.snaps,{x:4020,y:2380},50)).toEqual({x:4000,y:2400,kind:"endpoint"});
 expect(nearestSnap(g.snaps,{x:6002,y:3002},10)).toEqual({x:6000,y:3000,kind:"endpoint"});
 expect(nearestSnap(g.snaps,{x:1002,y:1002},10)).toEqual({x:1000,y:1000,kind:"endpoint"});
});
