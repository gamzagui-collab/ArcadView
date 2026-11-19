import type { MeasurementUnit } from "./measurementGeometry";

export type DrawingUnitPreference = { sourceUnit: MeasurementUnit; displayUnit: MeasurementUnit };
const PREFIX = "izcad.measurement-units.v1.";
const CHUNK_BYTES = 1024 * 1024;
const MAX_BYTES = 128 * 1024 * 1024;
const keys = new WeakMap<File, string | null>();
const validKey = (key: string) => /^v1-[a-f0-9]{64}$/.test(key);
const units: readonly string[] = ["drawing", "mm", "cm", "m", "in", "ft"];
const cancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException("Drawing identification was cancelled.", "AbortError");
};

/** SHA-256 of a versioned size header and ordered 1 MiB chunk hashes.
 * Every byte participates; names, dates and MIME types do not. This versioned
 * fingerprint is distinct from the raw file's standard SHA-256 digest.
 */
export async function prepareDrawingUnitKey(file: File, signal?: AbortSignal): Promise<string | undefined> {
  cancelled(signal);
  if (keys.has(file)) return keys.get(file) ?? undefined;
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_BYTES || !globalThis.crypto?.subtle) return undefined;
  try {
    const header = new TextEncoder().encode(`izcad-unit-fingerprint-v1\n${file.size}\n${CHUNK_BYTES}\n`);
    const hashes = new Uint8Array(header.length + Math.ceil(file.size / CHUNK_BYTES) * 32);
    hashes.set(header);
    let offset = header.length;
    for (let start = 0; start < file.size; start += CHUNK_BYTES) {
      cancelled(signal);
      const end = Math.min(start + CHUNK_BYTES, file.size);
      const bytes = await file.slice(start, end).arrayBuffer();
      cancelled(signal);
      if (bytes.byteLength !== end - start) throw new Error("Incomplete drawing read");
      hashes.set(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), offset);
      cancelled(signal);
      offset += 32;
    }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", hashes));
    cancelled(signal);
    const key = "v1-" + Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
    if (!validKey(key)) throw new Error("Invalid drawing fingerprint");
    keys.set(file, key);
    return key;
  } catch (error) {
    cancelled(signal);
    console.warn("Could not identify drawing for saved measurement units.", error);
    return undefined;
  }
}

/** A generated DXF retains its original DWG identity. */
export function bindDrawingUnitKey(renderFile: File, key: string | undefined): void {
  keys.set(renderFile, key && validKey(key) ? key : null);
}
export function getDrawingUnitKey(file: File): string | undefined { return keys.get(file) ?? undefined; }

function validPreference(value: unknown): value is DrawingUnitPreference {
  if (!value || typeof value !== "object") return false;
  const p = value as DrawingUnitPreference;
  return units.includes(p.sourceUnit) && units.includes(p.displayUnit) &&
    (p.sourceUnit !== "drawing" || p.displayUnit === "drawing");
}
export function readDrawingUnitPreference(key: string | undefined): DrawingUnitPreference | undefined {
  if (!key || !validKey(key)) return undefined;
  try {
    const text = globalThis.localStorage?.getItem(PREFIX + key);
    if (!text || text.length > 128) return undefined;
    const value: unknown = JSON.parse(text);
    return validPreference(value) ? { sourceUnit: value.sourceUnit, displayUnit: value.displayUnit } : undefined;
  } catch { return undefined; }
}
export function saveDrawingUnitPreference(key: string | undefined, value: DrawingUnitPreference): boolean {
  if (!key || !validKey(key) || !validPreference(value)) return false;
  try {
    if (!globalThis.localStorage) throw new Error("Drawing unit storage is unavailable");
    globalThis.localStorage.setItem(PREFIX + key, JSON.stringify({ sourceUnit: value.sourceUnit, displayUnit: value.displayUnit }));
    return true;
  } catch (error) {
    console.warn("Could not save drawing measurement units.", error);
    return false;
  }
}
