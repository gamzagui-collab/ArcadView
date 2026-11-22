import{afterEach,expect,it,vi}from'vitest';
import{AnnotationStorage}from'./annotationStorage';
import{newAnnotationDocument}from'./annotations';
import{newTakeoff}from'../takeoff/model';
import{flushTakeoffSaves,saveTakeoff}from'../takeoff/storage';
afterEach(()=>vi.unstubAllGlobals());
it('waits for every queued annotation snapshot on that drawing before leaving',async()=>{
 const writes:Array<()=>void>=[],backend={read:async()=>null,write:vi.fn(()=>new Promise<void>(res=>writes.push(res)))},s=new AnnotationStorage(backend,{getItem:()=>null,setItem:()=>{}}),doc=newAnnotationDocument();
 const first=s.save('A',doc),second=s.save('A',{...doc,dimensionScale:2});let done=false;const wait=s.flush('A').then(()=>{done=true});await Promise.resolve();await Promise.resolve();expect(done).toBe(false);expect(writes).toHaveLength(1);writes[0]();await first;await Promise.resolve();expect(done).toBe(false);writes[1]();await second;await wait;expect(done).toBe(true);
});
it('propagates a failed pending annotation save instead of acknowledging navigation',async()=>{
 let reject!:(e:Error)=>void;const s=new AnnotationStorage({read:async()=>null,write:()=>new Promise<void>((_,r)=>{reject=r})},{getItem:()=>null,setItem:()=>{}}),job=s.save('A',newAnnotationDocument()),wait=s.flush('A');await Promise.resolve();await Promise.resolve();reject(Error('disk full'));await expect(job).rejects.toThrow('disk full');await expect(wait).rejects.toThrow('disk full');
});
it('waits for the takeoff transaction ACK and isolates other drawing writes',async()=>{
 const transactions:any[]=[];vi.stubGlobal('indexedDB',{open:()=>{const r:any={result:{onversionchange:null,close:()=>{},transaction:()=>{const t:any={objectStore:()=>({put:()=>{}})};transactions.push(t);return t}}};queueMicrotask(()=>r.onsuccess());return r;}});
 const drawing={key:'v1-'+'a'.repeat(64),name:'A.dwg',size:1,lastModified:1},a=saveTakeoff(newTakeoff(drawing,'mm')),b=saveTakeoff(newTakeoff({...drawing,key:'v1-'+'b'.repeat(64)},'mm'));let done=false;const wait=flushTakeoffSaves(drawing.key).then(()=>{done=true});await Promise.resolve();await Promise.resolve();expect(done).toBe(false);transactions[0].oncomplete();await a;await wait;expect(done).toBe(true);transactions[1].oncomplete();await b;
});
it('rejects navigation when a pending takeoff transaction aborts',async()=>{
 let transaction:any;vi.stubGlobal('indexedDB',{open:()=>{const r:any={result:{close:()=>{},transaction:()=>transaction={error:Error('write aborted'),objectStore:()=>({put:()=>{}})}}};queueMicrotask(()=>r.onsuccess());return r;}});
 const drawing={key:'v1-'+'c'.repeat(64),name:'C.dwg',size:1,lastModified:1},job=saveTakeoff(newTakeoff(drawing,'mm')),wait=flushTakeoffSaves(drawing.key);await Promise.resolve();await Promise.resolve();transaction.onabort();await expect(job).rejects.toThrow('write aborted');await expect(wait).rejects.toThrow('write aborted');
});
