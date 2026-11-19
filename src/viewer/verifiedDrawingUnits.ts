import type { MeasurementUnit } from "./measurementGeometry";
import { bindDrawingUnitKey, getDrawingUnitKey, prepareDrawingUnitKey, readDrawingUnitPreference } from "./drawingUnitPreferences";

// The same reviewed original DWG (raw SHA-256 d623b790...45bd15f60), now
// identified using the bounded-memory content fingerprint shared by all files.
const verifiedDrawings: Readonly<Record<string, MeasurementUnit>> = {
  "v1-c9b45ea3ad4533f563f6f87d8b6ea382693f68e6d4f1a39e3f3bc4a923e3f74d": "mm",
};
function checkCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException("DWG conversion was cancelled.", "AbortError");
}

/** Bind reviewed source units to its generated File without editing either file. */
export async function convertWithVerifiedDrawingUnits(
  source: File, convert: () => Promise<File>, signal?: AbortSignal,
): Promise<File> {
  const key = await prepareDrawingUnitKey(source, signal);
  checkCancelled(signal);
  const renderFile = await convert();
  checkCancelled(signal);
  bindDrawingUnitKey(renderFile, key);
  return renderFile;
}

export function resolveDrawingMeasurementUnit(file: File, declaredUnit: MeasurementUnit): MeasurementUnit {
  const key = getDrawingUnitKey(file), preference = readDrawingUnitPreference(key);
  if (preference) return preference.sourceUnit;
  return declaredUnit === "drawing" ? (key && verifiedDrawings[key]) || declaredUnit : declaredUnit;
}
export function resolveDrawingDisplayUnit(file: File, sourceUnit: MeasurementUnit): MeasurementUnit {
  return readDrawingUnitPreference(getDrawingUnitKey(file))?.displayUnit ?? sourceUnit;
}
