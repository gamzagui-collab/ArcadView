import { drawingLayers,isDimensionTool,type AnnotationDocument,type AnnotationTool } from "../viewer/annotations";
/** Classify completed objects, not every UI commit (typing layer names, visibility, etc.). */
export function annotationUsage(before:AnnotationDocument,after:AnnotationDocument,tool:AnnotationTool):string|null{
  if(tool==="trim")return null;
  const old=new Map(before.objects.map(o=>[o.id,o]));
  const changed=after.objects.filter(o=>{
    if(o.kind==="mask")return false;
    const previous=old.get(o.id);
    // Placing the completed label/arc exposes no new measured value.
    if(previous&&isDimensionTool(o.kind)&&JSON.stringify({...previous,labelPoint:undefined,textPoint:undefined})===JSON.stringify({...o,labelPoint:undefined,textPoint:undefined}))return false;
    return JSON.stringify(previous)!==JSON.stringify(o);
  });
  if(changed.length){
    if(["move","rotate","offset","trim","extend"].includes(tool))return"edit."+tool;
    if(tool==="select")return"edit.reshape";
    if(tool.startsWith("dimension"))return"draw.dimension";
    if(tool.startsWith("point-"))return"draw.point";
    if(tool==="arc")return "draw.circle"; // Circular drawing uses the existing circle operation.
    if(["polyline","circle","rectangle","text"].includes(tool))return"draw."+tool;
    return"edit.style";
  }
  if(drawingLayers(after).length>drawingLayers(before).length)return"layer.create";
  return null;
}
