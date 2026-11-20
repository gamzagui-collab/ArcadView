import { convertMeasurement, type MeasurementUnit } from "./measurementGeometry";
import type { DrawingPoint } from "./savedView";
import { annotationPoints, dimensionGeometry, textBounds, visibleAnnotations, type Annotation, type AnnotationDocument } from "./annotations";
const NS="http://www.w3.org/2000/svg";
export function drawAnnotations(svg:SVGSVGElement,doc:AnnotationDocument,selected:string|null,draft:Annotation|null,project:(p:readonly DrawingPoint[])=>DrawingPoint[],source:MeasurementUnit,display:MeasurementUnit):void{
  const children:SVGElement[]=[];
  const el=(tag:string,attrs:Record<string,string|number>)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));children.push(e);return e;};
  const line=(points:DrawingPoint[],color:string,css:string,id:string)=>el("polyline",{points:project(points).map(p=>`${p.x},${p.y}`).join(" "),stroke:color,class:css,"data-object":id});
  const objects=visibleAnnotations(doc);
  // Erasures are a reversible overlay, drawn below all user geometry.
  for(const o of objects.filter(o=>o.kind==="mask")){
    line(o.points,"#0b1118","annotation-mask",o.id);
    if(o.id===selected)line(o.points,"#ff8e9b","annotation-mask-selected",o.id);
  }
  for(const o of [...objects.filter(o=>o.kind!=="mask"),...(draft?[draft]:[])]){
    const color=o.color??doc.layers.find(l=>l.id===o.layerId)?.color??"#49cfff",active=o.id===selected;
    const dim=o.kind.startsWith("dimension")?dimensionGeometry(o,source):null;
    if(o.kind==="text"){
      const p=o.points[0],h=o.textHeight??50,[a,b]=project([p,{x:p.x,y:p.y+h}]),height=Math.max(.1,Math.hypot(a.x-b.x,a.y-b.y));
      const text=el("text",{x:a.x,y:a.y,"font-size":height,fill:color,class:"annotation-user-text","data-object":o.id,"xml:space":"preserve"});
      for(const [i,line]of(o.text??"").split("\n").entries()){
        const span=document.createElementNS(NS,"tspan");span.setAttribute("x",String(a.x));span.setAttribute("y",String(a.y+i*height*1.3));span.textContent=line||" ";text.append(span);
      }
      if(active){const b=textBounds(o);line([{x:b.minX,y:b.minY},{x:b.maxX,y:b.minY},{x:b.maxX,y:b.maxY},{x:b.minX,y:b.maxY},{x:b.minX,y:b.minY}],"#e9fbff","annotation-text-selection",o.id);}
    }else if(dim){
      const[a,b]=project([dim.first,dim.second]),dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);if(l<1e-6)continue;
      for(const edge of dim.extensions)line(edge,color,"annotation-extension",o.id);
      line([dim.first,dim.second],"#03101d","annotation-halo",o.id);line([dim.first,dim.second],color,active?"annotation-line selected":"annotation-line",o.id);
      const [p,q]=project([dim.first,{x:dim.first.x,y:dim.first.y+dim.textHeight}]);
      const height=Math.max(.1,Math.hypot(q.x-p.x,q.y-p.y)),head=height*.65,ux=dx/l,uy=dy/l;
      for(const [tip,sign]of [[a,1],[b,-1]]as const){const x=tip.x+ux*head*sign,y=tip.y+uy*head*sign;el("polygon",{points:`${tip.x},${tip.y} ${x-uy*head*.27},${y+ux*head*.27} ${x+uy*head*.27},${y-ux*head*.27}`,fill:color,class:"annotation-arrow"});}
      let degrees=Math.atan2(dy,dx)*180/Math.PI;if(degrees>90)degrees-=180;if(degrees< -90)degrees+=180;
      const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
      const text=el("text",{x,y,transform:`rotate(${degrees} ${x} ${y})`,"text-anchor":"middle",dy:-height*.35,"font-size":height,fill:color,class:"annotation-dimension-text","data-object":o.id});
      text.textContent=new Intl.NumberFormat("ko",{maximumFractionDigits:3}).format(convertMeasurement(dim.value,source,display))+(display==="drawing"?"":` ${display}`);
    }else{
      const points=annotationPoints(o);line(points,"#03101d","annotation-halo",o.id);line(points,color,active?"annotation-line selected":"annotation-line",o.id);
    }
    if(active)for(const p of project(o.points))el("rect",{x:p.x-3,y:p.y-3,width:6,height:6,fill:"#fff",stroke:color,"stroke-width":1});
  }
  svg.replaceChildren(...children);
}
