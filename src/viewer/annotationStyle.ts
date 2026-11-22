import {isPointAnnotation,type Annotation,type AnnotationDocument} from "./annotations";

export type ObjectStyle={color?:string;screenWidth?:number;textHeight?:number;screenFontSize?:number};
export const hasTextSize=(object:Annotation)=>object.kind==="text"||["point-leader","point-text"].includes(object.kind);
export function objectStyleValue(object:Annotation):number {
  return object.kind==="text"?object.textHeight??50:["point-leader","point-text"].includes(object.kind)?object.screenFontSize??18:object.screenWidth??(isPointAnnotation(object)?3:2);
}
export function objectColor(object:Annotation,doc:AnnotationDocument):string {
  return object.color??doc.layers.find(l=>l.id===object.layerId)?.color??"#49cfff";
}
/** Style edits keep all coordinates and layer ownership intact. */
export function styleAnnotation(object:Annotation,style:ObjectStyle):Annotation {
  if(object.kind==="mask")throw Error("An erasure cannot be styled");
  if(style.color!==undefined&&!/^#[a-f0-9]{6}$/i.test(style.color))throw Error("Invalid color");
  if(style.screenWidth!==undefined&&(!Number.isFinite(style.screenWidth)||style.screenWidth<1||style.screenWidth>12))throw Error("Invalid line width");
  if(style.textHeight!==undefined&&(object.kind!=="text"||!Number.isFinite(style.textHeight)||style.textHeight<.001||style.textHeight>1e6))throw Error("Invalid text height");
  if(style.screenFontSize!==undefined&&(!["point-leader","point-text"].includes(object.kind)||!Number.isFinite(style.screenFontSize)||style.screenFontSize<10||style.screenFontSize>48))throw Error("Invalid label size");
  return{...object,...style};
}
