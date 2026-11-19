import { DxfFetcher } from "dxf-viewer/src/DxfFetcher.js";
import DxfParser from "dxf-viewer/src/parser/DxfParser.js";
import { MAX_CONVERTED_DXF_BYTES, validateDrawingFileSize } from "../files/fileTypes";

/** The pinned parser needs indexed lines, peek and rewind. Generate lines on
 * demand instead of split(), which creates tens of millions of live strings. */
export function dxfLines(chunks: string[]): unknown {
  type Cursor = { chunk: number; offset: number; ended: boolean };
  const cursor: Cursor = {chunk:0,offset:0,ended:false}, checkpoints: Cursor[] = [];
  const recent = new Map<number,string>(); let count=0, last=-1;
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const character=(c:Cursor):string|undefined=>{
    while(c.chunk<chunks.length && c.offset>=chunks[c.chunk].length){c.chunk++;c.offset=0;}
    return c.chunk<chunks.length?chunks[c.chunk][c.offset]:undefined;
  };
  const line=(c:Cursor):string|undefined=>{
    if(c.ended)return undefined;
    let result="";
    for(;;){
      if(character(c)===undefined){c.ended=true;return result;}
      const text=chunks[c.chunk], start=c.offset;
      let end=text.indexOf("\n",start),cr=text.indexOf("\r",start);
      if(cr>=0&&(end<0||cr<end))end=cr;
      if(end<0){result+=text.slice(start);c.chunk++;c.offset=0;continue;}
      result+=text.slice(start,end);c.offset=end+1;
      if(text[end]==="\r"&&character(c)==="\n")c.offset++;
      // Long retained TEXT/handle strings must not pin entire source chunks.
      return result.length>12?decoder.decode(encoder.encode(result)):result;
    }
  };
  const fill=(index:number)=>{
    while(count<=index&&!cursor.ended){
      if(count%256===0)checkpoints[count/256]={...cursor};
      const value=line(cursor);if(value===undefined)break;
      recent.set(count++,value);if(recent.size>256)recent.delete(count-257);
    }
  };
  return new Proxy({}, {get(_target,key){
    if(key==="length"){fill(last+2);return cursor.ended?count:Number.MAX_SAFE_INTEGER;}
    if(typeof key!=="string"||!/^\d+$/.test(key))return undefined;
    const index=Number(key);last=index;fill(index);
    if(index>=count)return undefined;
    if(recent.has(index))return recent.get(index);
    const start=Math.floor(index/256)*256,c={...checkpoints[start/256]};let value;
    for(let i=start;i<=index;i++)value=line(c);return value;
  }});
}

let installed=false;
export function installLargeDxfReader():void {
  if(installed)return;installed=true;
  DxfFetcher.prototype.Fetch=async function(progress?: (phase:string,received:number,total:number|null)=>void){
    const response=await fetch(this.url);if(!response.ok)throw Error(`DXF read failed (${response.status})`);
    const total=Number(response.headers.get("content-length"))||0;
    if(total)validateDrawingFileSize(total,MAX_CONVERTED_DXF_BYTES);
    const chunks:string[]=[],decoder=new TextDecoder(this.encoding);let received=0;
    if(response.body){const reader=response.body.getReader();try{for(;;){const {done,value}=await reader.read();if(done)break;received+=value.byteLength;validateDrawingFileSize(received,MAX_CONVERTED_DXF_BYTES);chunks.push(decoder.decode(value,{stream:true}));progress?.("fetch",received,total);}}catch(error){await reader.cancel().catch(()=>undefined);throw error;}finally{reader.releaseLock();}chunks.push(decoder.decode());}
    else {const bytes=await response.arrayBuffer();received=bytes.byteLength;validateDrawingFileSize(received,MAX_CONVERTED_DXF_BYTES);chunks.push(decoder.decode(bytes));}
    progress?.("parse",0,null);
    // _parse uses its source only for split(); all entity handlers stay intact.
    return (new DxfParser() as unknown as {_parse(source:unknown):unknown})._parse({split:()=>dxfLines(chunks)});
  };
}
