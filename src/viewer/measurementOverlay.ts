import type { MeasurementSettings } from "./measurementGeometry";
import type { MeasurementPick } from "./DrawingViewer";
import type { DrawingPoint } from "./savedView";
import { rightAngleCorners } from "./rightAngles";
import { isDistanceMode, linearMeasurement, measurementPointsAfterPick, pathIsClosed } from "./measurementTools";
const NS = "http://www.w3.org/2000/svg";
const pointWindows=new WeakMap<SVGSVGElement,string>();
let nextPointWindow=0;
/** Updated in the same Render call as WebGL, without a deferred React commit. */
export function drawMeasurementOverlay(svg: SVGSVGElement, settings: MeasurementSettings, project: (points: readonly DrawingPoint[]) => DrawingPoint[], preview: MeasurementPick | null, references: readonly DrawingPoint[] = [],endReferences:readonly DrawingPoint[]=[],label?:string,draftPoints?:readonly DrawingPoint[]): string|undefined {
  if (!settings.enabled) { svg.replaceChildren(); return; }
  let points = settings.mode === "object" ? settings.entity?.points ?? [] : settings.points;
  if(draftPoints)points=[...draftPoints];
  else if (preview && settings.mode !== "object") points = measurementPointsAfterPick(settings, preview.point, preview.replaceIndex);
  const projected = project(points), elements: SVGElement[] = [];
  const markers=settings.mode==="object"?[]:projected.filter((_,i)=>!(settings.mode==="path"&&pathIsClosed(points)&&i===projected.length-1));
  const make = (tag: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) e.setAttribute(name, String(value));
    elements.push(e); return e;
  };
  // Cut the broad line/fill out of the rings. A transparent circle alone still
  // leaves the dark line halo covering the drawing underneath its centre.
  let pointWindow:Record<string,string>={};
  if(markers.length){
    let id=pointWindows.get(svg);if(!id){id=`arcad-point-window-${++nextPointWindow}`;pointWindows.set(svg,id);}
    const defs=make("defs",{}),mask=document.createElementNS(NS,"mask");
    for(const[k,v]of Object.entries({id,maskUnits:"userSpaceOnUse",x:"0",y:"0",width:"100%",height:"100%"}))mask.setAttribute(k,v);
    const background=document.createElementNS(NS,"rect");background.setAttribute("width","100%");background.setAttribute("height","100%");background.setAttribute("style","fill:#fff;stroke:none");mask.append(background);
    for(const p of markers){const hole=document.createElementNS(NS,"circle");for(const[k,v]of Object.entries({cx:p.x,cy:p.y,r:5.5,style:"fill:#000;stroke:none"}))hole.setAttribute(k,String(v));mask.append(hole);}
    defs.append(mask);pointWindow={mask:`url(#${id})`};
  }
  const lines = (p: DrawingPoint[], closed = false) => {
    const tag = closed ? "polygon" : "polyline", coordinates = p.map(p => `${p.x},${p.y}`).join(" ");
    if (closed) make(tag, { points: coordinates, class: "measurement-area-fill",...pointWindow });
    for (const layer of ["halo", "rails", "core", "highlight"]) make(tag, { points: coordinates, class: `measurement-line-${layer}`,...(layer==="highlight"?{}:pointWindow) });
  };
  const linear = settings.mode === "linear" ? linearMeasurement(points, settings.linearAxis) : null;
  if (linear) {
    const [a, start] = project([points[0], linear.start]);
    make("polyline", { points: `${a.x},${a.y} ${start.x},${start.y}`, class: "measurement-extension-halo",...pointWindow });
    make("polyline", { points: `${a.x},${a.y} ${start.x},${start.y}`, class: "measurement-extension",...pointWindow });
    lines(project([linear.start, linear.end]));
  } else if (projected.length) lines(projected, settings.mode === "area" && projected.length >= 3);

  if (settings.mode !== "object") projected.forEach((p, i) => {
    if (settings.mode === "path" && pathIsClosed(points) && i === projected.length - 1) return;
    // Hollow rings retain the drawing around a precise, small centre dot.
    make("circle", { cx: p.x, cy: p.y, r: 6.5, class: "measurement-point-ring", "data-point": i + 1 });
    make("circle", { cx: p.x, cy: p.y, r: 1.7, class: "measurement-point-dot" });
    make("text", { x: p.x + 12, y: p.y - 12 }).textContent = String(i + 1);
  });
  if (preview) {
    const p = project([preview.point])[0];
    make("circle", { cx: p.x, cy: p.y, r: 14, class: "measurement-target", "data-snapped": preview.snapped ?? "none" });
    make("path", { d: `M${p.x - 20},${p.y}h10 M${p.x + 10},${p.y}h10 M${p.x},${p.y - 20}v10 M${p.x},${p.y + 10}v10`, class: "measurement-target-cross" });
  }
  for (const corner of rightAngleCorners(points, settings.mode, references, settings.linearAxis,endReferences)) {
    const [a, v, b] = project(corner), la = Math.hypot(a.x - v.x, a.y - v.y), lb = Math.hypot(b.x - v.x, b.y - v.y);
    if (la < 1e-8 || lb < 1e-8) continue;
    const size = Math.min(15, lb / 3, isDistanceMode(settings.mode) ? 15 : la / 3);
    if (size < 3) continue;
    const ax = (a.x - v.x) / la * size, ay = (a.y - v.y) / la * size, bx = (b.x - v.x) / lb * size, by = (b.y - v.y) / lb * size;
    const d = `M${v.x + ax},${v.y + ay}L${v.x + ax + bx},${v.y + ay + by}L${v.x + bx},${v.y + by}`;
    make("path", { d, class: "measurement-right-angle-halo",...pointWindow });
    make("path", { d, class: "measurement-right-angle", "data-angle": "90", "data-vertex-x": v.x, "data-vertex-y": v.y,...pointWindow });
  }
  if(label&&projected.length>=2){
    const p=linear?project([linear.start,linear.end]):projected;
    const a=!settings.displayOnly&&(settings.mode==="path"||settings.mode==="area")?p[p.length-2]:p[0],b=p[p.length-1],x=(a.x+b.x)/2,y=(a.y+b.y)/2-25,width=Math.min(300,label.length*8+22);
    make("rect",{x:x-width/2,y:y-14,width,height:29,rx:7,class:"measurement-value-badge"});
    make("text",{x,y:y+5,"text-anchor":"middle",class:"measurement-value-label"}).textContent=label;
  }
  svg.replaceChildren(...elements);
  return markers.length?pointWindows.get(svg):undefined;
}
