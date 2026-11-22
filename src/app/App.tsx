import { isLikelyMemoryError } from "../dwg/diagnostics";
import { readPrecision, savePrecision } from "../viewer/displayPrecision";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { commerceSnapshot,commerceSubscribe,canStart,hasToolAccess } from "../commerce/client";
import { isUnmeteredTool,measurementToolId } from "../commerce/toolPolicy";
import { CommercePortal } from "../commerce/CommercePortal";
import { useOperation } from "../commerce/useOperation";
import { readMeasurement,saveMeasurement } from "../commerce/operationJournal";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { DrawingLibrary } from "../components/DrawingLibrary";
import { ErrorScreen } from "../components/ErrorScreen";
import { CloseIcon } from "../components/Icons";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { LoadingScreen } from "../components/LoadingScreen";
import { HomeDashboard } from "../components/HomeDashboard";
import { AboutPanel } from "../components/AboutPanel";
import { AppUpdateCenter } from "../components/AppUpdateCenter";
import { Brand } from "../components/Brand";
import {DrawingHeader}from'../components/DrawingHeader';
import {ExitConfirmation}from'../components/AppNavigation';
import {ViewerSettings}from'../components/ViewerSettings';
import {navigationWords}from'../i18n/navigation';
import { ViewerToolbar } from "../components/ViewerToolbar";
import { MeasurementPanel, MeasurementStatus } from "../components/MeasurementPanel";
import type { MeasurementPick } from "../viewer/DrawingViewer";
import type { MeasurementGeometry, MeasurementSettings, MeasurementUnit } from "../viewer/measurementGeometry";
import { canFinishMeasurement,measurementPointsAfterPick,measurementValue,pathIsClosed } from "../viewer/measurementTools";
import { UndoHistory, type EditCommand, type EditHistoryState } from "../viewer/undoHistory";
import { saveDrawingUnitPreference, type DrawingUnitPreference } from "../viewer/drawingUnitPreferences";
import { dispatchBackNavigation, useBackNavigation } from "./backNavigation";
import { convertDwgToDxf } from "../dwg/convertDwg";
import { isArchiveFormat, toDrawingFile } from "../files/fileTypes";
import { useI18n } from "../i18n/I18nProvider";
import {
  importDrawingToLibrary,
  ROOT_FOLDER_ID,
} from "../library/drawingLibrary";
import {
  incomingDrawingPlugin,
  readIncomingDrawingFile,
  type IncomingDrawing,
} from "../native/incomingDrawing";
import {
  AppError,
  type AppErrorCode,
  type DrawingFile,
  type LoadingPhase,
  type ViewerCommand,
  type ViewerHandle,
} from "../types/drawing";

const DrawingCanvas = lazy(() =>
  import("../components/DrawingCanvas").then((module) => ({
    default: module.DrawingCanvas,
  })),
);
const PdfViewer = lazy(() => import("../components/PdfViewer").then((module) => ({ default: module.PdfViewer })));
const emptyMeasurement: MeasurementSettings = { enabled: false, mode: "distance", points: [], snapping: true, entity: null };

type AppState =
  | { status: "home" }
  | {
      status: "loading";
      drawing: DrawingFile;
      renderFile: File | null;
      phase: LoadingPhase;
      progress: number | null;
    }
  | { status: "viewer"; drawing: DrawingFile; renderFile: File }
  | { status: "error"; error: AppError };

