import{useI18n}from"../i18n/I18nProvider";
export function PrecisionSelect({value,onChange,compact=false}:{value:number;onChange(value:number):void;compact?:boolean}){
 const{locale}=useI18n(),label=locale==="ko"?"소수 자릿수":locale==="en"?"Decimal places":"Ondalık basamak";
 return <label className="precision-option">{compact?(locale==="ko"?"소수":locale==="en"?"Dec.":"Bas."):label}<select aria-label={label} value={value} onChange={e=>onChange(+e.target.value)}>{Array.from({length:7},(_,i)=><option key={i} value={i}>{compact?String(i):i===0?"0":`0.${"0".repeat(i)}`}</option>)}</select></label>;
}
