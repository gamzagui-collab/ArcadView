import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Keep Capacitor 8.4.3's native inset calculation, padding and error reporting.
// Only its injected JavaScript must wait for the HTML root during navigation.
export const UPSTREAM_INJECTION = `                    try {
                      document.documentElement.style.setProperty("--safe-area-inset-top", "%dpx");
                      document.documentElement.style.setProperty("--safe-area-inset-right", "%dpx");
                      document.documentElement.style.setProperty("--safe-area-inset-bottom", "%dpx");
                      document.documentElement.style.setProperty("--safe-area-inset-left", "%dpx");
                    } catch(e) { console.error('Error injecting safe area CSS:', e); }`;

export const SAFE_AREA_INJECTION = `                    // Arcad View: document-ready safe area injection (8.4.3).
                    (() => {
                      const state = document.__arcadSafeAreaInsets || (document.__arcadSafeAreaInsets = { waiting: false });
                      state.values = ["%dpx", "%dpx", "%dpx", "%dpx"];
                      const apply = () => {
                        const root = document.documentElement;
                        if (!root) {
                          if (document.readyState === "loading" && !state.waiting) {
                            state.waiting = true;
                            document.addEventListener("DOMContentLoaded", () => {
                              state.waiting = false;
                              apply();
                            }, { once: true });
                          }
                          return;
                        }
                        try {
                          ["top", "right", "bottom", "left"].forEach((side, i) => {
                            root.style.setProperty("--safe-area-inset-" + side, state.values[i]);
                          });
                        } catch(e) { console.error('Error injecting safe area CSS:', e); }
                      };
                      apply();
                    })();`;

export function patchSafeAreaSource(source, version) {
  if (version !== "8.4.3") throw new Error("Review the safe area workaround before changing Capacitor Android 8.4.3.");
  const normalized = source.replaceAll("\r\n", "\n");
  if (normalized.includes("Arcad View: document-ready safe area injection")) {
    if (!normalized.includes(SAFE_AREA_INJECTION)) throw new Error("Unexpected modified safe area injection.");
    return source;
  }
  if (normalized.split(UPSTREAM_INJECTION).length !== 2) throw new Error("Expected exactly one Capacitor 8.4.3 safe area injection block.");
  const patched = normalized.replace(UPSTREAM_INJECTION, SAFE_AREA_INJECTION);
  return source.includes("\r\n") ? patched.replaceAll("\n", "\r\n") : patched;
}

export async function patchCapacitorSafeArea() {
  const dependency = new URL("../node_modules/@capacitor/android/", import.meta.url);
  const { version } = JSON.parse(await readFile(new URL("package.json", dependency), "utf8"));
  const path = new URL("capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java", dependency);
  const source = await readFile(path, "utf8"), patched = patchSafeAreaSource(source, version);
  if (patched !== source) await writeFile(path, patched, "utf8");
  console.log("Capacitor 8.4.3 safe area: document-ready injection verified.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await patchCapacitorSafeArea();
