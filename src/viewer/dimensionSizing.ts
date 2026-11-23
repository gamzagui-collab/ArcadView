import type {Annotation} from "./annotations";
import {UNIT_METERS,type MeasurementUnit} from "./measurementGeometry";

/** Explicit heights use drawing coordinates; legacy dimensions retain their paper scale. */
export function dimensionTextHeight(o:Annotation,source:MeasurementUnit="drawing"):number {
  return o.dimensionTextHeight??2.5*(o.scale??20)*(source==="drawing"?1:.001/UNIT_METERS[source]);
}

export function parseDimensionTextHeight(input:string):number|null {
  if(!input.trim())return null;
  const height=Number(input);return Number.isFinite(height)&&height>0&&height<=1e12?height:null;
}
