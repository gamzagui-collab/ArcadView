import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useI18n } from "../i18n/I18nProvider";
import { AppError, type LoadingPhase, type ViewerHandle } from "../types/drawing";

type Props = {
  file: File;
  onProgress(phase: LoadingPhase, processed: number, total: number): void;
  onReady(): void;
  onError(error: unknown): void;
};

/** Render the selected page only, so large PDFs do not allocate a canvas per page. */
export const PdfViewer = forwardRef<ViewerHandle, Props>(function PdfViewer(
  { file, onProgress, onReady, onError }, ref,
) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<RenderTask | null>(null);
  const callbacksRef = useRef({ onProgress, onReady, onError });
  callbacksRef.current = { onProgress, onReady, onError };
  const readyRef = useRef(false);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const zoomRef=useRef(zoom);zoomRef.current=zoom;
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(true);

  useImperativeHandle(ref, () => ({
    execute(command) {
      if (command === "zoom-in") setZoom((value) => Math.min(6, value * 1.25));
      if (command === "zoom-out") setZoom((value) => Math.max(0.25, value / 1.25));
      if (command === "fit" || command === "reset") {
        setZoom(1);
        scrollRef.current?.scrollTo({ top: 0, left: 0 });
      }
    },
  }), []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  // The compact toolbar has no zoom buttons; retain PDF zoom through two fingers.
  useEffect(()=>{
    const element=scrollRef.current;if(!element)return;
    let pinch:{distance:number;zoom:number}|null=null;
    const span=(e:TouchEvent)=>Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);
    const start=(e:TouchEvent)=>{pinch=e.touches.length===2?{distance:span(e),zoom:zoomRef.current}:null;};
    const move=(e:TouchEvent)=>{if(!pinch||e.touches.length!==2||pinch.distance<4)return;if(e.cancelable)e.preventDefault();setZoom(Math.max(.25,Math.min(6,pinch.zoom*span(e)/pinch.distance)));};
    const end=()=>{pinch=null;};
    element.addEventListener("touchstart",start,{passive:true});element.addEventListener("touchmove",move,{passive:false});
    element.addEventListener("touchend",end);element.addEventListener("touchcancel",end);
    return()=>{element.removeEventListener("touchstart",start);element.removeEventListener("touchmove",move);element.removeEventListener("touchend",end);element.removeEventListener("touchcancel",end);};
  },[]);

  useEffect(() => {
    let active = true;
    let loading: PDFDocumentLoadingTask | undefined;
    let failed = false;
    readyRef.current = false;
    setDocument(null);
    setPage(1);
    setZoom(1);
    setRendering(true);
    const fail = (error: AppError) => {
      if (!active || failed) return;
      failed = true;
      callbacksRef.current.onError(error);
    };
    void (async () => {
      callbacksRef.current.onProgress("reading", 0, file.size);
      const data = new Uint8Array(await file.arrayBuffer());
      if (!active) return;
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (!active) return;
      const assetRoot = new URL(`${import.meta.env.BASE_URL}pdfjs/`, location.href).href;
      pdfjs.GlobalWorkerOptions.workerSrc = `${assetRoot}pdf.worker.min.mjs`;
      callbacksRef.current.onProgress("parse", 0, 0);
      loading = pdfjs.getDocument({
        data, cMapUrl: `${assetRoot}cmaps/`, cMapPacked: true,
        standardFontDataUrl: `${assetRoot}standard_fonts/`, wasmUrl: `${assetRoot}wasm/`, iccUrl: `${assetRoot}iccs/`,
        enableXfa: false,
      });
      loading.onPassword = () => {
        fail(new AppError("PDF_PASSWORD_REQUIRED"));
        void loading?.destroy();
      };
      const pdf = await loading.promise;
      if (!active) { void loading.destroy(); return; }
      callbacksRef.current.onProgress("prepare", 0, pdf.numPages);
      setDocument(pdf);
    })().catch((error: unknown) => fail(new AppError("PDF_OPEN_FAILED", undefined, { cause: error })));
    return () => {
      active = false;
      renderRef.current?.cancel();
      void loading?.destroy().catch(() => undefined);
    };
  }, [file]);

  useEffect(() => {
    if (!document || !canvasRef.current || width <= 0) return;
    let active = true;
    let task: RenderTask | null = null;
    const previous = renderRef.current;
    setRendering(true);
    void (async () => {
      // Cancellation finishes asynchronously; never reuse the canvas concurrently.
      await previous?.promise.catch(() => undefined);
      const pdfPage = await document.getPage(page);
      if (!active || !canvasRef.current) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = Math.max(0.05, (width - 36) / base.width) * zoom;
      const viewport = pdfPage.getViewport({ scale });
      const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2,
        Math.sqrt(12_000_000 / (viewport.width * viewport.height)),
        8192 / Math.max(viewport.width, viewport.height));
      const canvas = canvasRef.current;
      canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio));
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      task = pdfPage.render({ canvas, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0], background: "#ffffff" });
      renderRef.current = task;
      await task.promise;
      if (!active) return;
      setRendering(false);
      callbacksRef.current.onProgress("prepare", page, document.numPages);
      if (!readyRef.current) { readyRef.current = true; callbacksRef.current.onReady(); }
    })().catch((error: unknown) => {
      if (active) callbacksRef.current.onError(new AppError("PDF_OPEN_FAILED", undefined, { cause: error }));
    });
    return () => { active = false; task?.cancel(); };
  }, [document, page, width, zoom]);

  const changePage = (next: number) => {
    if (!Number.isFinite(next)) return;
    setPage(Math.max(1, Math.min(document?.numPages ?? 1, Math.trunc(next))));
    scrollRef.current?.scrollTo({ left: 0, top: 0 });
  };
  return (
    <div className="pdf-viewer">
      <div ref={scrollRef} className="pdf-scroll" aria-busy={rendering}>
        <canvas ref={canvasRef} className="pdf-page" aria-label={`${t("pdfPage")} ${page}`} />
      </div>
      <div className="pdf-pagination">
        <button type="button" onClick={() => changePage(page - 1)} disabled={!document || page <= 1} aria-label={t("pdfPreviousPage")}>‹</button>
        <label>
          <span>{t("pdfPage")}</span>
          <input type="number" min={1} max={document?.numPages ?? 1} value={page}
            disabled={!document} onChange={(event) => { if (event.target.value) changePage(Number(event.target.value)); }} />
          <span>/ {document?.numPages ?? "—"}</span>
        </label>
        <button type="button" onClick={() => changePage(page + 1)} disabled={!document || page >= document.numPages} aria-label={t("pdfNextPage")}>›</button>
        <span className="pdf-zoom-label" aria-label={t("pdfZoom")}>{Math.round(zoom * 100)}%</span>
        {rendering ? <span className="pdf-rendering" role="status">{t("pdfLoading")}</span> : null}
      </div>
    </div>
  );
});
