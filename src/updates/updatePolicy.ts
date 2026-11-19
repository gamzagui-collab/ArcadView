export const UPDATE_INTERVAL=6*60*60*1000;
export function shouldCheckUpdate(now:number,last:number|null):boolean{
 return Number.isFinite(now)&&(last===null||!Number.isFinite(last)||last<0||now<last||now-last>=UPDATE_INTERVAL);
}
export function updateProgress(received:number,total:number):number|null{
 if(!Number.isFinite(received)||!Number.isFinite(total)||received<0||total<=0)return null;
 return Math.min(100,Math.max(0,Math.round(received/total*100)));
}
