import type {MeasurementUnit} from "../viewer/measurementGeometry";
import {dimensionCandidate,dimensionFields,type SpecificationUnit} from "./dimensionInputs";
import {quantity,type Dimensions,type TakeoffObject} from "./model";

export type DimensionWarning={code:"mixed-units"|"large-size"|"previous-size";message:string};
const number=new Intl.NumberFormat("ko-KR",{maximumFractionDigits:6});
/** These are input plausibility prompts, not structural design limits. Only
 * the existing positive/finite/hard range validation can prevent saving. */
export function reviewDimensions(object:TakeoffObject,values:readonly string[],units:readonly SpecificationUnit[],drawingUnit:MeasurementUnit,previous?:Dimensions){
 const fields=dimensionFields(object.kind),warnings:DimensionWarning[]=[];let candidate:TakeoffObject|null=null,error="";
 try{candidate=dimensionCandidate(object,values,units);quantity(candidate,drawingUnit);}catch(e){
  const entered=fields.map((f,i)=>`${f.label} ${values[i]??""} ${units[i]??""}`).join(" · ");
  error=`${e instanceof Error?e.message:String(e)} 입력: ${entered}`;
  return{candidate:null,error,warnings};
 }
 if(new Set(units).size>1)warnings.push({code:"mixed-units",message:`입력 단위가 섞여 있습니다: ${fields.map((f,i)=>`${f.label} ${units[i]}`).join(" · ")}. 환산값을 확인하세요.`});
 const q=quantity(candidate,drawingUnit),span=q.lengthM||Math.sqrt(q.areaM2),basis=q.lengthM?`도형 길이 ${number.format(q.lengthM)} m`:`도형 면적 ${number.format(q.areaM2)} m²`;
 for(const f of fields){const metres=candidate.dimensions[f.key]!*.001;
  const unusual=f.key==="heightMm"?metres>=100||metres>Math.max(10,span*10):metres>=10||metres>Math.max(1,span*2);
  if(unusual)warnings.push({code:"large-size",message:`${basis}에 ${f.label} ${number.format(metres)} m를 적용합니다. 큰 규격이므로 m/mm 단위와 자릿수를 확인하세요.`});
 }
 if(previous){const changes=fields.filter(f=>typeof previous[f.key]==="number"&&Math.abs(candidate!.dimensions[f.key]!-previous[f.key]!)>Math.max(1e-7,Math.abs(previous[f.key]!)*1e-12));
  if(changes.length)warnings.push({code:"previous-size",message:`앞서 입력한 규격과 다릅니다.\n${changes.map(f=>`${f.label}: ${number.format(previous[f.key]!)} mm → ${number.format(candidate!.dimensions[f.key]!)} mm`).join("\n")}`});
 }
 return{candidate,error,warnings};
}
