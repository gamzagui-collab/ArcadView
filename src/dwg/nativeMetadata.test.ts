import{expect,it}from"vitest";
import{applyNativeDwgMetadata,validateNativeDwgMetadata}from"./nativeMetadata";
import{parseDxfXclip}from"./xclipMetadata";
const identity=[1,0,0,0,0,1,0,0,0,0,1,0];
it("restores exact native layer states and clipping on both top-level and nested inserts without changing source coordinates or colors",()=>{
 const metadata=validateNativeDwgMetadata({version:1,layers:[{name:"한글",off:false,frozen:false,frozenInNewViewport:false}],clips:{AB:{enabled:true,points:[{x:0,y:0},{x:100,y:50}],inverseTransform:identity,transform:identity},CD:{enabled:false,points:[{x:0,y:0},{x:1,y:1}],inverseTransform:identity,transform:identity}}});
 const entity={type:"INSERT",handle:"ab",position:{x:123456789.123,y:500},xdata:undefined},nested={type:"INSERT",handle:"AB"},disabled={type:"INSERT",handle:"CD"};
 const dxf={tables:{layer:{layers:{"한글":{name:"한글",visible:false,frozen:true,color:0x808080}}}},entities:[entity,disabled],blocks:{B:{entities:[nested]}}};
 applyNativeDwgMetadata(dxf,metadata);expect(dxf.tables.layer.layers["한글"]).toEqual({name:"한글",visible:true,frozen:false,color:0x808080});
 expect(parseDxfXclip(entity)).toEqual([{x:0,y:0},{x:100,y:0},{x:100,y:50},{x:0,y:50}]);expect(parseDxfXclip(nested as any)).toEqual(parseDxfXclip(entity));expect(parseDxfXclip(disabled as any)).toBeNull();expect(entity.position.x).toBe(123456789.123);
});
it("rejects invalid clipping data before it can silently omit a boundary",()=>{
 expect(()=>validateNativeDwgMetadata({version:1,layers:[],clips:{A:{enabled:true,points:[{x:0,y:0},{x:1,y:1}],inverseTransform:[1],transform:identity}}})).toThrow();
});
