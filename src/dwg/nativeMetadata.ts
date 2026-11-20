import { spatialFilterBlockPoints, type DxfClipPoint, type SavedDwgSpatialFilter } from "./xclipMetadata";

export type NativeDwgMetadata = {
  version: 1;
  layers: Array<{name:string;off:boolean;frozen:boolean;frozenInNewViewport:boolean}>;
  clips: Record<string, SavedDwgSpatialFilter & {points:DxfClipPoint[]}>;
};
const files = new WeakMap<File, NativeDwgMetadata>();
const loads = new Map<string, NativeDwgMetadata>();
export const getNativeDwgMetadata = (file:File):NativeDwgMetadata|undefined => files.get(file);
export function registerNativeDwgMetadata(file:File, value:NativeDwgMetadata|undefined):void { if(value)files.set(file,value); }
export function validateNativeDwgMetadata(value:any):NativeDwgMetadata {
  if(value?.version!==1||!Array.isArray(value.layers)||!value.clips||typeof value.clips!=="object")throw Error("Invalid native DWG metadata");
  for(const l of value.layers)if(typeof l.name!=="string"||typeof l.off!=="boolean"||typeof l.frozen!=="boolean"||typeof l.frozenInNewViewport!=="boolean")throw Error("Invalid native layer state");
  for(const [handle,c]of Object.entries(value.clips) as Array<[string,NativeDwgMetadata["clips"][string]]>){
    if(!/^[0-9a-f]+$/i.test(handle)||typeof c.enabled!=="boolean"||!Array.isArray(c.points)||c.points.length<2||!c.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))||![c.inverseTransform,c.transform].every(a=>Array.isArray(a)&&a.length===12&&a.every(Number.isFinite)))throw Error("Invalid native clipping metadata");
  }
  return value;
}
export function applyNativeDwgMetadata(dxf:any, metadata:NativeDwgMetadata|undefined):void {
  if(!metadata)return;
  const layers=dxf.tables?.layer?.layers??{},folded=new Map(Object.values(layers).map((l:any)=>[String(l.name).toLocaleUpperCase("en-US"),l]));
  for(const state of metadata.layers){const layer=layers[state.name]??folded.get(state.name.toLocaleUpperCase("en-US"));if(layer){layer.visible=!state.off;layer.frozen=state.frozen||state.frozenInNewViewport;}}
  const apply=(entities:any[])=>{for(const entity of entities??[]){
    if(entity.type!=="INSERT")continue;
    const filter=metadata.clips[String(entity.handle).toUpperCase()];if(!filter||!filter.enabled)continue;
    const points=spatialFilterBlockPoints(filter.points,filter);
    entity.xdata??={};entity.xdata.IZCAD_XCLIP={values:[{code:1000,value:points.map(p=>`${p.x},${p.y}`).join(";")},{code:1070,value:0}]};
  }};
  apply(dxf.entities);for(const block of Object.values(dxf.blocks??{}) as any[])apply(block.entities);
}
export function installNativeDwgMetadata(constructor:object):void {
  const p=(constructor as {prototype:any}).prototype,load=p._Load;
  p._Load=async function(url:string,fonts:string[],options:any,progress:any){
    const prior=loads.get(url);if(options.izcadDwgMetadata)loads.set(url,validateNativeDwgMetadata(options.izcadDwgMetadata));
    try{return await load.call(this,url,fonts,options,progress);}finally{if(prior)loads.set(url,prior);else loads.delete(url);}
  };
}
export const nativeMetadataForUrl=(url:string):NativeDwgMetadata|undefined=>loads.get(url);
