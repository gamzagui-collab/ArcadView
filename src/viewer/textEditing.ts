import type { Annotation, AnnotationDocument } from "./annotations";
import type { DrawingPoint } from "./savedView";

export type TextEditSession = {
  id: string;
  originalId?: string;
  layerId: string;
  point: DrawingPoint;
  text: string;
  height: number;
  color?: string;
};

/** One completed text session is one document edit, including its style. */
export function completeTextEdit(doc: AnnotationDocument, session: TextEditSession): AnnotationDocument {
  const text = session.text.replace(/\r\n?/g, "\n");
  if (text.length > 500 || !Number.isFinite(session.height) || session.height <= 0 || session.height > 1e6 ||
      (session.color !== undefined && !/^#[a-f0-9]{6}$/i.test(session.color))) throw Error("Invalid text edit");
  const original = session.originalId ? doc.objects.find(o => o.id === session.originalId && o.kind === "text") : undefined;
  if (session.originalId && !original) return doc;
  if (!text.trim()) return original ? {...doc, objects:doc.objects.filter(o=>o.id!==original.id)} : doc;
  const object: Annotation = {...original, id:session.id, layerId:session.layerId, kind:"text",
    points:[session.point], text, textHeight:session.height, color:session.color};
  if (original && original.text === text && original.textHeight === session.height && original.color === session.color) return doc;
  return {...doc, textHeight:session.height, objects:original ? doc.objects.map(o=>o.id===original.id?object:o) : [...doc.objects,object]};
}
