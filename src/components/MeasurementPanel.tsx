import { useI18n } from "../i18n/I18nProvider";
import { CloseIcon } from "./Icons";
import { ToolIcon } from "./ToolIcon";
import { PrecisionSelect } from "./PrecisionSelect";
import { formatCadNumber } from "../viewer/displayPrecision";
import {
  convertMeasurement, pathLength,
  type LinearAxis, type MeasurementGeometry, type MeasurementMode, type MeasurementSettings, type MeasurementUnit,
} from "../viewer/measurementGeometry";
import { isDistanceMode, linearMeasurement, measurementValue, pathIsClosed } from "../viewer/measurementTools";

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
};
const unitOptions: MeasurementUnit[] = ["drawing", "mm", "cm", "m", "in", "ft"];
const modeKeys = { distance: "measureDistance", linear: "measureLinear", path: "measurePath", area: "measureArea", angle: "measureAngle", object: "measureObject" } as const;

export function MeasurementPanel({ settings, geometry, sourceUnit, displayUnit, feedback,precision,onPrecision, onHide, onSettings, onSourceUnit, onDisplayUnit }: Props) {
  const { t, locale } = useI18n();
  const format = (value: number, area = false) => `${formatCadNumber(convertMeasurement(value, sourceUnit, displayUnit, area),precision,locale)} ${displayUnit === "drawing" ? t("drawingUnit") : displayUnit}${area ? "²" : ""}`;
  const value = measurementValue(settings);
  const instruction = settings.mode === "object" ? t("measurePickObject") : settings.mode === "angle" ? t("measurePickAngle") : settings.mode === "area" ? t("measurePickArea") : settings.mode === "path" ? t("measurePickPath") : settings.mode === "linear" ? t("measurePickLinear") : t("measurePickDistance");
  return (
    <section className="measurement-panel" aria-label={t("measure")}>
      <div className="measurement-title"><strong>{t("measure")}</strong>
      <div className="measurement-result" role="status">
        <strong>{value === undefined ? "—" : `${settings.entity?.approximate && settings.mode === "object" ? "≈ " : ""}${settings.mode === "angle" ? `${formatCadNumber(value,precision,locale)}°` : format(value, settings.mode === "area")}`}</strong>
        {settings.mode === "area" && settings.points.length >= 3 ? <span>{t("measurePerimeter")}: {format(pathLength(settings.points, true))}</span> : null}
        {settings.mode === "object" && settings.entity?.area !== undefined ? <span>{t("measureArea")}: {format(settings.entity.area, true)}</span> : null}
      </div>
      <button type="button" className="icon-button" aria-label={t("closeMeasurement")} onClick={onHide}><CloseIcon /></button></div>
      <div className="measurement-modes">
        {(["distance", "linear", "path", "area", "angle", "object"] as MeasurementMode[]).map((mode) => (
          <button key={mode} type="button" aria-pressed={settings.mode === mode} onClick={() => onSettings({ ...settings, enabled: true, mode, points: [], entity: null })}><ToolIcon name={mode}/><span>{t(modeKeys[mode])}</span></button>
        ))}
      </div>
      <details className="measurement-help"><summary>{t("measureHelp")}</summary><p className="measurement-instruction">{instruction}</p></details>
      {settings.mode === "linear" ? <label className="measurement-linear-axis">{t("measureLinearAxis")}<select value={settings.linearAxis ?? "auto"} onChange={e => onSettings({ ...settings, linearAxis: e.target.value as LinearAxis })}>
        <option value="auto">{t("measureAxisAuto")}</option><option value="x">{t("measureHorizontal")}</option><option value="y">{t("measureVertical")}</option>
      </select></label> : null}
      <div className="measurement-options">
        <label>{t("drawingUnitLabel")}<select value={sourceUnit} onChange={(e) => { const unit = e.target.value as MeasurementUnit; onSourceUnit(unit); if (displayUnit === "drawing") onDisplayUnit(unit); }}>{unitOptions.map((unit) => <option key={unit} value={unit}>{unit === "drawing" ? t("drawingUnit") : unit}</option>)}</select></label>
        <label>{t("displayUnitLabel")}<select value={displayUnit} onChange={(e) => onDisplayUnit(e.target.value as MeasurementUnit)}>{unitOptions.filter((unit) => sourceUnit !== "drawing" || unit === "drawing").map((unit) => <option key={unit} value={unit}>{unit === "drawing" ? t("drawingUnit") : unit}</option>)}</select></label>
      </div>
      <PrecisionSelect value={precision} onChange={onPrecision}/>
      {sourceUnit === "drawing" ? <p className="measurement-hint">{t("measureUnknownUnit")}</p> : null}
      {geometry?.limited||geometry?.snapLimited ? <p className="measurement-hint">{t("measureIndexLimited")}</p> : null}
      <div className="measurement-actions">
        <label className="measurement-snap"><input type="checkbox" checked={settings.snapping} onChange={(e) => onSettings({ ...settings, snapping: e.target.checked })} />{t("measureSnap")}</label>
        <span className="measurement-feedback" role="status">{feedback ?? t("measure2D")}</span>
        <button type="button" disabled={settings.points.length === 0 && !settings.entity} onClick={() => onSettings({ ...settings, points: settings.points.slice(0, -1), entity: null })}>{t("measureUndo")}</button>
        <button type="button" disabled={settings.points.length === 0 && !settings.entity} onClick={() => onSettings({ ...settings, points: [], entity: null })}>{t("measureClear")}</button>
      </div>
    </section>
  );
}

export function MeasurementStatus({settings,sourceUnit,displayUnit,feedback,precision,onShow,onToggle}:Pick<Props,"settings"|"sourceUnit"|"displayUnit"|"feedback"|"precision">&{onShow():void;onToggle():void}) {
  const {t,locale}=useI18n();
  const value=measurementValue(settings);
  const unit=displayUnit==="drawing"?t("drawingUnit"):displayUnit;
  const result=value===undefined?"—":settings.mode==="angle"?formatCadNumber(value,precision,locale)+"°":`${formatCadNumber(convertMeasurement(value,sourceUnit,displayUnit,settings.mode==="area"),precision,locale)} ${unit}${settings.mode==="area"?"²":""}`;
  const direction=settings.mode==="linear"?linearMeasurement(settings.points,settings.linearAxis)?.axis:undefined;
  const mode=t(modeKeys[settings.mode])+(direction?` · ${t(direction==="x"?"measureHorizontal":"measureVertical")}`:"");
  return <div className={`measurement-status ${settings.enabled?"is-active":""}`} role="status">
    <button type="button" className="measurement-status-copy" onClick={onShow}><span>{settings.enabled?mode:`${t("measureNavigate")} · ${mode}`} · {settings.points.length}{settings.mode==="angle"?"/3":isDistanceMode(settings.mode)?"/2":""} · {settings.snapping?t("measureSnap"):t("measureSnapOff")}{settings.mode==="path"&&pathIsClosed(settings.points)?` · ${t("measureClosed")}`:""}</span><strong className="measurement-status-result">{result}</strong>{settings.enabled&&feedback?<small>{feedback}</small>:null}</button>
    <button type="button" className="measurement-toggle" onClick={onToggle} aria-label={settings.enabled?t("measurePause"):t("measureResume")} title={settings.enabled?t("measurePause"):t("measureResume")}>{settings.enabled?"Ⅱ":"▶"}</button>
  </div>;
}
