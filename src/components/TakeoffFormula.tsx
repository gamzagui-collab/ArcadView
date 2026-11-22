import type {MeasurementUnit} from "../viewer/measurementGeometry";
import {knownUnit,type Dimensions,type TakeoffObject} from "../takeoff/model";
import {takeoffFormula} from "../takeoff/formula";
import {dimensionFields} from "../takeoff/dimensionInputs";

export function TakeoffFormula({object,unit,measurementUnit,onEdit,disabled=false}:{object:TakeoffObject;unit:MeasurementUnit;measurementUnit:MeasurementUnit;onEdit?:(key:keyof Dimensions)=>void;disabled?:boolean}){
 const formula=takeoffFormula(object,unit);
 return <section className="takeoff-formula" aria-label="선택 적산 객체 산식">
  <small>{formula.factors.map(f=>f.name).join(" × ")}</small>
  <output data-takeoff-formula aria-label={formula.description}>{formula.factors.map((f,i)=>{const field=dimensionFields(object.kind).find(d=>d.label===f.name);return <span key={f.name}>{i?" × ":""}{onEdit&&field?<button type="button" className="takeoff-formula-value" aria-label={`${f.name} ${f.value} 수정`} disabled={disabled} onClick={()=>onEdit(field.key)}>{f.value}</button>:f.value}</span>;})}{" = "}{formula.result}</output>
  {onEdit&&formula.factors.some(f=>dimensionFields(object.kind).some(d=>d.label===f.name))?<small>밑줄 값을 눌러 규격 수정 · 길이·면적은 도형 기준</small>:null}
  {knownUnit(measurementUnit)&&measurementUnit!==unit?<p className="takeoff-unit-mismatch" role="status">측정 도면 단위는 {measurementUnit}, 적산 도면 단위는 {unit}입니다. 단위 설정을 확인하세요.</p>:null}
  <details><summary>입력값·단위 · 도면 {unit}</summary><small>적산 도면 1단위 = {unit}</small>
   <dl>{formula.factors.map(f=><div key={f.name}><dt>{f.name}</dt><dd>{f.source} → {f.value}</dd></div>)}</dl>
   <small>계산은 반올림 전 값 기준</small>
  </details>
 </section>;
}
