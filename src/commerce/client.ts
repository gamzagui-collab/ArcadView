import { Capacitor, registerPlugin } from "@capacitor/core";
import { isUnmeteredTool } from "./toolPolicy";

export type AccountBalance = { userId:string;plan:"FREE"|"STANDARD"|"PRO";free:number;paid:number;debt:number;resetsAt:string;subscription:null|{state:string;expiresAt:string;autoRenew:boolean;active:boolean} };
export type PlayProduct={id:string;name:string;description:string;price?:string;period?:string;offerToken?:string};
type Purchase={token:string;products:string[];state:number};
interface NativeCommerce {
  getConfig():Promise<{enabled:boolean;server:string;distribution:string;environment?:string;billingEnabled?:boolean}>;
  signIn(options:{clientId:string;nonce:string}):Promise<{idToken:string}>;
  saveSession(options:{session:string}):Promise<void>;readSession():Promise<{session?:string}>;clearSession():Promise<void>;
  products():Promise<{products:PlayProduct[]}>;purchase(options:{productId:string;offerToken:string;accountId:string}):Promise<void>;
  restore():Promise<{purchases:Purchase[]}>;
  addListener(name:"purchases"|"resume",listener:(event:{code?:number;purchases?:Purchase[]})=>void):Promise<{remove():Promise<void>}>;
}
export const nativeCommerce=registerPlugin<NativeCommerce>("ArcadCommerce");
type Session={session:string;userId:string;accountId:string};
export type CommerceState={ready:boolean;managed:boolean;server:string;available:boolean;environment:string;billingEnabled:boolean;balance:AccountBalance|null;error:string|null;busy:boolean};
let state:CommerceState={ready:false,managed:Capacitor.isNativePlatform(),server:"",available:false,environment:"staging",billingEnabled:false,balance:null,error:null,busy:false};
let session:Session|null=null,boot:Promise<void>|undefined,restoring:Promise<void>|undefined;
const listeners=new Set<()=>void>();
export const commerceSnapshot=()=>state;
export const commerceSubscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
function patch(value:Partial<CommerceState>){state={...state,...value};for(const fn of listeners)fn();}
export type ToolAccessRequest={tool:string;resume?:()=>void};
export function showAccount(request?:ToolAccessRequest){window.dispatchEvent(new CustomEvent("arcad:account",{detail:request}));}
export class CommerceError extends Error { constructor(public code:string){super(code);} }
export async function api<T>(path:string,method="GET",body?:unknown):Promise<T>{
  if(!state.server)throw new CommerceError("SERVICE_NOT_CONFIGURED");
  const response=await fetch(state.server+path,{method,headers:{"Content-Type":"application/json",...(session?{Authorization:"Bearer "+session.session}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000),credentials:"omit",cache:"no-store"});
  const data=await response.json();
  if(!response.ok){if(response.status===401){session=null;patch({balance:null});await nativeCommerce.clearSession().catch(()=>undefined);}throw new CommerceError(data.error??"SERVICE_UNAVAILABLE");}
  return data as T;
}
export async function initializeCommerce(){
  return boot??=(async()=>{
    if(!Capacitor.isNativePlatform()){patch({ready:true,managed:false});return;}
    try{
      const config=await nativeCommerce.getConfig();
      if(config.server&&!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?$/.test(config.server))throw new CommerceError("SERVICE_NOT_CONFIGURED");
      patch({managed:config.enabled,server:config.server,environment:config.environment??"staging",billingEnabled:!!config.billingEnabled,ready:true});if(!config.enabled)return;
      const saved=await nativeCommerce.readSession();if(saved.session){const parsed=JSON.parse(saved.session)as Session;if(typeof parsed.session==="string"&&typeof parsed.userId==="string")session=parsed;}
      const onResume=()=>{if(session)void refreshAccount().then(()=>state.billingEnabled?restorePurchases():undefined).catch(e=>patch({error:errorMessage(e)}));};
      await nativeCommerce.addListener("purchases",event=>{if(event.code===0&&event.purchases)void receivePurchases(event.purchases).catch(e=>patch({error:errorMessage(e)}));else if(event.code!==1)patch({error:"Google Play 결제를 완료하지 못했습니다. 구매 복원으로 다시 확인해 주세요."});});
      await nativeCommerce.addListener("resume",onResume);
      // A guest's offline CAD use never needs a health, auth or token request.
      if(session&&config.server)try{await checkService();}catch(e){patch({error:errorMessage(e)});}
      if(session)onResume();
    }catch(e){patch({ready:true,error:errorMessage(e)});}
  })();
}
export async function signIn(){
  patch({busy:true,error:null});try{
    await checkService();
    if(!state.available)throw new CommerceError("SERVICE_NOT_CONFIGURED");
    const challenge=await api<{id:string;nonce:string;clientId:string}>("/v1/auth/challenge","POST");
    const credential=await nativeCommerce.signIn({clientId:challenge.clientId,nonce:challenge.nonce});
    const login=await api<{session:string;obfuscatedAccountId:string;balance:AccountBalance}>("/v1/auth/google","POST",{challengeId:challenge.id,idToken:credential.idToken});
    const next={session:login.session,userId:login.balance.userId,accountId:login.obfuscatedAccountId};
    await nativeCommerce.saveSession({session:JSON.stringify(next)});session=next;patch({balance:login.balance});
    if(state.billingEnabled)await restorePurchases();
    return "signed-in" as const;
  }catch(e){if(e instanceof Error&&e.message==="GOOGLE_SIGN_IN_CANCELLED"){patch({error:null});return "cancelled" as const;}patch({error:errorMessage(e)});return "failed" as const;}finally{patch({busy:false});}
}
export async function refreshAccount(){if(!session)return;const balance=await api<AccountBalance>("/v1/account");if(balance.userId!==session.userId)throw new CommerceError("ACCOUNT_MISMATCH");patch({balance,error:null});}
export async function logout(){try{if(session)await api("/v1/auth/logout","POST",{});}finally{await nativeCommerce.clearSession();session=null;patch({balance:null,error:null,available:false});}}
export async function checkService(){if(!state.server)return;const health=await api<{configured:boolean;environment:string}>("/health");if(health.environment!==state.environment)throw new CommerceError("SERVICE_NOT_CONFIGURED");patch({available:health.configured});}
export async function deleteAccount(){await api("/v1/account","DELETE",{confirm:"DELETE"});await nativeCommerce.clearSession();session=null;patch({balance:null,error:null});}
async function receivePurchases(items:Purchase[]){
  if(!session)return;
  for(const p of items){
    // PENDING is displayed by Play, never provisionally grants credits on this device.
    if(p.state!==1)continue;
    for(const productId of p.products.filter(id=>id==="standard_500_credits"||id==="pro_monthly")){
      const result=await api<{balance:AccountBalance}>("/v1/play/purchase","POST",{productId,purchaseToken:p.token});patch({balance:result.balance});
    }
  }
}
export function restorePurchases(){
  if(!state.billingEnabled)return refreshAccount();
  return restoring??=(async()=>{try{await receivePurchases((await nativeCommerce.restore()).purchases);await refreshAccount();}finally{restoring=undefined;}})();
}
export async function buy(product:PlayProduct){
  if(!state.billingEnabled)throw new CommerceError("SALES_NOT_ENABLED");
  if(!session){showAccount();throw new CommerceError("LOGIN_REQUIRED");}
  if(!product.offerToken||!product.price)throw new CommerceError("PRODUCT_UNAVAILABLE");
  if(!(await api<{canPurchase:boolean}>("/v1/catalog")).canPurchase)throw new CommerceError("SALES_NOT_ENABLED");
  await nativeCommerce.purchase({productId:product.id,offerToken:product.offerToken,accountId:session.accountId});
}
export function currentUser(){return session?.userId??null;}
export function hasToolAccess(tool:string){
  if(isUnmeteredTool(tool))return true;
  if(!state.managed)return state.ready;
  if(!session||!state.balance||globalThis.navigator?.onLine===false)return false;
  const b=state.balance;return b.plan==="PRO"||b.free>0||b.paid>0;
}
export function canStart(tool:string,resume?:()=>void){
  if(hasToolAccess(tool))return true;
  showAccount({tool,resume});return false;
}
export function updateAccountBalance(balance:AccountBalance){
  if(!session||balance.userId!==session.userId)throw new CommerceError("ACCOUNT_MISMATCH");
  patch({balance,error:null});
}
export const errorMessage=(e:unknown)=>{
  const code=e instanceof CommerceError?e.code:e instanceof Error?e.message:"SERVICE_UNAVAILABLE";
  const messages:Record<string,string>={SERVICE_NOT_CONFIGURED:"계정 서비스를 준비하고 있습니다. 도면 열람은 계속 사용할 수 있습니다.",LOGIN_REQUIRED:"Google 계정으로 로그인해 주세요.",INSUFFICIENT_CREDITS:"사용 가능한 횟수가 없습니다. 충전 또는 Pro 구독을 확인하세요.",PURCHASE_ACCOUNT_CONFLICT:"이 구매는 다른 Arcad 계정에 연결되어 있습니다. 구매할 때 로그인한 계정으로 전환하세요.",SALES_NOT_ENABLED:"Google Play 상품은 아직 판매되지 않습니다.",SESSION_STORAGE_UNAVAILABLE:"안전한 로그인 저장소를 사용할 수 없습니다. 기기 잠금과 저장 공간을 확인하세요.",PRODUCT_UNAVAILABLE:"Google Play 상품 정보를 가져오지 못했습니다. Play 설치 버전에서 다시 확인해 주세요.",GOOGLE_SIGN_IN_CANCELLED_OR_UNAVAILABLE:"Google 로그인이 취소되었거나 현재 기기에서 사용할 수 없습니다."};
  return messages[code]??"연결을 완료하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.";
};
