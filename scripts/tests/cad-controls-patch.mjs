import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { patchCadControls } from "../patch-cad-controls.mjs";
const fixture="// Original license stays.\n"+["onTouchStart","onTouchMove"].map(name=>`function ${name}(event){\n\t\tevent.preventDefault(); // prevent scrolling\n pan();\n}`).join("\n");
test("non-cancelable touches keep pan handling without calling preventDefault",()=>{
  const patched=patchCadControls(fixture);assert.equal(patchCadControls(patched),patched);assert.ok(patched.includes("// Original license stays."));
  for(const cancelable of[false,true]){let pans=0,cancels=0;const context={pan:()=>pans++};runInNewContext(patched,context);const event={cancelable,preventDefault(){cancels++;if(!cancelable)throw Error("Cannot cancel");}};context.onTouchStart(event);context.onTouchMove(event);assert.equal(pans,2);assert.equal(cancels,cancelable?2:0);}
});
test("a changed dependency cannot receive an unreviewed or partial patch",()=>{
  assert.throws(()=>patchCadControls(fixture.replace("event.preventDefault(); // prevent scrolling","different();")));
  assert.throws(()=>patchCadControls(patchCadControls(fixture).replace("if ( event.cancelable )","if ( changed )")));
});
