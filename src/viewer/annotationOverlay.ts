import { convertMeasurement, type MeasurementUnit } from "./measurementGeometry";
import type { DrawingPoint } from "./savedView";
import { annotationPoints, dimensionGeometry, isDimensionTool, isPointAnnotation, textBounds, visibleAnnotations, type Annotation, type AnnotationDocument } from "./annotations";
import { drawPointAnnotation } from "./pointMarkup";
import { formatCadNumber } from "./displayPrecision";
import {moveHandlePosition,objectGrips} from "./objectEditing";
import {isRadialDimension,radialDimensionGeometry} from "./radialDimensions";
const NS="http://www.w3.org/2000/svg";
export function drawAnnotations(svg:SVGSVGElement,doc:AnnotationDocument,selected:string|null,draft:Annotation|null,project:(p:readonly DrawingPoint[])=>DrawingPoint[],source:MeasurementUnit,display:MeasurementUnit,precision=3,locale="ko",draftPointWindow?:string):void{
  const children:SVGElement[]=[];
  const el=(tag:string,attrs:Record<string,string|number>)=>{const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));children.push(e);return e;};
  let objectWidth:number|undefined;
  const line=(points:DrawingPoint[],color:string,css:string,id:string)=>el("polyline",{points:project(points).map(p=>`${p.x},${p.y}`).join(" "),stroke:color,class:css,"data-object":id,...(objectWidth!==undefined&&/annotation-(line|halo|extension)/.test(css)?{style:`stroke-width:${css==="annotation-halo"?objectWidth+3:css==="annotation-extension"?Math.max(1,objectWidth*.6):objectWidth}px`}:{})});
  const objects=visibleAnnotations(doc);
  // Erasures are a reversible overlay, drawn below all user geometry.
  for(const o of objects.filter(o=>o.kind==="mask")){
    line(o.points,"#0b1118","annotation-mask",o.id);
    if(o.id===selected)line(o.points,"#ff8e9b","annotation-mask-selected",o.id);
  }
  for(const o of [...objects.filter(o=>o.kind!=="mask"&&!isPointAnnotation(o)),...objects.filter(isPointAnnotation),...(draft?[draft]:[])]){
    const first=children.length;
    objectWidth=o.screenWidth;
    const color=o.color??doc.layers.find(l=>l.id===o.layerId)?.color??"#49cfff",active=o.id===selected;
    const dim=o.kind.startsWith("dimension")?dimensionGeometry(o,source):null;
    if(isPointAnnotation(o))drawPointAnnotation(o,project,el);
    else if(o.kind==="text"){
      const p=o.points[0],h=o.textHeight??50,[a,b]=project([p,{x:p.x,y:p.y+h}]),height=Math.max(.1,Math.hypot(a.x-b.x,a.y-b.y));
      const text=el("text",{x:a.x,y:a.y,"font-size":height,fill:color,class:"annotation-user-text","data-object":o.id,"xml:space":"preserve",...(o.rotation?{transform:`rotate(${-o.rotation} ${a.x} ${a.y})`}:{})});
      for(const [i,line]of(o.text??"").split("\n").entries()){
        const span=document.createElementNS(NS,"tspan");span.setAttribute("x",String(a.x));span.setAttribute("y",String(a.y+i*height*1.3));span.textContent=line||" ";text.append(span);
      }
      if(active){const b=textBounds(o);line([{x:b.minX,y:b.minY},{x:b.maxX,y:b.minY},{x:b.maxX,y:b.maxY},{x:b.minX,y:b.maxY},{x:b.minX,y:b.minY}],"#e9fbff","annotation-text-selection",o.id);}
    }else if(isRadialDimension(o)){
      const g=radialDimensionGeometry(o,source);if(!g)continue;
      for(const edge of g.extensions)line(edge,color,"annotation-extension",o.id);
      for(const chain of g.lines){line(chain,"#03101d","annotation-halo",o.id);line(chain,color,active?"annotation-line selected":"annotation-line",o.id);}
      const [a,b]=project([g.label,{x:g.label.x,y:g.label.y+g.textHeight}]),height=Math.max(.1,Math.hypot(b.x-a.x,b.y-a.y));
      for(const arrow of g.arrows){const[tip,tail]=project([arrow.tip,arrow.tail]),dx=tail.x-tip.x,dy=tail.y-tip.y,l=Math.hypot(dx,dy);if(l<1e-9)continue;const h=Math.min(height*.65,l*.65),ux=dx/l,uy=dy/l,x=tip.x+ux*h,y=tip.y+uy*h;el("polygon",{points:`${tip.x},${tip.y} ${x-uy*h*.27},${y+ux*h*.27} ${x+uy*h*.27},${y-ux*h*.27}`,fill:color,class:"annotation-arrow","data-object":o.id});}
      const text=el("text",{x:a.x,y:a.y,dy:-height*.35,"text-anchor":"middle","font-size":height,fill:color,class:"annotation-dimension-text","data-object":o.id,"data-dimension":o.kind});
      text.textContent=o.kind==="dimension-angle"?formatCadNumber(g.value,precision,locale)+"°":"R "+formatCadNumber(convertMeasurement(g.value,source,display),precision,locale)+(display==="drawing"?"":` ${display}`);
      const center=project([g.center])[0];el("path",{d:`M${center.x-4},${center.y}h8 M${center.x},${center.y-4}v8`,stroke:color,"stroke-width":1.2,fill:"none","data-object":o.id});
    }else if(dim){
      const[a,b]=project([dim.first,dim.second]),dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy);if(l<1e-6)continue;
      for(const edge of dim.extensions)line(edge,color,"annotation-extension",o.id);
      line([dim.first,dim.second],"#03101d","annotation-halo",o.id);line([dim.first,dim.second],color,active?"annotation-line selected":"annotation-line",o.id);
      const [p,q]=project([dim.first,{x:dim.first.x,y:dim.first.y+dim.textHeight}]);
      const height=Math.max(.1,Math.hypot(q.x-p.x,q.y-p.y)),head=height*.65,ux=dx/l,uy=dy/l;
      for(const [tip,sign]of [[a,1],[b,-1]]as const){const x=tip.x+ux*head*sign,y=tip.y+uy*head*sign;el("polygon",{points:`${tip.x},${tip.y} ${x-uy*head*.27},${y+ux*head*.27} ${x+uy*head*.27},${y-ux*head*.27}`,fill:color,class:"annotation-arrow"});}
      let degrees=Math.atan2(dy,dx)*180/Math.PI;if(degrees>90)degrees-=180;if(degrees< -90)degrees+=180;
      const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
      const text=el("text",{x,y,transform:`rotate(${degrees} ${x} ${y})`,"text-anchor":"middle",dy:-height*.35,"font-size":height,fill:color,class:"annotation-dimension-text","data-object":o.id,"data-dimension":o.kind});
      text.textContent=formatCadNumber(convertMeasurement(dim.value,source,display),precision,locale)+(display==="drawing"?"":` ${display}`);
    }else{
      const points=annotationPoints(o);line(points,"#03101d","annotation-halo",o.id);line(points,color,active?"annotation-line selected":"annotation-line",o.id);
    }
    if(active&&o.kind!=="mask"){
      const grips=objectGrips(o),step=Math.max(1,Math.ceil(grips.length/512));
      for(const[g,i]of grips.map((g,i)=>[g,i]as const).filter(([,i])=>i%step===0||i===grips.length-1)){
        const p=project([g.point])[0];if(p.x< -10||p.x>svg.clientWidth+10||p.y< -10||p.y>svg.clientHeight+10)continue;
        el("rect",{x:p.x-6,y:p.y-6,width:12,height:12,rx:2,fill:"#03101d",stroke:"#03101d","stroke-width":3});
        el("rect",{x:p.x-4,y:p.y-4,width:8,height:8,fill:"#fff",stroke:color,"stroke-width":1.5,"data-grip":g.id,"data-grip-index":i,"data-object":o.id});
      }
      const p=moveHandlePosition(o,project,svg.clientWidth,svg.clientHeight);
      if(p){el("circle",{cx:p.x,cy:p.y,r:17,fill:"#0a263ce8",stroke:"#9fe5ff","stroke-width":1.5,"data-free-move":o.id,...(isDimensionTool(o.kind)?{"data-dimension-handle":o.id}:{})});el("path",{d:`M${p.x-10},${p.y}h20 M${p.x},${p.y-10}v20 M${p.x-6},${p.y-4}l-4,4 4,4 M${p.x+6},${p.y-4}l4,4 -4,4 M${p.x-4},${p.y-6}l4,-4 4,4 M${p.x-4},${p.y+6}l4,4 4,-4`,fill:"none",stroke:"#b8f0ff","stroke-width":1.6});}
    }
    if(o===draft&&draftPointWindow){const group=document.createElementNS(NS,"g");group.setAttribute("mask",`url(#${draftPointWindow})`);group.append(...children.splice(first));children.push(group);}
  }
  svg.replaceChildren(...children);
}
