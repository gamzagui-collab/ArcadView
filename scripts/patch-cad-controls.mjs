import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const original="\t\tevent.preventDefault(); // prevent scrolling";
const guarded="\t\tif ( event.cancelable ) event.preventDefault(); // prevent scrolling";
const notice="// Arcad View / GUI's Arc Industry, 2026-11-20: guard non-cancelable touch events.\n";
export function patchCadControls(source){
  const text=source.replaceAll("\r\n","\n");
  if(text.startsWith(notice)){
    if(text.split(guarded).length!==3||text.includes(original))throw Error("CAD touch guard changed; review required.");
    return text;
  }
  if(text.split(original).length!==3||text.includes(guarded))throw Error("Unsupported CAD touch handlers; review required.");
  return notice+text.replaceAll(original,guarded);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const directory=resolve("node_modules/dxf-viewer");
  const pkg=JSON.parse(await readFile(resolve(directory,"package.json"),"utf8"));
  if(pkg.version!=="1.0.48")throw Error("The CAD touch guard requires dxf-viewer 1.0.48; review required.");
  const path=resolve(directory,"src/OrbitControls.js"),source=await readFile(path,"utf8"),next=patchCadControls(source);
  if(next!==source)await writeFile(path,next,"utf8");
  console.log("dxf-viewer 1.0.48: touch cancelability guards verified.");
}
