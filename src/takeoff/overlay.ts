import type {DrawingPoint as P} from "../viewer/savedView";
import {labelPosition,quantity,type TakeoffDocument,type TakeoffObject} from "./model";
/** Keep a clamped movement cross away from the object's editable vertices. */
export function takeoffMovePoint(points:readonly P[],width:number,height:number):P{
 const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),clamp=(p:P)=>({x:Math.max(20,Math.min(width-20,p.x)),y:Math.max(100,Math.min(height-125,p.y))});
 const candidates=[{x:(minX+maxX)/2,y:maxY+32},{x:(minX+maxX)/2,y:minY-32},{x:minX-32,y:(minY+maxY)/2},{x:maxX+32,y:(minY+maxY)/2}].map(clamp);
 return candidates.find(p=>points.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=30))??candidates.reduce((a,b)=>Math.min(...points.map(q=>Math.hypot(a.x-q.x,a.y-q.y)))>=Math.min(...points.map(q=>Math.hypot(b.x-q.x,b.y-q.y)))?a:b);
}
export function drawTakeoff(svg:SVGSVGElement,doc:TakeoffDocument,selected:string|null,draft:TakeoffObject|null,project:(p:readonly P[])=>P[],active:boolean){
 const ns="http://www.w3.org/2000/svg",nodes:SVGElement[]=[],el=(tag:string,attrs:Record<string,string|number>,parent?:SVGElement)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(parent)parent.append(e);else nodes.push(e);return e;};
 for(const o of [...doc.objects.filter(o=>doc.groups.find(g=>g.id===o.groupId)?.visible&&o.id!==draft?.id),...draft?[draft]:[]]){
  const group=doc.groups.find(g=>g.id===o.groupId)!,color=group.color,chosen=active&&o.id===selected,world=o.geometry.points,points=project(world),closed=o.kind==="slab",coords=points.map(p=>`${p.x},${p.y}`).join(" "),tag=closed?"polygon":"polyline";
  if(closed)el("polygon",{points:coords,fill:color,"fill-opacity":.13,stroke:"none","data-takeoff":o.id});
  el(tag,{points:coords,fill:"none",stroke:"#04101e","stroke-width":chosen?9:7,"stroke-linejoin":"round","stroke-linecap":"round"});
  el(tag,{points:coords,fill:"none",stroke:color,"stroke-width":chosen?5:3,"stroke-linejoin":"round","stroke-linecap":"round","data-takeoff":o.id});
  el(tag,{points:coords,fill:"none",stroke:"#f2fbff","stroke-width":.7,"stroke-opacity":.75});
  points.forEach((p,i)=>{el("circle",{cx:p.x,cy:p.y,r:chosen?6:4,style:`fill:none;stroke:${color};stroke-width:1.6`,"data-takeoff-vertex":i,"data-takeoff":o.id});el("circle",{cx:p.x,cy:p.y,r:1.2,style:"fill:white;stroke:none"});});
  if(o.label.visible){let lines:string[];try{const q=quantity(o,doc.unit),d=o.dimensions;lines=o.kind==="wall"?[`L ${q.lengthM.toFixed(2)} × H ${(d.heightMm!*.001).toFixed(2)} × T ${(d.thicknessMm!*.001).toFixed(2)}`,`= ${q.volumeM3.toFixed(3)} m³`]:o.kind==="beam"?[`L ${q.lengthM.toFixed(2)} × W ${(d.widthMm!*.001).toFixed(2)} × D ${(d.depthMm!*.001).toFixed(2)}`,`= ${q.volumeM3.toFixed(3)} m³`]:[`A ${q.areaM2.toFixed(2)} m² × T ${(d.thicknessMm!*.001).toFixed(2)} m`,`= ${q.volumeM3.toFixed(3)} m³`];}catch{lines=["작성 중 · 규격 확정 전"];}
   const anchor=project([labelPosition(o)])[0],width=Math.min(252,Math.max(132,...lines.map(s=>s.length*6.1+18))),height=lines.length*17+15;
   const p={x:anchor.x,y:closed?anchor.y+height/2:anchor.y-24},left=p.x-width/2,top=p.y-height;
   if(left+width>=0&&left<=svg.clientWidth&&top+height>=0&&top<=svg.clientHeight){
    const g=el("g",{"data-takeoff-label":o.id});
    el("line",{x1:anchor.x,y1:anchor.y,x2:p.x,y2:p.y,stroke:color,"stroke-width":1.1},g);el("rect",{x:left,y:top,width,height,rx:6,fill:"#102d48",stroke:chosen?"#f1fbff":color,"stroke-width":chosen?2:1.1},g);
    lines.forEach((line,i)=>{el("text",{x:p.x,y:top+18+i*17,"text-anchor":"middle",fill:i?"#fff":"#d4ebff","font-size":i?13:11,"font-weight":i?700:500},g).textContent=line;});
    el("text",{x:left+4,y:top-4,fill:color,"font-size":9,"data-takeoff-id":o.id},g).textContent=o.id.slice(0,8);
   }
  }
  if(chosen&&points.length){const{x,y}=takeoffMovePoint(points,svg.clientWidth,svg.clientHeight);el("circle",{cx:x,cy:y,r:16,fill:"#102d48",stroke:color,"stroke-width":1.8,"data-takeoff-move":o.id});el("path",{d:`M${x-9},${y}h18 M${x},${y-9}v18 M${x-5},${y-4}l-4,4 4,4 M${x+5},${y-4}l4,4-4,4`,fill:"none",stroke:"#e3f8ff","stroke-width":1.5});}
 }
 svg.replaceChildren(...nodes);
}
