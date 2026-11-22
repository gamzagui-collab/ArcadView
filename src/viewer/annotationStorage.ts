import {Capacitor,registerPlugin} from '@capacitor/core';
import {newAnnotationDocument,validateAnnotationDocument,type AnnotationDocument} from './annotations';
const native=registerPlugin<{read(o:{key:string}):Promise<{json:string|null}>;write(o:{key:string;json:string}):Promise<void>}>('AnnotationStorage');
const prefix='arcad.annotations.v1.';
export function parseAnnotationDocument(raw:string):AnnotationDocument{
 if(raw.length>4_000_000)throw Error('주석 저장 용량을 초과했습니다.');
 const doc=JSON.parse(raw) as AnnotationDocument;validateAnnotationDocument(doc);return doc;
}
/** Serializes immutable snapshots per drawing. A failed write never acknowledges
 * a later UI state or replaces the previous durable document. */
export class AnnotationStorage{
 private queues=new Map<string,Promise<unknown>>();
 private confirmed=new Map<string,string>();
 constructor(private backend:{read(key:string):Promise<string|null>;write(key:string,raw:string):Promise<void>},private legacy:Pick<Storage,'getItem'|'setItem'>){ }
 private serial<T>(key:string,run:()=>Promise<T>):Promise<T>{const job=(this.queues.get(key)??Promise.resolve()).catch(()=>{}).then(run);this.queues.set(key,job);void job.finally(()=>{if(this.queues.get(key)===job)this.queues.delete(key);}).catch(()=>{});return job;}
 load(key:string):Promise<AnnotationDocument>{return this.serial(key,async()=>{
  const durable=await this.backend.read(key);
  if(durable!==null){const doc=parseAnnotationDocument(durable);this.confirmed.set(key,durable);return doc;}
  const raw=this.legacy.getItem(prefix+key);if(raw===null)return newAnnotationDocument();
  const doc=parseAnnotationDocument(raw);await this.backend.write(key,raw);this.confirmed.set(key,raw);return doc;
 });}
 save(key:string,doc:AnnotationDocument):Promise<void>{
  let raw:string;try{validateAnnotationDocument(doc);raw=JSON.stringify(doc);parseAnnotationDocument(raw);}catch(e){return Promise.reject(e);}
  return this.serial(key,async()=>{if(this.confirmed.get(key)!==raw){await this.backend.write(key,raw);this.confirmed.set(key,raw);}
   // Compatibility mirror only. Failure here cannot undo the durable commit.
   try{this.legacy.setItem(prefix+key,raw);}catch{/* Android canonical file remains authoritative. */}
  });
 }
}
// Browser builds keep their existing storage API. Android does not treat a
// WebView localStorage acknowledgement as a disk persistence guarantee.
const backend={read:async(key:string)=>Capacitor.getPlatform()==='android'?(await native.read({key})).json:localStorage.getItem(prefix+key),write:async(key:string,json:string)=>{if(Capacitor.getPlatform()==='android')await native.write({key,json});else localStorage.setItem(prefix+key,json);}};
export const annotationStorage=new AnnotationStorage(backend,{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)});
