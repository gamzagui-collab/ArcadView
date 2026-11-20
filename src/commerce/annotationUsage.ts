import { POINT_LAYER_ID,type AnnotationDocument,type AnnotationTool } from "../viewer/annotations";
/** Classify completed objects, not every UI commit (typing layer names, visibility, etc.). */
export function annotationUsage(before:AnnotationDocument,after:AnnotationDocument,tool:AnnotationTool):string|null{
  if(tool==="trim")return null;
  const old=new Map(before.objects.map(o=>[o.id,o]));
  const changed=after.objects.filter(o=>o.kind!=="mask"&&JSON.stringify(old.get(o.id))!==JSON.stringify(o));
  if(changed.length){
    if(["move","rotate","offset","trim","extend"].includes(tool))return"edit."+tool;
    if(tool==="select")return"edit.reshape";
    if(tool.startsWith("dimension"))return"draw.dimension";
    if(tool.startsWith("point-"))return"draw.point";
    if(["polyline","circle","rectangle","text"].includes(tool))return"draw."+tool;
    return"edit.style";
  }
  if(after.layers.filter(l=>l.id!==POINT_LAYER_ID).length>before.layers.filter(l=>l.id!==POINT_LAYER_ID).length)return"layer.create";
  return null;
}