function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length,
  );
  const value = bytes / 1024 ** exponent;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${units[exponent - 1]}`;
}

function toAppError(error: unknown, fallback: AppErrorCode): AppError {
  if (error instanceof AppError) return error;
  if (isLikelyMemoryError(error)) return new AppError("DRAWING_MEMORY_LIMIT", undefined, {cause:error});
  return new AppError(fallback, undefined, { cause: error });
}

export function App() {
  const commerce=useSyncExternalStore(commerceSubscribe,commerceSnapshot);
  const { locale, t } = useI18n();
  const [state, setState] = useState<AppState>({ status: "home" });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [aboutOpen,setAboutOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(false),[exitOpen,setExitOpen]=useState(false);
  const [navigationBusy,setNavigationBusy]=useState(false),[navigationError,setNavigationError]=useState(''),navigationLock=useRef(false);
  const [updatePending,setUpdatePending]=useState(false);
  const [libraryNotice, setLibraryNotice] = useState(false);
  const [incomingArchive, setIncomingArchive] = useState<File | null>(null);
  const [measurement, setMeasurement] = useState<MeasurementSettings>(emptyMeasurement);
  const measurementRef=useRef(measurement);measurementRef.current=measurement;
  const measurementHistory=useRef(new UndoHistory<MeasurementSettings>());
  const localMeasurementSaving=useRef(false);
  const [measurementSaving,setMeasurementSaving]=useState(false);
  const measurementWrites=useRef(new Set<Promise<void>>());
  const persistMeasurement=(key:string,value:MeasurementSettings)=>{const job=saveMeasurement(key,value);measurementWrites.current.add(job);void job.finally(()=>measurementWrites.current.delete(job)).catch(()=>{});return job;};
  const [editHistory,setEditHistory]=useState<EditHistoryState>({canUndo:false,canRedo:false});
  const [measurementPanelOpen,setMeasurementPanelOpen]=useState(false);
  const [annotationOpen,setAnnotationOpen]=useState(false);
  const [layersOpen,setLayersOpen]=useState(false);
  const [annotationActive,setAnnotationActive]=useState(false);
  const [takeoffActive,setTakeoffActive]=useState(false);
  const measurementActivated=useRef(false);
  const [measurementGeometry, setMeasurementGeometry] = useState<MeasurementGeometry | null>(null);
  const measurementKey=measurementGeometry?.unitPreferenceKey;
  const measurementOperation=useOperation<MeasurementSettings>(measurementKey,"measurement",async candidate=>{
    if(!measurementKey)throw Error("MISSING_DRAWING_KEY");
    const saved={...candidate,enabled:true,displayOnly:true};await persistMeasurement(measurementKey,saved);
    if(unitPreferenceRef.current?.key===measurementKey&&measurementRef.current.mode===candidate.mode){measurementHistory.current.record(measurementRef.current);measurementRef.current=saved;setMeasurement(saved);}
  });
  const measurementOperationRef=useRef(measurementOperation);measurementOperationRef.current=measurementOperation;
  const [sourceUnit, setSourceUnit] = useState<MeasurementUnit>("drawing");
  const [displayUnit, setDisplayUnit] = useState<MeasurementUnit>("drawing");
  const [precision,setPrecision]=useState(readPrecision);
  const handlePrecision=(value:number)=>{setPrecision(value);savePrecision(value);};
  const unitPreferenceRef = useRef<(DrawingUnitPreference & { key?: string }) | null>(null);
  const [measurementFeedback, setMeasurementFeedback] = useState<string | null>(null);
  const viewerRef = useRef<ViewerHandle>(null);
  const requestIdRef = useRef(0);
  const incomingRequestIdRef = useRef(0);
  const handledIncomingIdsRef = useRef(new Set<string>());
  const conversionAbortRef = useRef<AbortController | null>(null);
  const incomingAbortRef = useRef<AbortController | null>(null);
  const lastDrawingRef = useRef<{ file: File; libraryEntryId?: string } | null>(null);
  const pendingImportRef = useRef<{ file: File; requestId: number } | null>(null);

  const openFile = useCallback(async (file: File, libraryEntryId?: string) => {
    incomingRequestIdRef.current += 1;
    incomingAbortRef.current?.abort();
    conversionAbortRef.current?.abort();
    conversionAbortRef.current = null;
    const requestId = ++requestIdRef.current;
    lastDrawingRef.current = null;
    pendingImportRef.current = null;
    setLibraryNotice(false);
    setMeasurement(emptyMeasurement);
    measurementHistory.current.clear();setEditHistory({canUndo:false,canRedo:false});
    setMeasurementPanelOpen(false);
    setTakeoffActive(false);setAnnotationOpen(false);setAnnotationActive(false);setLayersOpen(false);
    measurementActivated.current=false;
    setMeasurementGeometry(null);
    unitPreferenceRef.current = null;
    setMeasurementFeedback(null);
    setIncomingArchive(null);

    let drawing: DrawingFile;
    try {
      drawing = toDrawingFile(file);
    } catch (error) {
      setState({
        status: "error",
        error: toAppError(error, "UNSUPPORTED_FORMAT"),
      });
      return;
    }

    lastDrawingRef.current = { file, libraryEntryId };
    if (isArchiveFormat(drawing.format)) {
      setIncomingArchive(file);
      setState({ status: "home" });
      setLibraryOpen(true);
      return;
    }
    if (!libraryEntryId) pendingImportRef.current = { file, requestId };
    setLibraryOpen(false);
    setState({
      status: "loading",
      drawing,
      renderFile: null,
      phase: "reading",
      progress: null,
    });

    const conversionController =
      drawing.format === "dwg" ? new AbortController() : null;
    conversionAbortRef.current = conversionController;

    try {
      const renderFile =
        drawing.format === "dwg"
          ? await convertDwgToDxf(
              file,
              conversionController?.signal,
              () => { if (requestId === requestIdRef.current) setState(current => current.status === "loading" ? { ...current, phase: "converting" } : current); },
            )
          : file;
      if (requestId !== requestIdRef.current) {
        return;
      }

      setState({
        status: "loading",
        drawing,
        renderFile,
        phase: "fetch",
        progress: null,
      });
    } catch (error) {
      if (requestId === requestIdRef.current) {
        setState({
          status: "error",
          error: toAppError(error, "DWG_CONVERSION_FAILED"),
        });
      }
    } finally {
      if (conversionAbortRef.current === conversionController) {
        conversionAbortRef.current = null;
      }
    }
  }, []);

  const openIncomingDrawing = useCallback(
    async (incoming: IncomingDrawing) => {
      if (handledIncomingIdsRef.current.has(incoming.id)) {
        return;
      }

      handledIncomingIdsRef.current.add(incoming.id);
      // Only retain a bounded deduplication history during long sessions.
      if (handledIncomingIdsRef.current.size > 100) {
        handledIncomingIdsRef.current.delete(handledIncomingIdsRef.current.values().next().value!);
      }
      incomingAbortRef.current?.abort();
      const controller = new AbortController();
      incomingAbortRef.current = controller;
      const incomingRequestId = ++incomingRequestIdRef.current;
      const appRequestId = requestIdRef.current;
      let file: File;

      try {
        file = await readIncomingDrawingFile(incoming, controller.signal);
      } catch (error) {
        if (
          incomingRequestId === incomingRequestIdRef.current &&
          appRequestId === requestIdRef.current
        ) {
          requestIdRef.current += 1;
          conversionAbortRef.current?.abort();
          conversionAbortRef.current = null;
          pendingImportRef.current = null;
          lastDrawingRef.current = null;
          setLibraryOpen(false);
          setState({
            status: "error",
            error: toAppError(error, "FILE_READ_FAILED"),
          });
        }
        return;
      } finally {
        if (incomingAbortRef.current === controller) incomingAbortRef.current = null;
        void incomingDrawingPlugin
          .acknowledgeDrawing({ id: incoming.id })
          .catch(() => undefined);
      }

      if (
        incomingRequestId === incomingRequestIdRef.current &&
        appRequestId === requestIdRef.current
      ) {
        await openFile(file);
      }
    },
    [openFile],
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let disposed = false;
    let listener: PluginListenerHandle | null = null;

    void (async () => {
      listener = await incomingDrawingPlugin.addListener(
        "drawingReceived",
        (drawing) => {
          if (!disposed) {
            void openIncomingDrawing(drawing);
          }
        },
      );

      if (disposed) {
        await listener.remove();
        return;
      }

      const { drawing } = await incomingDrawingPlugin.getPendingDrawing();
      if (drawing && !disposed) {
        await openIncomingDrawing(drawing);
      }
    })().catch(() => {
      if (!disposed) {
        console.error("Incoming drawing bridge could not be initialized.");
      }
    });

    return () => {
      disposed = true;
      if (listener) {
        void listener.remove();
      }
    };
  }, [openIncomingDrawing]);

  const handleProgress = useCallback(
    (phase: LoadingPhase, processed: number, total: number) => {
      setState((current) => {
        if (current.status !== "loading") {
          return current;
        }

        return {
          ...current,
          phase,
          progress:
            total > 0 && Number.isFinite(processed) && Number.isFinite(total)
              ? Math.min(1, Math.max(0, processed / total)) : null,
        };
      });
    },
    [],
  );

  const handleViewerReady = useCallback(() => {
    const pending = pendingImportRef.current;
    pendingImportRef.current = null;
    if (pending && pending.requestId === requestIdRef.current) {
      void importDrawingToLibrary(pending.file, ROOT_FOLDER_ID).catch(() => {
        if (pending.requestId === requestIdRef.current) setLibraryNotice(true);
      });
    }
    setState((current) => {
      if (current.status !== "loading" || !current.renderFile) {
        return current;
      }
      return {
        status: "viewer",
        drawing: current.drawing,
        renderFile: current.renderFile,
      };
    });
  }, []);

  const handleViewerError = useCallback((error: unknown) => {
    pendingImportRef.current = null;
    setState({
      status: "error",
      error: toAppError(error, "DXF_OPEN_FAILED"),
    });
  }, []);

  const closeDrawing = useCallback(() => {
    incomingRequestIdRef.current += 1;
    requestIdRef.current += 1;
    conversionAbortRef.current?.abort();
    conversionAbortRef.current = null;
    incomingAbortRef.current?.abort();
    incomingAbortRef.current = null;
    pendingImportRef.current = null;
    lastDrawingRef.current = null;
    setLibraryNotice(false);
    setMeasurement(emptyMeasurement);
    setIncomingArchive(null);
    setState({ status: "home" });
    setMeasurementPanelOpen(false);
    setSettingsOpen(false);
    setTakeoffActive(false);setAnnotationOpen(false);setAnnotationActive(false);setLayersOpen(false);
  }, []);

  const prepareNavigation=useCallback(async()=>{
    try{
      await viewerRef.current?.prepareToLeave?.();
      while(measurementWrites.current.size)await Promise.all([...measurementWrites.current]);
      if(commerceSnapshot().managed&&measurementOperationRef.current.blocked())throw Error('Pending operation');
    }catch{throw Error(navigationWords[locale].saveError);}
  },[locale]);
  const requestHome=useCallback(()=>{
    if(navigationLock.current)return;navigationLock.current=true;setNavigationBusy(true);setNavigationError('');
    void prepareNavigation().then(closeDrawing).catch(e=>setNavigationError(e.message)).finally(()=>{navigationLock.current=false;setNavigationBusy(false);});
  },[closeDrawing,prepareNavigation]);
  const requestExit=useCallback(()=>{viewerRef.current?.cancelGesture?.();setExitOpen(true);},[]);
  const openSettings=useCallback(()=>{viewerRef.current?.cancelGesture?.();setSettingsOpen(true);},[]);
  const confirmExit=useCallback(async()=>{
    await prepareNavigation();
    if(!Capacitor.isNativePlatform())throw Error(navigationWords[locale].browserExit);
    try{await incomingDrawingPlugin.exitApp();}catch{throw Error(navigationWords[locale].exitError);}
  },[prepareNavigation,locale]);

  const handleBack = useCallback(() => {
    if (libraryOpen) {
      setLibraryOpen(false);
    } else if(viewerRef.current?.finishText?.()){
      // Finish a text transaction before backing out of tools or the drawing.
    } else if(layersOpen){
      setLayersOpen(false);
    } else if(takeoffActive){
      viewerRef.current?.edit?.("cancel");setTakeoffActive(false);
    } else if(annotationOpen){
      setAnnotationOpen(false);
    } else if(annotationActive){
      setAnnotationActive(false);
    } else if (measurementPanelOpen) {
      setMeasurementPanelOpen(false);
    } else if (measurement.enabled) {
      setMeasurement((current) => ({ ...current, enabled: false }));
    } else if (state.status !== "home") {
      requestHome();
    } else if (Capacitor.isNativePlatform()) {
      requestExit();
    }
  }, [requestHome,requestExit, libraryOpen, state.status, measurement.enabled,measurementPanelOpen,annotationOpen,annotationActive,layersOpen,takeoffActive]);
  useBackNavigation(handleBack);

  useEffect(() => {
    let disposed = false;
    let backListener: PluginListenerHandle | null = null;
    if (Capacitor.isNativePlatform()) {
      void incomingDrawingPlugin.addListener("backPressed", dispatchBackNavigation)
        .then((listener) => {
          if (disposed) void listener.remove();
          else backListener = listener;
        }).catch(() => undefined);
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        dispatchBackNavigation();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      disposed = true;
      void backListener?.remove();
      window.removeEventListener("keydown", onKeyDown);
      requestIdRef.current += 1;
      incomingRequestIdRef.current += 1;
      conversionAbortRef.current?.abort();
      incomingAbortRef.current?.abort();
    };
  }, []);

  const sendCommand = useCallback((command: ViewerCommand) => {
    viewerRef.current?.execute(command);
  }, []);

  const handleMeasurementReady = useCallback((geometry: MeasurementGeometry) => {
    const display = geometry.displayUnits ?? geometry.units;
    unitPreferenceRef.current = { key: geometry.unitPreferenceKey, sourceUnit: geometry.units, displayUnit: display };
    setMeasurementGeometry(geometry);
    setSourceUnit(geometry.units);
    setDisplayUnit(display);
    if(commerceSnapshot().managed&&geometry.unitPreferenceKey)void readMeasurement<MeasurementSettings>(geometry.unitPreferenceKey).then(saved=>{
      if(saved&&unitPreferenceRef.current?.key===geometry.unitPreferenceKey&&measurementRef.current.points.length===0){const restored={...saved,enabled:true,displayOnly:true};measurementRef.current=restored;setMeasurement(restored);}
    }).catch(()=>undefined);
  }, []);
  const handleSourceUnit = useCallback((unit: MeasurementUnit) => {
    setSourceUnit(unit);
    setDisplayUnit(unit);
    const current = unitPreferenceRef.current;
    if (current) {
      const next = { ...current, sourceUnit: unit, displayUnit: unit };
      unitPreferenceRef.current = next;
      saveDrawingUnitPreference(next.key, next);
    }
  }, []);
  const handleDisplayUnit = useCallback((unit: MeasurementUnit) => {
    setDisplayUnit(unit);
    const current = unitPreferenceRef.current;
    if (current) {
      const next = { ...current, displayUnit: unit };
      unitPreferenceRef.current = next;
      saveDrawingUnitPreference(next.key, next);
    }
  }, []);
  const finishLocalMeasurement=(candidate:MeasurementSettings)=>{
    const key=unitPreferenceRef.current?.key,request=requestIdRef.current;
    if(localMeasurementSaving.current)return;
    if(!key){setMeasurementFeedback(t("librarySaveFailed"));return;}
    const saved={...candidate,enabled:true,displayOnly:true};
    localMeasurementSaving.current=true;setMeasurementSaving(true);
    void persistMeasurement(key,saved).then(()=>{
      if(request!==requestIdRef.current||measurementRef.current.mode!==candidate.mode)return;
      measurementHistory.current.record(measurementRef.current);measurementRef.current=saved;setMeasurement(saved);
    }).catch(()=>{if(request===requestIdRef.current)setMeasurementFeedback(t("librarySaveFailed"));})
      .finally(()=>{localMeasurementSaving.current=false;setMeasurementSaving(false);});
  };
  const handleMeasurementPick = useCallback((pick: MeasurementPick) => {
    const current=measurementRef.current;if(!current.enabled||current.displayOnly||localMeasurementSaving.current)return;
    const tool=measurementToolId(current.mode);
    if(commerceSnapshot().managed&&!isUnmeteredTool(tool)&&(measurementOperation.blocked()||!canStart(tool)))return;
    const next=current.mode==="object"?{...current,entity:pick.entity,points:[]}:{...current,points:measurementPointsAfterPick(current,pick.point,pick.replaceIndex),entity:null};
    if(commerceSnapshot().managed&&!isUnmeteredTool(tool)){const value=measurementValue(next),complete=next.mode==="object"?!!next.entity:next.mode==="path"?pathIsClosed(next.points):next.mode==="area"?false:next.mode==="angle"?next.points.length===3:next.points.length===2;
      if(complete&&value!==undefined&&Number.isFinite(value)&&value>0){measurementOperation.begin(next,tool);return;}}
    if(!commerceSnapshot().managed&&next.mode==="path"&&pathIsClosed(next.points)&&canFinishMeasurement(next)){finishLocalMeasurement(next);return;}
    measurementHistory.current.record(current);
    measurementRef.current=next;setMeasurement(next);
    if(isUnmeteredTool(tool)&&next.points.length===2&&unitPreferenceRef.current?.key)void persistMeasurement(unitPreferenceRef.current.key,next).catch(()=>setMeasurementFeedback(t("librarySaveFailed")));
    setMeasurementFeedback(pick.entity ? null : measurement.mode === "object" ? t("measureNoObject") : pick.snapped ? t(({ endpoint: "measureEndpoint", midpoint: "measureMidpoint", center: "measureCenter", insertion:"measureInsertion", start: "measureStartPoint",perpendicular:"measurePerpendicular",intersection:"measureIntersection",curve:"measureCurve",edge:"measureSnap" } as const)[pick.snapped]) : null);
  }, [measurement.mode, t,measurementOperation]);

  const finishMeasurement=()=>{
    const settings=measurementRef.current;
    if(!canFinishMeasurement(settings)||localMeasurementSaving.current)return;
    if(commerceSnapshot().managed){const tool=measurementToolId(settings.mode);if(!measurementOperation.blocked()&&canStart(tool))measurementOperation.begin(settings,tool);}
    else finishLocalMeasurement(settings);
  };

  const changeMeasurementSettings=(settings:MeasurementSettings)=>{
    if(localMeasurementSaving.current)return;
    const drawingRequest=requestIdRef.current;
    const apply=()=>{
      if(requestIdRef.current!==drawingRequest)return;
      const current=measurementRef.current;
      if(settings.mode!==current.mode){measurementHistory.current.clear();settings={...settings,displayOnly:false};}
      else if((settings.points!==current.points&&(settings.points.length>0||current.points.length>0))||settings.entity!==current.entity){measurementHistory.current.record(current);settings={...settings,displayOnly:false};}
      measurementRef.current=settings;if(settings.enabled)measurementActivated.current=true;
      setMeasurement(settings);setMeasurementFeedback(null);
    };
    const tool=measurementToolId(settings.mode);
    if(commerce.managed&&!isUnmeteredTool(tool)&&(measurementOperation.blocked()||settings.enabled&&!canStart(tool,apply)))return;
    apply();
  };
  const openMeasurementTools=()=>{
    setLayersOpen(false);
    setTakeoffActive(false);setAnnotationActive(false);setAnnotationOpen(false);setMeasurementPanelOpen(open=>!open);
    const current=measurementRef.current;
    if(!hasToolAccess(measurementToolId(current.mode))){
      const next={...current,mode:"distance" as const,enabled:true,displayOnly:false,points:[],entity:null};
      measurementRef.current=next;measurementActivated.current=true;setMeasurement(next);
    }else if(!measurementActivated.current||annotationActive||current.displayOnly){
      measurementActivated.current=true;const next={...current,enabled:true,displayOnly:false,...(current.displayOnly?{points:[],entity:null}:{})};measurementRef.current=next;setMeasurement(next);
    }
  };
  const toggleMeasurement=()=>{
    const drawingRequest=requestIdRef.current,tool=measurementToolId(measurementRef.current.mode);
    const apply=()=>{if(drawingRequest!==requestIdRef.current)return;measurementActivated.current=true;const current=measurementRef.current,next={...current,enabled:current.displayOnly?true:!current.enabled,displayOnly:false,...(current.displayOnly?{points:[],entity:null}:{})};measurementRef.current=next;setMeasurement(next);};
    if(commerce.managed&&!canStart(tool,apply))return;apply();
  };

  const handleEditCommand=(command:EditCommand)=>{
    if(takeoffActive){viewerRef.current?.edit?.(command);if(command==="cancel")setTakeoffActive(false);return;}
    if(localMeasurementSaving.current)return;
    if(commerce.managed&&!isUnmeteredTool(measurementToolId(measurementRef.current.mode))&&measurementOperation.blocked())return;
    viewerRef.current?.cancelGesture?.();
    if(command==="cancel"){
      viewerRef.current?.edit?.("cancel");
      setTakeoffActive(false);setAnnotationActive(false);setAnnotationOpen(false);setLayersOpen(false);setMeasurementPanelOpen(false);setMeasurementFeedback(null);
      const next={...measurementRef.current,enabled:false,points:[],entity:null};measurementRef.current=next;setMeasurement(next);
      measurementHistory.current.clear();measurementActivated.current=false;
    }else if(measurementRef.current.enabled&&!annotationActive){
      const next=measurementHistory.current[command](measurementRef.current);
      if(next){const restored={...measurementRef.current,points:next.points,entity:next.entity,displayOnly:next.displayOnly};measurementRef.current=restored;setMeasurement(restored);setMeasurementFeedback(null);}
    }else viewerRef.current?.edit?.(command);
  };

  const canvasRequestId = requestIdRef.current;
  const canvas =
    (state.status === "loading" && state.renderFile) ||
    state.status === "viewer" ? (
      <Suspense fallback={null}>
        {state.drawing.format === "pdf" ? <PdfViewer
          ref={viewerRef}
          key={requestIdRef.current}
          file={state.renderFile!}
          onProgress={(phase, processed, total) => { if (canvasRequestId === requestIdRef.current) handleProgress(phase, processed, total); }}
          onReady={() => { if (canvasRequestId === requestIdRef.current) handleViewerReady(); }}
          onError={(error) => { if (canvasRequestId === requestIdRef.current) handleViewerError(error); }}
        /> : <DrawingCanvas
          ref={viewerRef}
          key={requestIdRef.current}
          file={
            state.status === "viewer" ? state.renderFile : state.renderFile!
          }
          onProgress={(phase, processed, total) => {
            if (canvasRequestId === requestIdRef.current) handleProgress(phase, processed, total);
          }}
          onReady={() => {
            if (canvasRequestId === requestIdRef.current) handleViewerReady();
          }}
          onError={(error) => {
            if (canvasRequestId === requestIdRef.current) handleViewerError(error);
          }}
          measurement={measurement}
          onMeasurementReady={handleMeasurementReady}
          onMeasurementPick={handleMeasurementPick}
          onEditHistory={setEditHistory}
          takeoffActive={takeoffActive} drawingIdentity={{name:state.drawing.name,size:state.drawing.size,lastModified:state.drawing.file.lastModified}}
          annotationActive={annotationActive} annotationOpen={annotationOpen} layersOpen={layersOpen}
          onLayersToggle={()=>{setLayersOpen(open=>!open);setAnnotationOpen(false);setMeasurementPanelOpen(false);}}
          onLayersHide={()=>setLayersOpen(false)} sourceUnit={sourceUnit} displayUnit={displayUnit}
          precision={precision} onPrecision={handlePrecision}
          onAnnotationHide={()=>setAnnotationOpen(open=>!open)} onAnnotationPause={()=>setAnnotationActive(false)}
          onAnnotationActivate={()=>{setTakeoffActive(false);setLayersOpen(false);setAnnotationActive(true);setMeasurement(current=>({...current,enabled:false}));setMeasurementPanelOpen(false);}}
        />}
      </Suspense>
    ) : null;

  let content;
  if (state.status === "error") {
    content = (
      <>
        <header className="topbar minimal">
          <Brand />
          <LanguageSwitch />
        </header>
        <ErrorScreen
          error={state.error}
          onOpenLibrary={() => setLibraryOpen(true)}
          onRetry={lastDrawingRef.current ? () => {
            const last = lastDrawingRef.current;
            if (last) void openFile(last.file, last.libraryEntryId);
          } : undefined}
          onClose={closeDrawing}
        />
      </>
    );
  } else if (state.status === "home") {
    content = <HomeDashboard onLibrary={()=>setLibraryOpen(true)} onOpen={openFile} onAbout={()=>setAboutOpen(true)} onExit={requestExit} onSettings={openSettings} updatePending={updatePending}/>;
  } else if (state.status === "loading") {
    content = (
        <LoadingScreen
          phase={state.phase}
          progress={state.progress}
          fileName={state.drawing.name}
          onCancel={closeDrawing}
        />
    );
  } else {
    content = (
    <>
      <DrawingHeader name={state.drawing.name} format={state.drawing.format} size={formatBytes(state.drawing.size,locale)} busy={navigationBusy} settingsOpen={settingsOpen} onHome={requestHome} onLibrary={()=>setLibraryOpen(true)} onSettings={openSettings} onExit={requestExit}/>


      <ViewerToolbar takeoffActive={takeoffActive} onTakeoff={()=>{viewerRef.current?.cancelGesture?.();setTakeoffActive(true);viewerRef.current?.showTakeoffTools?.();setAnnotationActive(false);setAnnotationOpen(false);setLayersOpen(false);setMeasurementPanelOpen(false);setMeasurement(m=>({...m,enabled:false}));}} onCommand={sendCommand}
        selecting={(annotationActive||takeoffActive)&&editHistory.selecting} canDelete={(annotationActive||takeoffActive)&&editHistory.canDelete}
        onSelect={()=>{setLayersOpen(false);viewerRef.current?.objectAction?.("select");setAnnotationOpen(false);}}
        onDelete={()=>viewerRef.current?.objectAction?.("delete")}
        objectTool={annotationActive?editHistory.objectTool:undefined}
        onMove={()=>{setLayersOpen(false);viewerRef.current?.objectAction?.("move");setAnnotationOpen(false);}}
        onRotate={()=>{setLayersOpen(false);viewerRef.current?.objectAction?.("rotate");setAnnotationOpen(false);}}
        canUndo={measurement.enabled&&!annotationActive&&!takeoffActive?measurementHistory.current.canUndo:editHistory.canUndo}
        canRedo={measurement.enabled&&!annotationActive&&!takeoffActive?measurementHistory.current.canRedo:editHistory.canRedo}
        onUndo={()=>handleEditCommand("undo")} onRedo={()=>handleEditCommand("redo")} onCancel={()=>handleEditCommand("cancel")}
        canMeasure={state.drawing.format !== "pdf"}
        measuring={measurement.enabled}
        panelOpen={measurementPanelOpen}
        editing={annotationActive} editOpen={annotationOpen} onEdit={()=>{setTakeoffActive(false);setLayersOpen(false);setAnnotationOpen(open=>!open);setAnnotationActive(true);setMeasurement(current=>({...current,enabled:false}));setMeasurementPanelOpen(false);}}
        onMeasure={openMeasurementTools} />
      {state.drawing.format!=="pdf"&&!annotationActive&&!takeoffActive?<MeasurementStatus settings={measurement} sourceUnit={sourceUnit} displayUnit={displayUnit} feedback={measurementFeedback} precision={precision}
        onShow={()=>setMeasurementPanelOpen(open=>!open)} onFinish={finishMeasurement} finishDisabled={measurementSaving||(commerce.managed&&measurementOperation.blocked())} onToggle={toggleMeasurement}/>:null}
      {measurementPanelOpen && state.drawing.format !== "pdf" ? <MeasurementPanel settings={measurement} geometry={measurementGeometry}
        sourceUnit={sourceUnit} displayUnit={displayUnit} feedback={measurementFeedback} precision={precision} onPrecision={handlePrecision}
        onHide={()=>setMeasurementPanelOpen(false)}
        onSettings={changeMeasurementSettings}
        onFinish={finishMeasurement} finishDisabled={measurementSaving||(commerce.managed&&measurementOperation.blocked())}
        onSourceUnit={handleSourceUnit} onDisplayUnit={handleDisplayUnit} /> : null}
      {libraryNotice ? <div className="library-notice" role="status">{t("librarySaveFailed")}</div> : null}
    </>
    );
  }

  return (
    <div className={`app-shell ${state.status === "home" ? "home" : "viewer-shell"}`}>
      {canvas ? <div className="canvas-layer" inert={libraryOpen||aboutOpen||settingsOpen||exitOpen||navigationBusy} aria-hidden={libraryOpen||aboutOpen||settingsOpen||exitOpen}>{canvas}</div> : null}
      <div className="app-content" hidden={libraryOpen} inert={aboutOpen||settingsOpen||exitOpen||navigationBusy} aria-busy={navigationBusy}>{content}</div>
      {navigationError?<div className="navigation-error" role="alert">{navigationError}<button type="button" aria-label={navigationWords[locale].dismiss} onClick={()=>setNavigationError('')}><CloseIcon/></button></div>:null}
      {settingsOpen?<ViewerSettings onClose={()=>setSettingsOpen(false)}/>:null}
      {exitOpen?<ExitConfirmation onCancel={()=>setExitOpen(false)} onConfirm={confirmExit}/>:null}
      {aboutOpen?<AboutPanel onClose={()=>setAboutOpen(false)}/>:null}
      <CommercePortal/>
      {commerce.managed?measurementOperation.controls:null}
      <AppUpdateCenter onPendingChange={setUpdatePending}/>
      {libraryOpen ? (
        <div className="library-overlay">
          <DrawingLibrary onClose={() => { setLibraryOpen(false); setIncomingArchive(null); }} onOpen={openFile}
            incomingArchive={incomingArchive} onIncomingArchiveHandled={() => setIncomingArchive(null)} />
        </div>
      ) : null}
    </div>
  );
}
