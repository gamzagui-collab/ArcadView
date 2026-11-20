import { useEffect,useState,useSyncExternalStore } from "react";
import { commerceSnapshot,commerceSubscribe,initializeCommerce,refreshAccount } from "./client";
import { AccountPanel } from "../components/AccountPanel";
export function CommercePortal(){
 const state=useSyncExternalStore(commerceSubscribe,commerceSnapshot),[open,setOpen]=useState(false);
 useEffect(()=>{void initializeCommerce();const show=()=>setOpen(true),changed=()=>{void refreshAccount().catch(()=>undefined);};window.addEventListener("arcad:account",show);window.addEventListener("arcad:balance-changed",changed);return()=>{window.removeEventListener("arcad:account",show);window.removeEventListener("arcad:balance-changed",changed);};},[]);
 return state.managed&&open?<AccountPanel onClose={()=>setOpen(false)}/>:null;
}
