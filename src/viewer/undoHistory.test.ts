import { expect, it } from "vitest";
import { UndoHistory } from "./undoHistory";
it("restores complete documents in both directions and drops only the abandoned redo branch", () => {
  const h = new UndoHistory<{ text: string; color: string }>();
  const a = {text:"한",color:"#49cfff"}, b = {...a,text:"한글"}, c = {...b,color:"#ff3366"};
  h.record(a);h.record(b);
  expect(h.undo(c)).toBe(b);expect(h.undo(b)).toBe(a);expect(h.canUndo).toBe(false);
  expect(h.redo(a)).toBe(b);expect(h.redo(b)).toBe(c);
  expect(h.undo(c)).toBe(b);h.record(b);expect(h.canRedo).toBe(false);
  expect(h.undo({...b,text:"새 분기"})).toBe(b);
});
it("bounds memory and clears history when a drawing is closed", () => {
  const h = new UndoHistory<number>(2);h.record(1);h.record(2);h.record(3);
  expect(h.undo(4)).toBe(3);expect(h.undo(3)).toBe(2);expect(h.undo(2)).toBeUndefined();
  h.clear();expect(h.canUndo).toBe(false);expect(h.canRedo).toBe(false);
});
