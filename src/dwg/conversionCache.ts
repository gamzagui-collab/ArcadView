import { getDrawingUnitKey } from "../viewer/drawingUnitPreferences";
import { getSavedDrawingView, normalizeSavedDrawingView, registerSavedDrawingView, type SavedDrawingView } from "../viewer/savedView";
import { replaceExtension, MAX_CONVERTED_DXF_BYTES, MAX_DERIVED_CACHE_BYTES } from "../files/fileTypes";

export const DWG_CACHE_VERSION = "libredwg-web-0.9.0-xclip-v2";
const DATABASE = "izcad-dwg-conversion-cache";
const MAX_CACHE_BYTES = MAX_DERIVED_CACHE_BYTES;
type Entry = { id: string; blob: Blob; view: SavedDrawingView | null; bytes: number; accessed: number };
const statuses = new WeakMap<File, "hit" | "converted">();
const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const finished = (t: IDBTransaction) => new Promise<void>((resolve, reject) => { t.oncomplete = () => resolve(); t.onabort = t.onerror = () => reject(t.error); });
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DATABASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("entries", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); r.onblocked = () => reject(new Error("DWG cache blocked"));
  });
}
async function read(id: string): Promise<Entry | undefined> {
  const db = await open();
  try { const tx = db.transaction("entries", "readonly"), done = finished(tx), entry = await request<Entry | undefined>(tx.objectStore("entries").get(id)); await done; return entry; }
  finally { db.close(); }
}
async function store(entry: Entry): Promise<void> {
  const db = await open();
  try {
    const tx = db.transaction("entries", "readwrite"), done = finished(tx), table = tx.objectStore("entries");
    const r = table.getAll();
    r.onsuccess = () => {
      const others = (r.result as Entry[]).filter(e => e.id !== entry.id).sort((a, b) => b.accessed - a.accessed);
      let bytes = entry.bytes, count = 1;
      for (const other of others) {
        if (bytes + other.bytes > MAX_CACHE_BYTES || count >= 8) table.delete(other.id);
        else { bytes += other.bytes; count++; }
      }
      table.put(entry);
    };
    await done;
  } finally { db.close(); }
}
const cancelled = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException("DWG conversion was cancelled.", "AbortError"); };
export function getDwgCacheStatus(file: File): "hit" | "converted" | undefined { return statuses.get(file); }

/** Only generated DXFs are cached. Source drawings and the drawing library are untouched. */
export async function cachedDwgConversion(source: File, convert: () => Promise<File>, signal?: AbortSignal, onConversionStart?: () => void): Promise<File> {
  cancelled(signal);
  const key = getDrawingUnitKey(source), id = key ? `${DWG_CACHE_VERSION}:${key}` : undefined;
  if (id && globalThis.indexedDB) {
    try {
      const entry = await read(id); cancelled(signal);
      if (entry?.blob instanceof Blob && entry.bytes === entry.blob.size && entry.bytes > 0 && entry.bytes <= MAX_CONVERTED_DXF_BYTES) {
        const prefix = await entry.blob.slice(0, 4096).text(); cancelled(signal);
        if (/SECTION/.test(prefix)) {
          const file = new File([entry.blob], replaceExtension(source.name, "dxf"), { type: "application/dxf", lastModified: source.lastModified });
          registerSavedDrawingView(file, entry.view ? normalizeSavedDrawingView(entry.view) : null);
          statuses.set(file, "hit");
          await store({ ...entry, accessed: Date.now() }).catch(() => undefined);
          cancelled(signal); return file;
        }
      }
    } catch { cancelled(signal); }
  }
  cancelled(signal); onConversionStart?.();
  const file = await convert(); cancelled(signal);
  statuses.set(file, "converted");
  if (id && globalThis.indexedDB && file.size <= MAX_CONVERTED_DXF_BYTES) {
    try { await store({ id, blob: file.slice(), bytes: file.size, view: getSavedDrawingView(file), accessed: Date.now() }); }
    catch (error) { console.warn("Could not save generated DWG conversion cache.", error); }
  }
  cancelled(signal); return file;
}
