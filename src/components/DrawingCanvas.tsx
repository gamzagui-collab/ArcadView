import {
  forwardRef,
  useCallback,
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
import {TakeoffEditor,type TakeoffHandle} from "./TakeoffEditor";
import type { EditHistoryState } from "../viewer/undoHistory";
import { measurementReadout,measurementPointsAfterPick } from "../viewer/measurementTools";
import { formatCadNumber } from "../viewer/displayPrecision";
import { useI18n } from "../i18n/I18nProvider";

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
  takeoffActive:boolean;
  drawingIdentity:{name:string;size:number;lastModified:number};
  annotationActive:boolean;
  annotationOpen:boolean;
  layersOpen:boolean;
  onLayersToggle():void;
  onLayersHide():void;
  sourceUnit:MeasurementUnit;
  displayUnit:MeasurementUnit;
  precision:number;
  onPrecision(value:number):void;
  onAnnotationHide():void;
  onAnnotationActivate():void;
  onAnnotationPause():void;
  onEditHistory(state:EditHistoryState):void;
};

export const DrawingCanvas = forwardRef<ViewerHandle, Props>(
  function DrawingCanvas({ file, onProgress, onReady, onError, measurement, onMeasurementPick, onMeasurementReady,takeoffActive,drawingIdentity,annotationActive,annotationOpen,layersOpen,onLayersToggle,onLayersHide,sourceUnit,displayUnit,precision,onPrecision,onAnnotationHide,onAnnotationActivate,onAnnotationPause,onEditHistory }, ref) {
    const {locale}=useI18n();
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<DrawingViewer | null>(null);
    const annotationRef=useRef<AnnotationEditorHandle>(null),takeoffRef=useRef<TakeoffHandle>(null),takeoffActiveRef=useRef(takeoffActive);takeoffActiveRef.current=takeoffActive;
    const annotationHistory=useCallback((state:EditHistoryState)=>{if(!takeoffActive)onEditHistory(state);},[takeoffActive,onEditHistory]);
    const [readyViewer,setReadyViewer]=useState<DrawingViewer|null>(null);
    const unitRef=useRef({sourceUnit,displayUnit,precision,locale});unitRef.current={sourceUnit,displayUnit,precision,locale};
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
      const preview=settings.displayOnly?null:previewRef.current;
      const readout=preview&&(settings.mode==="path"||settings.mode==="area")?{...settings,points:measurementPointsAfterPick(settings,preview.point,preview.replaceIndex)}:settings;
      const {value,area}=measurementReadout(readout),u=unitRef.current;
      const label=value===undefined?undefined:settings.mode==="angle"?`${formatCadNumber(value,u.precision,u.locale)}°`:`${settings.mode==="radius"?"R ":""}${formatCadNumber(convertMeasurement(value,u.sourceUnit,u.displayUnit,area),u.precision,u.locale)} ${u.displayUnit==="drawing"?"":u.displayUnit}${area?"²":""}`;
      drawMeasurementOverlay(overlayRef.current, settings, points => viewer.projectPoints(points), preview,viewer.getMeasurementReferences(),viewer.getMeasurementEndReferences(),label);
    };

    useLayoutEffect(() => {
      viewerRef.current?.configureMeasurement({...measurement,enabled:measurement.enabled&&!measurement.displayOnly});
      updateProjection();
    }, [measurement,sourceUnit,displayUnit,precision,locale]);

    useImperativeHandle(
      ref,
      () => ({
        edit(command) { viewerRef.current?.cancelInteraction();if(takeoffActiveRef.current)takeoffRef.current?.execute(command);else annotationRef.current?.execute(command); },
        objectAction(command) { viewerRef.current?.cancelInteraction();if(takeoffActiveRef.current)takeoffRef.current?.objectAction(command);else annotationRef.current?.objectAction(command); },
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
        {readyViewer?<AnnotationEditor ref={annotationRef} viewer={readyViewer} active={annotationActive} open={annotationOpen} layersOpen={layersOpen} onLayersToggle={onLayersToggle} onLayersHide={onLayersHide} sourceUnit={sourceUnit} displayUnit={displayUnit} precision={precision} onPrecision={onPrecision} onHide={onAnnotationHide} onActivate={onAnnotationActivate} onPause={onAnnotationPause} onHistoryState={annotationHistory}/>:null}
        {readyViewer?<TakeoffEditor ref={takeoffRef} viewer={readyViewer} identity={drawingIdentity} active={takeoffActive} sourceUnit={sourceUnit} onHistory={onEditHistory}/>:null}
        <svg ref={overlayRef} className="measurement-overlay" aria-hidden="true" />
      </div>
    );
  },
);

