import { useEffect, useRef, useState,useSyncExternalStore } from "react";
import { commerceSnapshot,commerceSubscribe,showAccount } from "../commerce/client";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { version } from "../../package.json";
import { useBackNavigation } from "../app/backNavigation";
import { useUx } from "../i18n/ux";
import { Brand } from "./Brand";
import { CloseIcon } from "./Icons";
import { ToolIcon } from "./ToolIcon";
const sourceUrl=`https://github.com/gamzagui-collab/ArcadView-Source/tree/v${version}`;

export function AboutPanel({onClose}:{onClose():void}){
 const commerce=useSyncExternalStore(commerceSubscribe,commerceSnapshot);
 const u=useUx(),ref=useRef<HTMLElement>(null),[notices,setNotices]=useState("");useBackNavigation(onClose,true);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>previous?.focus();},[]);
 useEffect(()=>{let live=true;void Promise.all(['NOTICE.md','THIRD_PARTY_LICENSES.md'].map(n=>fetch('/licenses/'+n).then(r=>{if(!r.ok)throw Error();return r.text();}))).then(v=>{if(live)setNotices(v.join('\n\n'));}).catch(()=>{if(live)setNotices('GPL-3.0-only · izCAD © orgofjs / İZ\nComplete corresponding source: '+sourceUrl+'\nUpstream: https://github.com/orgofjs/izCAD\nBundled dependency licenses are included with this application.');});return()=>{live=false;};},[]);
 return <div className="about-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={ref} className="about-panel" role="dialog" aria-modal="true" aria-label={u.about} onKeyDown={e=>{if(e.key==='Tab'){const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('button,a,summary')??[]).filter(e=>e.getClientRects().length);if(!items?.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}>
  <header><span>{u.about}</span><button className="icon-button" onClick={onClose} aria-label={u.close}><CloseIcon/></button></header><Brand company/><p>{u.aboutCopy}</p><small>Version {version.replace(/\.0$/,"")}</small><div className="about-privacy"><ToolIcon name="shield"/><p>{commerce.managed?"도면은 이 기기에서 처리합니다. 로그인·사용량·구매 확인에는 계정 서버와 Google을 사용하며 도면은 업로드하지 않습니다.":u.privacy}</p></div>
  {commerce.managed?<><p>Google 로그인·사용량·결제 확인은 온라인으로 처리합니다. 도면은 서버에 전송하지 않습니다.</p><button className="about-update-button" onClick={()=>{onClose();showAccount();}}>계정 및 사용량</button><button className="about-update-button" onClick={()=>void Browser.open({url:"https://play.google.com/store/apps/details?id=com.guisarc.arcadview"})}>Google Play 업데이트</button></>:<button className="about-update-button" onClick={()=>window.dispatchEvent(new Event("arcad:check-updates"))}><ToolIcon name="save"/>{u.updates}</button>}
  <details><summary>{u.credits} · GPL-3.0</summary><pre>{notices}</pre><a href={sourceUrl} target="_blank" rel="noreferrer" onClick={e=>{if(Capacitor.isNativePlatform()){e.preventDefault();void Browser.open({url:e.currentTarget.href}).catch(()=>undefined);}}}>{commerce.managed&&!commerce.server?"기존 직원용 공개 소스 (현재 Play 개발본의 소스는 동봉된 개발 아카이브 참조)":"Arcad View · "+u.sourceCode} · v{version}</a><a href="https://github.com/orgofjs/izCAD" target="_blank" rel="noreferrer" onClick={e=>{if(Capacitor.isNativePlatform()){e.preventDefault();void Browser.open({url:e.currentTarget.href}).catch(()=>undefined);}}}>izCAD · upstream source</a></details><p className="about-company">GUI&apos;s Arc Industry</p>
 </section></div>;
}
