import{expect,it,vi}from"vitest";
import{collectRenderBuffers,retireDrawingBuffers}from"./drawingBufferRelease";

it("detaches retired backing stores once even when attributes share a buffer",()=>{
  const positions=new Float32Array([1,2,3,4]),index=new Uint16Array([0,1]);
  const object={geometry:{attributes:{position:{array:positions},shared:{data:{array:positions.subarray(0,2)}}},index:{array:index}}};
  const buffers=collectRenderBuffers({traverse(visit:(o:any)=>void){visit(object);}});
  expect(buffers.size).toBe(2);retireDrawingBuffers([...buffers,positions.buffer]);
  expect(positions.byteLength).toBe(0);expect(index.byteLength).toBe(0);
  expect(()=>retireDrawingBuffers(buffers)).not.toThrow();
});

it("keeps unrelated original data and empty scenes untouched",()=>{
  const original=new Uint8Array([10,20,30]),retired=new ArrayBuffer(64);
  expect(collectRenderBuffers(null).size).toBe(0);retireDrawingBuffers([retired]);
  expect(retired.byteLength).toBe(0);expect(Array.from(original)).toEqual([10,20,30]);
});

it("keeps cleanup non-throwing when a memory-constrained WebView cannot create a port",()=>{
  const buffer=new ArrayBuffer(32);
  vi.stubGlobal("MessageChannel",class{constructor(){throw Error("Port unavailable");}});
  try{expect(()=>retireDrawingBuffers([buffer])).not.toThrow();expect(buffer.byteLength).toBe(32);}finally{vi.unstubAllGlobals();}
});
