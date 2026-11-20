import type { ViewerCommand } from "../types/drawing";
import { useI18n } from "../i18n/I18nProvider";
import {
  FitIcon,
  ResetIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MeasureIcon,
  UndoIcon, RedoIcon, CancelToolIcon,
} from "./Icons";

type Props = {
  onCommand(command: ViewerCommand): void;
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
};

export function ViewerToolbar({ onCommand, canMeasure, measuring, panelOpen, onMeasure,onEdit,editing,editOpen,canUndo,canRedo,onUndo,onRedo,onCancel }: Props) {
  const { t,locale } = useI18n();
  const words={ko:{view:"보기",history:"실행 취소 · 다시 실행 · 도구 해제",undo:"실행 취소",redo:"다시 실행",cancel:"도구 해제"},en:{view:"View",history:"Undo, redo and cancel tool",undo:"Undo",redo:"Redo",cancel:"Cancel tool"},tr:{view:"Görünüm",history:"Geri al, yinele ve aracı bırak",undo:"Geri al",redo:"Yinele",cancel:"Aracı bırak"}}[locale];
  const buttons = [
    { command: "zoom-in" as const, label: t("zoomIn"), Icon: ZoomInIcon },
    { command: "zoom-out" as const, label: t("zoomOut"), Icon: ZoomOutIcon },
    { command: "fit" as const, label: t("fit"), Icon: FitIcon },
    { command: "reset" as const, label: t("reset"), Icon: ResetIcon },
  ];

  return (
    <nav className={`viewer-toolbar ${canMeasure ? "with-measure with-edit" : ""}`} aria-label={t("viewerControls")}>
      <div className="viewer-view-group" role="group" aria-label={words.view}>{buttons.map(({ command, label, Icon }) => (
        <button
          key={command}
          type="button"
          aria-label={label}
          title={label}
          onClick={() => onCommand(command)}
        >
          <Icon />
        </button>
      ))}</div>
      {canMeasure ? <button type="button" aria-pressed={!!measuring} aria-expanded={!!panelOpen} aria-label={t("measure")} title={t("measure")} onClick={onMeasure}><MeasureIcon /><span>{t("measure")}</span></button> : null}
      {canMeasure ? <button type="button" aria-pressed={!!editing} aria-expanded={!!editOpen} aria-label={t("editTools")} onClick={onEdit}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 16-1 5 5-1L21 7l-4-4L4 16Zm10-10 4 4M4 16l4 4"/></svg><span>{t("editTools")}</span></button>:null}
      {canMeasure?<div className="viewer-history-group" role="group" aria-label={words.history}>
        <button type="button" aria-label={words.undo} title={words.undo} disabled={!canUndo} onClick={onUndo}><UndoIcon/></button>
        <button type="button" aria-label={words.redo} title={words.redo} disabled={!canRedo} onClick={onRedo}><RedoIcon/></button>
        <button type="button" aria-label={words.cancel} title={words.cancel} onClick={onCancel}><CancelToolIcon/></button>
      </div>:null}
    </nav>
  );
}

