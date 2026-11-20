import { api, commerceSnapshot, currentUser, CommerceError } from "./client";

export type PendingOperation<T=unknown>={id:string;userId:string;drawingKey:string;tool:string;candidate:T;resultHash:string;state:"pending"|"approved";createdAt:number};
export interface OperationStore{put(value:PendingOperation):Promise<void>;remove(id:string):Promise<void>;list(drawingKey:string,userId:string):Promise<PendingOperation[]>;}
function database(){return new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("arcad-operation-journal",1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore("pending",{keyPath:"id"});s.createIndex("drawingKey","drawingKey");r.result.createObjectStore("measurements",{keyPath:"drawingKey"});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function transaction<T>(store:string,mode:IDBTransactionMode,action:(s:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await database();try{return await new Promise<T>((resolve,reject)=>{const tx=db.transaction(store,mode),r=action(tx.objectStore(store));let value:T;r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error??new Error("LOCAL_STORAGE_FAILED"));});}finally{db.close();}
}
export const operationStore:OperationStore={
  async put(v){await transaction("pending","readwrite",s=>s.put(v));},
  async remove(id){await transaction("pending","readwrite",s=>s.delete(id));},
  async list(key,userId){return(await transaction("pending","readonly",s=>s.index("drawingKey").getAll(key))as PendingOperation[]).filter(v=>v.userId===userId).sort((a,b)=>a.createdAt-b.createdAt);},
};
export async function saveMeasurement(drawingKey:string,candidate:unknown){await transaction("measurements","readwrite",s=>s.put({drawingKey,candidate}));}
export async function readMeasurement<T>(drawingKey:string):Promise<T|undefined>{const row=await transaction("measurements","readonly",s=>s.get(drawingKey));return row?.candidate as T|undefined;}
export async function resultHash(candidate:unknown){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(candidate)))),n=>n.toString(16).padStart(2,"0")).join("");}
type Authorize=(operation:{id:string;tool:string;resultHash:string})=>Promise<unknown>;
export async function finishJournalOperation<T>(op:PendingOperation<T>,store:OperationStore,authorize:Authorize,save:(candidate:T)=>Promise<void>){
  // Persist the complete result BEFORE contacting the server. No drawings leave
  // this journal. If the response or final promotion is lost, replay the same id.
  await store.put(op);
  if(op.state!=="approved"){
    await authorize({id:op.id,tool:op.tool,resultHash:op.resultHash});
    op={...op,state:"approved"};await store.put(op);
  }
  await save(op.candidate);await store.remove(op.id);
}
export async function newOperation<T>(drawingKey:string,tool:string,candidate:T):Promise<PendingOperation<T>>{
  const userId=currentUser();if(!userId)throw new CommerceError("LOGIN_REQUIRED");
  return{id:crypto.randomUUID(),userId,drawingKey,tool,candidate,resultHash:await resultHash(candidate),state:"pending",createdAt:Date.now()};
}
export async function authorizeOperation(operation:{id:string;tool:string;resultHash:string}){
  const result=await api<{balance:ReturnType<typeof commerceSnapshot>["balance"]}>("/v1/usage","POST",operation);
  window.dispatchEvent(new Event("arcad:balance-changed"));return result;
}
