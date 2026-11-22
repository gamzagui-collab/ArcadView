import {ToolStrip} from "./ToolStrip";
import {ToolbarStatus} from "./ToolbarStatus";
import { useI18n } from "../i18n/I18nProvider";
import { CloseIcon,UndoIcon } from "./Icons";
import { ToolIcon } from "./ToolIcon";
import { PrecisionSelect } from "./PrecisionSelect";
import { formatCadNumber } from "../viewer/displayPrecision";
import {
  convertMeasurement, pathLength,
  type LinearAxis, type MeasurementGeometry, type MeasurementMode, type MeasurementSettings, type MeasurementUnit,
} from "../viewer/measurementGeometry";
import { canFinishMeasurement, isDistanceMode, linearMeasurement, measurementReadout, pathIsClosed } from "../viewer/measurementTools";

type Props = {
  settings: MeasurementSettings;
  geometry: MeasurementGeometry | null;
  sourceUnit: MeasurementUnit;
  displayUnit: MeasurementUnit;
  feedback: string | null;
  precision:number;
  onPrecision(value:number):void;
  onHide(): void;
  onSettings(settings: MeasurementSettings): void;
  onSourceUnit(unit: MeasurementUnit): void;
  onDisplayUnit(unit: MeasurementUnit): void;
  onFinish(): void;
  finishDisabled?: boolean;
};
const unitOptions: MeasurementUnit[] = ["drawing", "mm", "cm", "m", "in", "ft"];
const modeKeys = { distance: "measureDistance", linear: "measureLinear", path: "measurePath", area: "measureArea", radius:"measureRadius", angle: "measureAngle", object: "measureObject" } as const;

export function MeasurementPanel({ settings, geometry, sourceUnit, displayUnit, feedback,precision,onPrecision, onHide, onSettings, onSourceUnit, onDisplayUnit,onFinish,finishDisabled }: Props) {
  const { t, locale } = useI18n();
  const format = (value: number, area = false) => `${formatCadNumber(convertMeasurement(value, sourceUnit, displayUnit, area),precision,locale)} ${displayUnit === "drawing" ? t("drawingUnit") : displayUnit}${area ? "²" : ""}`;
  const { value, area, segment } = measurementReadout(settings);
  const instruction = settings.mode === "object" ? t("measurePickObject") : settings.mode === "angle" ? t("measurePickAngle") : settings.mode==="radius"?t("measurePickRadius"):settings.mode === "area" ? t("measurePickArea") : settings.mode === "path" ? t("measurePickPath") : settings.mode === "linear" ? t("measurePickLinear") : t("measurePickDistance");
  return (
    <section className="measurement-panel tool-panel" aria-label={t("measure")}>
      <div className="measurement-title tool-panel-header"><strong className="sr-only">{t("measure")}</strong>
      <button type="button" className="icon-button" aria-label={t("closeMeasurement")} onClick={onHide}><CloseIcon /></button></div>
      <ToolStrip className="measurement-modes" tabIndex={0}>
        {(["distance", "linear", "path", "area", "radius", "angle", "object"] as MeasurementMode[]).map((mode) => (
          <button key={mode} data-mode={mode} type="button" aria-pressed={settings.mode === mode} onClick={() => onSettings({ ...settings, enabled: true, displayOnly:false, mode, points: [], entity: null })}><ToolIcon name={mode}/><span>{t(modeKeys[mode])}{mode==="distance"?<small className="tool-free-label">{locale==="ko"?"무료 · 무제한":locale==="en"?"Free · unlimited":"Ücretsiz · sınırsız"}</small>:null}</span></button>
        ))}
      </ToolStrip>
      <details className="measurement-help tool-help"><summary aria-label={t("measureHelp")} title={t("measureHelp")}>?</summary><p className="measurement-instruction">{instruction}</p></details>
      <div className="measurement-options">
        <label title={t("drawingUnitLabel")}>{locale==="ko"?"도면":locale==="en"?"DWG":"Çiz."}<select aria-label={t("drawingUnitLabel")} value={sourceUnit} onChange={(e) => { const unit = e.target.value as MeasurementUnit; onSourceUnit(unit); if (displayUnit === "drawing") onDisplayUnit(unit); }}>{unitOptions.map((unit) => <option key={unit} value={unit}>{unit === "drawing" ? t("drawingUnit") : unit}</option>)}</select></label>
        <label title={t("displayUnitLabel")}>{locale==="ko"?"표시":locale==="en"?"Unit":"Birim"}<select aria-label={t("displayUnitLabel")} value={displayUnit} onChange={(e) => onDisplayUnit(e.target.value as MeasurementUnit)}>{unitOptions.filter((unit) => sourceUnit !== "drawing" || unit === "drawing").map((unit) => <option key={unit} value={unit}>{unit === "drawing" ? t("drawingUnit") : unit}</option>)}</select></label>
        <PrecisionSelect value={precision} onChange={onPrecision} compact/>
        {settings.mode === "linear" ? <label className="measurement-linear-axis" title={t("measureLinearAxis")}>{locale==="ko"?"축":locale==="en"?"Axis":"Eksen"}<select aria-label={t("measureLinearAxis")} value={settings.linearAxis ?? "auto"} onChange={e => onSettings({ ...settings, linearAxis: e.target.value as LinearAxis })}><option value="auto">{t("measureAxisAuto")}</option><option value="x">X</option><option value="y">Y</option></select></label>:null}
      </div>
      {sourceUnit === "drawing" ? <p className="measurement-hint">{t("measureUnknownUnit")}</p> : null}
      {geometry?.limited||geometry?.snapLimited ? <p className="measurement-hint">{t("measureIndexLimited")}</p> : null}
      <div className="measurement-actions">
        <div className="measurement-result" role="status">
          {segment?<span className="sr-only">{locale==="ko"?"직전 구간":locale==="en"?"Last segment":"Son parça"}</span>:null}
          <strong>{value === undefined ? "—" : `${settings.entity?.approximate && settings.mode === "object" ? "≈ " : ""}${settings.mode === "angle" ? `${formatCadNumber(value,precision,locale)}°` : (settings.mode==="radius"?"R ":"")+format(value, area)}`}</strong>
          {settings.mode === "area" && settings.displayOnly && settings.points.length >= 3 ? <span>{t("measurePerimeter")}: {format(pathLength(settings.points, true))}</span> : null}
          {settings.mode === "object" && settings.entity?.area !== undefined ? <span>{t("measureArea")}: {format(settings.entity.area, true)}</span> : null}
        </div>
        <label className="measurement-snap" title={t("measureSnap")}><input type="checkbox" aria-label={t("measureSnap")} checked={settings.snapping} onChange={(e) => onSettings({ ...settings, snapping: e.target.checked })} />{locale==="ko"?"스냅":locale==="en"?"Snap":"Yak."}</label>
        {!settings.displayOnly&&(settings.mode==="path"||settings.mode==="area")?<button type="button" className="measurement-finish" aria-label={locale==="ko"?"측정 완료":locale==="en"?"Finish measurement":"Ölçümü bitir"} disabled={finishDisabled||!canFinishMeasurement(settings)} onClick={onFinish}>{locale==="ko"?"완료 ✓":locale==="en"?"Finish ✓":"Bitir ✓"}</button>:null}
        <span className="measurement-feedback sr-only" role="status">{feedback ?? t("measure2D")}</span>
        <button type="button" aria-label={t("measureUndo")} title={t("measureUndo")} disabled={settings.points.length === 0 && !settings.entity} onClick={() => onSettings({ ...settings, points: settings.points.slice(0, -1), entity: null })}><UndoIcon/></button>
        <button type="button" aria-label={t("measureClear")} title={t("measureClear")} disabled={settings.points.length === 0 && !settings.entity} onClick={() => onSettings({ ...settings, points: [], entity: null })}><ToolIcon name="delete"/></button>
      </div>
    </section>
  );
}

