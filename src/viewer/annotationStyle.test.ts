import {afterEach,expect,it,vi} from "vitest";
import {newAnnotationDocument,readAnnotations,saveAnnotations,type Annotation} from "./annotations";
import {styleAnnotation,objectStyleValue} from "./annotationStyle";
import {UndoHistory} from "./undoHistory";
afterEach(()=>vi.unstubAllGlobals());
const line:Annotation={id:"line",layerId:"base",kind:"polyline",points:[{x:1e9,y:1e9},{x:1e9+123,y:1e9+456}]};
it("persists per-object width and color without changing geometry or neighboring objects, and restores both with one undo",()=>{
  const storage=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>storage.get(k),setItem:(k:string,v:string)=>storage.set(k,v)});
  const before={...newAnnotationDocument(),objects:[line,{...line,id:"neighbor"}]},history=new UndoHistory<typeof before>();
  history.record(before);const styled=styleAnnotation(line,{color:"#ff526d",screenWidth:7.5}),after={...before,objects:[styled,before.objects[1]]};
  expect(styled.points).toBe(line.points);expect(after.objects[1]).toBe(before.objects[1]);expect(styled.layerId).toBe(line.layerId);
  expect(saveAnnotations("qa",after)).toBe(true);expect(readAnnotations("qa")).toEqual(after);
  expect(history.undo(after)).toEqual(before);expect(history.canUndo).toBe(false);expect(history.redo(before)).toEqual(after);
});
it("changes text height without changing content, rotation or insertion point",()=>{
  const text:Annotation={...line,kind:"text",points:[line.points[0]],text:"한글 ABC",textHeight:50,rotation:45};
  const styled=styleAnnotation(text,{textHeight:125,color:"#8ce56d"});
  expect(objectStyleValue(styled)).toBe(125);expect(styled.text).toBe(text.text);expect(styled.rotation).toBe(45);expect(styled.points).toBe(text.points);
});
it("rejects invalid persisted widths and invalid text sizes or erasure styling",()=>{
  vi.stubGlobal("localStorage",{setItem:vi.fn()});
  for(const width of [0,13,NaN,Infinity]){
    expect(()=>styleAnnotation(line,{screenWidth:width})).toThrow();
    expect(saveAnnotations("bad",{...newAnnotationDocument(),objects:[{...line,screenWidth:width}]})).toBe(false);
  }
  expect(()=>styleAnnotation(line,{textHeight:50})).toThrow();
  expect(()=>styleAnnotation({...line,kind:"mask"},{color:"#ffffff"})).toThrow();
});
