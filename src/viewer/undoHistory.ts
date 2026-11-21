/** Immutable snapshots; a new edit after undo starts a new history branch. */
export class UndoHistory<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private readonly limit = 30) {}
  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  record(current: T): void {
    this.past.push(current);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: T): T | undefined {
    if (!this.canUndo) return undefined;
    this.future.push(current);
    return this.past.pop();
  }
  redo(current: T): T | undefined {
    if (!this.canRedo) return undefined;
    this.past.push(current);
    return this.future.pop();
  }
  clear(): void { this.past = []; this.future = []; }
}
export type EditHistoryState = { canUndo: boolean; canRedo: boolean; selecting?: boolean; canDelete?: boolean };
export type EditCommand = "undo" | "redo" | "cancel";
