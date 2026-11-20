import{afterEach,expect,it,vi}from"vitest";
import{annotationGeometry,drawingLayers,ensurePointLayer,newAnnotationDocument,POINT_LAYER_ID,pointLayer,readAnnotations,removeDrawingLayer,saveAnnotations,translateAnnotation,trimAnnotation,visibleAnnotations,type Annotation}from"./annotations";
import{addPointObject,badgeForeground,completePointText,drawPointAnnotation,pointHit,pointMoveSnaps,pointScreenGeometry,readPointStyle,savePointStyle}from"./pointMarkup";
import{offsetAnnotation}from"./offsetGeometry";
import{UndoHistory}from"./undoHistory";
const object=(kind:Annotation["kind"]="point-arrow"):Annotation=>({id:"mark",layerId:POINT_LAYER_ID,kind,points:[{x:1e9,y:1e9},{x:1e9+100,y:1e9+60}],screenWidth:4,color:"#ffd65c",screenFontSize:18});
const project=(scale=1)=>(points:readonly{x:number;y:number}[])=>points.map(p=>({x:(p.x-1e9)*scale+100,y:300-(p.y-1e9)*scale}));
afterEach(()=>vi.unstubAllGlobals());
it("adds the reserved layer only when used, retaining all three normal layers and the last active layer",()=>{
 const doc=newAnnotationDocument();doc.layers.push({id:"second",name:"2",color:"#ff0000",visible:true},{id:"third",name:"3",color:"#ffffff",visible:true});doc.activeLayer="second";const before=JSON.stringify(doc);
 const next=addPointObject(doc,object());expect(next.layers).toHaveLength(4);expect(next.layers.at(-1)?.name).toBe("포인트그리기");expect(next.activeLayer).toBe("second");expect(drawingLayers(next)).toHaveLength(3);expect(JSON.stringify(doc)).toBe(before);expect(ensurePointLayer(next)).toBe(next);
});
it("preserves legacy documents byte-for-byte and round trips new mark types and protected metadata",()=>{
 const store=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)});
 const legacy=newAnnotationDocument();expect(saveAnnotations("legacy",legacy)).toBe(true);expect(readAnnotations("legacy")).toEqual(legacy);expect(store.get("arcad.annotations.v1.legacy")).toBe(JSON.stringify(legacy));
 let doc=legacy;for(const[i,kind]of(["point-arrow","point-cloud","point-circle","point-rectangle","point-leader"]as const).entries())doc=addPointObject(doc,{...object(kind),id:String(i),...(kind==="point-leader"?{text:"한글 지시문자"}:{})});
 expect(saveAnnotations("point",doc)).toBe(true);expect(readAnnotations("point")).toEqual(doc);
 for(const bad of[{...doc,activeLayer:POINT_LAYER_ID},{...doc,layers:doc.layers.map(l=>l.id===POINT_LAYER_ID?{...l,name:"renamed"}:l)},{...doc,objects:[{...object(),layerId:"base"}]},{...doc,objects:[{...object(),kind:"polyline"as const}]}])expect(saveAnnotations("point",bad)).toBe(false);
 expect(readAnnotations("point")).toEqual(doc);
});
it("does not allow deleting the reserved layer and preserves it when the last ordinary layer is removed",()=>{
 const doc=addPointObject(newAnnotationDocument(),object());expect(removeDrawingLayer(doc,POINT_LAYER_ID)).toBe(doc);
 const next=removeDrawingLayer(doc,"base");expect(next.objects).toEqual(doc.objects);expect(drawingLayers(next)).toHaveLength(1);expect(next.activeLayer).not.toBe(POINT_LAYER_ID);expect(pointLayer(next).name).toBe("포인트그리기");
 const hidden={...doc,layers:doc.layers.map(l=>l.id===POINT_LAYER_ID?{...l,visible:false}:l)};expect(visibleAnnotations(hidden)).toEqual([]);
});
it("keeps point marks out of CAD snapping and measurement geometry and disallows trim/offset",()=>{
 const o=object("point-circle"),g=annotationGeometry([o]);expect(g.entities).toEqual([]);expect(g.snaps).toEqual([]);expect(trimAnnotation(o,[],[],o.points[0])).toBeNull();expect(offsetAnnotation(o,10,1)).toBeNull();
});
it("offers sorted exact anchors only for the selected mark's move base, including reverse drags",()=>{
 const o=object();o.points.reverse();const snaps=pointMoveSnaps(o);expect(snaps.map(p=>p.x)).toEqual([1e9,1e9+100]);expect(snaps.every(p=>p.kind==="endpoint")).toBe(true);expect(o.points[0].x).toBe(1e9+100);expect(pointMoveSnaps({...o,kind:"polyline",layerId:"base"})).toEqual([]);
});
it("uses exact world anchors while arrowheads and line widths remain fixed at different zoom levels",()=>{
 const o=object(),a=pointScreenGeometry(o,project()),b=pointScreenGeometry(o,project(4));
 const size=(p:NonNullable<typeof a.head>)=>Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);expect(size(a.head!)).toBeCloseTo(size(b.head!));expect(b.paths[0][1].x-b.paths[0][0].x).toBe(400);
 for(const scale of[1,4]){const elements:any[]=[];drawPointAnnotation(o,project(scale),(tag,attrs)=>{const n={tag,attrs};elements.push(n);return n as any;});const line=elements.find(e=>e.attrs.class==="point-mark");expect(line.attrs["stroke-width"]).toBe(4);expect(line.attrs.points.split(" ").at(-1)).not.toBe(pointScreenGeometry(o,project(scale)).head![0].x+","+pointScreenGeometry(o,project(scale)).head![0].y);}
 const moved=translateAnnotation(o,o.points[0],{x:1e9+25.25,y:1e9-50.5});expect(moved.points[0]).toEqual({x:1e9+25.25,y:1e9-50.5});expect(moved.screenWidth).toBe(4);expect(moved.layerId).toBe(POINT_LAYER_ID);expect(o.points[0].x).toBe(1e9);
});
it("draws closed clouds and circles, supports either corner ordering, and bounds cloud complexity",()=>{
 for(const kind of["point-cloud","point-rectangle","point-circle"]as const){const a=pointScreenGeometry(object(kind),project());expect(a.paths[0][0].x).toBeCloseTo(a.paths[0].at(-1)!.x);expect(a.paths[0][0].y).toBeCloseTo(a.paths[0].at(-1)!.y);expect(a.paths.flat().every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))).toBe(true);}
 const cloud=object("point-cloud"),a=pointScreenGeometry(cloud,project()),b=pointScreenGeometry({...cloud,points:[...cloud.points].reverse()},project());expect(a.path).toBe(b.path);expect(a.path).toContain("Q");expect(pointScreenGeometry(cloud,project(1000)).paths[0].length).toBeLessThanOrEqual(1281);
});
it("selects marks and label boxes in screen space at any zoom, including label-only re-edit hits",()=>{
 const arrow=object(),g=pointScreenGeometry(arrow,project());const mid={x:(arrow.points[0].x+arrow.points[1].x)/2,y:(arrow.points[0].y+arrow.points[1].y)/2};expect(pointHit([arrow],mid,5,project())?.id).toBe("mark");expect(pointHit([arrow],mid,5,project(4))?.id).toBe("mark");
 const label={...object("point-leader"),text:"문자"};expect(pointScreenGeometry(label,project()).label?.fontSize).toBe(18);expect(pointScreenGeometry(label,project(4)).label?.fontSize).toBe(18);
 const q={x:label.points[1].x+15,y:label.points[1].y+10};expect(pointHit([label],q,3,project(),true)?.id).toBe("mark");expect(pointHit([arrow],mid,3,project(),true)).toBeNull();expect(g.head?.[0]).toEqual(g.paths[0].at(-1));
});
it("completes each Korean label once, edits without duplicating, and supports undo/redo",()=>{
 const doc=newAnnotationDocument(),session={object:{...object("point-leader"),text:""}},next=completePointText(doc,session,"확인\r\n필요 <태그>");expect(next.objects[0].text).toBe("확인\n필요 <태그>");expect(doc.objects).toEqual([]);
 const edited=completePointText(next,{object:next.objects[0],originalId:"mark"},"수정");expect(edited.objects).toHaveLength(1);expect(edited.objects[0].id).toBe("mark");expect(completePointText(doc,session," ")).toBe(doc);expect(()=>completePointText(doc,session,"x".repeat(501))).toThrow();
 const history=new UndoHistory<typeof doc>();history.record(doc);expect(history.undo(next)).toBe(doc);expect(history.redo(doc)).toBe(next);
});
it("remembers valid stroke/color settings and chooses contrasting badge text",()=>{
 const store=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>store.get(k),setItem:(k:string,v:string)=>store.set(k,v)});const style={width:7.5,color:"#49cfff",fontSize:24};expect(savePointStyle(style)).toBe(true);expect(readPointStyle()).toEqual(style);expect(savePointStyle({...style,width:99})).toBe(false);expect(badgeForeground("#ffffff")).toBe("#07182b");expect(badgeForeground("#000000")).toBe("#ffffff");
});
