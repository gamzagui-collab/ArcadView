import { useEffect,useState,useSyncExternalStore } from "react";
import { commerceSnapshot,commerceSubscribe,hasToolAccess,initializeCommerce,refreshAccount,type ToolAccessRequest } from "./client";
import { AccountPanel } from "../components/AccountPanel";
export function CommercePortal(){
 const state=useSyncExternalStore(commerceSubscribe,commerceSnapshot),[open,setOpen]=useState(false),[request,setRequest]=useState<ToolAccessRequest|null>(null);
 const close=()=>{setOpen(false);setRequest(null);};
 useEffect(()=>{void initializeCommerce();const show=(event:Event)=>{setRequest((event as CustomEvent<ToolAccessRequest>).detail??null);setOpen(true);},changed=()=>{void refreshAccount().catch(()=>undefined);};window.addEventListener("arcad:account",show);window.addEventListener("arcad:balance-changed",changed);return()=>{window.removeEventListener("arcad:account",show);window.removeEventListener("arcad:balance-changed",changed);};},[]);
 return state.managed&&open?<AccountPanel requestedTool={request?.tool} onClose={close} onAuthenticated={()=>{if(request&&hasToolAccess(request.tool)){const resume=request.resume;close();resume?.();}}}/>:null;
}
