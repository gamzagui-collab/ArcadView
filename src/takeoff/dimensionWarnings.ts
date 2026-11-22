import type {MeasurementUnit} from "../viewer/measurementGeometry";
import {dimensionCandidate,dimensionFields,type SpecificationUnit} from "./dimensionInputs";
import {quantity,type Dimensions,type TakeoffObject} from "./model";
import type {Locale} from "../i18n/translations";
import {intlLocale,takeoffText,takeoffError} from "../i18n/takeoff";

export type DimensionWarning={code:"mixed-units"|"large-size"|"previous-size";message:string};
/** These are input plausibility prompts, not structural design limits. Only
 * the existing positive/finite/hard range validation can prevent saving. */
export function reviewDimensions(object:TakeoffObject,values:readonly string[],units:readonly SpecificationUnit[],drawingUnit:MeasurementUnit,previous?:Dimensions,locale:Locale="ko"){
 const text=(key:Parameters<typeof takeoffText>[1],values?:Record<string,string|number>)=>takeoffText(locale,key,values),number=new Intl.NumberFormat(intlLocale(locale),{maximumFractionDigits:6});
 const fields=dimensionFields(object.kind,locale),warnings:DimensionWarning[]=[];let candidate:TakeoffObject|null=null,error="";
 try{candidate=dimensionCandidate(object,values,units,locale);quantity(candidate,drawingUnit);}catch(e){
  const entered=fields.map((f,i)=>`${f.label} ${values[i]??""} ${units[i]??""}`).join(" · ");
  error=`${takeoffError(locale,e)} ${text("입력: {values}",{values:entered})}`;
  return{candidate:null,error,warnings};
 }
 if(new Set(units).size>1)warnings.push({code:"mixed-units",message:text("입력 단위가 섞여 있습니다: {units}. 환산값을 확인하세요.",{units:fields.map((f,i)=>`${f.label} ${units[i]}`).join(" · ")})});
 const q=quantity(candidate,drawingUnit),span=q.lengthM||Math.sqrt(q.areaM2),basis=q.lengthM?text("도형 길이 {value} m",{value:number.format(q.lengthM)}):text("도형 면적 {value} m²",{value:number.format(q.areaM2)});
 for(const f of fields){const metres=candidate.dimensions[f.key]!*.001;
  const unusual=f.key==="heightMm"?metres>=100||metres>Math.max(10,span*10):metres>=10||metres>Math.max(1,span*2);
  if(unusual)warnings.push({code:"large-size",message:text("{basis}에 {field} {value} m를 적용합니다. 큰 규격이므로 m/mm 단위와 자릿수를 확인하세요.",{basis,field:f.label,value:number.format(metres)})});
 }
 if(previous){const changes=fields.filter(f=>typeof previous[f.key]==="number"&&Math.abs(candidate!.dimensions[f.key]!-previous[f.key]!)>Math.max(1e-7,Math.abs(previous[f.key]!)*1e-12));
  if(changes.length)warnings.push({code:"previous-size",message:`${text("앞서 입력한 규격과 다릅니다.")}\n${changes.map(f=>`${f.label}: ${number.format(previous[f.key]!)} mm → ${number.format(candidate!.dimensions[f.key]!)} mm`).join("\n")}`});
 }
 return{candidate,error,warnings};
}
