import{beforeEach,it,expect,vi}from"vitest";
const mock=vi.hoisted(()=>({getConfig:vi.fn(),readSession:vi.fn(),addListener:vi.fn(),clearSession:vi.fn(),purchase:vi.fn(),restore:vi.fn(),signIn:vi.fn(),saveSession:vi.fn()}));
vi.mock("@capacitor/core",()=>({Capacitor:{isNativePlatform:()=>true},registerPlugin:()=>mock}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();vi.stubGlobal("window",new EventTarget());vi.stubGlobal("navigator",{onLine:true});mock.getConfig.mockResolvedValue({enabled:true,server:"https://accounts.example",environment:"staging",billingEnabled:false});mock.readSession.mockResolvedValue({session:JSON.stringify({session:"a".repeat(43),userId:"test-user",accountId:"b".repeat(64)})});mock.addListener.mockResolvedValue({remove:async()=>{}});mock.clearSession.mockResolvedValue(undefined);vi.stubGlobal("fetch",vi.fn().mockRejectedValue(new Error("offline")));});
it("reads the secure session even if the server is unavailable on restart",async()=>{const client=await import("./client");await client.initializeCommerce();await new Promise(r=>setTimeout(r,0));expect(client.currentUser()).toBe("test-user");expect(mock.readSession).toHaveBeenCalledOnce();expect(client.commerceSnapshot().balance).toBeNull();expect(client.commerceSnapshot().error).toBeTruthy();});
it("offline logout clears the local secure session even if remote revocation fails",async()=>{const client=await import("./client");await client.initializeCommerce();await expect(client.logout()).rejects.toThrow("offline");expect(mock.clearSession).toHaveBeenCalledOnce();expect(client.currentUser()).toBeNull();});
it("disabled billing never opens checkout or submits a purchase request",async()=>{const client=await import("./client");await client.initializeCommerce();await expect(client.buy({id:"standard_500_credits",name:"TEST ONLY",description:"unit test",price:"TEST PRICE",offerToken:"test"})).rejects.toThrow("SALES_NOT_ENABLED");expect(mock.purchase).not.toHaveBeenCalled();});

const balance={userId:"test-user",plan:"FREE",free:100,paid:0,debt:0,resetsAt:"2026-12-01T00:00:00+09:00",subscription:null};
function onlineAccountService(account=balance){
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>{
    const path=new URL(url).pathname;
    const data=path==="/health"?{configured:true,environment:"staging"}
      :path==="/v1/auth/challenge"?{id:"challenge",nonce:"n".repeat(43),clientId:"test.apps.googleusercontent.com"}
      :path==="/v1/auth/google"?{session:"s".repeat(43),obfuscatedAccountId:"b".repeat(64),balance:account}
      :path==="/v1/account"?account:path==="/v1/auth/logout"?{loggedOut:true}:null;
    if(!data)throw new Error("Unexpected account endpoint: "+path);
    return new Response(JSON.stringify(data),{status:200});
  }));
}
it("Google login succeeds when the staging build has billing disabled and Play billing is unavailable",async()=>{
  onlineAccountService();mock.readSession.mockResolvedValue({});
  mock.signIn.mockResolvedValue({idToken:"unit-test-credential"});mock.saveSession.mockResolvedValue(undefined);
  mock.restore.mockRejectedValue(new Error("PLAY_BILLING_UNAVAILABLE_3"));
  const client=await import("./client");await client.initializeCommerce();await client.signIn();
  expect(client.currentUser()).toBe("test-user");expect(client.commerceSnapshot().balance).toEqual(balance);
  expect(client.commerceSnapshot().error).toBeNull();expect(mock.saveSession).toHaveBeenCalledOnce();expect(mock.restore).not.toHaveBeenCalled();
});
it("restart restores the Google account balance without Play billing when sales are disabled",async()=>{
  onlineAccountService();mock.restore.mockRejectedValue(new Error("PLAY_BILLING_UNAVAILABLE_3"));
  const client=await import("./client");await client.initializeCommerce();await new Promise(r=>setTimeout(r,0));
  expect(client.currentUser()).toBe("test-user");expect(client.commerceSnapshot().balance).toEqual(balance);
  expect(client.commerceSnapshot().error).toBeNull();expect(mock.restore).not.toHaveBeenCalled();
});
it("billing-enabled builds still restore Play purchases after account restart",async()=>{
  onlineAccountService();mock.getConfig.mockResolvedValue({enabled:true,server:"https://accounts.example",environment:"staging",billingEnabled:true});
  mock.restore.mockResolvedValue({purchases:[]});
  const client=await import("./client");await client.initializeCommerce();await new Promise(r=>setTimeout(r,0));
  expect(mock.restore).toHaveBeenCalledOnce();expect(client.commerceSnapshot().balance).toEqual(balance);expect(client.commerceSnapshot().error).toBeNull();
});

