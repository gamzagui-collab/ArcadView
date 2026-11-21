import {useLayoutEffect,useRef,useState} from "react";
import {useI18n} from "../i18n/I18nProvider";
import {hasTextSize,objectStyleValue,type ObjectStyle} from "../viewer/annotationStyle";
import type {Annotation} from "../viewer/annotations";
import {PaletteIcon} from "./Icons";

const colors=["#ffffff","#c0c8d2","#808a98","#202a36","#49cfff","#218bff","#3155df","#9a74ff","#fa68df","#ff526d","#ff944d","#ffd65c","#8ce56d","#25c795","#39d9d1","#b99975"];
type Props={object:Annotation;color:string;onPreview(style:ObjectStyle|null):void;onApply(style:ObjectStyle):void};
export function ObjectStyleControls({object,color,onPreview,onApply}:Props){
  const{locale}=useI18n(),w={ko:{style:"선택 객체 스타일",width:"선 두께",size:"글자 크기",color:"객체 색상",palette:"색상 팔레트",apply:"적용",close:"닫기",custom:"다른 색상"},en:{style:"Selected object style",width:"Line width",size:"Text size",color:"Object color",palette:"Color palette",apply:"Apply",close:"Close",custom:"Custom color"},tr:{style:"Seçili nesne stili",width:"Çizgi kalınlığı",size:"Metin boyutu",color:"Nesne rengi",palette:"Renk paleti",apply:"Uygula",close:"Kapat",custom:"Özel renk"}}[locale];
  const value=objectStyleValue(object),text=hasTextSize(object),label=text?w.size:w.width;
  const [size,setSize]=useState(value),[base,setBase]=useState(value),[palette,setPalette]=useState(false),[chosen,setChosen]=useState(color);
  const pending=useRef<ObjectStyle|null>(null),latest=useRef({onApply,onPreview,object});latest.current={onApply,onPreview,object};
  useLayoutEffect(()=>{pending.current=null;setSize(value);setBase(value);setPalette(false);},[object.id,object.points]);
  useLayoutEffect(()=>{if(!pending.current)setSize(value);},[value]);
  useLayoutEffect(()=>()=>latest.current.onPreview(null),[]);
  const finish=()=>{const style=pending.current;if(style){pending.current=null;onApply(style);}};
  const cancel=()=>{pending.current=null;setSize(objectStyleValue(latest.current.object));onPreview(null);};
  const slider=object.kind==="text"?Math.max(0,Math.min(100,50+Math.log2(size/base)*12.5)):size;
  const change=(range:number)=>{const next=object.kind==="text"?Math.max(.001,Math.min(1e6,base*2**((range-50)/12.5))):range;setSize(next);const style=object.kind==="text"?{textHeight:next}:object.kind==="point-leader"?{screenFontSize:next}:{screenWidth:next};pending.current=style;onPreview(style);};
  return <aside className="object-style-sidebar" aria-label={w.style} data-object={object.id}>
    <span className="object-size-symbol" aria-hidden="true">{text?"A":"≋"}</span>
    <output>{new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(size)}{object.kind==="text"?"":"px"}</output>
    <div className="object-size-track"><input type="range" aria-label={label} min={object.kind==="text"?0:object.kind==="point-leader"?10:1} max={object.kind==="text"?100:object.kind==="point-leader"?48:12} step={text?1:.5} value={slider}
      onChange={e=>change(+e.currentTarget.value)} onPointerUp={finish} onPointerCancel={cancel} onKeyUp={e=>{if(e.key.startsWith("Arrow")||["Home","End","PageUp","PageDown"].includes(e.key))finish();}} onBlur={finish}/></div>
    <button type="button" className="text-palette-button object-palette-button" aria-label={w.color} title={w.color} aria-expanded={palette} style={{color}}
      onClick={()=>{finish();setChosen(color);setPalette(v=>!v);}}><PaletteIcon/></button>
    {palette?<section className="text-color-palette object-color-palette" role="dialog" aria-label={w.palette}>
      <header><strong>{w.color}</strong><button type="button" aria-label={w.close} onClick={()=>setPalette(false)}>×</button></header>
      <div className="text-color-body"><div className="text-color-swatches">{colors.map(c=><button key={c} type="button" aria-label={c} aria-pressed={chosen.toLowerCase()===c} style={{background:c}} onClick={()=>setChosen(c)}/>)}</div>
        <label className="text-custom-color">{w.custom}<input type="color" aria-label={w.custom} value={chosen} onChange={e=>setChosen(e.currentTarget.value)}/></label></div>
      <button type="button" className="text-color-apply" onClick={()=>{onApply({color:chosen});setPalette(false);}}>{w.apply}</button>
    </section>:null}
  </aside>;
}
