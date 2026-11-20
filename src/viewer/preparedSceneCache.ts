import { MAX_CONVERTED_DXF_BYTES, MAX_DERIVED_CACHE_BYTES } from "../files/fileTypes";
import { isLikelyMemoryError } from "../dwg/diagnostics";
import { AppError } from "../types/drawing";
// Derived data only: original drawings and the library use separate stores.
const VERSION = "prepared-v5-precision2", DB = "izcad-prepared-scene-index", CACHE = "izcad-prepared-scenes-v1";
const MAX_BYTES = MAX_DERIVED_CACHE_BYTES, MAX_ENTRY = MAX_CONVERTED_DXF_BYTES, CHUNK = 4 * 1024 ** 2;
type Header = { key: string; bytes: number; accessed: number; ready: boolean };
const constructors = { Float32Array, Float64Array, Uint16Array, Uint32Array, Uint8Array, Int32Array };
const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error); });
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore("entries", {keyPath:"key"}); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
async function headers(): Promise<Header[]> {
  const db = await database();
  try { return await new Promise((resolve, reject) => { const r = db.transaction("entries").objectStore("entries").getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); } finally { db.close(); }
}
async function record(header: Header | string): Promise<void> {
  const db = await database();
  try { const tx = db.transaction("entries", "readwrite"), complete = done(tx); const table = tx.objectStore("entries"); if (typeof header === "string") table.delete(header); else table.put(header); await complete; } finally { db.close(); }
}
const url = (key: string, part: string) => `${globalThis.location?.origin ?? "https://localhost"}/__izcad_prepared_cache/${encodeURIComponent(key)}/${part}`;
function encode(value: any, buffers: ArrayBuffer[], ids: Map<ArrayBuffer, number>): any {
  const bufferId = (buffer: ArrayBuffer) => { if (!ids.has(buffer)) { ids.set(buffer, buffers.length); buffers.push(buffer); } return ids.get(buffer); };
  if (value instanceof ArrayBuffer) return { $izcadBuffer: bufferId(value) };
  if (ArrayBuffer.isView(value)) return { $izcadView: value.constructor.name, buffer: bufferId(value.buffer as ArrayBuffer), offset: value.byteOffset, length: (value as unknown as {length:number}).length };
  if (Array.isArray(value)) return value.map(v => encode(v, buffers, ids));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,encode(v,buffers,ids)]));
  return value;
}
function decode(value: any, buffers: ArrayBuffer[]): any {
  if (Array.isArray(value)) return value.map(v => decode(v,buffers));
  if (value && typeof value === "object") {
    if (Number.isInteger(value.$izcadBuffer)) { if (!buffers[value.$izcadBuffer]) throw Error("Invalid scene buffer"); return buffers[value.$izcadBuffer]; }
    if (value.$izcadView) {
      const C = constructors[value.$izcadView as keyof typeof constructors];
      if (!C || !buffers[value.buffer]) throw Error("Invalid scene view");
      return new C(buffers[value.buffer], value.offset, value.length);
    }
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,decode(v,buffers)]));
  }
  return value;
}
async function discard(cache: Cache, key: string): Promise<void> {
  await Promise.all([cache.delete(url(key,"meta")),cache.delete(url(key,"data")),record(key)]);
}
async function read(cache: Cache, key: string): Promise<any | null> {
  const available = await headers();
  // Same explicit geometry/font/snap version and source fingerprint only.
  // Reuse old Windows/Linux worker-source URL suffixes without duplicating
  // hundreds of MiB or rebuilding a scene that already fits the renderer.
  const header = available.find(h => h.key === key && h.ready) ??
    available.filter(h => h.ready && h.key.startsWith(key + ":data:video/mp2t;base64,")).sort((a,b)=>b.accessed-a.accessed)[0];
  if (!header) return null;
  const storedKey = header.key;
  const [metaResponse, response] = await Promise.all([cache.match(url(storedKey,"meta")),cache.match(url(storedKey,"data"))]);
  if (!metaResponse || !response?.body) throw Error("Incomplete prepared scene");
  const meta = await metaResponse.json();
  if (meta.version !== VERSION || meta.key !== storedKey || !Array.isArray(meta.sizes) || meta.sizes.some((n: number) => !Number.isSafeInteger(n) || n < 0) || meta.sizes.reduce((n:number,s:number)=>n+s,0) !== header.bytes || header.bytes > MAX_ENTRY) throw Error("Invalid prepared scene metadata");
  const buffers: ArrayBuffer[] = meta.sizes.map((size:number)=>new ArrayBuffer(size));
  const reader = response.body.getReader(); let index = 0, offset = 0, received = 0;
  try { for (;;) { const {done,value} = await reader.read(); if (done) break; received += value.byteLength; let at=0;
    while (at<value.byteLength) { while (index<buffers.length && offset===buffers[index].byteLength) { index++; offset=0; } if (index===buffers.length) throw Error("Extra scene data"); const n=Math.min(value.byteLength-at,buffers[index].byteLength-offset); new Uint8Array(buffers[index],offset,n).set(value.subarray(at,at+n)); offset+=n; at+=n; }
  }} finally { reader.releaseLock(); }
  if (received!==header.bytes) throw Error("Truncated prepared scene");
  const result = decode(meta.graph,buffers);
  if (!(result.scene?.vertices instanceof ArrayBuffer) || !result.dxf?.izcadMeasurement?.packed) throw Error("Prepared scene is missing geometry");
  await record({...header,accessed:Date.now()});
  return result;
}
async function write(cache: Cache, key: string, result: any): Promise<void> {
  const buffers: ArrayBuffer[] = [], graph = encode(result,buffers,new Map()), bytes = buffers.reduce((n,b)=>n+b.byteLength,0);
  if (!bytes || bytes>MAX_ENTRY) return;
  const others=(await headers()).filter(h=>h.key!==key).sort((a,b)=>b.accessed-a.accessed); let total=bytes,count=1;
  for(const h of others) { if (!h.ready || total+h.bytes>MAX_BYTES || count>=4) await discard(cache,h.key); else { total+=h.bytes; count++; } }
  await discard(cache,key);
  await record({key,bytes,accessed:Date.now(),ready:false});
  let index=0,offset=0;
  const stream=new ReadableStream<Uint8Array>({pull(controller) {
    while(index<buffers.length && offset===buffers[index].byteLength){index++;offset=0;}
    if(index===buffers.length){controller.close();return;}
    const chunk=new Uint8Array(Math.min(CHUNK,bytes));let used=0;
    while(used<chunk.length && index<buffers.length){const n=Math.min(chunk.length-used,buffers[index].byteLength-offset);chunk.set(new Uint8Array(buffers[index],offset,n),used);offset+=n;used+=n;if(offset===buffers[index].byteLength){index++;offset=0;}}
    controller.enqueue(used===chunk.length?chunk:chunk.subarray(0,used));
  }});
  await cache.put(url(key,"data"),new Response(stream,{headers:{"Content-Type":"application/octet-stream"}}));
  await cache.put(url(key,"meta"),new Response(JSON.stringify({version:VERSION,key,sizes:buffers.map(b=>b.byteLength),graph}),{headers:{"Content-Type":"application/json"}}));
  await record({key,bytes,accessed:Date.now(),ready:true});
}
export async function preparedScene(key: string | undefined, load: () => Promise<any>, progress?: (phase:string,size:number,total:number) => void): Promise<any> {
  if (!key || !globalThis.caches || !globalThis.indexedDB) return load();
  const id=VERSION+":"+key;let cache:Cache;
  try { cache=await caches.open(CACHE); const result=await read(cache,id);if(result){progress?.("prepare",1,1);console.info("[izcad-scene-cache] hit",id);return result;} }
  catch(error){
    // Do not immediately run a second full parse after an allocation failure.
    if(isLikelyMemoryError(error)) throw new AppError("DRAWING_MEMORY_LIMIT", undefined, {cause:error});
    console.warn("Prepared scene cache unavailable; rebuilding.",error);
  }
  const result=await load();
  try{cache??=await caches.open(CACHE);await write(cache,id,result);console.info("[izcad-scene-cache] stored",id);}catch(error){console.warn("Could not store prepared scene.",error);if(cache!)await discard(cache,id).catch(()=>undefined);}
  return result;
}
const patched=new WeakSet<object>();
export function installPreparedSceneCache(constructor: object): void {
  if(patched.has(constructor))return;
  const p=(constructor as {prototype:any}).prototype,load=p._Load;
  p._Load=function(url:string,fonts:string[],options:any,progress:any){return preparedScene(options.izcadPreparedKey,()=>load.call(this,url,fonts,options,progress),progress);};
  patched.add(constructor);
}
