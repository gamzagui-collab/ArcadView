import { useEffect,useRef,useState } from "react";
import { api,commerceSnapshot,currentUser,errorMessage,CommerceError } from "./client";
import { authorizeOperation,finishJournalOperation,newOperation,operationStore,type PendingOperation } from "./operationJournal";
import { isUnmeteredTool } from "./toolPolicy";
type Candidate<T>={kind:string;value:T};
/** One durable in-flight candidate per editor; no new edits can overwrite it. */
export function useOperation<T>(drawingKey:string|undefined,kind:string,onSave:(value:T)=>Promise<void>){
 const save=useRef(onSave);save.current=onSave;
 const userId=currentUser(),context=JSON.stringify([drawingKey,kind,userId]);
 const[revision,setRevision]=useState(0);
 const [ui,setUi]=useState<{context:string;pending:PendingOperation<Candidate<T>>|null;busy:boolean;error:string|null}>({context,pending:null,busy:false,error:null});
 const pendingRef=useRef<PendingOperation<Candidate<T>>|null>(null),busyRef=useRef(false),mounted=useRef(true),contextRef=useRef(context);
 if(contextRef.current!==context){contextRef.current=context;pendingRef.current=null;busyRef.current=false;}
 const update=(value:Partial<typeof ui>)=>{if(mounted.current&&contextRef.current===context)setUi(previous=>({...previous,...value,context}));};
 const set=(v:PendingOperation<Candidate<T>>|null)=>{if(contextRef.current!==context)return;pendingRef.current=v;update({pending:v});};
 const lock=(v:boolean)=>{if(contextRef.current!==context)return;busyRef.current=v;update({busy:v});};
 const report=(value:string|null)=>update({error:value});
 const run=async(op:PendingOperation<Candidate<T>>,promote=save.current)=>{
  lock(true);report(null);try{
   if(currentUser()!==op.userId)throw new CommerceError("LOGIN_REQUIRED");
   await finishJournalOperation(op,operationStore,authorizeOperation,async candidate=>{await promote(candidate.value);});set(null);
  }catch(e){
   const saved=(await operationStore.list(op.drawingKey,op.userId).catch(()=>[])).find(v=>v.id===op.id);
   set((saved??op)as PendingOperation<Candidate<T>>);report(errorMessage(e));
  }finally{lock(false);}
 };
 const begin=(value:T,tool:string)=>{
  if(busyRef.current||pendingRef.current)return false;
  if(!drawingKey){report("도면 식별 정보를 준비한 후 다시 시도하세요.");return false;}
  const promote=save.current;lock(true);void(async()=>{try{const op=await newOperation(drawingKey,tool,{kind,value});set(op);await run(op,promote);}catch(e){report(errorMessage(e));lock(false);}})();return false;
 };
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  if(!drawingKey||!userId||!commerceSnapshot().managed)return;
  let live=true;lock(true);void(async()=>{try{
   const ops=await operationStore.list(drawingKey,userId),op=ops.find(v=>(v.candidate as Candidate<T>)?.kind===kind)as PendingOperation<Candidate<T>>|undefined;
   if(!op)return;
   if(live)set(op);
   if(op.state==="pending"&&!isUnmeteredTool(op.tool)){
    try{const r=await api<{receipt:{result_hash:string}}>("/v1/usage/"+op.id);if(r.receipt.result_hash!==op.resultHash)throw new CommerceError("OPERATION_ID_CONFLICT");op.state="approved";await operationStore.put(op);}
    catch(e){if(!(e instanceof CommerceError&&e.code==="OPERATION_NOT_FOUND"))throw e;}
   }
   if(live){set(op);if(op.state==="approved"||isUnmeteredTool(op.tool))await run(op);}
  }catch(e){if(live)report(errorMessage(e));}finally{if(live)lock(false);}})();return()=>{live=false;};
 },[drawingKey,userId,kind,revision]);
 const cancel=async()=>{const op=pendingRef.current;if(!op||busyRef.current)return;lock(true);try{
  const result=isUnmeteredTool(op.tool)?{receipt:null}:await api<{receipt:unknown}>("/v1/usage/"+op.id+"/cancel","POST",{});
  if(result.receipt){await run({...op,state:"approved"});}
  else{await operationStore.remove(op.id);set(null);report(null);}
 }catch(e){report(errorMessage(e));}finally{lock(false);}};
 const{pending,busy,error}=ui.context===context?ui:{pending:null,busy:false,error:null};
 return{begin,blocked:()=>busyRef.current||!!pendingRef.current||ui.context===context&&!!ui.error,
  controls:pending||busy||error?<div className="commerce-pending" role="status">{busy?"작업을 안전하게 저장하고 있습니다…":error??"미완료 작업이 보관되어 있습니다."}{pending&&!busy?<><button onClick={()=>void run(pending)}>복구·다시 시도</button><button onClick={()=>void cancel()}>작업 취소</button></>:error&&!busy?<button onClick={()=>{report(null);setRevision(v=>v+1);}}>다시 조회</button>:null}</div>:null};
}