it("guest startup and 1000 aligned selections require no server, Google request or login popup",async()=>{
  mock.readSession.mockResolvedValue({});const popup=vi.fn();window.addEventListener("arcad:account",popup);
  const client=await import("./client");expect(client.canStart("measure.aligned")).toBe(true);
  await client.initializeCommerce();
  for(let n=0;n<1000;n++)expect(client.canStart("measure.aligned")).toBe(true);
  expect(fetch).not.toHaveBeenCalled();expect(mock.signIn).not.toHaveBeenCalled();expect(popup).not.toHaveBeenCalled();expect(client.currentUser()).toBeNull();
});
it("guest advanced selection requests login with a stable ID and never executes the selected operation",async()=>{
  mock.readSession.mockResolvedValue({});const resume=vi.fn(),popup=vi.fn();window.addEventListener("arcad:account",popup);
  const client=await import("./client");await client.initializeCommerce();expect(client.canStart("measure.linear",resume)).toBe(false);
  const event=popup.mock.calls[0][0]as CustomEvent;expect(event.detail.tool).toBe("measure.linear");expect(event.detail.resume).toBe(resume);
  expect(resume).not.toHaveBeenCalled();expect(mock.signIn).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it("a logged-in free allowance authorizes advanced tools without charging on selection",async()=>{
  onlineAccountService();const client=await import("./client");await client.initializeCommerce();await new Promise(r=>setTimeout(r,0));
  const calls=vi.mocked(fetch).mock.calls.length;
  for(const tool of ["measure.linear","measure.path","measure.area","measure.angle","measure.object","draw.polyline","draw.circle","draw.rectangle","draw.dimension"])expect(client.canStart(tool)).toBe(true);
  expect(vi.mocked(fetch).mock.calls.length).toBe(calls);expect(client.commerceSnapshot().balance?.free).toBe(100);
});
it("aligned authorization has no network or account dependency, even through the old journal entry point",async()=>{
  mock.readSession.mockResolvedValue({});const client=await import("./client");await client.initializeCommerce();
  const{authorizeOperation}=await import("./operationJournal");await authorizeOperation({id:"old-aligned-request",tool:"measure.aligned",resultHash:"a".repeat(64)});
  expect(fetch).not.toHaveBeenCalled();expect(client.currentUser()).toBeNull();
});
it("offline guests retain aligned access while advanced work requires a connection and account",async()=>{
  vi.stubGlobal("navigator",{onLine:false});mock.readSession.mockResolvedValue({});
  const client=await import("./client");await client.initializeCommerce();expect(client.canStart("measure.aligned")).toBe(true);expect(client.hasToolAccess("measure.linear")).toBe(false);expect(fetch).not.toHaveBeenCalled();
});
it("logout clears only the session and leaves aligned access without network requests",async()=>{
  onlineAccountService();const client=await import("./client");await client.initializeCommerce();await new Promise(r=>setTimeout(r,0));await client.logout();
  vi.mocked(fetch).mockClear();expect(client.currentUser()).toBeNull();expect(client.canStart("measure.aligned")).toBe(true);expect(client.hasToolAccess("measure.linear")).toBe(false);expect(fetch).not.toHaveBeenCalled();expect(mock.clearSession).toHaveBeenCalledOnce();
});
it("Google cancellation creates no local session, debit or automatic retry",async()=>{
  onlineAccountService();mock.readSession.mockResolvedValue({});mock.signIn.mockRejectedValue(new Error("GOOGLE_SIGN_IN_CANCELLED"));
  const client=await import("./client");await client.initializeCommerce();expect(await client.signIn()).toBe("cancelled");expect(client.currentUser()).toBeNull();expect(mock.saveSession).not.toHaveBeenCalled();
  expect(vi.mocked(fetch).mock.calls.map(([url])=>new URL(String(url)).pathname)).toEqual(["/health","/v1/auth/challenge"]);
});
