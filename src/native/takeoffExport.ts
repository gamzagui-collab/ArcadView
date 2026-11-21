import {Capacitor,registerPlugin} from "@capacitor/core";

export const XLSX_MIME="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const nativeExport=registerPlugin<{save(options:{name:string;data:string}):Promise<{cancelled:boolean;name?:string;bytes?:number}>}>("TakeoffExport");
export async function saveTakeoffWorkbook(name:string,bytes:Uint8Array):Promise<"saved"|"cancelled"|"download">{
 if(bytes.length>16*1024*1024)throw Error("집계표가 16MB를 초과했습니다. 적산 객체 수를 확인하세요.");
 if(Capacitor.getPlatform()==="android"){
  let binary="";for(let offset=0;offset<bytes.length;offset+=32768)binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
  return (await nativeExport.save({name,data:btoa(binary)})).cancelled?"cancelled":"saved";
 }
 const copy=new Uint8Array(bytes),url=URL.createObjectURL(new Blob([copy],{type:XLSX_MIME})),a=document.createElement("a");
 try{a.href=url;a.download=name;document.body.append(a);a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 return "download";
}
