import type { ViewerCommand } from "../types/drawing";
import {useLayoutEffect,useRef,useState} from "react";
import { useI18n } from "../i18n/I18nProvider";
import {
  ResetIcon,
  MeasureIcon,
  UndoIcon, RedoIcon, CancelToolIcon,SettingsIcon,
} from "./Icons";
import { ToolIcon } from "./ToolIcon";
import { ToolStrip } from "./ToolStrip";
import {ViewerSettings}from'./ViewerSettings';

type Props = {
  onCommand(command: ViewerCommand): void;
  takeoffActive?:boolean;
  onTakeoff?():void;
  canMeasure?: boolean;
  measuring?: boolean;
  panelOpen?: boolean;
  onMeasure?(): void;
  onEdit?():void;
  editing?:boolean;
  editOpen?:boolean;
  canUndo?:boolean;
  canRedo?:boolean;
  onUndo?():void;
  onRedo?():void;
  onCancel?():void;
  selecting?:boolean;
  canDelete?:boolean;
  onSelect?():void;
  onDelete?():void;
  objectTool?:"move"|"rotate";
  onMove?():void;
  onRotate?():void;
  onSettingsOpen?():void;
};

export function ViewerToolbar({ onCommand,takeoffActive,onTakeoff, canMeasure, measuring, panelOpen, onMeasure,onEdit,editing,editOpen,canUndo,canRedo,onUndo,onRedo,onCancel,selecting,canDelete,onSelect,onDelete,objectTool,onMove,onRotate,onSettingsOpen }: Props) {
  const { t,locale } = useI18n();
  const[settingsOpen,setSettingsOpen]=useState(false);
  const objectWords={ko:{move:"이동",rotate:"회전"},en:{move:"Move",rotate:"Rotate"},tr:{move:"Taşı",rotate:"Döndür"}}[locale];
  const toolbar=useRef<HTMLElement>(null),history=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    const nav=toolbar.current,shell=nav?.closest<HTMLElement>(".viewer-shell"),dock=history.current;if(!nav||!shell)return;
    let frame=0;
    const update=()=>{const s=shell.getBoundingClientRect(),n=nav.getBoundingClientRect(),h=dock?.getBoundingClientRect(),header=shell.querySelector('.viewer-header')?.getBoundingClientRect(),bottom=s.bottom-n.top+6;
      const values:Record<string,number>={"--tool-panel-left":n.left-s.left,"--tool-panel-width":n.width,"--tool-panel-bottom":bottom,"--tool-panel-space":Math.max(70,n.top-(header?.bottom??s.top)-12),"--precision-top":(header?.bottom??s.top+44)-s.top+8,"--history-left":h?h.left-s.left:10,"--history-width":h?.width??46,"--history-top":h?h.top-s.top:s.height-96,"--history-bottom":h?s.bottom-h.bottom:10,"--history-height":h?.height??86};
      for(const[k,v]of Object.entries(values)){const value=`${Math.round(v*100)/100}px`;if(shell.style.getPropertyValue(k)!==value)shell.style.setProperty(k,value);}
    };
    const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};update();const observer=new ResizeObserver(schedule);for(const e of [shell,nav,...dock?[dock]:[]])observer.observe(e);window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);
    return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);};
  },[canMeasure]);
  const words={ko:{view:"보기",tools:"작업 도구",select:"객체 선택",remove:"객체 삭제",history:"실행 취소 · 다시 실행 · 도구 해제",undo:"실행 취소",redo:"다시 실행",cancel:"도구 해제"},en:{view:"View",tools:"Tools",select:"Select object",remove:"Delete object",history:"Undo, redo and cancel tool",undo:"Undo",redo:"Redo",cancel:"Cancel tool"},tr:{view:"Görünüm",tools:"Araçlar",select:"Nesne seç",remove:"Nesneyi sil",history:"Geri al, yinele ve aracı bırak",undo:"Geri al",redo:"Yinele",cancel:"Aracı bırak"}}[locale];

  return (
    <>
      {canMeasure?<aside ref={history} className={`viewer-history-dock${takeoffActive?" takeoff-history":""}`} role="group" aria-label={words.history}>
        <div id="viewer-status-slot"/>
        <button type="button" aria-label={words.undo} title={words.undo} disabled={!canUndo} onClick={onUndo}><UndoIcon/></button>
        <button type="button" aria-label={words.redo} title={words.redo} disabled={!canRedo} onClick={onRedo}><RedoIcon/></button>
      </aside>:null}
    <nav ref={toolbar} className={`viewer-toolbar ${canMeasure ? "with-measure with-edit" : ""}${takeoffActive?" with-takeoff":""}`} aria-label={t("viewerControls")}>
      <div className="viewer-tool-row">
        <div className="viewer-view-group" role="group" aria-label={words.view}>
          <button type="button" aria-label={t("reset")} title={t("reset")} onClick={()=>onCommand("reset")}><ResetIcon/></button>
        </div>
        {canMeasure?<ToolStrip className="viewer-tools-scroll" role="group" aria-label={words.tools} tabIndex={0}>
          <button type="button" aria-pressed={!!measuring} aria-expanded={!!panelOpen} aria-label={t("measure")} title={t("measure")} onClick={onMeasure}><MeasureIcon/><span>{t("measure")}</span></button>
          <button type="button" aria-pressed={!!editing} aria-expanded={!!editOpen} aria-label={t("editTools")} onClick={onEdit}><ToolIcon name="polyline"/><span>{t("editTools")}</span></button>
          {onTakeoff?<button type="button" data-tool="takeoff" aria-label={locale==="ko"?"콘크리트 적산":locale==="en"?"Concrete takeoff":"Beton metrajı"} aria-pressed={!!takeoffActive} onClick={onTakeoff}><ToolIcon name="layers"/><span>{locale==="ko"?"적산":locale==="en"?"Takeoff":"Metraj"}</span></button>:null}
          <span className="tool-group-divider" role="separator" aria-orientation="vertical"/>
          <button type="button" className="viewer-object-tool" data-tool="select" aria-label={words.select} title={words.select} aria-pressed={!!selecting} onClick={onSelect}><ToolIcon name="select"/></button>
          <button type="button" className="viewer-object-tool" data-tool="move" aria-label={objectWords.move} title={objectWords.move} aria-pressed={objectTool==="move"} disabled={takeoffActive} onClick={onMove}><ToolIcon name="move"/></button>
          <button type="button" className="viewer-object-tool" data-tool="rotate" aria-label={objectWords.rotate} title={objectWords.rotate} aria-pressed={objectTool==="rotate"} disabled={takeoffActive} onClick={onRotate}><ToolIcon name="rotate"/></button>
          <button type="button" className="viewer-object-tool" data-tool="delete" aria-label={words.remove} title={words.remove} disabled={!canDelete} onClick={onDelete}><ToolIcon name="delete"/></button>
        </ToolStrip>:null}
        {canMeasure?<button type="button" className="viewer-settings-tool" aria-label={locale==='ko'?'뷰어 설정':locale==='en'?'Viewer settings':'Görünüm ayarları'} aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={()=>{onSettingsOpen?.();setSettingsOpen(true);}}><SettingsIcon/></button>:null}
        {canMeasure?<button type="button" className="viewer-cancel-tool" aria-label={words.cancel} title={words.cancel} onClick={onCancel}><CancelToolIcon/></button>:null}
      </div>
    </nav>
    {settingsOpen?<ViewerSettings onClose={()=>setSettingsOpen(false)}/>:null}
    </>
  );
}

