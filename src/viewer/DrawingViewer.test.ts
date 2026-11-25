import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrawingViewer } from "./DrawingViewer";
import { registerSavedDrawingView } from "./savedView";
import {buildMeasurementGeometry} from './measurementGeometry';
import {annotationGeometry} from './annotations';

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
  it('stabilizes held placement and the final release, but resets between gestures and respects snap OFF',async()=>{
    const picked=vi.fn(),preview=vi.fn(),viewer=new DrawingViewer({}as HTMLElement,undefined,picked,undefined,preview);
    await viewer.load(new File(['0\nEOF\n'],'stable.dxf'),vi.fn());vi.useFakeTimers();
    const native=state.current;Object.assign(native.canvas,{clientWidth:1000,clientHeight:2000,style:{},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:2000})});
    Object.assign(native.camera,{left:0,right:1000,top:1000,bottom:-1000});native.camera.updateProjectionMatrix();
    (viewer as any).geometry=buildMeasurementGeometry({entities:[0,6].map(y=>({type:'LINE',vertices:[{x:0,y},{x:1000,y}]}))}as any,{},undefined,true);
    const emit=(type:string,id:number,x=100,y=2.8)=>native.canvas.dispatchEvent(Object.assign(new Event(type),{pointerId:id,clientX:x,clientY:1000-y+64,pointerType:'touch',button:0}));
    const current=()=>preview.mock.calls.filter(c=>c[0]).at(-1)![0];
    viewer.configureMeasurement({enabled:true,mode:'distance',points:[],snapping:true,entity:null});
    emit('pointerdown',1);vi.advanceTimersByTime(350);expect(current().point.y).toBe(0);
    for(let i=0;i<20;i++){emit('pointermove',1,101+i,i%2?3.4:2.6);expect(current().point.y).toBe(0);expect(current().point.x).toBeCloseTo(101+i,7);}
    const displayed=current().point;emit('pointerup',1,120,3.4);expect(picked.mock.calls[0][0].point).toEqual(displayed);
    emit('pointerdown',2,120,3.4);vi.advanceTimersByTime(350);expect(current().point.y).toBe(6);emit('pointercancel',2);expect(picked).toHaveBeenCalledTimes(1);
    emit('pointerdown',3);vi.advanceTimersByTime(350);viewer.configureMeasurement({enabled:true,mode:'distance',points:[],snapping:false,entity:null});emit('pointermove',3,130,3.4);expect(current().snapped).toBeNull();expect(current().point.y).toBeCloseTo(3.4,7);emit('pointercancel',3);
    viewer.configureMeasurement({enabled:true,mode:'distance',points:[],snapping:true,entity:null});emit('pointerdown',4);vi.advanceTimersByTime(350);viewer.setBaseDrawingVisible(false);emit('pointermove',4,130,3.4);expect(current().snapped).toBeNull();emit('pointercancel',4);viewer.destroy();
  });
  it('shares weak midpoint and either-end perpendicular picks across tools, retaining OFF and completed-measurement behavior',async()=>{
    const viewer=new DrawingViewer({}as HTMLElement);await viewer.load(new File(['0\nEOF\n'],'weak.dxf'),vi.fn());
    const native=state.current;Object.assign(native.canvas,{clientWidth:1000,clientHeight:2000,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:2000})});
    Object.assign(native.camera,{left:0,right:10000,top:10000,bottom:-10000});native.camera.updateProjectionMatrix();
    (viewer as any).geometry=buildMeasurementGeometry({entities:[{type:'LINE',vertices:[{x:0,y:0},{x:10000,y:0}]},{type:'LINE',vertices:[{x:0,y:10000},{x:10000,y:0}]}]}as any,{},undefined,true);
    const pick=(x:number,y:number)=>(viewer as any).pickAt({x:x/10,y:(10000-y)/10},false),anchor={x:2000,y:0};
    for(const mode of['distance','linear','path','area','angle']as const){
      viewer.configureMeasurement({enabled:true,mode,points:[anchor],snapping:true,entity:null});
      expect(pick(2020,7990)).toMatchObject({point:{x:2000,y:8000},snapped:'perpendicular'});
      expect(pick(6020,3980)).toMatchObject({point:{x:6000,y:4000},snapped:'perpendicular'});
    }
    for(const owner of['annotations','takeoff']){viewer.setTakeoffMode(owner==='takeoff');viewer.configureAnnotations({tool:'polyline',points:[anchor],anchor,snapping:true,onPick:vi.fn(),onPreview:vi.fn()},owner);expect(pick(2020,7990)).toMatchObject({point:{x:2000,y:8000},snapped:'perpendicular'});viewer.configureAnnotations(null,owner);}
    viewer.configureMeasurement({enabled:true,mode:'distance',points:[],snapping:true,entity:null});expect(pick(5030,0)).toMatchObject({point:{x:5000,y:0},snapped:'midpoint'});
    viewer.configureMeasurement({enabled:true,mode:'distance',points:[anchor],snapping:false,entity:null});expect(pick(2020,7990).point.x).toBeCloseTo(2020,7);expect(pick(2020,7990).snapped).toBeNull();
    viewer.configureMeasurement({enabled:true,mode:'distance',points:[anchor,{x:2000,y:8000}],snapping:true,entity:null});expect(pick(2030,3000).snapped).toBeNull();
    viewer.destroy();
  });
  it('uses real arc tangents at both endpoints and caches the fixed endpoint references through a preview',async()=>{
    const viewer=new DrawingViewer({}as HTMLElement);await viewer.load(new File(['0\nEOF\n'],'arc-normal.dxf'),vi.fn());
    const native=state.current;Object.assign(native.canvas,{clientWidth:1000,clientHeight:2000,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:2000})});
    Object.assign(native.camera,{left:-5000,right:5000,top:10000,bottom:-10000});native.camera.updateProjectionMatrix();
    (viewer as any).geometry=buildMeasurementGeometry({entities:[1000,2000].map(radius=>({type:'ARC',center:{x:0,y:0},radius,startAngle:.1,endAngle:1.4}))}as any,{},undefined,true);
    const a=.63,anchor={x:1000*Math.cos(a),y:1000*Math.sin(a)},end={x:2000*Math.cos(a),y:2000*Math.sin(a)};
    viewer.configureMeasurement({enabled:true,mode:'distance',points:[anchor],snapping:true,entity:null});
    const pick=()=>(viewer as any).pickAt({x:(end.x+20+5000)/10,y:(10000-end.y+30)/10},false),p=pick();
    expect(p.snapped).toBe('perpendicular');expect(p.point.x).toBeCloseTo(end.x,6);expect(p.point.y).toBeCloseTo(end.y,6);
    const cached=(viewer as any).perpendicularReferences;pick();expect((viewer as any).perpendicularReferences).toBe(cached);
    expect(viewer.getMeasurementReferences()).toHaveLength(1);expect(viewer.getMeasurementEndReferences()).toHaveLength(1);
    native.canvas.style={};viewer.setBaseDrawingVisible(false);expect(viewer.getMeasurementReferences()).toHaveLength(0);expect(pick().snapped).toBeNull();
    viewer.setBaseDrawingVisible(true);expect(pick().snapped).toBe('perpendicular');viewer.destroy();expect((viewer as any).perpendicularReferences).toBeNull();
  });
  it('reads viewport bounds a bounded number of times even when thousands of snap candidates overlap',async()=>{
    const viewer=new DrawingViewer({}as HTMLElement);await viewer.load(new File(['0\nEOF\n'],'dense.dxf'),vi.fn());
    const canvas=state.current.canvas,rect=vi.fn(()=>({left:0,top:0,width:1000,height:200}));canvas.getBoundingClientRect=rect;
    Object.assign(state.current.camera,{left:0,right:10000,top:1000,bottom:-1000});state.current.camera.updateProjectionMatrix();
    (viewer as any).geometry=buildMeasurementGeometry({entities:Array.from({length:2000},(_,i)=>({type:'LINE',vertices:[{x:0,y:i*.001},{x:10000,y:i*.001}]}))}as any,{},undefined,true);
    viewer.configureMeasurement({enabled:true,mode:'area',points:[],snapping:true,entity:null});rect.mockClear();
    expect((viewer as any).pickAt({x:370,y:92},false).snapped).not.toBeNull();expect(rect.mock.calls.length).toBeLessThan(8);viewer.destroy();
  });
  it('shares exact nearest picks across measurement, drawing, takeoff and handles while excluding inactive takeoff geometry',async()=>{
    const picked=vi.fn(),viewer=new DrawingViewer({}as HTMLElement,undefined,picked);
    await viewer.load(new File(['0\nEOF\n'],'nearest.dxf'),vi.fn());
    const native=state.current,canvas=native.canvas;canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:200});
    Object.assign(native.camera,{left:0,right:10000,top:1000,bottom:-1000});native.camera.updateProjectionMatrix();
    (viewer as any).geometry=buildMeasurementGeometry({entities:[{type:'LINE',vertices:[{x:0,y:0},{x:10000,y:0}]}]}as any,{});
    const emit=()=>{for(const type of['pointerdown','pointerup'])canvas.dispatchEvent(Object.assign(new Event(type),{pointerId:1,clientX:370,clientY:92,pointerType:'touch',button:0}));};
    for(const mode of['distance','linear','path','area','angle']as const){viewer.configureAnnotations(null);viewer.configureMeasurement({enabled:true,mode,points:[],snapping:true,entity:null});emit();expect(picked.mock.calls.at(-1)![0]).toMatchObject({point:{x:3700,y:0},snapped:'edge'});}
    for(const tool of['polyline','circle','rectangle','dimension-aligned']){const onPick=vi.fn();viewer.configureAnnotations({tool,snapping:true,points:[],onPick,onPreview:vi.fn()});emit();expect(onPick.mock.calls[0][0].point).toEqual({x:3700,y:0});}
    const user=annotationGeometry([{id:'user',layerId:'one',kind:'polyline',points:[{x:0,y:400},{x:10000,y:400}]}]);viewer.setUserGeometry(user,[]);
    const takeoff=annotationGeometry([{id:'takeoff',layerId:'t',kind:'polyline',points:[{x:0,y:600},{x:10000,y:600}]}]);viewer.setTakeoffGeometry(takeoff);
    viewer.configureAnnotations(null);viewer.configureMeasurement({enabled:true,mode:'distance',points:[],snapping:true,entity:null});
    expect((viewer as any).pickAt({x:370,y:58},false).point).toEqual({x:3700,y:400});
    expect((viewer as any).pickAt({x:370,y:38},false).snapped).toBeNull();
    viewer.setTakeoffMode(true);expect((viewer as any).pickAt({x:370,y:38},false).point).toEqual({x:3700,y:600});
    expect((viewer as any).pickAt({x:370,y:58},false).point).toEqual({x:3700,y:400});
    viewer.setTakeoffMode(false);expect((viewer as any).pickAt({x:370,y:38},false).snapped).toBeNull();
    viewer.configureMeasurement({enabled:true,mode:'distance',points:[],snapping:false,entity:null});expect((viewer as any).pickAt({x:370,y:92},false).snapped).toBeNull();viewer.destroy();
  });
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
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
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

  it("edits an opted-in draft vertex on hold, while a quick tap on its first point still closes the path", async () => {
    const viewer=new DrawingViewer({} as HTMLElement);await viewer.load(new File(["0\nEOF\n"],"draft.dxf"),vi.fn());vi.useFakeTimers();
    const canvas=state.current.canvas;canvas.getBoundingClientRect=()=>({left:20,top:10,width:100,height:200});state.current.camera.updateProjectionMatrix();
    const emit=(type:string,id:number,x:number,y:number)=>canvas.dispatchEvent(Object.assign(new Event(type),{pointerId:id,clientX:x,clientY:y,pointerType:"touch",button:0}));
    const input={tool:"polyline",editableDraftPoints:true,snapping:true,points:[{x:-.5,y:-.5},{x:.5,y:-.5},{x:.5,y:.5}],onPick:vi.fn(),onPreview:vi.fn()};viewer.configureAnnotations(input,"takeoff");
    emit("pointerdown",1,45,160);vi.advanceTimersByTime(350);
    expect(input.onPick).not.toHaveBeenCalled();expect(input.onPreview).toHaveBeenLastCalledWith(expect.objectContaining({replaceIndex:0}));
    emit("pointermove",1,70,160);emit("pointerup",1,70,160);expect(input.onPick).toHaveBeenLastCalledWith(expect.objectContaining({replaceIndex:0,point:expect.objectContaining({x:0})}));
    input.onPick.mockClear();emit("pointerdown",1,45,160);emit("pointerup",1,45,160);expect(input.onPick).toHaveBeenCalledOnce();expect(input.onPick.mock.calls[0][0]).toMatchObject({snapped:"start"});expect(input.onPick.mock.calls[0][0]).not.toHaveProperty("replaceIndex");
    viewer.destroy();
  });

  it("keeps draft editing opt-in and cancels holds for pan, pinch and pointer cancellation",async()=>{
    const viewer=new DrawingViewer({} as HTMLElement);await viewer.load(new File(["0\nEOF\n"],"draft.dxf"),vi.fn());vi.useFakeTimers();
    const canvas=state.current.canvas;canvas.getBoundingClientRect=()=>({left:20,top:10,width:100,height:200});state.current.camera.updateProjectionMatrix();
    const emit=(type:string,id:number,x=45,y=160)=>canvas.dispatchEvent(Object.assign(new Event(type),{pointerId:id,clientX:x,clientY:y,pointerType:"touch",button:0}));
    const input={tool:"polyline",snapping:true,points:[{x:-.5,y:-.5},{x:.5,y:-.5},{x:.5,y:.5}],onPick:vi.fn(),onPreview:vi.fn()};viewer.configureAnnotations(input);
    emit("pointerdown",1);vi.advanceTimersByTime(350);emit("pointerup",1);expect(input.onPick.mock.calls[0][0]).not.toHaveProperty("replaceIndex");input.onPick.mockClear();
    viewer.configureAnnotations({...input,editableDraftPoints:true},"takeoff");
    emit("pointerdown",1);emit("pointermove",1,80,160);vi.advanceTimersByTime(350);emit("pointerup",1,80,160);
    emit("pointerdown",1);vi.advanceTimersByTime(350);emit("pointerdown",2,90,160);emit("pointerup",2,90,160);emit("pointerup",1);
    emit("pointerdown",1);vi.advanceTimersByTime(350);emit("pointercancel",1);emit("pointerup",1);expect(input.onPick).not.toHaveBeenCalled();viewer.destroy();
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

  it("magnifies the snapped commit point rather than the finger and hides on release/cancel/pinch",async()=>{
    const picked=vi.fn(),preview=vi.fn(),viewer=new DrawingViewer({}as HTMLElement,undefined,picked,undefined,preview);
    await viewer.load(new File(["0\nEOF\n"],"lens.dxf"),vi.fn());vi.useFakeTimers();
    const lens={show:vi.fn(),hide:vi.fn(),invalidate:vi.fn(),destroy:vi.fn()};(viewer as any).magnifier=lens;
    const canvas=state.current.canvas;canvas.clientWidth=100;canvas.clientHeight=200;canvas.getBoundingClientRect=()=>({left:20,top:10,width:100,height:200});state.current.camera.updateProjectionMatrix();
    (viewer as any).geometry.snaps=[{x:0,y:0,kind:"endpoint"}];
    const emit=(type:string,id:number,x=72,y=174)=>canvas.dispatchEvent(Object.assign(new Event(type),{pointerId:id,clientX:x,clientY:y,pointerType:"touch",button:0}));
    viewer.configureMeasurement({enabled:true,mode:"distance",points:[],snapping:true,entity:null});
    emit('pointerdown',1);vi.advanceTimersByTime(350);
    expect(lens.show).toHaveBeenLastCalledWith({x:50,y:100},{x:0,y:0},'endpoint');expect(picked).not.toHaveBeenCalled();
    emit('pointerup',1);expect(picked.mock.calls[0][0].point).toEqual(lens.show.mock.calls[0][1]);expect(lens.hide).toHaveBeenCalled();
    picked.mockClear();emit('pointerdown',1);vi.advanceTimersByTime(350);emit('pointercancel',1);expect(picked).not.toHaveBeenCalled();
    emit('pointerdown',1);vi.advanceTimersByTime(350);emit('pointerdown',2,90,174);emit('pointerup',2);emit('pointerup',1);expect(picked).not.toHaveBeenCalled();
    const calls=lens.show.mock.calls.length;emit('pointerdown',1);emit('pointermove',1,95,174);vi.advanceTimersByTime(350);emit('pointerup',1,95,174);expect(lens.show).toHaveBeenCalledTimes(calls);
    viewer.destroy();expect(lens.destroy).toHaveBeenCalledOnce();
  });
});
