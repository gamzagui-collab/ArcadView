import {migrateTakeoff,newTakeoff,validateDocument,type TakeoffDocument} from "./model";
import type {MeasurementUnit} from "../viewer/measurementGeometry";
export const TAKEOFF_DB="arcad-concrete-takeoff",TAKEOFF_DB_VERSION=3;
/** A separate versioned database: no migration or writes to drawings, ordinary
 * annotations, accounts or usage journals. Transaction completion is the ACK. */
function open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{
 if(!globalThis.indexedDB){reject(Error("적산 저장소를 사용할 수 없습니다."));return;}
 const r=indexedDB.open(TAKEOFF_DB,TAKEOFF_DB_VERSION);let blocked=false;
 r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains("documents")){const s=db.createObjectStore("documents",{keyPath:"drawing.key"});s.createIndex("drawingName","drawing.name",{unique:false});return;}
  const cursor=r.transaction!.objectStore("documents").openCursor();cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;try{row.update(migrateTakeoff(row.value));row.continue();}catch{r.transaction!.abort();}};
 };
 r.onerror=()=>reject(r.error);r.onblocked=()=>{blocked=true;reject(Error("다른 창에서 적산 저장소를 사용 중입니다. 창을 닫고 다시 시도하세요."));};
 r.onsuccess=()=>{if(blocked){r.result.close();return;}r.result.onversionchange=()=>r.result.close();resolve(r.result);};
 });}
function result<T>(r:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function loadTakeoff(drawing:TakeoffDocument["drawing"],unit:MeasurementUnit){
 const db=await open();try{const t=db.transaction("documents","readonly"),s=t.objectStore("documents"),[stored,previous]=await Promise.all([result(s.get(drawing.key)),result(s.index("drawingName").getAll(drawing.name))]);
 if(stored)validateDocument(stored,drawing.key);const revisions=(previous as TakeoffDocument[]).filter(d=>d.drawing.key!==drawing.key);return{document:stored??newTakeoff(drawing,unit),existing:!!stored,revisions:revisions.map(d=>({key:d.drawing.key,count:d.objects?.length??0,revision:d.revision}))};
 }finally{db.close();}}
export async function saveTakeoff(document:TakeoffDocument):Promise<void>{
 validateDocument(document);const db=await open();try{await new Promise<void>((resolve,reject)=>{const t=db.transaction("documents","readwrite");t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error??Error("적산 저장이 취소되었습니다."));t.onerror=()=>reject(t.error??Error("적산 저장에 실패했습니다."));t.objectStore("documents").put(document);});}finally{db.close();}
}
export type TakeoffCompletion={drawingKey:string;objectId:string;kind:"wall"|"beam"|"slab"|"column"};
/** Future usage integration point. Deliberately has no billing implementation. */
export function notifyTakeoffCompleted(detail:TakeoffCompletion){globalThis.dispatchEvent?.(new CustomEvent("arcad:takeoff-completed",{detail}));}
