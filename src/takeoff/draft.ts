import type {MeasurementPick} from "../viewer/DrawingViewer";
import type {DrawingPoint} from "../viewer/savedView";

/** Editing an existing draft vertex never appends or completes an object. */
export function takeoffDraftPoints(points:readonly DrawingPoint[],pick:Pick<MeasurementPick,"point"|"replaceIndex">|null):DrawingPoint[]{
 if(!pick)return [...points];
 if(pick.replaceIndex===undefined)return [...points,pick.point];
 const index=pick.replaceIndex;
 return Number.isInteger(index)&&index>=0&&index<points.length?points.map((p,i)=>i===index?pick.point:p):[...points];
}
