import {useLayoutEffect,useRef} from "react";
import {createPortal} from "react-dom";
import {useBackNavigation} from "../app/backNavigation";
import {useI18n} from "../i18n/I18nProvider";
import type {DrawingViewer} from "../viewer/DrawingViewer";
import type {OffsetGuide} from "../viewer/offsetGeometry";

export function GeometryDistanceDialog({kind,values,unit,error,onChange,onApply,onCancel,title,labels,help}:{title?:string;labels?:string[];help?:string;kind:"move"|"offset"|"rotate";values:string[];unit:string;error:string;onChange(values:string[]):void;onApply():void;onCancel():void}){
  const {locale}=useI18n();
  const w={ko:{move:"이동 거리",offset:"옵셋 거리",apply:"적용",go:"이동",cancel:"취소",x:"X 이동",y:"Y 이동",distance:"거리",help:"X: 오른쪽 + / 왼쪽 − · Y: 위 + / 아래 −",offsetHelp:"선택한 화살표 방향으로 평행한 객체를 추가합니다."},en:{move:"Move distance",offset:"Offset distance",apply:"Apply",go:"Move",cancel:"Cancel",x:"X displacement",y:"Y displacement",distance:"Distance",help:"X: right + / left − · Y: up + / down −",offsetHelp:"Add a parallel copy in the selected arrow direction."},tr:{move:"Taşıma mesafesi",offset:"Öteleme mesafesi",apply:"Uygula",go:"Taşı",cancel:"İptal",x:"X mesafesi",y:"Y mesafesi",distance:"Mesafe",help:"X: sağ + / sol − · Y: yukarı + / aşağı −",offsetHelp:"Seçilen ok yönünde paralel bir kopya ekler."}}[locale];
  const dialog=useRef<HTMLElement>(null),first=useRef<HTMLInputElement>(null);
  const rotation=locale==="ko"?{title:"회전 각도",angle:"각도",help:"1도 단위 · + 반시계 방향 / − 시계 방향"}:locale==="en"?{title:"Rotation angle",angle:"Angle",help:"Whole degrees · + counterclockwise / − clockwise"}:{title:"Döndürme açısı",angle:"Açı",help:"Tam derece · + saat yönünün tersi / − saat yönü"};
  const heading=title??(kind==="rotate"?rotation.title:w[kind]),field=(i:number)=>labels?.[i]??(kind==="move"?(i===0?w.x:w.y):kind==="rotate"?rotation.angle:w.distance);
  useBackNavigation(onCancel,true);
  useLayoutEffect(()=>{
    const nodes=[...document.querySelectorAll<HTMLElement>('.app-content,.canvas-layer')].map(e=>({e,prior:e.inert}));
    for(const{e}of nodes)e.inert=true;
    first.current?.focus({preventScroll:true});first.current?.select();
    return()=>{for(const{e,prior}of nodes)if(e.isConnected)e.inert=prior;};
  },[]);
  return createPortal(<div className="geometry-edit-backdrop" onPointerDown={e=>e.stopPropagation()}>
    <section ref={dialog} className="geometry-edit-dialog" role="dialog" aria-modal="true" aria-label={heading} onKeyDown={e=>{
      if(e.key==="Escape"){e.preventDefault();onCancel();}
      if(e.key==="Tab"){const nodes=[...dialog.current!.querySelectorAll<HTMLElement>('input,button')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    }}>
      <header><strong>{heading}</strong><button type="button" aria-label={w.cancel} onClick={onCancel}>×</button></header>
      <form onSubmit={e=>{e.preventDefault();onApply();}}>
        <p>{help??(kind==="move"?w.help:kind==="rotate"?rotation.help:w.offsetHelp)}</p>
        <div className="geometry-distance-fields">{values.map((value,i)=><label key={i}>{field(i)}<span>
          <input ref={i===0?first:undefined} aria-label={field(i)} type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={value}
            onFocus={e=>e.currentTarget.select()} onMouseUp={e=>e.preventDefault()} onChange={e=>onChange(values.map((v,j)=>i===j?e.target.value:v))}/><b>{unit}</b>
        </span></label>)}</div>
        {error?<p className="geometry-edit-error" role="alert">{error}</p>:null}
        <div className="geometry-edit-actions"><button type="button" onClick={onCancel}>{w.cancel}</button><button type="submit" className="geometry-edit-apply">{kind==="move"?w.go:w.apply}</button></div>
      </form>
    </section>
  </div>,document.body);
}

export function OffsetDirections({viewer,guide,onChoose}:{viewer:DrawingViewer;guide:OffsetGuide;onChoose(side:1|-1):void}){
  const {locale}=useI18n(),buttons=useRef<Array<HTMLButtonElement|null>>([]);
  const text=locale==="ko"?{title:"옵셋 방향 선택",out:"바깥쪽",inside:"안쪽",side:"이 방향"}:locale==="en"?{title:"Choose offset side",out:"Outside",inside:"Inside",side:"This side"}:{title:"Öteleme yönü",out:"Dışarı",inside:"İçeri",side:"Bu yön"};
  useLayoutEffect(()=>{
    const position=()=>{
      const[a,b]=viewer.projectPoints([guide.anchor,{x:guide.anchor.x+guide.normal.x,y:guide.anchor.y+guide.normal.y}]),d=Math.hypot(b.x-a.x,b.y-a.y)||1;
      for(const[i,side]of([1,-1]as const).entries()){
        const el=buttons.current[i];if(!el)continue;
        const x=(b.x-a.x)/d*side,y=(b.y-a.y)/d*side;
        el.style.left=`${a.x+x*58}px`;el.style.top=`${a.y+y*58}px`;el.style.setProperty('--direction-angle',`${Math.atan2(y,x)}rad`);
      }
    };
    position();return viewer.subscribeView(position);
  },[viewer,guide]);
  return <div className="offset-direction-controls" role="group" aria-label={text.title}>{([1,-1]as const).map((side,i)=><button key={side} ref={el=>{buttons.current[i]=el;}} data-offset-side={side} aria-label={guide.radial?(side===1?text.out:text.inside):`${text.side} ${i+1}`} onClick={()=>onChoose(side)}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m-7-7 7 7-7 7"/></svg><small>{guide.radial?(side===1?text.out:text.inside):text.side}</small>
  </button>)}</div>;
}
