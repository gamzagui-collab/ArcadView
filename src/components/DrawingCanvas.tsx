import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useLayoutEffect,
  useState,
} from "react";
import {
  AppError,
  type LoadingPhase,
  type ViewerCommand,
  type ViewerHandle,
} from "../types/drawing";
import { DrawingViewer, type MeasurementPick } from "../viewer/DrawingViewer";
import { convertMeasurement, type MeasurementGeometry, type MeasurementSettings, type MeasurementUnit } from "../viewer/measurementGeometry";
import { drawMeasurementOverlay } from "../viewer/measurementOverlay";
import { AnnotationEditor, type AnnotationEditorHandle } from "./AnnotationEditor";
import type { EditHistoryState } from "../viewer/undoHistory";
import { measurementValue } from "../viewer/measurementTools";

type Props = {
  file: File;
  onProgress(
    phase: LoadingPhase,
    processed: number,
    total: number,
  ): void;
  onReady(): void;
  onError(error: unknown): void;
  measurement: MeasurementSettings;
  onMeasurementPick(pick: MeasurementPick): void;
  onMeasurementReady(geometry: MeasurementGeometry): void;
  annotationActive:boolean;
  annotationOpen:boolean;
  sourceUnit:MeasurementUnit;
  displayUnit:MeasurementUnit;
  onAnnotationHide():void;
  onAnnotationActivate():void;
  onAnnotationPause():void;
  onEditHistory(state:EditHistoryState):void;
};

export const DrawingCanvas = forwardRef<ViewerHandle, Props>(
  function DrawingCanvas({ file, onProgress, onReady, onError, measurement, onMeasurementPick, onMeasurementReady,annotationActive,annotationOpen,sourceUnit,displayUnit,onAnnotationHide,onAnnotationActivate,onAnnotationPause,onEditHistory }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<DrawingViewer | null>(null);
    const annotationRef=useRef<AnnotationEditorHandle>(null);
    const [readyViewer,setReadyViewer]=useState<DrawingViewer|null>(null);
    const unitRef=useRef({sourceUnit,displayUnit});unitRef.current={sourceUnit,displayUnit};
    const callbacksRef = useRef({ onProgress, onReady, onError, onMeasurementPick, onMeasurementReady });
    callbacksRef.current = { onProgress, onReady, onError, onMeasurementPick, onMeasurementReady };
    const measurementRef = useRef(measurement);
    measurementRef.current = measurement;
    const overlayRef = useRef<SVGSVGElement>(null);
    const previewRef = useRef<MeasurementPick | null>(null);
    const updateProjection = () => {
      const settings = measurementRef.current;
      const viewer = viewerRef.current;
      if (!viewer || !overlayRef.current) return;
      const value=measurementValue(settings),u=unitRef.current;
      const label=value===undefined?undefined:settings.mode==="angle"?`${value.toFixed(1)}°`:`${new Intl.NumberFormat("ko",{maximumFractionDigits:3}).format(convertMeasurement(value,u.sourceUnit,u.displayUnit,settings.mode==="area"))} ${u.displayUnit==="drawing"?"":u.displayUnit}${settings.mode==="area"?"²":""}`;
      drawMeasurementOverlay(overlayRef.current, settings, points => viewer.projectPoints(points), previewRef.current,viewer.getMeasurementReferences(),viewer.getMeasurementEndReferences(),label);
    };

    useLayoutEffect(() => {
      viewerRef.current?.configureMeasurement(measurement);
      updateProjection();
    }, [measurement,sourceUnit,displayUnit]);

    useImperativeHandle(
      ref,
      () => ({
        edit(command) { viewerRef.current?.cancelInteraction();annotationRef.current?.execute(command); },
        cancelGesture() { viewerRef.current?.cancelInteraction(); },
        finishText() { return annotationRef.current?.finishText()??false; },
        execute(command: ViewerCommand) {
          try {
            viewerRef.current?.execute(command);
          } catch (error) {
            callbacksRef.current.onError(
              error instanceof AppError
                ? error
                : new AppError("RENDER_FAILED", undefined, { cause: error }),
            );
          }
        },
      }),
      [],
    );

    useEffect(() => {
      if (!containerRef.current) {
        return;
      }

      let active = true;
      let viewer: DrawingViewer;
      try {
        viewer = new DrawingViewer(containerRef.current, (error) => {
          if (active) {
            callbacksRef.current.onError(error);
          }
        }, (pick) => { if (active) callbacksRef.current.onMeasurementPick(pick); }, () => { if (active) updateProjection(); }, pick => {
          if (active) { previewRef.current = pick; updateProjection(); }
        });
      } catch (error) {
        callbacksRef.current.onError(error);
        return;
      }
      viewerRef.current = viewer;

      viewer
        .load(file, (phase, processed, total) => {
          if (active) {
            callbacksRef.current.onProgress(phase, processed, total);
          }
        })
        .then(() => {
          if (active) {
            viewer.configureMeasurement(measurementRef.current);
            setReadyViewer(viewer);
            callbacksRef.current.onMeasurementReady(viewer.getMeasurementGeometry());
            callbacksRef.current.onReady();
          }
        })
        .catch((error: unknown) => {
          if (active) {
            callbacksRef.current.onError(error);
          }
        });

      return () => {
        active = false;
        previewRef.current = null;
        viewerRef.current = null;
        viewer.destroy();
      };
    }, [file]);

    return (
      <div className={`drawing-canvas ${measurement.enabled ? "measurement-active" : ""}`}>
        <div ref={containerRef} className="drawing-surface" />
        {readyViewer?<AnnotationEditor ref={annotationRef} viewer={readyViewer} active={annotationActive} open={annotationOpen} sourceUnit={sourceUnit} displayUnit={displayUnit} onHide={onAnnotationHide} onActivate={onAnnotationActivate} onPause={onAnnotationPause} onHistoryState={onEditHistory}/>:null}
        <svg ref={overlayRef} className="measurement-overlay" aria-hidden="true" />
      </div>
    );
  },
);

