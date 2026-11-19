import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { DrawingLibrary } from "../components/DrawingLibrary";
import { ErrorScreen } from "../components/ErrorScreen";
import { CloseIcon, FolderIcon } from "../components/Icons";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { LoadingScreen } from "../components/LoadingScreen";
import { HomeDashboard } from "../components/HomeDashboard";
import { AboutPanel } from "../components/AboutPanel";
import { AppUpdateCenter } from "../components/AppUpdateCenter";
import { Brand, ArcadMark } from "../components/Brand";
import { ViewerToolbar } from "../components/ViewerToolbar";
import { MeasurementPanel, MeasurementStatus } from "../components/MeasurementPanel";
import type { MeasurementPick } from "../viewer/DrawingViewer";
import type { MeasurementGeometry, MeasurementSettings, MeasurementUnit } from "../viewer/measurementGeometry";
import { measurementPointsAfterPick } from "../viewer/measurementTools";
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
  return error instanceof AppError
    ? error
    : new AppError(fallback, undefined, { cause: error });
}

export function App() {
  const { locale, t } = useI18n();
  const [state, setState] = useState<AppState>({ status: "home" });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [aboutOpen,setAboutOpen]=useState(false);
  const [libraryNotice, setLibraryNotice] = useState(false);
  const [incomingArchive, setIncomingArchive] = useState<File | null>(null);
  const [measurement, setMeasurement] = useState<MeasurementSettings>(emptyMeasurement);
  const [measurementPanelOpen,setMeasurementPanelOpen]=useState(false);
  const [annotationOpen,setAnnotationOpen]=useState(false);
  const [annotationActive,setAnnotationActive]=useState(false);
  const measurementActivated=useRef(false);
  const [measurementGeometry, setMeasurementGeometry] = useState<MeasurementGeometry | null>(null);
  const [sourceUnit, setSourceUnit] = useState<MeasurementUnit>("drawing");
  const [displayUnit, setDisplayUnit] = useState<MeasurementUnit>("drawing");
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
    setMeasurementPanelOpen(false);
    setAnnotationOpen(false);setAnnotationActive(false);
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
    setAnnotationOpen(false);setAnnotationActive(false);
  }, []);

  const handleBack = useCallback(() => {
    if (libraryOpen) {
      setLibraryOpen(false);
    } else if(annotationOpen){
      setAnnotationOpen(false);
    } else if(annotationActive){
      setAnnotationActive(false);
    } else if (measurementPanelOpen) {
      setMeasurementPanelOpen(false);
    } else if (measurement.enabled) {
      setMeasurement((current) => ({ ...current, enabled: false }));
    } else if (state.status !== "home") {
      closeDrawing();
    } else if (Capacitor.isNativePlatform()) {
      void incomingDrawingPlugin.exitApp().catch(() => undefined);
    }
  }, [closeDrawing, libraryOpen, state.status, measurement.enabled,measurementPanelOpen,annotationOpen,annotationActive]);
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
  const handleMeasurementPick = useCallback((pick: MeasurementPick) => {
    setMeasurement((current) => {
      if (!current.enabled) return current;
      if (current.mode === "object") return { ...current, entity: pick.entity, points: [] };
      return { ...current, points: measurementPointsAfterPick(current, pick.point, pick.replaceIndex), entity: null };
    });
    setMeasurementFeedback(pick.entity ? null : measurement.mode === "object" ? t("measureNoObject") : pick.snapped ? t(({ endpoint: "measureEndpoint", midpoint: "measureMidpoint", center: "measureCenter", insertion:"measureInsertion", start: "measureStartPoint",perpendicular:"measurePerpendicular" } as const)[pick.snapped]) : null);
  }, [measurement.mode, t]);

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
          annotationActive={annotationActive} annotationOpen={annotationOpen} sourceUnit={sourceUnit} displayUnit={displayUnit}
          onAnnotationHide={()=>setAnnotationOpen(open=>!open)} onAnnotationPause={()=>setAnnotationActive(false)}
          onAnnotationActivate={()=>{setAnnotationActive(true);setMeasurement(current=>({...current,enabled:false}));setMeasurementPanelOpen(false);}}
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
    content = <HomeDashboard onLibrary={()=>setLibraryOpen(true)} onOpen={openFile} onAbout={()=>setAboutOpen(true)}/>;
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
      <header className="viewer-header">
        <div className="file-heading">
          <ArcadMark className="viewer-brand-mark"/>
          <div>
            <strong>{state.drawing.name}</strong>
            <span>
              <b className="file-format">{state.drawing.format}</b> · {formatBytes(state.drawing.size, locale)}
            </span>
          </div>
        </div>
        <div className="viewer-header-actions">
          <button
            type="button"
            className="open-button compact"
            aria-label={t("myDrawings")}
            title={t("myDrawings")}
            onClick={() => setLibraryOpen(true)}
          >
            <FolderIcon />
            <span>{t("myDrawings")}</span>
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t("close")}
            title={t("close")}
            onClick={closeDrawing}
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <ViewerToolbar onCommand={sendCommand}
        canMeasure={state.drawing.format !== "pdf"}
        measuring={measurement.enabled}
        panelOpen={measurementPanelOpen}
        editing={annotationActive} editOpen={annotationOpen} onEdit={()=>{setAnnotationOpen(open=>!open);setAnnotationActive(true);setMeasurement(current=>({...current,enabled:false}));setMeasurementPanelOpen(false);}}
        onMeasure={() => {setAnnotationActive(false);setAnnotationOpen(false);setMeasurementPanelOpen(open=>!open);if(!measurementActivated.current||annotationActive){measurementActivated.current=true;setMeasurement(current=>({...current,enabled:true}));}}} />
      {state.drawing.format!=="pdf"&&!annotationActive?<MeasurementStatus settings={measurement} sourceUnit={sourceUnit} displayUnit={displayUnit} feedback={measurementFeedback}
        onShow={()=>setMeasurementPanelOpen(open=>!open)} onToggle={()=>{measurementActivated.current=true;setMeasurement(current=>({...current,enabled:!current.enabled}));}}/>:null}
      {measurementPanelOpen && state.drawing.format !== "pdf" ? <MeasurementPanel settings={measurement} geometry={measurementGeometry}
        sourceUnit={sourceUnit} displayUnit={displayUnit} feedback={measurementFeedback}
        onHide={()=>setMeasurementPanelOpen(false)}
        onSettings={(settings) => { if(settings.enabled)measurementActivated.current=true;setMeasurement(settings); setMeasurementFeedback(null); }}
        onSourceUnit={handleSourceUnit} onDisplayUnit={handleDisplayUnit} /> : null}
      {libraryNotice ? <div className="library-notice" role="status">{t("librarySaveFailed")}</div> : null}
    </>
    );
  }

  return (
    <div className={`app-shell ${state.status === "home" ? "home" : "viewer-shell"}`}>
      {canvas ? <div className="canvas-layer" inert={libraryOpen||aboutOpen} aria-hidden={libraryOpen||aboutOpen}>{canvas}</div> : null}
      <div className="app-content" hidden={libraryOpen} inert={aboutOpen}>{content}</div>
      {aboutOpen?<AboutPanel onClose={()=>setAboutOpen(false)}/>:null}
      <AppUpdateCenter/>
      {libraryOpen ? (
        <div className="library-overlay">
          <DrawingLibrary onClose={() => { setLibraryOpen(false); setIncomingArchive(null); }} onOpen={openFile}
            incomingArchive={incomingArchive} onIncomingArchiveHandled={() => setIncomingArchive(null)} />
        </div>
      ) : null}
    </div>
  );
}
