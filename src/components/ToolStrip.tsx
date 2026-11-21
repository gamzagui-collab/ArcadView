import {useLayoutEffect,useRef,type HTMLAttributes} from "react";
import {coastScroll,releaseScrollVelocity} from "./inertialScroll";

/** Touch and mouse use the same modest inertia, independent of WebView defaults. */
export function ToolStrip(props:HTMLAttributes<HTMLDivElement>) {
  const ref=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const el=ref.current!;
    let frame=0,suppressUntil=0;
    let drag:{id:number;x:number;y:number;lastX:number;time:number;velocity:number;horizontal:boolean}|null=null;
    const pointers=new Set<number>();
    const stop=()=>{cancelAnimationFrame(frame);frame=0;};
    const releaseCapture=()=>{if(drag&&el.hasPointerCapture(drag.id))el.releasePointerCapture(drag.id);};
    const coast=(velocity:number)=>{
      if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
      let last=performance.now();const start=last;
      const tick=(now:number)=>{
        if(document.hidden||now-start>500){stop();return;}
        const next=coastScroll(el.scrollLeft,velocity,Math.min(32,now-last),el.scrollWidth-el.clientWidth);
        el.scrollLeft=next.position;velocity=next.velocity;last=now;
        if(Math.abs(velocity)<.025){stop();return;}frame=requestAnimationFrame(tick);
      };
      frame=requestAnimationFrame(tick);
    };
    const down=(e:PointerEvent)=>{
      pointers.add(e.pointerId);stop();suppressUntil=0;
      if(pointers.size>1){releaseCapture();drag=null;return;}
      if(e.button!==0||el.scrollWidth<=el.clientWidth)return;
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,time:performance.now(),velocity:0,horizontal:false};
    };
    const move=(e:PointerEvent)=>{
      if(!drag||drag.id!==e.pointerId)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(!drag.horizontal){
        if(Math.abs(dy)>6&&Math.abs(dy)>Math.abs(dx)){drag=null;return;}
        if(Math.abs(dx)<6||Math.abs(dx)<Math.abs(dy))return;
        drag.horizontal=true;el.setPointerCapture(e.pointerId);
      }
      if(e.cancelable)e.preventDefault();
      const now=performance.now(),delta=drag.lastX-e.clientX,dt=Math.max(1,now-drag.time);
      el.scrollLeft+=delta;drag.velocity=drag.velocity*.25+delta/dt*.75;drag.lastX=e.clientX;drag.time=now;
    };
    const end=(e:PointerEvent)=>{
      pointers.delete(e.pointerId);if(!drag||drag.id!==e.pointerId)return;
      const current=drag;releaseCapture();drag=null;
      if(current.horizontal){
        suppressUntil=performance.now()+300;
        if(e.type==="pointerup")coast(releaseScrollVelocity(current.velocity,current.time,performance.now()));
      }
    };
    const click=(e:MouseEvent)=>{if(e.detail!==0&&performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}};
    const visibility=()=>{if(document.hidden){stop();releaseCapture();drag=null;pointers.clear();}};
    el.addEventListener("pointerdown",down);window.addEventListener("pointermove",move,{passive:false});
    window.addEventListener("pointerup",end);window.addEventListener("pointercancel",end);el.addEventListener("click",click,true);
    document.addEventListener("visibilitychange",visibility);el.addEventListener("wheel",stop,{passive:true});
    return()=>{stop();releaseCapture();el.removeEventListener("pointerdown",down);window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",end);window.removeEventListener("pointercancel",end);el.removeEventListener("click",click,true);document.removeEventListener("visibilitychange",visibility);el.removeEventListener("wheel",stop);};
  },[]);
  return <div {...props} ref={ref}/>;
}
