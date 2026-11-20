import { useEffect, useState, useSyncExternalStore,useRef } from "react";
import { Browser } from "@capacitor/browser";
import { useBackNavigation } from "../app/backNavigation";
import { api, buy, checkService,commerceSnapshot, commerceSubscribe,currentUser, deleteAccount, errorMessage, logout, nativeCommerce, refreshAccount, restorePurchases, signIn, type PlayProduct } from "../commerce/client";
import { CloseIcon } from "./Icons";
import "../commerce/commerce.css";
export function AccountPanel({onClose}:{onClose():void}){
  const panel=useRef<HTMLElement>(null);
  const account=useSyncExternalStore(commerceSubscribe,commerceSnapshot),[products,setProducts]=useState<PlayProduct[]>([]),[message,setMessage]=useState<string|null>(null),[busy,setBusy]=useState(false),[deleting,setDeleting]=useState(false),[history,setHistory]=useState<{usage:{tool:string;source:string;created_at:number}[];purchases:{product_id:string;state:string;created_at:number}[]}|null>(null);
  useBackNavigation(onClose,true);
  useEffect(()=>{void checkService().catch(e=>setMessage(errorMessage(e)));},[]);
  useEffect(()=>{const old=document.activeElement as HTMLElement|null;panel.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>old?.focus();},[]);
  const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);setMessage(null);try{await fn();}catch(e){setMessage(errorMessage(e));}finally{setBusy(false);}};
  useEffect(()=>{if(!account.balance)return;let live=true;void api<typeof history>("/v1/history").then(v=>{if(live)setHistory(v);}).catch(()=>undefined);return()=>{live=false;};},[account.balance]);
  const prices=()=>run(async()=>{setProducts((await nativeCommerce.products()).products);});
  const b=account.balance,disabled=busy||account.busy;
  return <div className="about-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={panel} className="about-panel account-panel" role="dialog" aria-modal="true" aria-label="계정 및 사용량" onKeyDown={e=>{if(e.key==='Tab'){const items=[...panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a,summary')??[]].filter(v=>v.getClientRects().length);if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}>
    <header><strong>계정 및 사용량</strong><button className="icon-button" onClick={onClose} aria-label="닫기"><CloseIcon/></button></header>
    {account.environment!=="production"?<small>개발용 · 테스트 서비스 · 실제 판매 비활성화</small>:null}
    <p>도면 열람은 로그인 없이 무료로 사용할 수 있습니다. 도면은 서버에 업로드하지 않습니다.</p>
    {!b?currentUser()?<><h2>계정이 연결되어 있습니다</h2><p>인터넷 연결 후 최신 잔액을 확인해 주세요. 도면과 저장된 결과는 계속 열람할 수 있습니다.</p><button disabled={disabled} onClick={()=>void run(()=>refreshAccount())}>잔액 다시 확인</button><button disabled={disabled} onClick={()=>void run(()=>logout())}>로그아웃</button></>:<><h2>Google 계정으로 계속하기</h2><p>측정·작성과 구매한 사용량을 계정에 연결합니다.</p><button disabled={disabled||!account.available} onClick={()=>void signIn()}>Google 계정으로 계속하기</button>{!account.available?<><p role="status">계정 서비스를 준비하고 있습니다. 도면 열람은 계속 사용할 수 있습니다.</p>{account.server?<button disabled={disabled} onClick={()=>void run(()=>checkService())}>서비스 다시 확인</button>:null}</>:null}</>:<>
      <h2>{b.plan}</h2><div className="account-balances"><div><strong>{b.free}</strong><span>이번 달 무료 횟수</span></div><div><strong>{b.paid}</strong><span>Standard 잔액</span></div></div>
      <p>무료 횟수 재설정: {new Date(b.resetsAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})} (한국시간)</p>
      {b.subscription?<p>Pro: {b.subscription.state.replace("SUBSCRIPTION_STATE_","")}<br/>이용기한: {new Date(b.subscription.expiresAt).toLocaleString("ko-KR")}</p>:null}
      {b.debt>0?<p role="alert">환불된 구매에서 이미 사용한 {b.debt}회가 기록되어 있습니다. 다음 충전 시 이 수량을 먼저 정산합니다.</p>:null}
      <button disabled={disabled} onClick={()=>void run(()=>refreshAccount())}>잔액 새로고침</button>
      <button disabled={disabled} onClick={()=>void run(()=>restorePurchases())}>구매 복원</button>
      <div className="account-products"><article><h3>Standard · 500회 충전</h3><p>필요할 때만 구매하고, 사용하지 않은 유료 횟수는 계속 보유합니다.</p><small>자동 갱신 없는 일회성 구매 · 완료된 작업 1회당 1회 차감</small></article><article><h3>Pro · 모든 측정·그리기 도구 무제한</h3><p>Google Play를 통한 월 자동 갱신 구독입니다.</p><small>활성 기간에는 무료·Standard 잔액을 차감하지 않습니다.</small></article></div>
      <button disabled={disabled} onClick={()=>void prices()}>Google Play 가격 확인</button>
      {products.map(p=><button key={p.id} disabled={disabled||!account.billingEnabled||!p.price||!p.offerToken} onClick={()=>void run(()=>buy(p))}>{p.name} · {p.price??"구매 불가"}{p.period==="P1M"?" / 매월":" · 일회성"}</button>)}
      <p className="account-policy">정렬 측정: 매월 무료 100회부터 사용합니다. 고급 측정·작성은 Standard 또는 Pro가 필요합니다. 선택·취소·오류·Undo/Redo·삭제만 한 경우는 차감하지 않습니다. 기존 결과의 열람은 무료입니다. 측정·작성 완료에는 인터넷 연결이 필요합니다.</p>
      <button onClick={()=>void Browser.open({url:"https://play.google.com/store/account/subscriptions?sku=pro_monthly&package=com.guisarc.arcadview"})}>Google Play 구독 관리</button>
      {history?<details><summary>최근 사용·구매 기록</summary><ul>{history.usage.map((v,i)=><li key={"u"+i}>{new Date(v.created_at).toLocaleDateString("ko-KR")} · {v.tool} · {v.source}</li>)}{history.purchases.map((v,i)=><li key={"p"+i}>{new Date(v.created_at).toLocaleDateString("ko-KR")} · {v.product_id} · {v.state}</li>)}</ul></details>:null}
      <button disabled={disabled} onClick={()=>void run(()=>logout())}>로그아웃</button><button disabled={disabled} onClick={()=>setDeleting(v=>!v)}>계정 삭제</button>
      {deleting?<div className="account-delete"><p>계정을 삭제하면 로그인 연결과 잔여 사용권에 접근할 수 없습니다. 기기의 도면은 유지됩니다. 거래 기록은 법정 의무·분쟁 처리 범위에서 분리 보존합니다. 구독은 Google Play에서 별도로 취소해 주세요.</p><button disabled={disabled} onClick={()=>void run(async()=>{await deleteAccount();setDeleting(false);})}>계정 삭제 확정</button><button onClick={()=>setDeleting(false)}>돌아가기</button></div>:null}
    </>}
    <p role="alert">{message??account.error}</p><details><summary>개인정보처리 안내</summary><p>도면과 좌표·문자는 기기에만 보관합니다. 서버에는 로그인 식별자 해시, 구매·구독 정보, 작업 ID·도구 종류·결과 해시·사용 기록을 보관합니다. 로그인 연결과 세션은 계정 삭제 시 제거하며 거래 기록의 보존 정책은 출시 전에 확정합니다. 현재 개발 빌드는 판매용으로 출시되지 않았습니다.</p></details><p>앱 정보 화면에서 오픈소스 라이선스를 확인할 수 있습니다.</p>
  </section></div>;
}
