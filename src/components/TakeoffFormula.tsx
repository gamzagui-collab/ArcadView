import type {MeasurementUnit} from "../viewer/measurementGeometry";
import {knownUnit,type Dimensions,type TakeoffObject} from "../takeoff/model";
import {takeoffFormula} from "../takeoff/formula";
import {dimensionFields} from "../takeoff/dimensionInputs";
import type {Locale} from "../i18n/translations";
import {takeoffText,type TakeoffTextKey} from "../i18n/takeoff";

export function TakeoffFormula({object,unit,measurementUnit,onEdit,disabled=false,locale="ko"}:{object:TakeoffObject;unit:MeasurementUnit;measurementUnit:MeasurementUnit;onEdit?:(key:keyof Dimensions)=>void;disabled?:boolean;locale?:Locale}){
 const formula=takeoffFormula(object,unit,locale),fields=dimensionFields(object.kind,locale),tx=(key:TakeoffTextKey,values?:Record<string,string|number>)=>takeoffText(locale,key,values);
 return <section className="takeoff-formula" aria-label={tx("선택 적산 객체 산식")}>
  <small>{formula.factors.map(f=>f.name).join(" × ")}</small>
  <output data-takeoff-formula aria-label={formula.description}>{formula.factors.map((f,i)=>{const field=fields.find(d=>d.label===f.name);return <span key={f.name}>{i?" × ":""}{onEdit&&field?<button type="button" className="takeoff-formula-value" aria-label={tx("{field} {value} 수정",{field:f.name,value:f.value})} disabled={disabled} onClick={()=>onEdit(field.key)}>{f.value}</button>:f.value}</span>;})}{" = "}{formula.result}</output>
  {onEdit&&formula.factors.some(f=>fields.some(d=>d.label===f.name))?<small>{tx("밑줄 값을 눌러 규격 수정 · 길이·면적은 도형 기준")}</small>:null}
  {knownUnit(measurementUnit)&&measurementUnit!==unit?<p className="takeoff-unit-mismatch" role="status">{tx("측정 도면 단위는 {measurement}, 적산 도면 단위는 {takeoff}입니다. 단위 설정을 확인하세요.",{measurement:measurementUnit,takeoff:unit})}</p>:null}
  <details><summary>{tx("입력값·단위 · 도면 {unit}",{unit})}</summary><small>{tx("적산 도면 1단위 = {unit}",{unit})}</small>
   <dl>{formula.factors.map(f=><div key={f.name}><dt>{f.name}</dt><dd>{f.source} → {f.value}</dd></div>)}</dl>
   <small>{tx("계산은 반올림 전 값 기준")}</small>
  </details>
 </section>;
}
