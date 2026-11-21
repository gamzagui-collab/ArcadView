/** Short, bounded coasting in CSS pixels; no bounce or slow sliding tail. */
const DECAY_MS=140;
export function releaseScrollVelocity(velocity:number,lastMove:number,now:number):number {
  return now-lastMove>90?0:Math.max(-1.1,Math.min(1.1,velocity));
}
export function coastScroll(position:number,velocity:number,elapsed:number,maximum:number) {
  const decay=Math.exp(-Math.max(0,elapsed)/DECAY_MS);
  const next=Math.max(0,Math.min(maximum,position+velocity*DECAY_MS*(1-decay)));
  return {position:next,velocity:next<=0||next>=maximum?0:velocity*decay};
}
