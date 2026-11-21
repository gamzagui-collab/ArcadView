import {IDBFactory,IDBObjectStore} from "fake-indexeddb";
import {afterEach,expect,it,vi} from "vitest";
import {loadTakeoff,saveTakeoff,TAKEOFF_DB,notifyTakeoffCompleted} from "./storage";
import {newTakeoff,totals,type TakeoffObject} from "./model";
const drawing={key:"v1-"+"1".repeat(64),name:"same-name.dwg",size:30,lastModified:1};
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it("stores only source geometry/specs, survives reopen, separates drawings and flags same-name revisions",async()=>{
 vi.stubGlobal("indexedDB",new IDBFactory());const d=newTakeoff(drawing,"m"),o:TakeoffObject={id:"wall",kind:"wall",groupId:"wall",geometry:{type:"path",points:[{x:0,y:0},{x:20,y:0}]},dimensions:{heightMm:3000,thicknessMm:200},label:{visible:true,position:{x:11,y:2}}};d.objects=[o];await saveTakeoff(d);const saved=await loadTakeoff(drawing,"mm");expect(saved.document).toEqual(d);expect(saved.existing).toBe(true);expect(totals(saved.document).volumeM3).toBe(12);expect(JSON.stringify(saved.document)).not.toContain('volumeM3');
 const other=await loadTakeoff({...drawing,key:"v1-"+"2".repeat(64)},"mm");expect(other.document.objects).toEqual([]);expect(other.existing).toBe(false);expect(other.revisions).toEqual([{key:drawing.key,count:1,revision:0}]);expect((await loadTakeoff({...drawing,key:"v1-"+"3".repeat(64),name:"other.dxf"},"mm")).revisions).toEqual([]);
 expect(TAKEOFF_DB).not.toBe("izcad-drawing-library");
});
it("reports unavailable or quota-failing storage and never emits a billable operation",async()=>{
 vi.stubGlobal("indexedDB",undefined);await expect(saveTakeoff(newTakeoff(drawing,"mm"))).rejects.toThrow();
 const fetch=vi.fn();vi.stubGlobal("fetch",fetch);const dispatch=vi.fn();vi.stubGlobal("dispatchEvent",dispatch);notifyTakeoffCompleted({drawingKey:drawing.key,objectId:"one",kind:"wall"});expect(dispatch).toHaveBeenCalledOnce();expect(fetch).not.toHaveBeenCalled();
 const error=new DOMException("quota","QuotaExceededError");vi.stubGlobal("indexedDB",{open:()=>{const r={}as IDBOpenDBRequest;queueMicrotask(()=>{Object.defineProperty(r,"error",{value:error});r.onerror?.({}as Event);});return r;}});await expect(saveTakeoff(newTakeoff(drawing,"mm"))).rejects.toThrow("quota");
});
it("keeps the prior saved document intact when a write fails after opening the database",async()=>{
 vi.stubGlobal("indexedDB",new IDBFactory());const before=newTakeoff(drawing,"mm");await saveTakeoff(before);
 const put=vi.spyOn(IDBObjectStore.prototype,"put").mockImplementation(()=>{throw new DOMException("full","QuotaExceededError");});
 await expect(saveTakeoff({...before,revision:2,unit:"m"})).rejects.toThrow("full");put.mockRestore();expect((await loadTakeoff(drawing,"m")).document).toEqual(before);
});