export function MeasurementStatus({settings,sourceUnit,displayUnit,feedback,precision,onShow,onToggle,onFinish,finishDisabled}:Pick<Props,"settings"|"sourceUnit"|"displayUnit"|"feedback"|"precision"|"onFinish"|"finishDisabled">&{onShow():void;onToggle():void}) {
  const {t,locale}=useI18n();
  const {value,area,segment}=measurementReadout(settings);
  const unit=displayUnit==="drawing"?t("drawingUnit"):displayUnit;
  const result=value===undefined?"—":settings.mode==="angle"?formatCadNumber(value,precision,locale)+"°":`${settings.mode==="radius"?"R ":""}${formatCadNumber(convertMeasurement(value,sourceUnit,displayUnit,area),precision,locale)} ${unit}${area?"²":""}`;
  const direction=settings.mode==="linear"?linearMeasurement(settings.points,settings.linearAxis)?.axis:undefined;
  const mode=t(modeKeys[settings.mode])+(settings.mode==="distance"?` · ${locale==="ko"?"무료 · 무제한":locale==="en"?"Free · unlimited":"Ücretsiz · sınırsız"}`:"")+(direction?` · ${t(direction==="x"?"measureHorizontal":"measureVertical")}`:"");
  return <ToolbarStatus><div className={`measurement-status ${settings.enabled?"is-active":""}`} role="status">
    <button type="button" className="measurement-status-copy" title={`${mode} · ${result}`} aria-label={`${mode} · ${settings.points.length} · ${result}`} onClick={onShow}><ToolIcon name={settings.mode}/>{settings.points.length?<b className="status-count" aria-hidden="true">{settings.points.length}</b>:null}<span className="sr-only">{settings.enabled?mode:`${t("measureNavigate")} · ${mode}`} · {settings.points.length}{settings.mode==="angle"?"/3":isDistanceMode(settings.mode)||settings.mode==="radius"?"/2":""} · {settings.snapping?t("measureSnap"):t("measureSnapOff")}{settings.mode==="path"&&pathIsClosed(settings.points)?` · ${t("measureClosed")}`:""}{segment?` · ${locale==="ko"?"직전 구간":locale==="en"?"Last segment":"Son parça"}`:""}</span><strong className="measurement-status-result sr-only">{result}</strong>{settings.enabled&&feedback?<small className="sr-only">{feedback}</small>:null}</button>
    {!settings.displayOnly&&(settings.mode==="path"||settings.mode==="area")?<button type="button" className="measurement-finish" aria-label={locale==="ko"?"측정 완료":locale==="en"?"Finish measurement":"Ölçümü bitir"} disabled={finishDisabled||!canFinishMeasurement(settings)} onClick={onFinish}>{locale==="ko"?"완료":locale==="en"?"Finish":"Bitir"}</button>:null}
    <button type="button" className="measurement-toggle" onClick={onToggle} aria-label={settings.enabled&&!settings.displayOnly?t("measurePause"):t("measureResume")} title={settings.enabled&&!settings.displayOnly?t("measurePause"):t("measureResume")}>{settings.enabled&&!settings.displayOnly?"Ⅱ":"▶"}</button>
  </div></ToolbarStatus>;
}
