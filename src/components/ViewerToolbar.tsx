import type { ViewerCommand } from "../types/drawing";
import { useI18n } from "../i18n/I18nProvider";
import {
  ResetIcon,
  MeasureIcon,
  UndoIcon, RedoIcon, CancelToolIcon,
} from "./Icons";
import { ToolIcon } from "./ToolIcon";
import { ToolStrip } from "./ToolStrip";

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
};

export function ViewerToolbar({ onCommand,takeoffActive,onTakeoff, canMeasure, measuring, panelOpen, onMeasure,onEdit,editing,editOpen,canUndo,canRedo,onUndo,onRedo,onCancel,selecting,canDelete,onSelect,onDelete }: Props) {
  const { t,locale } = useI18n();
  const words={ko:{view:"보기",tools:"작업 도구",select:"객체 선택",remove:"객체 삭제",history:"실행 취소 · 다시 실행 · 도구 해제",undo:"실행 취소",redo:"다시 실행",cancel:"도구 해제"},en:{view:"View",tools:"Tools",select:"Select object",remove:"Delete object",history:"Undo, redo and cancel tool",undo:"Undo",redo:"Redo",cancel:"Cancel tool"},tr:{view:"Görünüm",tools:"Araçlar",select:"Nesne seç",remove:"Nesneyi sil",history:"Geri al, yinele ve aracı bırak",undo:"Geri al",redo:"Yinele",cancel:"Aracı bırak"}}[locale];

  return (
    <>
      {canMeasure?<aside className="viewer-history-dock" role="group" aria-label={words.history}>
        <button type="button" aria-label={words.undo} title={words.undo} disabled={!canUndo} onClick={onUndo}><UndoIcon/></button>
        <button type="button" aria-label={words.redo} title={words.redo} disabled={!canRedo} onClick={onRedo}><RedoIcon/></button>
      </aside>:null}
    <nav className={`viewer-toolbar ${canMeasure ? "with-measure with-edit" : ""}`} aria-label={t("viewerControls")}>
      <div className="viewer-tool-row">
        <div className="viewer-view-group" role="group" aria-label={words.view}>
          <button type="button" aria-label={t("reset")} title={t("reset")} onClick={()=>onCommand("reset")}><ResetIcon/></button>
        </div>
        {canMeasure?<ToolStrip className="viewer-tools-scroll" role="group" aria-label={words.tools} tabIndex={0}>
          <button type="button" aria-pressed={!!measuring} aria-expanded={!!panelOpen} aria-label={t("measure")} title={t("measure")} onClick={onMeasure}><MeasureIcon/><span>{t("measure")}</span></button>
          <button type="button" aria-pressed={!!editing} aria-expanded={!!editOpen} aria-label={t("editTools")} onClick={onEdit}><ToolIcon name="polyline"/><span>{t("editTools")}</span></button>
          {onTakeoff?<button type="button" data-tool="takeoff" aria-label="콘크리트 적산" aria-pressed={!!takeoffActive} onClick={onTakeoff}><ToolIcon name="layers"/><span>적산</span></button>:null}
          <button type="button" data-tool="select" aria-label={words.select} title={words.select} aria-pressed={!!selecting} onClick={onSelect}><ToolIcon name="select"/><span>{words.select}</span></button>
          <button type="button" data-tool="delete" aria-label={words.remove} title={words.remove} disabled={!canDelete} onClick={onDelete}><ToolIcon name="delete"/><span>{words.remove}</span></button>
        </ToolStrip>:null}
        {canMeasure?<button type="button" className="viewer-cancel-tool" aria-label={words.cancel} title={words.cancel} onClick={onCancel}><CancelToolIcon/></button>:null}
      </div>
    </nav>
    </>
  );
}

