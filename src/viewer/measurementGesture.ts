type Position = { x: number; y: number };
export const HOLD_MS = 350, TARGET_OFFSET = 64;
/** A quick drag pans; a stationary hold starts precision placement. */
export class MeasurementGesture {
  private pointers = new Map<number, Position>();
  private start: Position | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private active = false;
  private blocked = false;
  constructor(private callbacks: {
    lock(locked: boolean): void;
    preview(position: Position | null): void;
    commit(position: Position, precision: boolean): void;
  }) {}
  down(id: number, position: Position): void {
    this.pointers.set(id, position);
    if (this.pointers.size > 1) { this.cancelPlacement(); this.blocked = true; return; }
    this.start = position; this.blocked = false;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.blocked && this.pointers.size === 1) {
        this.active = true; this.callbacks.lock(true);
        this.callbacks.preview(this.target(this.pointers.get(id)!));
      }
    }, HOLD_MS);
  }
  move(id: number, position: Position): void {
    if (!this.pointers.has(id)) return;
    this.pointers.set(id, position);
    if (this.active) this.callbacks.preview(this.target(position));
    else if (this.start && Math.hypot(position.x - this.start.x, position.y - this.start.y) > 8) {
      this.cancelPlacement(); this.blocked = true;
    }
  }
  up(id: number, position: Position): void {
    if (!this.pointers.has(id)) return;
    const precision = this.active, pick = !this.blocked && this.pointers.size === 1;
    this.cancelPlacement(); this.pointers.delete(id);
    if (pick) this.callbacks.commit(precision ? this.target(position) : position, precision);
    if (!this.pointers.size) this.blocked = false;
  }
  cancel(id?: number): void {
    this.cancelPlacement(); this.blocked = true;
    if (id === undefined) this.pointers.clear(); else this.pointers.delete(id);
  }
  private target(p: Position): Position { return { x: p.x, y: p.y - TARGET_OFFSET }; }
  private cancelPlacement(): void {
    clearTimeout(this.timer); this.timer = undefined; this.active = false;
    this.callbacks.lock(false); this.callbacks.preview(null);
  }
}
