import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrawingViewer } from "./DrawingViewer";
import { registerSavedDrawingView } from "./savedView";

const state = vi.hoisted(() => ({
  hasRenderer: true,
  load: vi.fn(),
  current: null as any,
}));

vi.mock("dxf-viewer", async () => {
  const { Scene, OrthographicCamera } = await import("three");
  return {
    DxfViewer: class {
      scene = new Scene();
      options: Record<string, unknown>;
      camera = new OrthographicCamera();
      canvas = Object.assign(new EventTarget(), { width: 100, height: 200, remove: vi.fn() });
      renderer = { forceContextLoss: vi.fn() };
      Clear = vi.fn();
      Destroy = vi.fn();
      Render = vi.fn();
      FitView = vi.fn();
      SetView = vi.fn();

      constructor(_container: HTMLElement, options: Record<string, unknown>) {
        this.options = options;
        state.current = this;
      }

      HasRenderer() { return state.hasRenderer; }
      GetCanvas() { return this.canvas; }
      GetRenderer() { return this.renderer; }
      GetCamera() { return this.camera; }
      GetBounds() { return { minX: 0, minY: 0, maxX: 100, maxY: 100 }; }
      GetOrigin() { return { x: 0, y: 0 }; }
      Load(params: { workerFactory(): Worker }) {
        params.workerFactory();
        return state.load(params);
      }
    },
  };
});

class FakeWorker extends EventTarget {
  static current: FakeWorker;
  terminate = vi.fn();
  constructor() {
    super();
    FakeWorker.current = this;
  }
}

class FakeErrorEvent extends Event {
  message = "Worker could not start";
}

