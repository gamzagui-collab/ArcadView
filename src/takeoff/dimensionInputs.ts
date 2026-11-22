import {parseEditNumber} from "../viewer/offsetGeometry";
import {calculationOf,dimensionsError,type Dimensions,type TakeoffKind,type TakeoffObject} from "./model";

export type SpecificationUnit="m"|"mm";
export type DimensionField={key:keyof Dimensions;label:string};
// Move the decimal exponent without introducing binary multiplication tails
// such as 0.20012345678899998 into an editable decimal input.
function rescale(value:number,power:number){const [base,exponent="0"]=String(value).split("e");return Number(`${base}e${Number(exponent)+power}`);}
export function dimensionFields(kind:TakeoffKind):DimensionField[]{
 return kind==="wall"?[{key:"heightMm",label:"높이"},{key:"thicknessMm",label:"두께"}]:kind==="beam"?[{key:"widthMm",label:"폭"},{key:"depthMm",label:"깊이"}]:kind==="column"?[{key:"heightMm",label:"높이"}]:[{key:"thicknessMm",label:"두께"}];
}
export function dimensionInputs(object:TakeoffObject,heightUnit:SpecificationUnit,focus?:keyof Dimensions){
 const fields=dimensionFields(object.kind),units=fields.map(f=>f.key===focus?"m":f.key==="heightMm"?heightUnit:"mm") as SpecificationUnit[];
 return{fields,units,values:fields.map((f,i)=>String(rescale(object.dimensions[f.key]!,units[i]==="m"?-3:0))),focus:Math.max(0,fields.findIndex(f=>f.key===focus))};
}
export function convertDimensionInput(value:string,from:SpecificationUnit,to:SpecificationUnit){
 const number=parseEditNumber(value);return number===null||from===to?value:String(rescale(number,from==="m"?3:-3));
}
/** Specifications always remain mm in storage. Geometry and derived quantities
 * are never replaced by the displayed formula's rounded values. */
export function dimensionCandidate(object:TakeoffObject,values:readonly string[],units:readonly SpecificationUnit[]):TakeoffObject{
 if(calculationOf(object)!=="volume")throw Error("면적 적산의 길이·면적은 도형에서 수정하세요.");
 const fields=dimensionFields(object.kind);if(values.length!==fields.length||units.length!==fields.length)throw Error("규격 입력을 확인하세요.");
 const dimensions={...object.dimensions};
 for(let i=0;i<fields.length;i++){
  const number=parseEditNumber(values[i]);if(number===null||!["mm","m"].includes(units[i]))throw Error(`${fields[i].label}에 유효한 숫자와 단위를 입력하세요.`);
  dimensions[fields[i].key]=rescale(number,units[i]==="m"?3:0);
 }
 const error=dimensionsError(object.kind,dimensions);if(error)throw Error(error);
 return{...object,dimensions};
}
