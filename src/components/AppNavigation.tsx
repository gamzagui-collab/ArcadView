import{useLayoutEffect,useRef,useState}from'react';
import{useBackNavigation}from'../app/backNavigation';
import{useI18n}from'../i18n/I18nProvider';
import{navigationWords}from'../i18n/navigation';
import{CloseIcon,SettingsIcon}from'./Icons';
export function AppExitButton({onClick,disabled=false}:{onClick():void;disabled?:boolean}){
 const{locale}=useI18n(),w=navigationWords[locale];return<button type="button" className="icon-button app-exit-button" aria-label={w.exit} title={w.exit} disabled={disabled} onClick={onClick}><CloseIcon/></button>;
}
export function ViewerSettingsButton({onClick,open=false,disabled=false}:{onClick():void;open?:boolean;disabled?:boolean}){
 const{locale}=useI18n(),w=navigationWords[locale];return<button type="button" className="icon-button viewer-settings-button" aria-label={w.settings} title={w.settings} aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={onClick}><SettingsIcon/></button>;
}
export function ExitConfirmation({onCancel,onConfirm}:{onCancel():void;onConfirm():Promise<void>}){
 const{locale}=useI18n(),w=navigationWords[locale],dialog=useRef<HTMLDialogElement>(null),lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const cancel=()=>{if(!lock.current)onCancel();};useBackNavigation(cancel,true);
 useLayoutEffect(()=>{const e=dialog.current!,previous=document.activeElement as HTMLElement|null;e.showModal();return()=>{e.close();previous?.focus();};},[]);
 const confirm=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await onConfirm();}catch(e){setError(e instanceof Error?e.message:w.exitError);}finally{lock.current=false;setBusy(false);}};
 return<dialog ref={dialog} className="app-exit-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-exit-title" aria-busy={busy} onCancel={e=>{e.preventDefault();cancel();}}>
  <h2 id="app-exit-title">{w.confirm}</h2>{error?<p role="alert">{error}</p>:null}
  <div className="app-exit-actions"><button autoFocus type="button" disabled={busy} onClick={cancel}>{w.cancel}</button><button type="button" className="app-exit-confirm" disabled={busy} onClick={()=>void confirm()}>{busy?w.quitting:w.quit}</button></div>
 </dialog>;
}
