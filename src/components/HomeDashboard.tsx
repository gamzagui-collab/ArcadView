import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";
import { useUx } from "../i18n/ux";
import { listRecentDrawings, openLibraryDrawing, type LibraryDrawingEntry } from "../library/drawingLibrary";
import { Brand, Blueprint } from "./Brand";
import { LanguageSwitch } from "./LanguageSwitch";
import { ChevronRightIcon, FolderIcon, DrawingFileIcon } from "./Icons";
import { ToolIcon } from "./ToolIcon";

export function HomeDashboard({onLibrary,onOpen,onAbout,updatePending}:{onLibrary():void;onOpen(file:File,id:string):Promise<void>;onAbout():void;updatePending:boolean}){
 const{t,locale}=useI18n(),u=useUx(),[recent,setRecent]=useState<LibraryDrawingEntry[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{let live=true;void listRecentDrawings(4).then(rows=>{if(live)setRecent(rows);}).catch(()=>{if(live)setError(true);});return()=>{live=false;};},[]);
 const open=async(e:LibraryDrawingEntry)=>{setBusy(true);setError(false);try{const f=await openLibraryDrawing(e.id);await onOpen(f,e.id);}catch{setError(true);setBusy(false);}};
 const size=(bytes:number)=>{const i=bytes<1024?0:Math.min(3,Math.floor(Math.log(bytes)/Math.log(1024)));return `${new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(bytes/1024**i)} ${["B","KB","MB","GB"][i]}`;};
 return <div className="home-dashboard">
  <header className="arcad-home-header"><Brand company/><div className="home-header-actions"><LanguageSwitch/><button className="icon-button app-info-button" aria-label={u.info+(updatePending?` — ${locale==='ko'?'새 업데이트 있음':locale==='en'?'Update available':'Güncelleme var'}`:'')} onClick={onAbout}><ToolIcon name="info"/>{updatePending?<span className="update-dot" aria-hidden="true"/>:null}</button></div></header>
  <main className="home-scroll">
   <section className="home-welcome"><Blueprint/><div className="home-welcome-copy"><p className="home-kicker"><span/>{u.workbench}</p><h1>{u.title}</h1><p>{u.description}</p><button className="open-button home-open" aria-label={t("myDrawings")} onClick={onLibrary}><FolderIcon/><span>{u.open}</span><ChevronRightIcon/></button></div></section>
   <div className="home-capabilities"><div><ToolIcon name="bolt"/><strong>{u.quick}</strong><small>{u.quickSub}</small></div><div><ToolIcon name="shield"/><strong>{u.local}</strong><small>{u.localSub}</small></div><div><DrawingFileIcon/><strong>{u.formats}</strong><small>DWG · DXF · PDF</small></div></div>
   <section className="home-recent"><div className="section-heading"><div><p className="section-kicker">WORKSPACE</p><h2>{u.recent}</h2></div><button onClick={onLibrary}>{u.all}<ChevronRightIcon/></button></div>
    {error?<p className="home-notice" role="alert">{t("libraryOperationFailed")}</p>:null}
    {recent.length?<div className="home-recent-list">{recent.map(e=><button className="home-recent-card" key={e.id} disabled={busy} onClick={()=>void open(e)}><span className="home-file-visual" data-format={e.format}><DrawingFileIcon/><span>{e.format.toUpperCase()}</span></span><span className="home-file-copy"><strong>{e.name}</strong><small>{e.format.toUpperCase()} · {size(e.size)}</small></span><ChevronRightIcon/></button>)}</div>:<button className="home-empty" onClick={onLibrary}><FolderIcon/><strong>{u.empty}</strong><small>{u.emptySub}</small></button>}
   </section>
   <button className="home-library-link" onClick={onLibrary}><span className="home-folder-icon"><FolderIcon/></span><span><strong>{u.library}</strong><small>{u.libraryNote}</small></span><ChevronRightIcon/></button>
   <footer className="home-footer"><span><ToolIcon name="shield"/>{u.localNotice}</span><button onClick={onAbout}>Arcad View · {u.info}</button></footer>
  </main>
 </div>;
}
