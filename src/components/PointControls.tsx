import{useLayoutEffect,useRef}from"react";
import{useI18n}from"../i18n/I18nProvider";
import{useBackNavigation}from"../app/backNavigation";
import type{DrawingViewer}from"../viewer/DrawingViewer";
import{pointScreenGeometry,type PointStyle,type PointTextSession}from"../viewer/pointMarkup";
import{inputBaseline}from"./CanvasTextEditor";
const colors=["#ff586d","#ffd65c","#ffffff","#49cfff","#218bff","#8ce56d","#fa68df","#ff944d"];
export function PointStyleControls({style,selected,onChange,onApply}:{style:PointStyle;selected:boolean;onChange(style:PointStyle):void;onApply():void}){
 const{locale}=useI18n(),w=locale==="ko"?{width:"표시 굵기",color:"표시 색상",font:"마킹 글자 크기",fixed:"확대해도 굵기·문자 크기는 화면에서 일정합니다.",apply:"선택한 표시에 적용"}:locale==="en"?{width:"Mark width",color:"Mark color",font:"Label size",fixed:"Width and label size stay fixed on screen when zooming.",apply:"Apply to selected mark"}:{width:"İşaret kalınlığı",color:"İşaret rengi",font:"Yazı boyutu",fixed:"Yakınlaştırmada ekran kalınlığı ve yazı boyutu sabit kalır.",apply:"Seçili işarete uygula"};
 return <div className="point-style-controls">
  <label>{w.width}<input type="range" aria-label={w.width} min={1} max={12} step={.5} value={style.width} onChange={e=>onChange({...style,width:+e.target.value})}/><output>{style.width}px</output></label>
  <label>{w.font}<input type="range" aria-label={w.font} min={10} max={48} step={1} value={style.fontSize} onChange={e=>onChange({...style,fontSize:+e.target.value})}/><output>{style.fontSize}px</output></label>
  <div className="point-color-palette" role="group" aria-label={w.color}>{colors.map(c=><button key={c} type="button" aria-label={`${w.color} ${c}`} aria-pressed={style.color===c} style={{background:c}} onClick={()=>onChange({...style,color:c})}/>)}<input type="color" aria-label={w.color} value={style.color} onChange={e=>onChange({...style,color:e.target.value})}/></div>
  {selected?<button className="point-style-apply" type="button" onClick={onApply}>{w.apply}</button>:null}<small>{w.fixed}</small>
 </div>;
}
export function PointLeaderEditor({viewer,session,onText,onFinish}:{viewer:DrawingViewer;session:PointTextSession;onText(text:string):void;onFinish(text:string,cancel?:boolean):void}){
 const{locale}=useI18n(),input=useRef<HTMLTextAreaElement>(null),live=useRef({session,onText,onFinish});live.current={session,onText,onFinish};
 useBackNavigation(()=>live.current.onFinish(input.current?.value??live.current.session.object.text??""),true);
 const position=()=>{
  const el=input.current;if(!el)return;const object=live.current.session.object,g=pointScreenGeometry({...object,text:el.value},p=>viewer.projectPoints(p)),l=g.label;if(!l)return;
  const size=l.fontSize,width=Math.max(120,Math.min(l.bounds.maxX-l.bounds.minX+25,viewer.getCanvasElement().clientWidth-24));
  el.style.left=`${l.point.x-(l.anchor==="end"?width:0)-3}px`;el.style.top=`${l.point.y-inputBaseline(size)-1}px`;el.style.width=`${width}px`;el.style.fontSize=`${size}px`;el.style.height="0px";el.style.height=`${Math.max(size*1.3+6,el.scrollHeight+2)}px`;
 };
 useLayoutEffect(()=>viewer.subscribeView(position),[viewer]);
 useLayoutEffect(()=>{input.current?.focus({preventScroll:true});const e=input.current;if(e)e.setSelectionRange(e.value.length,e.value.length);position();},[session.object.id]);
 useLayoutEffect(position,[session]);
 useLayoutEffect(()=>{const outside=(e:PointerEvent)=>{if(input.current?.contains(e.target as Node))return;if(e.target===viewer.getCanvasElement()){if(e.cancelable)e.preventDefault();e.stopPropagation();}live.current.onFinish(input.current?.value??live.current.session.object.text??"");};document.addEventListener("pointerdown",outside,true);return()=>document.removeEventListener("pointerdown",outside,true);},[viewer]);
 return <textarea ref={input} key={session.object.id} className="point-leader-input" aria-label={session.object.kind==="point-text"?(locale==="ko"?"마킹 텍스트":locale==="en"?"Markup text":"İşaret metni"):(locale==="ko"?"포인트 지시문자":locale==="en"?"Point label":"İşaret yazısı")} placeholder={session.object.kind==="point-text"?(locale==="ko"?"텍스트 입력":locale==="en"?"Enter text":"Metin girin"):(locale==="ko"?"지시문자 입력":locale==="en"?"Enter label":"Etiket girin")} defaultValue={session.object.text??""} maxLength={500} rows={1} wrap="off" spellCheck={false} autoCapitalize="off" autoComplete="off" style={{color:session.object.color}}
  onInput={e=>{onText(e.currentTarget.value);position();}} onCompositionEnd={e=>{onText(e.currentTarget.value);position();}}
  onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==="Escape"){e.preventDefault();e.stopPropagation();onFinish(e.currentTarget.value,true);}else if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();onFinish(e.currentTarget.value);}}}/>;
}
