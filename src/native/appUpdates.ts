import { registerPlugin } from "@capacitor/core";
export type UpdateOffer={token:string;versionName:string;versionCode:number;size:number;notes:string;releaseUrl:string};
export type UpdateState={enabled:boolean;versionCode:number;versionName:string;offer?:UpdateOffer};
interface AppUpdatesPlugin{
 getState():Promise<UpdateState>;
 check():Promise<UpdateState>;
 download(options:{token:string}):Promise<UpdateOffer>;
 install(options:{token:string}):Promise<{permissionRequired?:boolean;installerOpened?:boolean}>;
 openInstallSettings():Promise<void>;
 cancel():Promise<void>;
 addListener(name:"progress",listener:(event:{received:number;total:number})=>void):Promise<{remove():Promise<void>}>;
 addListener(name:"installerResume",listener:()=>void):Promise<{remove():Promise<void>}>;
}
export const appUpdates=registerPlugin<AppUpdatesPlugin>("AppUpdates");
