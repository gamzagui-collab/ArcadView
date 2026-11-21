import { DxfViewer } from "dxf-viewer";
import { Color, Vector3 } from "three";
import {
  AppError,
  type LoadingPhase,
  type ViewerCommand,
} from "../types/drawing";
import { detectDxfEncoding } from "./dxfEncoding";
import { MAX_CONVERTED_DXF_BYTES, validateDrawingFileSize } from "../files/fileTypes";
import { getNativeDwgMetadata } from "../dwg/nativeMetadata";
import {
  getSavedDrawingView,
  resolveSavedDrawingView,
  type SavedDrawingView,
} from "./savedView";
import { installXclipRendering } from "./xclipRendering";
import {
  DEFAULT_VIEWER_OVERLAY_RESERVE,
  fitPaddingForViewport,
} from "./viewerLayout";
import {
  nearestEntity, nearestSnap, pointSegmentDistance,
  type MeasurementGeometry, type MeasurementSettings,
  type MeasurableEntity, type SnapPoint,
} from "./measurementGeometry";
import type { DrawingPoint } from "./savedView";
import { nearestPackedEntity, nearestPackedSnap, measurementFitBounds, measurementBuffers } from "./packedMeasurement";
import { retireDrawingBuffers } from "./drawingBufferRelease";
import { selectInitialDrawingBounds } from "./initialView";
import { resolveDrawingDisplayUnit, resolveDrawingMeasurementUnit } from "./verifiedDrawingUnits";
import { getDrawingUnitKey, prepareDrawingUnitKey } from "./drawingUnitPreferences";
import { installTrianglePrecisionRendering } from "./trianglePrecision";
import { MeasurementGesture } from "./measurementGesture";
import { installCadColorRendering } from "./blockColors";
import { ViewportCuller } from "./viewportCulling";
import { DWG_CACHE_VERSION } from "../dwg/conversionCache";
import { referenceDirections } from "./rightAngles";
import { isDistanceMode, pathIsClosed, snapToPathStart } from "./measurementTools";
import {snapToCircularEdge} from "./circularSnap";
import { intersectionSnap } from "./intersectionSnapping";
import { perpendicularSnap, segmentFoot } from "./cadPicking";
import { masked, visibleEntityFragment, type Annotation } from "./annotations";
import {CadFocusFilter,type CadFocus} from "../takeoff/cadFocus";
import {createMoveSnap,type MoveContact} from "./moveSnapping";

export type MeasurementPick = { point: DrawingPoint; snapped: SnapPoint["kind"] | "start" | "perpendicular" | "intersection" | "curve" | "edge" | null; entity: MeasurableEntity | null; replaceIndex?: number;contact?:MoveContact };
export type AnnotationHandleDrag={offset?:DrawingPoint;anchor?:DrawingPoint;translation?:{snap:ReturnType<typeof createMoveSnap>;geometry:MeasurementGeometry;masks:Annotation[]};move(pick:MeasurementPick):void;end(pick:MeasurementPick):void;cancel():void};
export type AnnotationInput = {tool:string;snapping:boolean;handleSnapping?:boolean;anchor?:DrawingPoint;points:DrawingPoint[];referenceSnaps?:SnapPoint[];onHandleDown?(client:DrawingPoint):AnnotationHandleDrag|null;onPick(pick:MeasurementPick):void;onPreview(pick:MeasurementPick|null):void};

installXclipRendering(DxfViewer);
installTrianglePrecisionRendering(DxfViewer);
installCadColorRendering(DxfViewer);

const LOAD_TIMEOUT_MS = 10 * 60 * 1000;
const HEADER_BYTES = 64 * 1024;

function abortError(): DOMException {
  return new DOMException("Drawing loading was cancelled.", "AbortError");
}

type ProgressCallback = (
  phase: LoadingPhase,
  processed: number,
  total: number,
) => void;

