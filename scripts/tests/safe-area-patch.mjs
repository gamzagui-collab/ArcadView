import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { UPSTREAM_INJECTION, SAFE_AREA_INJECTION, patchSafeAreaSource } from "../patch-capacitor-safe-area.mjs";

function page(root = null, readyState = "loading") {
  const values = new Map(), errors = [], listeners = [];
  const element = { style: { setProperty: (name, value) => values.set(name, value) } };
  const document = { documentElement: root ? element : null, readyState, addEventListener(type, fn, options) { listeners.push({ type, fn, options }); } };
  const inject = (insets) => { let i = 0; runInNewContext(SAFE_AREA_INJECTION.replaceAll("%d", () => String(insets[i++])), { document, console: { error: (...args) => errors.push(args) } }); };
  const ready = () => { document.documentElement = element; document.readyState = "interactive"; for (const listener of listeners.splice(0)) { assert.equal(listener.type, "DOMContentLoaded"); assert.equal(listener.options.once, true); listener.fn(); } };
  return { document, element, values, errors, listeners, inject, ready };
}
const sides = ["top", "right", "bottom", "left"];
const read = p => sides.map(s => p.values.get("--safe-area-inset-" + s));

test("ready documents receive all four native CSS values immediately", () => {
  const p = page(true); p.inject([24, 2, 12, 4]);
  assert.deepEqual(read(p), ["24px", "2px", "12px", "4px"]); assert.equal(p.listeners.length, 0); assert.deepEqual(p.errors, []);
});
test("early native updates coalesce until the HTML root exists", () => {
  const p = page(); p.inject([0, 0, 0, 0]); p.inject([25, 3, 13, 5]);
  assert.equal(p.values.size, 0); assert.equal(p.listeners.length, 1); assert.deepEqual(p.errors, []);
  p.ready(); assert.deepEqual(read(p), ["25px", "3px", "13px", "5px"]); assert.equal(p.listeners.length, 0);
});
test("an older pending DOM event cannot overwrite a newer inset update", () => {
  const p = page(); p.inject([1, 1, 1, 1]); p.document.documentElement = p.element; p.inject([10, 20, 30, 40]);
  p.ready(); assert.deepEqual(read(p), ["10px", "20px", "30px", "40px"]);
});
test("a detached document does not throw or start indefinite retries", () => {
  const p = page(null, "complete"); p.inject([1, 2, 3, 4]); assert.equal(p.listeners.length, 0); assert.deepEqual(p.errors, []);
  const next = page(); next.inject([4, 3, 2, 1]); next.ready(); assert.deepEqual(read(next), ["4px", "3px", "2px", "1px"]);
});
test("real style failures still reach the existing console error handler", () => {
  const p = page(true); p.element.style.setProperty = () => { throw new Error("style failed"); }; p.inject([0, 0, 0, 0]);
  assert.equal(p.errors.length, 1); assert.equal(p.errors[0][0], "Error injecting safe area CSS:"); assert.match(p.errors[0][1].message, /style failed/);
});
test("source patch preserves surrounding code, line endings and repeat installs", () => {
  for (const newline of ["\n", "\r\n"]) {
    const source = ("before\n" + UPSTREAM_INJECTION + "\nafter").replaceAll("\n", newline);
    const patched = patchSafeAreaSource(source, "8.4.3"); assert.equal(patched, ("before\n" + SAFE_AREA_INJECTION + "\nafter").replaceAll("\n", newline)); assert.equal(patchSafeAreaSource(patched, "8.4.3"), patched);
  }
});
test("changed dependency versions, missing blocks and partial patches fail the build", () => {
  assert.throws(() => patchSafeAreaSource(UPSTREAM_INJECTION, "8.5.0"));
  assert.throws(() => patchSafeAreaSource("other code", "8.4.3"));
  assert.throws(() => patchSafeAreaSource(UPSTREAM_INJECTION.repeat(2), "8.4.3"));
  assert.throws(() => patchSafeAreaSource(SAFE_AREA_INJECTION.replace("state.values =", "state.oldValues ="), "8.4.3"));
});
