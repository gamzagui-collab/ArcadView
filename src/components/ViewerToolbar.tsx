import type { ViewerCommand } from "../types/drawing";
import { useI18n } from "../i18n/I18nProvider";
import {
  FitIcon,
  ResetIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MeasureIcon,
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
};

export function ViewerToolbar({ onCommand, canMeasure, measuring, panelOpen, onMeasure,onEdit,editing,editOpen }: Props) {
  const { t } = useI18n();
  const buttons = [
    { command: "zoom-in" as const, label: t("zoomIn"), Icon: ZoomInIcon },
    { command: "zoom-out" as const, label: t("zoomOut"), Icon: ZoomOutIcon },
    { command: "fit" as const, label: t("fit"), Icon: FitIcon },
    { command: "reset" as const, label: t("reset"), Icon: ResetIcon },
  ];

  return (
    <nav className={`viewer-toolbar ${canMeasure ? "with-measure with-edit" : ""}`} aria-label={t("viewerControls")}>
      {buttons.map(({ command, label, Icon }) => (
        <button
          key={command}
          type="button"
          aria-label={label}
          title={label}
          onClick={() => onCommand(command)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
      {canMeasure ? <button type="button" aria-pressed={!!measuring} aria-expanded={!!panelOpen} aria-label={t("measure")} title={t("measure")} onClick={onMeasure}><MeasureIcon /><span>{t("measure")}</span></button> : null}
      {canMeasure ? <button type="button" aria-pressed={!!editing} aria-expanded={!!editOpen} aria-label={t("editTools")} onClick={onEdit}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 16-1 5 5-1L21 7l-4-4L4 16Zm10-10 4 4M4 16l4 4"/></svg><span>{t("editTools")}</span></button>:null}
    </nav>
  );
}