export class DrawingViewer {
  private readonly viewer: DxfViewer;
  private objectUrl: string | null = null;
  private savedView: SavedDrawingView | null = null;
  private worker: Worker | null = null;
  private cancelLoad: ((reason: unknown) => void) | null = null;
  private loadId = 0;
  private destroyed = false;
  private ready = false;
  private initialFitFrame: number | null = null;
  private geometry: MeasurementGeometry = { units: "drawing", entities: [], snaps: [], limited: false, completeBounds: false, fitBounds: [], fitCompleteBounds: false };
  private measurement: MeasurementSettings | null = null;
  private culler: ViewportCuller | null = null;
  private anchor: DrawingPoint | null = null;
  private references: DrawingPoint[] = [];
  private endAnchor: DrawingPoint | null = null;
  private endReferences: DrawingPoint[] = [];
  private annotationInput: AnnotationInput | null = null;
  private annotationOwner="annotations";
  private takeoffGeometry:MeasurementGeometry={units:"drawing",entities:[],snaps:[],limited:false,completeBounds:false,fitBounds:[],fitCompleteBounds:false};
  private takeoffFocus:CadFocusFilter|null=null;
  private baseDrawingVisible=true;
  private readonly emptyCad:MeasurementGeometry={units:"drawing",entities:[],snaps:[],limited:false,completeBounds:false,fitBounds:[],fitCompleteBounds:false};
  private userGeometry: MeasurementGeometry = {units:"drawing",entities:[],snaps:[],limited:false,completeBounds:false,fitBounds:[],fitCompleteBounds:false};
  private masks: Annotation[] = [];
  private viewListeners = new Set<()=>void>();
  private precisionIndex: number | undefined;
  private controlsBeforeHold: { enablePan: boolean; enableZoom: boolean } | null = null;
  private handleDrag:{id:number;input:AnnotationInput;drag:AnnotationHandleDrag}|null=null;
  private handlePointers=new Set<number>();
  private lockInteraction(locked:boolean):void{
    const controls=(this.viewer as any)?.controls;if(!controls)return;
    if(locked&&!this.controlsBeforeHold){this.controlsBeforeHold={enablePan:controls.enablePan,enableZoom:controls.enableZoom};controls.enablePan=false;controls.enableZoom=false;}
    else if(!locked&&this.controlsBeforeHold){Object.assign(controls,this.controlsBeforeHold);this.controlsBeforeHold=null;}
  }
  private cancelHandle():void{const h=this.handleDrag;this.handleDrag=null;if(h){this.lockInteraction(false);h.drag.cancel();}}
  private handlePick(event:PointerEvent):MeasurementPick{
    const h=this.handleDrag!,d=h.drag.offset,client={x:event.clientX+(d?.x??0),y:event.clientY+(d?.y??0)},moving=h.drag.translation;
    if(!moving)return this.pickAt(client,false);
    const point=this.clientToDrawing(client),rect=this.viewer.GetCanvas().getBoundingClientRect(),a=this.clientToDrawing({x:rect.left,y:rect.bottom}),b=this.clientToDrawing({x:rect.right,y:rect.top});
    const contact=(h.input.handleSnapping??h.input.snapping)?moving.snap(point,[this.baseDrawingVisible?this.geometry:this.emptyCad,moving.geometry],this.worldTolerance(12),p=>!masked(p,moving.masks,this.worldTolerance(3)),{minX:a.x,minY:a.y,maxX:b.x,maxY:b.y}):null;
    return{point:contact?.point??point,snapped:contact?.kind??null,entity:null,...(contact?{contact}:{})};
  }
  private readonly gesture = new MeasurementGesture({
    lock: locked => this.lockInteraction(locked),
    preview: position => {const pick=position?this.pickAt(position,true):null;if(this.annotationInput)this.annotationInput.onPreview(pick);else this.onPreview?.(pick);},
    commit: (position, precision) => {const pick=this.pickAt(position,precision);if(this.annotationInput)this.annotationInput.onPick(pick);else this.onPick?.(pick);},
  });
  private readonly pointerDown = (event: PointerEvent): void => {
    if ((!this.measurement?.enabled && !this.annotationInput) || !this.ready || (event.button !== 0 && event.pointerType !== "touch")) return;
    if(this.handlePointers.size){this.handlePointers.add(event.pointerId);this.cancelHandle();this.gesture.cancel();if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();return;}
    const direct=this.annotationInput?.onHandleDown?.({x:event.clientX,y:event.clientY});
    if(direct&&this.annotationInput){this.gesture.cancel();this.handleDrag={id:event.pointerId,input:this.annotationInput,drag:direct};this.handlePointers.add(event.pointerId);this.lockInteraction(true);try{this.viewer.GetCanvas().setPointerCapture(event.pointerId);}catch{}if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();return;}
    this.precisionIndex = undefined;
    if (!this.annotationInput && this.measurement && this.measurement.mode !== "object") {
      const rect = this.viewer.GetCanvas().getBoundingClientRect();
      const index = this.projectPoints(this.measurement.points).findIndex(p => Math.hypot(p.x + rect.left - event.clientX, p.y + rect.top - event.clientY) <= 16);
      // Returning to the first point finishes an open path, including a precision hold.
      const closing = this.measurement.mode === "path" && index === 0 && this.measurement.points.length >= 3 && !pathIsClosed(this.measurement.points);
      if (index >= 0 && !closing) this.precisionIndex = index;
    }
    this.gesture.down(event.pointerId, { x: event.clientX, y: event.clientY });
    try { this.viewer.GetCanvas().setPointerCapture(event.pointerId); } catch { /* Synthetic events or a detached canvas. */ }
  };
  private readonly pointerMove = (event: PointerEvent): void => {
    if(this.handlePointers.has(event.pointerId)){if(this.handleDrag?.id===event.pointerId)this.handleDrag.drag.move(this.handlePick(event));if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();return;}
    this.gesture.move(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  private readonly pointerCancel = (event: PointerEvent): void => {
    if(this.handlePointers.has(event.pointerId)){this.handlePointers.delete(event.pointerId);this.cancelHandle();return;}
    this.gesture.cancel(event.pointerId);
  };
  private readonly pointerUp = (event: PointerEvent): void => {
    if(this.handlePointers.has(event.pointerId)){this.handlePointers.delete(event.pointerId);const h=this.handleDrag;if(h?.id===event.pointerId){const pick=this.handlePick(event);this.handleDrag=null;this.lockInteraction(false);h.drag.end(pick);}if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();return;}
    this.gesture.up(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  private pickAt(position: { x: number; y: number }, precision: boolean): MeasurementPick {
    const cad=this.baseDrawingVisible?this.geometry:this.emptyCad;
    const editor=this.annotationInput??this.handleDrag?.input;
    const measurement:MeasurementSettings=editor?{enabled:true,mode:editor.tool==="polyline"?"path":!this.handleDrag&&editor.tool==="dimension-radius"?"radius":editor.tool==="dimension-angle"?"angle":"distance",points:editor.points,snapping:this.handleDrag?editor.handleSnapping??editor.snapping:editor.snapping,entity:null}:this.measurement!;
    const canvas = this.viewer.GetCanvas();
    const rect = canvas.getBoundingClientRect();
    const v = new Vector3((position.x - rect.left) * 2 / rect.width - 1, -(Math.max(rect.top + 20, position.y) - rect.top) * 2 / rect.height + 1, 0).unproject(this.viewer.GetCamera());
    const origin = this.viewer.GetOrigin();
    let point: DrawingPoint = { x: v.x + origin.x, y: v.y + origin.y };
    const camera = this.viewer.GetCamera();
    const tolerance = 18 * (camera.right - camera.left) / camera.zoom / rect.width;
    const replaceIndex = precision ? this.precisionIndex : undefined;
    const radiusSlot=replaceIndex??(measurement.points.length>=2?0:measurement.points.length),centerKind=measurement.mode==="radius"&&radiusSlot===0?"center":undefined;
    let snapped:SnapPoint|null = measurement.snapping && measurement.mode !== "object" ?
      cad.packed ? nearestPackedSnap(cad.packed, point, tolerance,centerKind) : nearestSnap(cad.snaps, point, tolerance,centerKind) : null;
    if(snapped&&masked(snapped,this.masks,this.worldTolerance(3)))snapped=null;
    const supplemental=editor&&this.annotationOwner==="takeoff"?this.takeoffGeometry:null;
    let own=measurement.snapping?nearestSnap(this.userGeometry.snaps,point,tolerance,centerKind):null;
    const takeoff=measurement.snapping&&supplemental?nearestSnap(supplemental.snaps,point,tolerance,centerKind):null;
    if(takeoff&&(!own||Math.hypot(takeoff.x-point.x,takeoff.y-point.y)<Math.hypot(own.x-point.x,own.y-point.y)))own=takeoff;
    if(own&&(!snapped||Math.hypot(own.x-point.x,own.y-point.y)<Math.hypot(snapped.x-point.x,snapped.y-point.y)))snapped=own;
    // Markup is excluded from CAD measurement. A selected mark may still use
    // its own exact anchors when choosing the base of a move operation.
    const reference=measurement.snapping&&editor?.referenceSnaps?nearestSnap(editor.referenceSnaps,point,tolerance):null;
    if(reference&&(!snapped||Math.hypot(reference.x-point.x,reference.y-point.y)<Math.hypot(snapped.x-point.x,snapped.y-point.y)))snapped=reference;
    let curve:DrawingPoint|null=null;
    if(measurement.mode==="radius"&&radiusSlot===1&&measurement.snapping){
      curve=snapToCircularEdge(cad,measurement.points[0],point,tolerance,p=>!masked(p,this.masks,this.worldTolerance(3)));
      const q=snapToCircularEdge(this.userGeometry,measurement.points[0],point,tolerance);
      if(q&&(!curve||Math.hypot(q.x-point.x,q.y-point.y)<Math.hypot(curve.x-point.x,curve.y-point.y)))curve=q;
      if(curve&&snapped&&Math.abs(Math.hypot(snapped.x-measurement.points[0].x,snapped.y-measurement.points[0].y)-Math.hypot(curve.x-measurement.points[0].x,curve.y-measurement.points[0].y))>Math.max(tolerance*1e-6,1e-7))snapped=null;
    }
    const intersection=(editor?.tool==="move"||editor?.tool==="rotate"||!!this.handleDrag)&&measurement.snapping?intersectionSnap([cad,this.userGeometry,...supplemental?[supplemental]:[]],point,this.worldTolerance(10),p=>!masked(p,this.masks,this.worldTolerance(3))):null;
    const start = snapToPathStart(measurement, point, tolerance, replaceIndex);
    const anchor=this.handleDrag?.drag.anchor??editor?.anchor??(isDistanceMode(measurement.mode)?measurement.points[replaceIndex===0?1:0]:undefined);
    let perpendicular:DrawingPoint|null=null;
    if(measurement.snapping&&anchor&&measurement.mode!=="radius"){
      const tol=this.worldTolerance(9),accept=(p:DrawingPoint)=>!masked(p,this.masks,this.worldTolerance(3));
      perpendicular=perpendicularSnap(cad,anchor,point,tol,accept);
      let ownFoot=perpendicularSnap(this.userGeometry,anchor,point,tol);
      const takeoffFoot=supplemental?perpendicularSnap(supplemental,anchor,point,tol):null;
      if(takeoffFoot&&(!ownFoot||Math.hypot(takeoffFoot.x-point.x,takeoffFoot.y-point.y)<Math.hypot(ownFoot.x-point.x,ownFoot.y-point.y)))ownFoot=takeoffFoot;
      if(ownFoot&&(!perpendicular||Math.hypot(ownFoot.x-point.x,ownFoot.y-point.y)<Math.hypot(perpendicular.x-point.x,perpendicular.y-point.y)))perpendicular=ownFoot;
    }
    if (start) point = start;
    else if(intersection)point=intersection;
    else if(perpendicular)point=perpendicular;
    else if (snapped) point = { x: snapped.x, y: snapped.y };
    else if(curve)point=curve;
    let entity = !this.handleDrag&&(measurement.mode === "object" || editor?.tool==="select"||editor?.tool==="trim") ?
      cad.packed ? nearestPackedEntity(cad.packed, point, tolerance, pointSegmentDistance) : nearestEntity(cad.entities, point, tolerance) : null;
    if(entity)entity=visibleEntityFragment(entity,this.masks,point,tolerance);
    if(entity){let nearest=Infinity,hit=point;for(let i=1;i<entity.points.length;i++){const q=segmentFoot(point,entity.points[i-1],entity.points[i]);if(q&&Math.hypot(q.x-point.x,q.y-point.y)<nearest){hit=q;nearest=Math.hypot(q.x-point.x,q.y-point.y);}}if(masked(hit,this.masks,this.worldTolerance(3)))entity=null;}
    if(measurement.mode==="object"){const candidate=nearestEntity(this.userGeometry.entities,point,tolerance);if(candidate)entity=candidate;}
    if(!editor&&isDistanceMode(measurement.mode))this.updateEndReferences(point);
    return { point, snapped: start ? "start" : intersection ? "intersection" : perpendicular ? "perpendicular" : snapped?.kind ?? (curve?"curve":null), entity, ...(replaceIndex !== undefined ? { replaceIndex } : {}) };
  }
  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.destroyed) {
      return;
    }
    this.ready = false;
    const error = new AppError(
      "RENDER_FAILED",
      "The drawing's WebGL context was lost.",
    );
    if (this.cancelLoad) {
      this.cancelLoad(error);
    } else {
      this.onError?.(error);
    }
  };

  constructor(
    container: HTMLElement,
    private readonly onError?: (error: unknown) => void,
    private readonly onPick?: (pick: MeasurementPick) => void,
    private readonly onViewChanged?: () => void,
    private readonly onPreview?: (pick: MeasurementPick | null) => void,
  ) {
    this.viewer = new DxfViewer(container, {
      autoResize: true,
      clearColor: new Color("#0b1118"),
      clearAlpha: 1,
      antialias: true,
      colorCorrection: true,
      blackWhiteInversion: true,
      pointSize: 3,
      // The worker replaces the parsed document with its compact measurement index.
      retainParsedDxf: true,
      preserveDrawingBuffer: false,
    });
    // dxf-viewer returns a partially initialized instance when WebGL creation
    // fails instead of throwing. Detect it before requesting any canvas methods.
    if (!this.viewer.HasRenderer()) {
      throw new AppError("RENDER_FAILED", "WebGL could not be initialized.");
    }
    this.viewer.GetCanvas().addEventListener(
      "webglcontextlost",
      this.onContextLost,
    );
    const canvas = this.viewer.GetCanvas();
    canvas.addEventListener("pointerdown", this.pointerDown,true);
    canvas.addEventListener("pointermove", this.pointerMove,true);
    canvas.addEventListener("pointerup", this.pointerUp,true);
    canvas.addEventListener("pointercancel", this.pointerCancel,true);
    canvas.addEventListener("lostpointercapture",this.pointerCancel);
    const render = this.viewer.Render.bind(this.viewer);
    this.viewer.Render = () => {
      // Three normally refreshes this inside renderer.render(). Project the
      // overlay with the new camera, rather than the previous frame's inverse.
      this.viewer.GetCamera().updateMatrixWorld();
      if ((this.viewer as any).options.izcadCulling !== false) this.culler?.update(this.viewer.GetCamera(),this.viewer.GetCanvas().clientWidth);
      else this.culler?.restore();
      if (!this.destroyed) this.onViewChanged?.();
      if (!this.destroyed) for(const listener of this.viewListeners)listener();
      if(this.baseDrawingVisible)render();
    };
  }

  async load(file: File, onProgress: ProgressCallback): Promise<void> {
    if (this.destroyed) {
      throw abortError();
    }
    validateDrawingFileSize(file.size, MAX_CONVERTED_DXF_BYTES);
    this.cancelLoad?.(abortError());
    this.cancelInitialFit();
    const loadId = ++this.loadId;
    this.ready = false;
    this.releaseWorker();
    this.releaseObjectUrl();
    this.savedView = getSavedDrawingView(file);
    const unitController = new AbortController();
    const interrupted = new Promise<never>((_resolve, reject) => {
      this.cancelLoad = error => { unitController.abort(); reject(error); };
    });
    const timeout = window.setTimeout(() => {
      if (loadId === this.loadId) {
        this.cancelLoad?.(new AppError("DXF_OPEN_FAILED", "Drawing loading timed out."));
      }
    }, LOAD_TIMEOUT_MS);

    try {
      const prefix = await Promise.race([
        file.slice(0, HEADER_BYTES).arrayBuffer(),
        interrupted,
      ]);
      await Promise.race([prepareDrawingUnitKey(file, unitController.signal), interrupted]);
      if (this.destroyed || loadId !== this.loadId) {
        throw abortError();
      }
      // The pinned viewer exposes fileEncoding only in constructor options, but
      // clones the options for every worker request. Set it before Load starts.
      const options = (this.viewer as unknown as {
        options: { fileEncoding: string };
      }).options;
      options.fileEncoding = detectDxfEncoding(new Uint8Array(prefix));
      (options as any).izcadDwgMetadata=getNativeDwgMetadata(file);
      const contentKey = getDrawingUnitKey(file);
      // Cache compatibility is versioned by preparedSceneCache.VERSION. A raw
      // worker source URL also encodes platform line endings and is not stable
      // between Windows development and Linux release builds.
      (options as any).izcadPreparedKey = contentKey && file.size >= 1024 * 1024 ? `${contentKey}:${DWG_CACHE_VERSION}` : undefined;
      this.objectUrl = URL.createObjectURL(file);

      await Promise.race([
        this.viewer.Load({
          url: this.objectUrl,
          fonts: [
            new URL("fonts/IzCadUniversal-Regular.ttf", document.baseURI).href,
          ],
          progressCbk: (phase, processed, total) => {
            if (!this.destroyed && loadId === this.loadId) {
              onProgress(phase, processed, total);
            }
          },
          workerFactory: () => {
            const worker = new Worker(
              new URL("../workers/drawing.worker.ts", import.meta.url),
              { type: "module", name: "izcad-dxf-worker" },
            );
            this.worker = worker;
            const failed = (event: Event): void => {
              if (!this.destroyed && loadId === this.loadId) {
                this.cancelLoad?.(new AppError(
                  "DXF_OPEN_FAILED",
                  event instanceof ErrorEvent ? event.message : "The drawing worker failed.",
                ));
              }
            };
            // dxf-viewer 1.0.48 does not reliably reject requests on worker errors.
            worker.addEventListener("error", failed);
            worker.addEventListener("messageerror", failed);
            return worker;
          },
        }),
        interrupted,
      ]);

      if (this.destroyed || loadId !== this.loadId) {
        throw abortError();
      }
      const retained = (this.viewer as unknown as { parsedDxf?: { izcadMeasurement?: MeasurementGeometry } }).parsedDxf;
      this.geometry = retained?.izcadMeasurement ?? { units: "drawing", entities: [], snaps: [], limited: false, completeBounds: false, fitBounds: [], fitCompleteBounds: false };
      this.geometry.units = resolveDrawingMeasurementUnit(file, this.geometry.units);
      this.geometry.displayUnits = resolveDrawingDisplayUnit(file, this.geometry.units);
      this.geometry.unitPreferenceKey = getDrawingUnitKey(file);
      this.culler = new ViewportCuller((this.viewer as any).scene);
      (this.viewer as unknown as { parsedDxf: unknown }).parsedDxf = null;
      if (!this.applySavedView()) {
        this.fit(true);
        // The ready callback mounts the header and toolbar after this promise
        // resolves. On the next frame their measured bounds include safe-area
        // insets, so refine the initial fit once without changing a saved camera.
        if (typeof requestAnimationFrame === "function") {
          this.initialFitFrame = requestAnimationFrame(() => {
            this.initialFitFrame = null;
            if (!this.destroyed && loadId === this.loadId && this.ready) {
              try {
                this.fit(true);
              } catch (error) {
                this.onError?.(new AppError("RENDER_FAILED", undefined, { cause: error }));
              }
            }
          });
        }
      }
      this.ready = true;
      this.onViewChanged?.();
    } catch (error) {
      if (!this.destroyed && loadId === this.loadId) {
        try {
          this.viewer.Clear();
        } catch {
          // Preserve the original load error if the failed renderer cannot clear.
        }
      }
      throw error;
    } finally {
      unitController.abort();
      clearTimeout(timeout);
      if (loadId === this.loadId) {
        this.cancelLoad = null;
        this.releaseWorker();
        this.releaseObjectUrl();
      }
    }
  }

  execute(command: ViewerCommand): void {
    if (this.destroyed || !this.ready) {
      return;
    }
    this.cancelInitialFit();
    switch (command) {
      case "zoom-in":
        this.zoom(1.25);
        break;
      case "zoom-out":
        this.zoom(0.8);
        break;
      case "fit":
        this.fit();
        break;
      case "reset":
        if (!this.applySavedView()) {
          this.fit(true);
        }
        break;
    }
  }

  getMeasurementGeometry(): MeasurementGeometry { return this.geometry; }

  configureMeasurement(settings: MeasurementSettings): void {
    if (!settings.enabled || settings.mode !== this.measurement?.mode) this.gesture.cancel();
    this.measurement = settings;
    const anchor=isDistanceMode(settings.mode)?settings.points[0]:undefined;
    if(anchor && (anchor.x!==this.anchor?.x||anchor.y!==this.anchor?.y)) {
      this.anchor=anchor;const c=this.viewer.GetCamera(),canvas=this.viewer.GetCanvas();
      const tolerance=1.5*(c.right-c.left)/c.zoom/Math.max(1,canvas.clientWidth);
      this.references=[...(!masked(anchor,this.masks,tolerance)?referenceDirections(this.geometry,anchor,tolerance):[]),...referenceDirections(this.userGeometry,anchor,tolerance)];
    } else if(!anchor){this.anchor=null;this.references=[];}
    if(isDistanceMode(settings.mode)&&settings.points[1])this.updateEndReferences(settings.points[1]);else{this.endAnchor=null;this.endReferences=[];}
  }
  getMeasurementReferences(): readonly DrawingPoint[] { return this.references; }
  getMeasurementEndReferences(): readonly DrawingPoint[] { return this.endReferences; }
  private updateEndReferences(point:DrawingPoint):void{
    if(this.endAnchor?.x===point.x&&this.endAnchor.y===point.y)return;
    this.endAnchor=point;const tolerance=this.worldTolerance(1.5);
    this.endReferences=[...(!masked(point,this.masks,tolerance)?referenceDirections(this.geometry,point,tolerance):[]),...referenceDirections(this.userGeometry,point,tolerance)];
  }
  worldTolerance(pixels:number):number{const c=this.viewer.GetCamera();return pixels*(c.right-c.left)/c.zoom/Math.max(1,this.viewer.GetCanvas().clientWidth);}
  configureAnnotations(input:AnnotationInput|null,owner="annotations"):void{if(!input&&owner!==this.annotationOwner)return;if(input&&owner!==this.annotationOwner){this.cancelInteraction();this.annotationOwner=owner;}if(input?.tool!==this.annotationInput?.tool){this.gesture.cancel();if(this.handleDrag)this.lockInteraction(true);if(input&&input.tool!==this.handleDrag?.input.tool)this.cancelHandle();}this.annotationInput=input;}
  cancelInteraction():void { this.gesture.cancel();this.cancelHandle();this.handlePointers.clear();this.precisionIndex=undefined; }
  getCanvasElement():HTMLCanvasElement { return this.viewer.GetCanvas(); }
  clientToDrawing(position:{x:number;y:number}):DrawingPoint {
    const r=this.viewer.GetCanvas().getBoundingClientRect();
    const v=new Vector3((position.x-r.left)*2/r.width-1,-(position.y-r.top)*2/r.height+1,0).unproject(this.viewer.GetCamera());
    const origin=this.viewer.GetOrigin();return{x:v.x+origin.x,y:v.y+origin.y};
  }
  setUserGeometry(geometry:MeasurementGeometry,masks:Annotation[]):void{this.userGeometry=geometry;this.masks=masks;this.anchor=null;this.endAnchor=null;if(this.measurement)this.configureMeasurement(this.measurement);}
  getAnnotationTargets(){return{geometry:this.userGeometry,masks:this.masks};}
  setTakeoffGeometry(geometry:MeasurementGeometry){this.takeoffGeometry=geometry;}
  getCadFocusOptions(){this.takeoffFocus??=new CadFocusFilter((this.viewer as any).scene);return this.takeoffFocus.options();}
  setTakeoffFocus(filter:CadFocus){if(this.destroyed)return;this.takeoffFocus??=new CadFocusFilter((this.viewer as any).scene);this.takeoffFocus.set(filter);this.viewer.Render();}
  setBaseDrawingVisible(visible:boolean){if(this.destroyed||visible===this.baseDrawingVisible)return;this.baseDrawingVisible=visible;this.viewer.GetCanvas().style.opacity=visible?"":"0";this.viewer.Render();}
  subscribeView(listener:()=>void):()=>void{this.viewListeners.add(listener);return()=>{this.viewListeners.delete(listener);};}

  projectPoints(points: readonly DrawingPoint[]): DrawingPoint[] {
    const camera = this.viewer.GetCamera(), origin = this.viewer.GetOrigin();
    const canvas = this.viewer.GetCanvas();
    const width = canvas.clientWidth || canvas.width, height = canvas.clientHeight || canvas.height;
    return points.map((point) => {
      const v = new Vector3(point.x - origin.x, point.y - origin.y, 0).project(camera);
      return { x: (v.x + 1) * width / 2, y: (1 - v.y) * height / 2 };
    });
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.takeoffFocus?.clear();this.takeoffFocus=null;this.takeoffGeometry.entities=[];this.takeoffGeometry.snaps=[];
    this.destroyed = true;
    this.viewListeners.clear();this.annotationInput=null;this.masks=[];this.userGeometry.entities=[];this.userGeometry.snaps=[];
    this.culler?.restore(); this.culler = null;
    this.ready = false;
    this.cancelInitialFit();
    this.cancelLoad?.(abortError());
    this.cancelLoad = null;
    this.releaseWorker();
    this.releaseObjectUrl();
    const canvas = this.viewer.GetCanvas();
    const renderer = this.viewer.GetRenderer();
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    canvas.removeEventListener("pointerdown", this.pointerDown,true);
    canvas.removeEventListener("pointermove", this.pointerMove,true);
    canvas.removeEventListener("pointerup", this.pointerUp,true);
    canvas.removeEventListener("pointercancel", this.pointerCancel,true);
    canvas.removeEventListener("lostpointercapture",this.pointerCancel);
    this.cancelInteraction();
    // The parent React state may retain the old geometry for one more commit.
    // The viewer owns these chunks; after destruction they must not keep
    // hundreds of MiB alive while the next cached scene is being restored.
    const packed = this.geometry.packed;
    const retired = packed ? measurementBuffers(packed) : [];
    if (packed) { packed.data.length=0; packed.refs.length=0; packed.points.length=0; packed.snaps.length=0;if(packed.extraSnaps)packed.extraSnaps.length=0;if(packed.snapSegments)packed.snapSegments.length=0;if(packed.fitBounds)packed.fitBounds.length=0; }
    this.geometry = { units: "drawing", entities: [], snaps: [], limited: false, completeBounds: false, fitBounds: [], fitCompleteBounds: false };
    try {
      this.viewer.Destroy();
    } finally {
      // dispose() releases GPU buffers but leaves the context allocated. Android
      // can otherwise exhaust its WebGL context budget after opening many files.
      renderer?.forceContextLoss();
      canvas.remove();
      retireDrawingBuffers(retired);
    }
  }

  private zoom(factor: number): void {
    const camera = this.viewer.GetCamera();
    camera.zoom = Math.min(1000, Math.max(0.01, camera.zoom * factor));
    camera.updateProjectionMatrix();
    this.viewer.Render();
    this.onViewChanged?.();
  }

  private fit(initial = false): void {
    const bounds = initial && this.geometry.fitCompleteBounds
      ? selectInitialDrawingBounds(this.viewer.GetBounds(), [...measurementFitBounds(this.geometry)])
      : this.viewer.GetBounds();
    if (!bounds) {
      return;
    }

    const origin = this.viewer.GetOrigin();
    const canvas = this.viewer.GetCanvas();
    const viewportHeight = canvas.clientHeight || canvas.height;
    const viewportBounds = canvas.getBoundingClientRect?.();
    const shell = canvas.closest?.<HTMLElement>(".viewer-shell") ?? canvas.parentElement?.parentElement;
    const header = shell?.querySelector<HTMLElement>(".viewer-header")?.getBoundingClientRect();
    const toolbar = shell?.querySelector<HTMLElement>(".viewer-toolbar")?.getBoundingClientRect();
    const reserve = Math.max(
      DEFAULT_VIEWER_OVERLAY_RESERVE,
      header && viewportBounds ? header.bottom - viewportBounds.top + 8 : 0,
      toolbar && viewportBounds && toolbar.width > toolbar.height
        ? viewportBounds.bottom - toolbar.top + 8
        : 0,
    );
    this.viewer.FitView(
      bounds.minX - origin.x,
      bounds.maxX - origin.x,
      bounds.minY - origin.y,
      bounds.maxY - origin.y,
      fitPaddingForViewport(viewportHeight, reserve),
    );
    this.viewer.Render();
    this.onViewChanged?.();
  }

  private applySavedView(): boolean {
    if (!this.savedView) {
      return false;
    }
    const canvas = this.viewer.GetCanvas();
    const viewportAspect = canvas.width / canvas.height;
    const origin = this.viewer.GetOrigin();
    const resolved = resolveSavedDrawingView(
      this.savedView,
      this.geometry.fitCompleteBounds ? selectInitialDrawingBounds(this.viewer.GetBounds(), [...measurementFitBounds(this.geometry)]) : this.viewer.GetBounds(),
      origin,
      viewportAspect,
      measurementFitBounds(this.geometry),
    );
    if (!resolved) {
      return false;
    }

    this.viewer.SetView(
      new Vector3(resolved.center.x, resolved.center.y, 0),
      resolved.width,
    );
    this.viewer.Render();
    return true;
  }

  private releaseObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }

  private releaseWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }

  private cancelInitialFit(): void {
    if (this.initialFitFrame !== null) {
      cancelAnimationFrame(this.initialFitFrame);
      this.initialFitFrame = null;
    }
  }
}
