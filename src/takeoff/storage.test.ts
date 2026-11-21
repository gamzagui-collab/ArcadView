import {IDBFactory,IDBObjectStore} from "fake-indexeddb";
import {afterEach,expect,it,vi} from "vitest";
import {loadTakeoff,saveTakeoff,TAKEOFF_DB,notifyTakeoffCompleted} from "./storage";
import {moveTakeoffToLayer,newTakeoff,totals,type TakeoffObject} from "./model";
const drawing={key:"v1-"+"1".repeat(64),name:"same-name.dwg",size:30,lastModified:1};
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it("stores only source geometry/specs, survives reopen, separates drawings and flags same-name revisions",async()=>{
 vi.stubGlobal("indexedDB",new IDBFactory());const d=newTakeoff(drawing,"m"),o:TakeoffObject={id:"wall",layerId:"takeoff-default",kind:"wall",groupId:"wall",geometry:{type:"path",points:[{x:0,y:0},{x:20,y:0}]},dimensions:{heightMm:3000,thicknessMm:200},label:{visible:true,position:{x:11,y:2}}};d.objects=[o];d.options.labelsVisible=false;await saveTakeoff(d);const saved=await loadTakeoff(drawing,"mm");expect(saved.document).toEqual(d);expect(saved.existing).toBe(true);expect(totals(saved.document).volumeM3).toBe(12);expect(JSON.stringify(saved.document)).not.toContain('volumeM3');
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

it("atomically migrates an existing v1 database to schema v3 and preserves ordinary databases",async()=>{
 const factory=new IDBFactory();vi.stubGlobal("indexedDB",factory);const original={...newTakeoff(drawing,"m"),schemaVersion:1,groups:newTakeoff(drawing,"m").groups.filter(g=>g.id!=="column")};
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=factory.open(TAKEOFF_DB,1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore("documents",{keyPath:"drawing.key"});s.createIndex("drawingName","drawing.name");s.put(original);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
 const saved=await loadTakeoff(drawing,"mm");expect(saved.document.schemaVersion).toBe(3);expect(saved.document.unit).toBe("m");expect(saved.document.layers[0].name).toBe("적산 1");expect((await factory.databases()).find(d=>d.name===TAKEOFF_DB)?.version).toBe(3);
});
it("migrates genuine v2 documents atomically and leaves legacy geometry, region data and preferences intact",async()=>{
 const factory=new IDBFactory();vi.stubGlobal("indexedDB",factory);const current=newTakeoff(drawing,"m"),{column:removed,...defaults}=current.defaults;void removed;
 const original={...current,schemaVersion:2,groups:current.groups.filter(g=>g.id!=="column"),defaults,options:{...current.options,labelsVisible:false,keepColors:["#ff0000"]}};
 const db=await new Promise<IDBDatabase>(resolve=>{const r=factory.open(TAKEOFF_DB,2);r.onupgradeneeded=()=>{const s=r.result.createObjectStore("documents",{keyPath:"drawing.key"});s.createIndex("drawingName","drawing.name");s.put(original);};r.onsuccess=()=>resolve(r.result);});db.close();
 const after=(await loadTakeoff(drawing,"mm")).document;expect(after.schemaVersion).toBe(3);expect(after.objects).toEqual(original.objects);expect(after.layers).toEqual(original.layers);expect(after.options).toEqual(original.options);expect(after.defaults).toEqual({...defaults,column:{heightMm:3000}});expect(after.groups).toEqual([...original.groups,{id:"column",visible:true,color:"#83e4bc"}]);expect((await factory.databases()).find(d=>d.name===TAKEOFF_DB)?.version).toBe(3);
});
it("rolls back every v2 document if one corrupt row prevents the v3 upgrade",async()=>{
 const factory=new IDBFactory();vi.stubGlobal("indexedDB",factory);const current=newTakeoff(drawing,"m"),original={...current,schemaVersion:2,groups:current.groups.filter(g=>g.id!=="column")},bad={...original,drawing:{...drawing,key:"v1-"+"f".repeat(64)},groups:[]};
 const db=await new Promise<IDBDatabase>(resolve=>{const r=factory.open(TAKEOFF_DB,2);r.onupgradeneeded=()=>{const s=r.result.createObjectStore("documents",{keyPath:"drawing.key"});s.createIndex("drawingName","drawing.name");s.put(original);s.put(bad);};r.onsuccess=()=>resolve(r.result);});db.close();await expect(loadTakeoff(drawing,"m")).rejects.toBeTruthy();expect((await factory.databases()).find(d=>d.name===TAKEOFF_DB)?.version).toBe(2);
 const old=await new Promise<IDBDatabase>(resolve=>{const r=factory.open(TAKEOFF_DB,2);r.onsuccess=()=>resolve(r.result);});const r=old.transaction("documents").objectStore("documents").get(drawing.key);expect(await new Promise(resolve=>{r.onsuccess=()=>resolve(r.result);})).toEqual(original);old.close();
});
it("aborts the entire upgrade if any legacy document is corrupt instead of replacing or deleting it",async()=>{
 const factory=new IDBFactory();vi.stubGlobal("indexedDB",factory);const original={...newTakeoff(drawing,"m"),schemaVersion:1,groups:newTakeoff(drawing,"m").groups.filter(g=>g.id!=="column"),objects:[{id:"bad"}]};
 const db=await new Promise<IDBDatabase>(resolve=>{const r=factory.open(TAKEOFF_DB,1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore("documents",{keyPath:"drawing.key"});s.createIndex("drawingName","drawing.name");s.put(original);};r.onsuccess=()=>resolve(r.result);});db.close();
 await expect(loadTakeoff(drawing,"mm")).rejects.toBeTruthy();expect((await factory.databases()).find(d=>d.name===TAKEOFF_DB)?.version).toBe(1);
 const old=await new Promise<IDBDatabase>(resolve=>{const r=factory.open(TAKEOFF_DB,1);r.onsuccess=()=>resolve(r.result);});const request=old.transaction("documents").objectStore("documents").get(drawing.key);expect(await new Promise(resolve=>{request.onsuccess=()=>resolve(request.result);})).toEqual(original);old.close();
});

it("reopens original CAD colors and object layer transfers with identical geometry/specs/manual labels",async()=>{
 vi.stubGlobal("indexedDB",new IDBFactory());const before=newTakeoff(drawing,"m");before.layers.push({id:"second",name:"3·4·5호",visible:false});before.objects=[{id:"W01",layerId:before.activeLayerId,kind:"wall",groupId:"wall",geometry:{type:"path",points:[{x:0,y:0},{x:20,y:0}]},dimensions:{heightMm:3000,thicknessMm:200},label:{visible:true,position:{x:5,y:2}}}];
 await saveTakeoff(before);const after=moveTakeoffToLayer(before,"W01","second");after.options={...after.options,focus:true,keepColors:["#34aadc"]};await saveTakeoff(after);
 const restored=(await loadTakeoff(drawing,"mm")).document;expect(restored).toEqual(after);expect(totals(restored).volumeM3).toBe(12);expect(totals(restored).visibleVolumeM3).toBe(0);expect(before.objects[0].layerId).toBe(before.activeLayerId);
});
