import { useLayoutEffect, useRef, useState } from "react";
import type { DrawingViewer } from "../viewer/DrawingViewer";
import type { TextEditSession } from "../viewer/textEditing";
import { useI18n } from "../i18n/I18nProvider";
import { PaletteIcon } from "./Icons";

const colors=["#ffffff","#c0c8d2","#808a98","#202a36","#49cfff","#218bff","#3155df","#9a74ff","#fa68df","#ff526d","#ff944d","#ffd65c","#8ce56d","#25c795","#39d9d1","#b99975"];
let textMetrics:CanvasRenderingContext2D|null|undefined;
export function inputBaseline(size:number):number{
  textMetrics??=document.createElement("canvas").getContext("2d");
  if(!textMetrics)return size*1.05;
  textMetrics.font=`${size}px ArcadAnnotation`;
  const m=textMetrics.measureText("한Ag"),a=m.fontBoundingBoxAscent,d=m.fontBoundingBoxDescent;
  return Number.isFinite(a)&&Number.isFinite(d)?(size*1.3-a-d)/2+a:size*1.05;
}
type Props={viewer:DrawingViewer;session:TextEditSession|null;active:boolean;height:number;color:string;onText(text:string):void;onStyle(style:{height?:number;color?:string}):void;onFinish(text:string,cancel?:boolean):void};

export function CanvasTextEditor({viewer,session,active,height,color,onText,onStyle,onFinish}:Props){
  const {locale}=useI18n();
  const w={ko:{content:"문자 내용",size:"글자 크기",color:"문자 색상",palette:"색상 팔레트",apply:"적용",close:"닫기",custom:"다른 색상",placeholder:"텍스트 입력"},en:{content:"Text content",size:"Text size",color:"Text color",palette:"Color palette",apply:"Apply",close:"Close",custom:"Custom color",placeholder:"Enter text"},tr:{content:"Metin içeriği",size:"Metin boyutu",color:"Metin rengi",palette:"Renk paleti",apply:"Uygula",close:"Kapat",custom:"Özel renk",placeholder:"Metin girin"}}[locale];
  const input=useRef<HTMLTextAreaElement>(null),sidebar=useRef<HTMLElement>(null);
  const [palette,setPalette]=useState(false),[paletteColor,setPaletteColor]=useState(color),[rangeBase,setRangeBase]=useState(height);
  const live=useRef({session,height,color,onText,onStyle,onFinish});live.current={session,height,color,onText,onStyle,onFinish};
  const position=()=>{
    const s=live.current.session,el=input.current;if(!s||!el)return;
    const[a,b]=viewer.projectPoints([s.point,{x:s.point.x,y:s.point.y+live.current.height}]);
    const size=Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));
    // Match the SVG baseline, including the input's border/padding, when editing ends.
    el.style.left=`${a.x-3}px`;el.style.top=`${a.y-inputBaseline(size)-1}px`;el.style.fontSize=`${size}px`;
    el.style.transformOrigin=`3px ${inputBaseline(size)+1}px`;el.style.transform=s.rotation?`rotate(${-s.rotation}deg)`:"";
    const width=viewer.getCanvasElement().clientWidth;
    el.style.width=`${Math.max(96,Math.min(Math.max(128,(el.value.split("\n").reduce((max,s)=>Math.max(max,[...s].length),0)+1)*size),width-Math.max(0,a.x)-12))}px`;
    el.style.height="0px";el.style.height=`${Math.max(size*1.3+6,el.scrollHeight+2)}px`;
  };
  useLayoutEffect(()=>viewer.subscribeView(position),[viewer]);
  useLayoutEffect(()=>{let mounted=true;void document.fonts?.ready.then(()=>{if(mounted)position();});return()=>{mounted=false;};},[]);
  useLayoutEffect(position,[session,height]);
  useLayoutEffect(()=>{
    setRangeBase(live.current.height);setPalette(false);
    if(session&&input.current){input.current.focus({preventScroll:true});input.current.setSelectionRange(input.current.value.length,input.current.value.length);position();}
  },[session?.id,active]);
  useLayoutEffect(()=>{
    const outside=(event:PointerEvent)=>{
      if(!live.current.session)return;
      const target=event.target as Node;
      if(input.current?.contains(target)||sidebar.current?.contains(target))return;
      // The first outside canvas tap only ends editing; it must not stamp a new text object.
      if(target===viewer.getCanvasElement()){if(event.cancelable)event.preventDefault();event.stopPropagation();}
      live.current.onFinish(input.current?.value??live.current.session.text);
    };
    document.addEventListener("pointerdown",outside,true);
    return()=>document.removeEventListener("pointerdown",outside,true);
  },[viewer]);
  if(!active&&!session)return null;
  const slider=Math.max(0,Math.min(100,50+Math.log2(height/rangeBase)*12.5));
  return <>
    {session?<textarea key={session.id} ref={input} className="canvas-text-input" aria-label={w.content} placeholder={w.placeholder}
      defaultValue={session.text} maxLength={500} rows={1} wrap="off" spellCheck={false} autoCapitalize="off" autoComplete="off" style={{color}}
      onInput={e=>{onText(e.currentTarget.value);position();}} onCompositionEnd={e=>{onText(e.currentTarget.value);position();}}
      onKeyDown={e=>{if(e.nativeEvent.isComposing){if(e.key==="Escape"||e.key==="Enter")e.stopPropagation();return;}if(e.key==="Escape"){e.preventDefault();onFinish(e.currentTarget.value,true);}else if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();onFinish(e.currentTarget.value);}}}/>:null}
    <aside ref={sidebar} className="text-style-sidebar" aria-label={w.size}>
      <span className="text-size-symbol" aria-hidden="true">A</span>
      <output aria-live="off">{new Intl.NumberFormat(locale,{maximumFractionDigits:3}).format(height)}</output>
      <div className="text-size-track"><input type="range" aria-label={w.size} min={0} max={100} step={1} value={slider}
        onChange={e=>onStyle({height:Math.max(.001,Math.min(1e6,rangeBase*2**((+e.target.value-50)/12.5)))})}/></div>
      <button type="button" className="text-palette-button" aria-label={w.color} title={w.color} aria-expanded={palette} style={{color}}
        onClick={()=>{setPaletteColor(color);setPalette(v=>!v);}}><PaletteIcon/></button>
      {palette?<section className="text-color-palette" role="dialog" aria-label={w.palette}>
        <header><strong>{w.color}</strong><button type="button" aria-label={w.close} onClick={()=>setPalette(false)}>×</button></header>
        <div className="text-color-body"><div className="text-color-swatches">{colors.map(c=><button type="button" key={c} aria-label={c} aria-pressed={paletteColor===c} style={{background:c}} onClick={()=>setPaletteColor(c)}/>)}</div>
        <label className="text-custom-color">{w.custom}<input type="color" aria-label={w.custom} value={paletteColor} onChange={e=>setPaletteColor(e.target.value)}/></label></div>
        <button type="button" className="text-color-apply" onClick={()=>{onStyle({color:paletteColor});setPalette(false);}}>{w.apply}</button>
      </section>:null}
    </aside>
  </>;
}
