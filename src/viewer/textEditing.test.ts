import { expect, it } from "vitest";
import { newAnnotationDocument, readAnnotations, saveAnnotations } from "./annotations";
import { completeTextEdit, type TextEditSession } from "./textEditing";
it("inserts the latest composed text once and preserves position, object color and legacy layers", () => {
  const d=newAnnotationDocument(),s:TextEditSession={id:"text1",layerId:"base",point:{x:123456789.123,y:456},text:"한글\r\n현장",height:75,color:"#218bff"};
  const next=completeTextEdit(d,s);expect(d.objects).toEqual([]);expect(next.layers).toBe(d.layers);
  expect(next.objects[0]).toMatchObject({text:"한글\n현장",textHeight:75,color:"#218bff",points:[s.point]});
  const storage=new Map<string,string>();const prior=globalThis.localStorage;
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(k:string)=>storage.get(k),setItem:(k:string,v:string)=>storage.set(k,v)}});
  try{expect(saveAnnotations("text-style-test",next)).toBe(true);expect(readAnnotations("text-style-test")).toEqual(next);}finally{Object.defineProperty(globalThis,"localStorage",{configurable:true,value:prior});}
});
it("edits an existing object in place, ignores untouched sessions and removes cleared text without stamping another object", () => {
  const s:TextEditSession={id:"text1",layerId:"base",point:{x:10,y:20},text:"원래",height:50};
  const d=completeTextEdit(newAnnotationDocument(),s),edit={...s,originalId:s.id};
  expect(completeTextEdit(d,edit)).toBe(d);
  const legacy={...d,textHeight:undefined};expect(completeTextEdit(legacy,edit)).toBe(legacy);
  const changed=completeTextEdit(d,{...edit,text:"수정",height:100});expect(changed.objects).toHaveLength(1);expect(changed.objects[0].id).toBe(s.id);
  expect(completeTextEdit(changed,{...edit,text:""}).objects).toEqual([]);
  expect(completeTextEdit(d,{...s,id:"empty",text:"   "})).toBe(d);
  expect(()=>completeTextEdit(d,{...s,text:"x".repeat(501)})).toThrow();
});
