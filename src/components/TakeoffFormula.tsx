import type {MeasurementUnit} from "../viewer/measurementGeometry";
import {knownUnit,type TakeoffObject} from "../takeoff/model";
import {takeoffFormula} from "../takeoff/formula";

export function TakeoffFormula({object,unit,measurementUnit}:{object:TakeoffObject;unit:MeasurementUnit;measurementUnit:MeasurementUnit}){
 const formula=takeoffFormula(object,unit);
 return <section className="takeoff-formula" aria-label="선택 적산 객체 산식">
  <small>{formula.factors.map(f=>f.name).join(" × ")}</small>
  <output data-takeoff-formula aria-label={formula.description}>{formula.expression}</output>
  {knownUnit(measurementUnit)&&measurementUnit!==unit?<p className="takeoff-unit-mismatch" role="status">측정 도면 단위는 {measurementUnit}, 적산 도면 단위는 {unit}입니다. 단위 설정을 확인하세요.</p>:null}
  <details><summary>입력값·단위 · 도면 {unit}</summary><small>적산 도면 1단위 = {unit}</small>
   <dl>{formula.factors.map(f=><div key={f.name}><dt>{f.name}</dt><dd>{f.source} → {f.value}</dd></div>)}</dl>
   <small>계산은 반올림 전 값 기준</small>
  </details>
 </section>;
}
