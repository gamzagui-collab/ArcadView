/** Surface failed WASM growth before C code can continue with a null malloc. */
export function patchDwgMemoryFailure(source) {
  if (source.includes('Module["onMemoryGrowthFailed"]')) return source;
  const pattern = /function _emscripten_resize_heap\(requestedSize\)\{.*?\}var ENV=\{\};/;
  const block = source.match(pattern)?.[0];
  if (!block || (block.match(/return false/g) ?? []).length !== 2) {
    throw Error("LibreDWG 0.9.0 memory-growth guard changed; review the runtime before building.");
  }
  return source.replace(block, block.replaceAll("return false", 'Module["onMemoryGrowthFailed"]?.(requestedSize);return false'));
}
