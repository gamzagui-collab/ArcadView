const KEY="arcad.display.precision.v1";
export function validPrecision(value:unknown):value is number{return Number.isInteger(value)&&Number(value)>=0&&Number(value)<=6;}
export function readPrecision():number{try{const raw=localStorage.getItem(KEY);if(raw!==null){const n=Number(raw);if(validPrecision(n))return n;}}catch{}return 3;}
export function savePrecision(value:number):boolean{if(!validPrecision(value))return false;try{localStorage.setItem(KEY,String(value));return true;}catch{return false;}}
/** Formatting only: never round the coordinates or calculated measurement. */
export function formatCadNumber(value:number,precision:number,locale="ko"):string{
  const digits=validPrecision(precision)?precision:3;
  return new Intl.NumberFormat(locale,{maximumFractionDigits:digits}).format(Math.abs(value)<.5*10**-digits?0:value);
}
