import {useI18n} from "../i18n/I18nProvider";
import type {ObjectSize} from "../viewer/objectSizing";
export const sizeWords={
 ko:{title:"선택 객체 치수",edit:"수치 수정",radius:"반지름",width:"가로",height:"세로",length:"구간 길이",segment:"구간",previous:"이전 구간",next:"다음 구간",direct:"수치입력없이 바로적용",help:"원·호는 중심, 사각형은 첫 모서리를 고정합니다. 폴리라인은 선택 구간의 시작점을 고정하고 끝점을 옮깁니다. 연결된 다음 구간 길이는 바뀔 수 있습니다.",invalid:"유효한 양수를 입력하세요. 연결된 구간이 사라지는 크기는 적용할 수 없습니다."},
 en:{title:"Selected object dimensions",edit:"Edit size",radius:"Radius",width:"Width",height:"Height",length:"Segment length",segment:"Segment",previous:"Previous segment",next:"Next segment",direct:"Apply without numeric input",help:"Circles/arcs keep their center; rectangles keep their first corner. A polyline keeps the selected segment start and moves its end; the next segment length can change.",invalid:"Enter positive sizes without collapsing an adjacent segment."},
 tr:{title:"Seçili nesne boyutları",edit:"Boyutu düzenle",radius:"Yarıçap",width:"Genişlik",height:"Yükseklik",length:"Bölüm uzunluğu",segment:"Bölüm",previous:"Önceki bölüm",next:"Sonraki bölüm",direct:"Sayısal giriş olmadan uygula",help:"Daire/yay merkezi ve dikdörtgenin ilk köşesi sabittir. Çoklu çizgide seçili bölümün başlangıcı sabit, sonu hareket eder; sonraki bölüm uzunluğu değişebilir.",invalid:"Pozitif boyutlar girin; bitişik bölümü sıfıra indirmeyin."}
};
export function ObjectSizeControls({id,info,unit,onEdit,onSegment}:{id:string;info:ObjectSize;unit:string;onEdit():void;onSegment(index:number):void}){
 const{locale}=useI18n(),w=sizeWords[locale],position=info.segments.indexOf(info.segment),format=(v:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:6}).format(v);
 return <section className="object-dimensions-panel" aria-label={w.title} data-object={id} data-size-segment={info.segment}>
  {info.kind==="segment"?<div className="object-segment-nav"><button type="button" aria-label={w.previous} disabled={position<=0} onClick={()=>onSegment(info.segments[position-1])}>‹</button><span>{w.segment} {position+1} / {info.segments.length}</span><button type="button" aria-label={w.next} disabled={position>=info.segments.length-1} onClick={()=>onSegment(info.segments[position+1])}>›</button></div>:null}
  <div className="object-dimensions-values">{info.values.map((value,i)=><span key={i}><small>{info.kind==="radius"?w.radius:info.kind==="rectangle"?(i===0?w.width:w.height):w.length}</small><output>{format(value)} <b>{unit}</b></output></span>)}<button type="button" className="object-dimensions-edit" onClick={onEdit}>{w.edit}</button></div>
 </section>;
}
