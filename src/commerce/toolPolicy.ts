import type { MeasurementMode } from "../viewer/measurementGeometry";

/** Stable internal IDs; display labels never decide whether a tool is metered. */
export const measurementToolId = (mode: MeasurementMode): string => mode === "distance" ? "measure.aligned" : "measure." + mode;
export const isUnmeteredTool = (tool: string): boolean => tool === "measure.aligned";
