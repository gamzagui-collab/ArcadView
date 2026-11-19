import { beforeEach,afterEach,expect,it,vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { preparedScene } from "./preparedSceneCache";
let entries:Map<string,Response>;
beforeEach(()=>{entries=new Map();vi.stubGlobal("indexedDB",new IDBFactory());vi.stubGlobal("caches",{open:async()=>({match:async(k:string)=>entries.get(k)?.clone(),delete:async(k:string)=>entries.delete(k),put:async(k:string,r:Response)=>{const bytes=await r.arrayBuffer();entries.set(k,new Response(bytes,{headers:r.headers}));}})});});
afterEach(()=>vi.unstubAllGlobals());
function fixture(){const buffer=new ArrayBuffer(32),array=new Float64Array(buffer);array.set([1,2,3,NaN]);return{scene:{vertices:buffer,indices:new Uint16Array([0,1,2]).buffer,transforms:new ArrayBuffer(0),izcadXclips:{B:{points:[{x:12,y:34}],blockOffset:{x:0,y:0}}}},dxf:{izcadMeasurement:{packed:{points:[new Float64Array(buffer,8,2)],refs:[new Uint32Array([0,2,0])],kinds:["LINE"]},units:"mm"}}};}
it("restores all binary data, shared buffers, typed offsets and clipping metadata without running the loader",async()=>{
 const load=vi.fn(async()=>fixture());const first=await preparedScene("source:worker-v1",load),second=await preparedScene("source:worker-v1",load);
 expect(load).toHaveBeenCalledTimes(1);expect(second.scene.vertices).not.toBe(first.scene.vertices);expect(new Float64Array(second.scene.vertices)[3]).toBeNaN();
 expect(second.dxf.izcadMeasurement.packed.points[0]).toBeInstanceOf(Float64Array);expect(second.dxf.izcadMeasurement.packed.points[0].buffer).toBe(second.scene.vertices);
 expect([...second.dxf.izcadMeasurement.packed.points[0]]).toEqual([2,3]);expect(second.scene.izcadXclips).toEqual(first.scene.izcadXclips);
 const withSnaps=vi.fn(async()=>{const value:any=fixture();value.dxf.izcadMeasurement.packed.extraSnaps=[new Float64Array([10,20,3])];value.dxf.izcadMeasurement.packed.extraSnapCount=1;value.dxf.izcadMeasurement.packed.snapSegments=[new Float64Array([0,0,100,0])];value.dxf.izcadMeasurement.packed.snapSegmentCount=1;return value;});
 await preparedScene("new-snap-schema",withSnaps);const restored=await preparedScene("new-snap-schema",withSnaps);expect(withSnaps).toHaveBeenCalledTimes(1);expect([...restored.dxf.izcadMeasurement.packed.extraSnaps[0]]).toEqual([10,20,3]);expect([...restored.dxf.izcadMeasurement.packed.snapSegments[0]]).toEqual([0,0,100,0]);
 await preparedScene("source:worker-v2",load);await preparedScene("changed-source:worker-v1",load);expect(load).toHaveBeenCalledTimes(3);
});
it("rebuilds corrupt or truncated data and falls back when cache storage fails",async()=>{
 const load=vi.fn(async()=>fixture());await preparedScene("file",load);
 const key=[...entries.keys()].find(k=>k.endsWith('/data'))!;entries.set(key,new Response(new Uint8Array([1])));
 await preparedScene("file",load);expect(load).toHaveBeenCalledTimes(2);
 vi.stubGlobal("caches",{open:async()=>{throw Error('quota')}});expect((await preparedScene("other",load)).scene.vertices.byteLength).toBe(32);
});
it("evicts only derived cache entries within its count bound",async()=>{
 const load=vi.fn(async()=>fixture());for(let i=0;i<5;i++)await preparedScene("file"+i,load);
 expect(entries.size).toBe(8);await preparedScene("file4",load);expect(load).toHaveBeenCalledTimes(5);
});
it("does not run a second full parse after a cached-scene allocation failure",async()=>{
 const load=vi.fn(async()=>fixture());await preparedScene("file",load);
 vi.stubGlobal("caches",{open:async()=>({match:async()=>{throw new RangeError("Array buffer allocation failed");}})});
 await expect(preparedScene("file",load)).rejects.toMatchObject({code:"DRAWING_MEMORY_LIMIT"});
 expect(load).toHaveBeenCalledTimes(1);
});
