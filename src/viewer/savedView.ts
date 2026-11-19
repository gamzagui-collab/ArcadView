export type DrawingPoint = {
  x: number;
  y: number;
};

export type DrawingBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type SavedDrawingView = {
  center: DrawingPoint;
  viewHeight: number;
  aspectRatio?: number;
  twistAngle?: number;
};

export type ResolvedDrawingView = {
  center: DrawingPoint;
  width: number;
};

const savedViews = new WeakMap<File, SavedDrawingView>();
const MAX_SAVED_VIEW_FIT_RATIO = 4;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeSavedDrawingView(
  view: SavedDrawingView,
): SavedDrawingView | null {
  if (
    !isFiniteNumber(view.center.x) ||
    !isFiniteNumber(view.center.y) ||
    !isFiniteNumber(view.viewHeight) ||
    view.viewHeight <= 0
  ) {
    return null;
  }

  const aspectRatio =
    isFiniteNumber(view.aspectRatio) && view.aspectRatio > 0
      ? view.aspectRatio
      : undefined;
  const twistAngle = isFiniteNumber(view.twistAngle)
    ? view.twistAngle
    : undefined;

  return {
    center: {
      x: view.center.x,
      y: view.center.y,
    },
    viewHeight: view.viewHeight,
    ...(aspectRatio === undefined ? {} : { aspectRatio }),
    ...(twistAngle === undefined ? {} : { twistAngle }),
  };
}

export function registerSavedDrawingView(
  file: File,
  view: SavedDrawingView | null,
): void {
  if (!view) {
    return;
  }

  const normalized = normalizeSavedDrawingView(view);
  if (normalized) {
    savedViews.set(file, normalized);
  }
}

export function getSavedDrawingView(
  file: File,
): SavedDrawingView | null {
  return savedViews.get(file) ?? null;
}

export function resolveSavedDrawingView(
  view: SavedDrawingView | null,
  bounds: DrawingBounds | null,
  origin: DrawingPoint,
  viewportAspect: number,
  entityBounds: readonly DrawingBounds[] = [],
): ResolvedDrawingView | null {
  if (
    !view ||
    !bounds ||
    !isFiniteNumber(origin?.x) ||
    !isFiniteNumber(origin?.y) ||
    !Object.values(bounds).every(isFiniteNumber) ||
    bounds.minX > bounds.maxX ||
    bounds.minY > bounds.maxY ||
    !isFiniteNumber(viewportAspect) ||
    viewportAspect <= 0
  ) {
    return null;
  }

  const normalized = normalizeSavedDrawingView(view);
  if (!normalized) {
    return null;
  }

  const width = normalized.viewHeight *
    Math.max(normalized.aspectRatio ?? viewportAspect, viewportAspect);
  const height = width / viewportAspect;
  const center = {
    x: normalized.center.x - origin.x,
    y: normalized.center.y - origin.y,
  };
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    !Number.isFinite(center.x) ||
    !Number.isFinite(center.y)
  ) {
    return null;
  }
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const viewMinX = normalized.center.x - halfWidth;
  const viewMaxX = normalized.center.x + halfWidth;
  const viewMinY = normalized.center.y - halfHeight;
  const viewMaxY = normalized.center.y + halfHeight;
  const intersectsDrawing =
    viewMaxX >= bounds.minX &&
    viewMinX <= bounds.maxX &&
    viewMaxY >= bounds.minY &&
    viewMinY <= bounds.maxY;

  if (!intersectsDrawing) {
    return null;
  }

  const drawingWidth = bounds.maxX - bounds.minX;
  const drawingHeight = bounds.maxY - bounds.minY;
  const fitWidth = Math.max(drawingWidth, drawingHeight * viewportAspect);
  // A valid desktop viewport may include a little context or focus on one
  // sheet. A viewport several times larger than all visible geometry instead
  // leaves the drawing as a tiny dot, especially after adapting it to a phone.
  // Let the content fit take over in that case without changing useful views.
  if (
    Number.isFinite(fitWidth) &&
    fitWidth > 0 &&
    width / fitWidth > MAX_SAVED_VIEW_FIT_RATIO
  ) {
    return null;
  }

  // A viewport can intersect the overall extents while sitting in the empty
  // gap between distant blocks. Keep the saved zoom, but anchor that empty
  // view to a dense group of actual geometry. This only moves the camera;
  // the fit-all command and all drawing coordinates remain unchanged.
  const visibleBounds = entityBounds.filter((box) =>
    Object.values(box).every(isFiniteNumber) &&
    box.minX <= box.maxX && box.minY <= box.maxY,
  );
  if (visibleBounds.length > 0 && !visibleBounds.some((box) =>
    viewMaxX >= box.minX && viewMinX <= box.maxX &&
    viewMaxY >= box.minY && viewMinY <= box.maxY,
  )) {
    const cells = new Map<string, { count: number; x: number; y: number }>();
    let densest: { count: number; x: number; y: number } | undefined;
    for (const box of visibleBounds) {
      if (box.maxX - box.minX > halfWidth || box.maxY - box.minY > halfHeight) continue;
      const x = box.minX + (box.maxX - box.minX) / 2;
      const y = box.minY + (box.maxY - box.minY) / 2;
      const key = `${Math.floor(x / halfWidth)},${Math.floor(y / halfHeight)}`;
      const cell = cells.get(key) ?? { count: 0, x: 0, y: 0 };
      cell.count++;
      cell.x += x;
      cell.y += y;
      cells.set(key, cell);
      if (!densest || cell.count > densest.count) densest = cell;
    }
    if (!densest) return null;
    center.x = densest.x / densest.count - origin.x;
    center.y = densest.y / densest.count - origin.y;
  }

  return {
    center,
    // VIEWSIZE is the saved vertical field of view. Preserve the complete
    // saved desktop rectangle on narrower phone screens instead of cropping
    // it horizontally and making neighbouring sheets look overlapped.
    width,
  };
}
