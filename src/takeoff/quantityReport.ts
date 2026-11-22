import {distance,UNIT_METERS} from "../viewer/measurementGeometry";
import {calculationOf,cleanPoints,KINDS,quantity,takeoffPolygon,totals,validateDocument,type TakeoffCalculation,type TakeoffDocument,type TakeoffKind} from "./model";

export type ReportItem={id:string;layerId:string;layer:string;kind:TakeoffKind;calculation:TakeoffCalculation;lengthM:number;widthM?:number;heightM?:number;areaM2:number;thicknessM?:number;volumeM3:number;equivalentWidth:boolean;hidden:boolean};
export function buildQuantityReport(doc:TakeoffDocument){
 validateDocument(doc);
 const items:ReportItem[]=[];
 for(const layer of doc.layers)for(const kind of KINDS)for(const o of doc.objects.filter(o=>o.layerId===layer.id&&o.kind===kind)){
  const q=quantity(o,doc.unit),d=o.dimensions,calculation=calculationOf(o);let lengthM=q.lengthM,widthM:number|undefined,heightM:number|undefined,equivalentWidth=false;
  if(takeoffPolygon(kind,calculation)){
   const p=cleanPoints(o.geometry.points,true),edges=p.map((a,i)=>distance(a,p[(i+1)%p.length]));
   lengthM=Math.max(...edges)*UNIT_METERS[doc.unit];widthM=q.areaM2/lengthM;
   equivalentWidth=p.length!==4||p.some((b,i)=>{const a=p[(i+p.length-1)%p.length],c=p[(i+1)%p.length];return Math.abs((a.x-b.x)*(c.x-b.x)+(a.y-b.y)*(c.y-b.y))>distance(a,b)*distance(b,c)*1e-8;});
  }
  if(calculation==="volume"&&(kind==="wall"||kind==="column"))heightM=d.heightMm!*.001;
  if(calculation==="volume"&&kind==="beam"){widthM=d.widthMm!*.001;heightM=d.depthMm!*.001;}
  items.push({id:o.id,layerId:layer.id,layer:layer.name,kind,calculation,lengthM,widthM,heightM,areaM2:q.areaM2,thicknessM:calculation==="area"||d.thicknessMm===undefined?undefined:d.thicknessMm*.001,volumeM3:q.volumeM3,equivalentWidth,hidden:!layer.visible||!doc.groups.find(g=>g.id===kind)!.visible});
 }
 return{drawing:doc.drawing.name,unit:doc.unit,layers:doc.layers.map(l=>({id:l.id,name:l.name,items:items.filter(o=>o.layerId===l.id)})),items,totals:totals(doc)};
}
