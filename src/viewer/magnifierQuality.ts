export const MAGNIFIER_IDLE_MS=140;
/** Learn slow redraws per drawing. On those drawings movement uses the cheap
 * existing raster, then one original-geometry redraw after a short pause. */
export class MagnifierQuality{
 private slow=false;private last:{x:number;y:number}|null=null;private until=0;
 move(point:{x:number;y:number},now:number){if(this.last&&Math.hypot(point.x-this.last.x,point.y-this.last.y)>.25)this.until=now+MAGNIFIER_IDLE_MS;this.last={...point};}
 allowDetail(now:number){return!this.slow||now>=this.until;}
 remaining(now:number){return this.slow?Math.max(0,this.until-now):0;}
 captured(ms:number){if(ms>16)this.slow=true;}
 reset(){this.last=null;this.until=0;}
}
