import {useI18n} from "../i18n/I18nProvider";
import {takeoffText} from "../i18n/takeoff";
export type LayerTab="draw"|"takeoff";
export function LayerTabs({value,onChange}:{value:LayerTab;onChange(value:LayerTab):void}){
 const{locale}=useI18n(),labels={ko:["그리기","적산"],en:["Drawing","Takeoff"],tr:["Çizim","Metraj"]}[locale];
 return <div className="layer-tabs" role="tablist" aria-label={takeoffText(locale,"레이어 종류")}>{(["draw","takeoff"]as const).map((tab,i)=><button key={tab} type="button" role="tab" data-layer-tab={tab} aria-selected={value===tab} onClick={()=>onChange(tab)}>{labels[i]}</button>)}</div>;
}