describe("drawing viewer lifecycle", () => {
  it("releases owned packed buffers even when a parent still holds the old geometry", async () => {
    const viewer = new DrawingViewer({} as HTMLElement);
    await viewer.load(new File(["0\nEOF\n"], "test.dxf"), vi.fn());
    const previous = viewer.getMeasurementGeometry();
    previous.packed = {data:[new Float64Array(7)],refs:[new Uint32Array(3)],points:[new Float64Array(4)],snaps:[new Float64Array(3)],extraSnaps:[new Float64Array(3)],extraSnapCount:1,snapSegments:[new Float64Array(4)],snapSegmentCount:1,kinds:["LINE"],entityCount:1,pointCount:2,snapCount:1};
    viewer.destroy();
    expect(previous.packed.data).toHaveLength(0); expect(previous.packed.points).toHaveLength(0);
    expect(previous.packed.refs).toHaveLength(0); expect(previous.packed.snaps).toHaveLength(0);
    expect(previous.packed.extraSnaps).toHaveLength(0);expect(previous.packed.snapSegments).toHaveLength(0);
  });
  beforeEach(() => {
    state.hasRenderer = true;
    state.load.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("ErrorEvent", FakeErrorEvent);
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("document", { baseURI: "http://localhost/" });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:drawing");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reports WebGL initialization failures with the render error code", () => {
    state.hasRenderer = false;
    expect(() => new DrawingViewer({} as HTMLElement)).toThrowError(
      expect.objectContaining({ code: "RENDER_FAILED" }),
    );
  });

  it("reads the saved code page and releases the input URL after loading", async () => {
    const viewer = new DrawingViewer({} as HTMLElement);
    await viewer.load(new File(["9\n$ACADVER\n1\nAC1018\n9\n$DWGCODEPAGE\n3\nANSI_1254\n"], "old.dxf"), vi.fn());
    expect(state.current.options.fileEncoding).toBe("windows-1254");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:drawing");
    viewer.destroy();
    viewer.destroy();
    expect(state.current.Destroy).toHaveBeenCalledOnce();
    expect(state.current.renderer.forceContextLoss).toHaveBeenCalledOnce();
    expect(state.current.canvas.remove).toHaveBeenCalledOnce();
  });

  it("settles cancelled loading even when the underlying worker never replies", async () => {
    state.load.mockReturnValue(new Promise(() => {}));
    const progress = vi.fn();
    const viewer = new DrawingViewer({} as HTMLElement);
    const loading = viewer.load(new File(["0\nEOF\n"], "test.dxf"), progress);
    const cancelled = expect(loading).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(state.load).toHaveBeenCalledOnce());
    const params = state.load.mock.calls[0][0];
    viewer.destroy();
    await cancelled;
    params.progressCbk("prepare", 1, 2);
    expect(progress).not.toHaveBeenCalled();
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it("rejects a crashed worker and releases its URL immediately", async () => {
    state.load.mockReturnValue(new Promise(() => {}));
    const viewer = new DrawingViewer({} as HTMLElement);
    const loading = viewer.load(new File(["0\nEOF\n"], "test.dxf"), vi.fn());
    const failed = expect(loading).rejects.toMatchObject({ code: "DXF_OPEN_FAILED" });
    await vi.waitFor(() => expect(state.load).toHaveBeenCalledOnce());
    FakeWorker.current.dispatchEvent(new FakeErrorEvent("error"));
    await failed;
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    viewer.destroy();
  });

  it("times out a worker which never completes", async () => {
    vi.useFakeTimers();
    state.load.mockReturnValue(new Promise(() => {}));
    const viewer = new DrawingViewer({} as HTMLElement);
    const loading = viewer.load(new File(["0\nEOF\n"], "test.dxf"), vi.fn());
    const failed = expect(loading).rejects.toMatchObject({ code: "DXF_OPEN_FAILED" });
    await vi.waitFor(() => expect(state.load).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
    await failed;
    expect(FakeWorker.current.terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    viewer.destroy();
  });

  it("cancels an older request without clearing the newer successful drawing", async () => {
    state.load.mockReturnValueOnce(new Promise(() => {}));
    const viewer = new DrawingViewer({} as HTMLElement);
    const first = viewer.load(new File(["0\nEOF\n"], "first.dxf"), vi.fn());
    const cancelled = expect(first).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(state.load).toHaveBeenCalledOnce());
    await viewer.load(new File(["0\nEOF\n"], "second.dxf"), vi.fn());
    await cancelled;
    expect(state.current.Clear).not.toHaveBeenCalled();
    viewer.execute("zoom-in");
    expect(state.current.camera.zoom).toBe(1.25);
    viewer.destroy();
  });

  it("reports context loss and removes its handler when destroyed", async () => {
    const onError = vi.fn();
    const viewer = new DrawingViewer({} as HTMLElement, onError);
    await viewer.load(new File(["0\nEOF\n"], "test.dxf"), vi.fn());
    const canvas: EventTarget = state.current.canvas;
    const event = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "RENDER_FAILED" }));
    viewer.destroy();
    canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(onError).toHaveBeenCalledOnce();
  });

  it("fits initial and toolbar views inside overlay bounds using CSS height rather than device pixels", async () => {
    const viewer = new DrawingViewer({} as HTMLElement);
    const canvas = state.current.canvas;
    canvas.clientHeight = 800;
    canvas.height = 1600;
    canvas.getBoundingClientRect = () => ({ top: 0, bottom: 800 });
    canvas.parentElement = { parentElement: {
      querySelector: (selector: string) => ({
        getBoundingClientRect: () => selector === ".viewer-header"
          ? { bottom: 110 }
          : { top: 690, width: 400, height: 70 },
      }),
    } };
    await viewer.load(new File(["0\nEOF\n"], "test.dxf"), vi.fn());
    const expectedPadding = 800 / (800 - 2 * 118) - 1;
    expect(state.current.FitView).toHaveBeenCalledWith(0, 100, 0, 100, expectedPadding);
    viewer.execute("fit");
    viewer.execute("reset");
    expect(state.current.FitView).toHaveBeenCalledTimes(3);
    viewer.destroy();
  });

  it("finds overlays through canvas wrappers and ignores a vertical desktop toolbar", async () => {
    const viewer = new DrawingViewer({} as HTMLElement);
    const canvas = state.current.canvas;
    canvas.clientHeight = 800;
    canvas.getBoundingClientRect = () => ({ top: 0, bottom: 800 });
    canvas.parentElement = { parentElement: { querySelector: () => null } };
    canvas.closest = vi.fn().mockReturnValue({
      querySelector: (selector: string) => ({
        getBoundingClientRect: () => selector === ".viewer-header"
          ? { bottom: 70 }
          : { top: 200, width: 64, height: 250 },
      }),
    });
    await viewer.load(new File(["0\nEOF\n"], "test.dxf"), vi.fn());
    expect(canvas.closest).toHaveBeenCalledWith(".viewer-shell");
    expect(state.current.FitView).toHaveBeenCalledWith(0, 100, 0, 100, 0.25);
    viewer.destroy();
  });

  it("preserves a valid saved camera instead of replacing it with automatic fit", async () => {
    const file = new File(["0\nEOF\n"], "saved.dxf");
    registerSavedDrawingView(file, {
      center: { x: 50, y: 50 },
      viewHeight: 40,
      aspectRatio: 1,
    });
    const viewer = new DrawingViewer({} as HTMLElement);
    await viewer.load(file, vi.fn());
    expect(state.current.FitView).not.toHaveBeenCalled();
    expect(state.current.SetView).toHaveBeenCalledOnce();
    viewer.destroy();
  });

  it("cancels deferred initial fitting when the drawing closes", async () => {
    const frame = vi.fn().mockReturnValue(12);
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", frame);
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const viewer = new DrawingViewer({} as HTMLElement);
    await viewer.load(new File(["0\nEOF\n"], "test.dxf"), vi.fn());
    expect(frame).toHaveBeenCalledOnce();
    viewer.destroy();
    expect(cancel).toHaveBeenCalledWith(12);
  });

  it("uses a compact index without retaining the full source document", async () => {
    const geometry = { units: "mm", snaps: [], entities: [], limited: false, completeBounds: false };
    state.load.mockImplementation(async () => { state.current.parsedDxf = { izcadMeasurement: geometry }; });
    const viewer = new DrawingViewer({} as HTMLElement);
    await viewer.load(new File(["0\nEOF\n"], "test.dxf"), vi.fn());
    expect(viewer.getMeasurementGeometry()).toBe(geometry);
    expect(state.current.parsedDxf).toBeNull();
    viewer.destroy();
  });

  it("measures taps in drawing coordinates and ignores dragging and pinch gestures", async () => {
    const pick = vi.fn();
    const viewer = new DrawingViewer({} as HTMLElement, undefined, pick);
    await viewer.load(new File(["0\nEOF\n"], "test.dxf"), vi.fn());
    const canvas = state.current.canvas;
    canvas.getBoundingClientRect = () => ({ left: 20, top: 10, width: 100, height: 200 });
    state.current.camera.updateProjectionMatrix();
    const emit = (type: string, id: number, x: number, y: number) => {
      canvas.dispatchEvent(Object.assign(new Event(type), { pointerId: id, clientX: x, clientY: y, pointerType: "touch", button: 0 }));
    };
    viewer.configureMeasurement({ enabled: true, mode: "distance", points: [], snapping: true, entity: null });
    emit("pointerdown", 1, 70, 110); emit("pointerup", 1, 70, 110);
    expect(pick).toHaveBeenCalledOnce();
    expect(pick.mock.calls[0][0].point).toEqual({ x: 0, y: 0 });
    emit("pointerdown", 1, 70, 110); emit("pointermove", 1, 90, 130); emit("pointermove", 1, 70, 110); emit("pointerup", 1, 70, 110);
    expect(pick).toHaveBeenCalledOnce();
    emit("pointerdown", 1, 70, 110); emit("pointerdown", 2, 80, 100); emit("pointerup", 1, 70, 110); emit("pointerup", 2, 80, 100);
    expect(pick).toHaveBeenCalledOnce();
    emit("pointerdown", 1, 70, 110); emit("pointerup", 1, 70, 110);
    expect(pick).toHaveBeenCalledTimes(2);
    viewer.configureMeasurement({ enabled: false, mode: "distance", points: [], snapping: true, entity: null });
    emit("pointerdown", 1, 70, 110); emit("pointerup", 1, 70, 110);
    expect(pick).toHaveBeenCalledTimes(2);
    viewer.destroy();
  });

  it("updates measurement projections synchronously in the drawing Render call and stops on close", async () => {
    const changed = vi.fn();
    const viewer = new DrawingViewer({} as HTMLElement, undefined, undefined, changed);
    await viewer.load(new File(["0\nEOF\n"], "test.dxf"), vi.fn());
    changed.mockClear();
    state.current.camera.position.x = 100;
    state.current.Render();
    expect(changed).toHaveBeenCalledOnce();
    expect(state.current.camera.matrixWorldInverse.elements[12]).toBe(-100);
    viewer.destroy();
    state.current.Render();
    expect(changed).toHaveBeenCalledOnce();
  });
});
