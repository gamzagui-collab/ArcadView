export const POLYLINE_DIRECT_KEY="arcad.polyline.direct.v1";
export function readPolylineDirect():boolean{try{return localStorage.getItem(POLYLINE_DIRECT_KEY)==="true";}catch{return false;}}
export function savePolylineDirect(value:boolean):void{try{localStorage.setItem(POLYLINE_DIRECT_KEY,String(value));}catch{/* The option still works for this session. */}}
