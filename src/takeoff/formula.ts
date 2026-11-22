import {UNIT_METERS,type MeasurementUnit} from "../viewer/measurementGeometry";
import {calculationOf,quantity,quantityText,type Quantity,type TakeoffObject} from "./model";

export type TakeoffFactor={name:string;value:string;source:string};
type Formula={factors:TakeoffFactor[];result:string;expression:string;description:string};
const formulas=new WeakMap<TakeoffObject,{unit:MeasurementUnit;quantity:Quantity;value:Formula}>();
const number=new Intl.NumberFormat("ko-KR",{maximumFractionDigits:6});
/** Show small, positive specifications rather than rounding them to zero. */
function format(value:number){return value!==0&&Math.abs(value)<1e-6?value.toExponential(5).replace(/\.?0+e/,"e"):number.format(value);}

/** Read the saved coordinates/specifications; never derive quantities from
 * rounded display text or the currently selected creation mode. */
export function takeoffFormula(object:TakeoffObject,unit:MeasurementUnit){
 const q=quantity(object,unit),d=object.dimensions,area=calculationOf(object)==="area";
 const cached=formulas.get(object);if(cached?.unit===unit&&cached.quantity===q)return cached.value;
 const factors:TakeoffFactor[]=[];
 if(area||object.kind==="slab"||object.kind==="column")factors.push({name:"면적",value:`${format(q.areaM2)} m²`,source:`${format(q.areaM2/(UNIT_METERS[unit]**2))} ${unit}²`});
 else factors.push({name:"길이",value:`${format(q.lengthM)} m`,source:`${format(q.lengthM/UNIT_METERS[unit])} ${unit}`});
 const dimension=(name:string,mm:number)=>factors.push({name,value:`${format(mm*.001)} m`,source:`${format(mm)} mm`});
 if(!area){
  if(object.kind==="wall"){dimension("높이",d.heightMm!);dimension("두께",d.thicknessMm!);}
  else if(object.kind==="beam"){dimension("폭",d.widthMm!);dimension("깊이",d.depthMm!);}
  else if(object.kind==="column")dimension("높이",d.heightMm!);
  else dimension("두께",d.thicknessMm!);
 }
 const result=quantityText(q),expression=`${factors.map(f=>f.value).join(" × ")} = ${result}`;
 const value={factors,result,expression,description:`${factors.map(f=>`${f.name} ${f.value}`).join(" × ")} = ${result}`};
 formulas.set(object,{unit,quantity:q,value});return value;
}
