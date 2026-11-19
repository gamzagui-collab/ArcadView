import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {patchDwgMemoryFailure} from '../dwg-memory-runtime.mjs';
const original=await readFile(new URL('../../node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.js',import.meta.url),'utf8');
function resize(grow,max=4096){
 const source=patchDwgMemoryFailure(original),body=source.match(/function _emscripten_resize_heap.*?\}var ENV=\{\};/)[0];
 const failures=[],context={HEAPU8:{length:1024},getHeapMax:()=>max,alignMemory:n=>n,growMemory:grow,Module:{onMemoryGrowthFailed:n=>failures.push(n)}};
 vm.runInNewContext(body,context);return {run:n=>context._emscripten_resize_heap(n),failures};
}
test('only final allocation failure is reported after all three growth attempts',()=>{let attempts=0;const r=resize(()=>{attempts++;return false});assert.equal(r.run(1500),false);assert.equal(attempts,3);assert.deepEqual(r.failures,[1500]);});
test('successful fallback growth and ordinary reads do not report out of memory',()=>{let attempts=0;const r=resize(()=>++attempts===2);assert.equal(r.run(1500),true);assert.deepEqual(r.failures,[]);});
test('engine hard maximum fails immediately and patch is guarded and idempotent',()=>{const r=resize(()=>assert.fail('must not attempt growth'));assert.equal(r.run(5000),false);assert.deepEqual(r.failures,[5000]);assert.equal(patchDwgMemoryFailure(patchDwgMemoryFailure(original)),patchDwgMemoryFailure(original));assert.throws(()=>patchDwgMemoryFailure('changed runtime'));});
