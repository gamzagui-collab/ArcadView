import {useEffect,useState} from "react";
import type {Quantity,TakeoffLayer} from "../takeoff/model";
type Props={layer:TakeoffLayer;number:number;selected:boolean;disabled:boolean;canRemove:boolean;quantity:Quantity&{count:number};onSelect():void;onVisible():void;onRename(name:string):void;onRemove():void};
export function TakeoffLayerRow({layer,number,selected,disabled,canRemove,quantity:q,onSelect,onVisible,onRename,onRemove}:Props){
 const[name,setName]=useState(layer.name);useEffect(()=>setName(layer.name),[layer.name]);
 const rename=()=>{const value=name.trim();if(value&&value!==layer.name)onRename(value);else setName(layer.name);};
 return <div className={`takeoff-layer-row ${selected?"active":""}`} data-takeoff-layer={layer.id}>
  <div><input type="radio" name="takeoff-layer" aria-label={`적산 레이어 ${number} 선택`} checked={selected} disabled={disabled} onChange={onSelect}/><input type="checkbox" aria-label={`${layer.name} 표시`} checked={layer.visible} disabled={disabled} onChange={onVisible}/><input aria-label={`적산 레이어 ${number} 이름`} className="takeoff-layer-name" value={name} maxLength={48} disabled={disabled} onChange={e=>setName(e.target.value)} onBlur={rename} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/><button type="button" aria-label={`적산 레이어 ${number} 삭제`} disabled={disabled||!canRemove} onClick={onRemove}>×</button></div>
  <small>{q.count}개 · {q.lengthM.toFixed(2)}m · {q.areaM2.toFixed(2)}m² <b>{q.volumeM3.toFixed(3)}m³</b></small>
 </div>;
}
