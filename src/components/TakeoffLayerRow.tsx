import {useEffect,useState} from "react";
import {totalText,type QuantityTotal,type TakeoffLayer} from "../takeoff/model";
import {useI18n} from "../i18n/I18nProvider";
import {takeoffText,takeoffLayerName,type TakeoffTextKey} from "../i18n/takeoff";
type Props={layer:TakeoffLayer;number:number;selected:boolean;disabled:boolean;canRemove:boolean;quantity:QuantityTotal;onSelect():void;onVisible():void;onRename(name:string):void;onRemove():void};
export function TakeoffLayerRow({layer,number,selected,disabled,canRemove,quantity:q,onSelect,onVisible,onRename,onRemove}:Props){
 const{locale}=useI18n(),tx=(key:TakeoffTextKey,values?:Record<string,string|number>)=>takeoffText(locale,key,values);
 const[name,setName]=useState(layer.name);useEffect(()=>setName(layer.name),[layer.name]);
 const rename=()=>{const value=name.trim();if(value&&value!==layer.name)onRename(value);else setName(layer.name);};
 return <div className={`takeoff-layer-row ${selected?"active":""}`} data-takeoff-layer={layer.id}>
  <div><input type="radio" name="takeoff-layer" aria-label={tx("적산 레이어 {n} 선택",{n:number})} checked={selected} disabled={disabled} onChange={onSelect}/><input type="checkbox" aria-label={tx("{name} 표시",{name:takeoffLayerName(locale,layer.name)})} checked={layer.visible} disabled={disabled} onChange={onVisible}/><input aria-label={tx("적산 레이어 {n} 이름",{n:number})} className="takeoff-layer-name" value={takeoffLayerName(locale,name)} maxLength={48} disabled={disabled} onChange={e=>setName(e.target.value)} onBlur={rename} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/><button type="button" aria-label={tx("적산 레이어 {n} 삭제",{n:number})} disabled={disabled||!canRemove} onClick={onRemove}>×</button></div>
  <small>{tx("{n}개",{n:q.count})} <b>{totalText(q)}</b></small>
 </div>;
}
