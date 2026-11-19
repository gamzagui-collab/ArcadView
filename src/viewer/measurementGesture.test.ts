import { afterEach, expect, it, vi } from "vitest";
import { HOLD_MS, MeasurementGesture } from "./measurementGesture";
afterEach(() => vi.useRealTimers());
const setup = () => { vi.useFakeTimers(); const c = { lock: vi.fn(), preview: vi.fn(), commit: vi.fn() }; return { c, g: new MeasurementGesture(c) }; };
it("previews above the finger, follows dragging, and commits only on release", () => {
  const { c, g } = setup(); g.down(1, { x: 80, y: 200 }); vi.advanceTimersByTime(HOLD_MS);
  expect(c.preview).toHaveBeenLastCalledWith({ x: 80, y: 136 }); expect(c.commit).not.toHaveBeenCalled();
  g.move(1, { x: 120, y: 240 }); expect(c.preview).toHaveBeenLastCalledWith({ x: 120, y: 176 });
  g.up(1, { x: 120, y: 240 }); expect(c.commit).toHaveBeenCalledWith({ x: 120, y: 176 }, true);
  expect(c.lock).toHaveBeenLastCalledWith(false); expect(c.preview).toHaveBeenLastCalledWith(null);
});
it("preserves taps and quick drags for panning", () => {
  const { c, g } = setup(); g.down(1, { x: 10, y: 20 }); g.up(1, { x: 10, y: 20 });
  expect(c.commit).toHaveBeenCalledWith({ x: 10, y: 20 }, false); c.commit.mockClear();
  g.down(1, { x: 10, y: 20 }); g.move(1, { x: 30, y: 20 }); vi.advanceTimersByTime(1000); g.up(1, { x: 30, y: 20 });
  expect(c.commit).not.toHaveBeenCalled(); expect(c.lock).not.toHaveBeenCalledWith(true);
});
it("cancels precision placement for pinch, pointer cancellation and teardown", () => {
  const { c, g } = setup(); g.down(1, { x: 80, y: 200 }); vi.advanceTimersByTime(HOLD_MS);
  g.down(2, { x: 180, y: 200 }); g.up(2, { x: 180, y: 200 }); g.up(1, { x: 80, y: 200 });
  expect(c.commit).not.toHaveBeenCalled(); expect(c.lock).toHaveBeenLastCalledWith(false);
  g.down(3, { x: 10, y: 10 }); g.cancel(); vi.advanceTimersByTime(1000); g.up(3, { x: 10, y: 10 }); expect(c.commit).not.toHaveBeenCalled();
});
