import {useLayoutEffect,useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";

/** Move only the status subtree; editor drafts and history stay mounted. */
export function ToolbarStatus({children}:{children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),[host,setHost]=useState<HTMLElement|null>(null);
 useLayoutEffect(()=>{
  const status=root.current?.firstElementChild as HTMLElement|null,slot=document.getElementById("viewer-status-slot"),toolbar=slot?.closest<HTMLElement>(".viewer-toolbar"),row=toolbar?.querySelector<HTMLElement>(".viewer-tool-row"),tools=row?.querySelector<HTMLElement>(".viewer-tools-scroll"),shell=toolbar?.closest<HTMLElement>(".viewer-shell");
  if(!status||!slot||!row||!tools||!shell)return;
  let frame=0;
  const update=()=>{
   const style=getComputedStyle(row),buttons=[...tools.children] as HTMLElement[];
   const toolsWidth=buttons.reduce((n,b)=>n+b.getBoundingClientRect().width,0)+parseFloat(getComputedStyle(tools).columnGap||"0")*Math.max(0,buttons.length-1);
   const fixed=[...row.children].filter(e=>e!==tools&&e!==slot).reduce((n,e)=>n+e.getBoundingClientRect().width,0);
   const chrome=[style.paddingLeft,style.paddingRight,style.borderLeftWidth,style.borderRightWidth].reduce((n,v)=>n+parseFloat(v||"0"),0)+parseFloat(style.columnGap||"0")*(row.children.length-1);
   const fits=toolsWidth+fixed+chrome+status.getBoundingClientRect().width+16<=shell.clientWidth-78;
   shell.classList.toggle("toolbar-status-inline",fits);
   setHost(current=>current===(fits?slot:null)?current:fits?slot:null);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
  update();const observer=new ResizeObserver(schedule);for(const e of [shell,status,row])observer.observe(e);window.addEventListener("resize",schedule);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener("resize",schedule);shell.classList.remove("toolbar-status-inline");};
 });
 const content=<div ref={root} className="toolbar-status-wrapper">{children}</div>;
 return host?createPortal(content,host):content;
}
