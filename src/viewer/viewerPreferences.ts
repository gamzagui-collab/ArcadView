export const VIEWER_PREFERENCES_KEY='arcad.viewer.preferences.v1';
export const VIEWER_PREFERENCES_EVENT='arcad-viewer-preferences';
export const MAGNIFIER_WIDTHS={small:164,medium:208,large:256} as const;
export type MagnifierSize=keyof typeof MAGNIFIER_WIDTHS;
export type ViewerPreferences={magnifierEnabled:boolean;magnifierSize:MagnifierSize};
const defaults:ViewerPreferences={magnifierEnabled:true,magnifierSize:'medium'};
export function readViewerPreferences(storage?:Pick<Storage,'getItem'>):ViewerPreferences{
 try{const p=JSON.parse((storage??globalThis.localStorage).getItem(VIEWER_PREFERENCES_KEY)??'null');return{magnifierEnabled:typeof p?.magnifierEnabled==='boolean'?p.magnifierEnabled:defaults.magnifierEnabled,magnifierSize:Object.hasOwn(MAGNIFIER_WIDTHS,p?.magnifierSize)?p.magnifierSize:defaults.magnifierSize};}catch{return{...defaults};}
}
export function saveViewerPreferences(value:ViewerPreferences,storage?:Pick<Storage,'setItem'>):boolean{
 try{(storage??globalThis.localStorage).setItem(VIEWER_PREFERENCES_KEY,JSON.stringify(value));if(typeof window!=='undefined')window.dispatchEvent(new Event(VIEWER_PREFERENCES_EVENT));return true;}catch{return false;}
}
