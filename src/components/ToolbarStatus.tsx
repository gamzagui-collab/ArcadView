import {useLayoutEffect,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";

/** Dock status controls above history without remounting their editor. */
export function ToolbarStatus({children}:{children:ReactNode}){
 const[host,setHost]=useState<HTMLElement|null>(null);
 useLayoutEffect(()=>{setHost(document.getElementById("viewer-status-slot"));},[]);
 const content=<div className="toolbar-status-wrapper">{children}</div>;
 return host?createPortal(content,host):content;
}
