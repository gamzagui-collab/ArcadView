type SplineEdge = {
  type: number;
  rational?: boolean | number;
  degreeOfSplineCurve?: number;
  controlPoints?: unknown[];
  knotValues?: number[];
};

type Hatch = {
  boundaryLoops?: Array<{ edges?: SplineEdge[] }>;
};

type Spline = { knots: number[]; weights: number[] };
type Scene = {
  _GetHatchBoundaryLoops(entity: Hatch): unknown;
  _InterpolateSpline(
    t: number, degree: number, points: number[][],
    knots?: number[] | null, weights?: number[] | null,
  ): number[];
};

const patchedConstructors = new WeakSet<object>();

/**
 * Some LibreDWG WASM builds emit rational HATCH weights as group 40 instead
 * of group 42. dxf-viewer consequently appends one weight per control point
 * to the knot vector. Recover only that exact layout; never invent knots or
 * discard a boundary to make a malformed curve render.
 */
export function recoverHatchSpline(edge: SplineEdge): Spline | null {
  const degree = edge.degreeOfSplineCurve;
  const pointCount = edge.controlPoints?.length ?? 0;
  const values = edge.knotValues;
  if (edge.type !== 4 || !edge.rational || degree === undefined ||
      !Number.isInteger(degree) || degree < 1 || degree >= pointCount || !values) {
    return null;
  }
  const knotCount = pointCount + degree + 1;
  if (values.length !== knotCount + pointCount) return null;
  const knots = values.slice(0, knotCount);
  const weights = values.slice(knotCount);
  if (knots.some((value, index) => !Number.isFinite(value) ||
      (index > 0 && value < knots[index - 1])) ||
      knots[degree] >= knots[pointCount] ||
      weights.some(value => !Number.isFinite(value) || value <= 0)) {
    return null;
  }
  return { knots, weights };
}

export function installHatchSplineCompatibility(constructor: object): void {
  if (patchedConstructors.has(constructor)) return;
  const prototype = (constructor as { prototype: Scene }).prototype;
  const recovered = new WeakMap<number[], Spline>();
  const getLoops = prototype._GetHatchBoundaryLoops;
  const interpolate = prototype._InterpolateSpline;

  prototype._GetHatchBoundaryLoops = function(entity) {
    for (const loop of entity.boundaryLoops ?? []) {
      for (const edge of loop.edges ?? []) {
        const spline = recoverHatchSpline(edge);
        if (spline && edge.knotValues) recovered.set(edge.knotValues, spline);
      }
    }
    return getLoops.call(this, entity);
  };

  prototype._InterpolateSpline = function(t, degree, points, knots = null, weights = null) {
    const spline = knots ? recovered.get(knots) : undefined;
    return interpolate.call(this, t, degree, points,
      spline?.knots ?? knots, weights ?? spline?.weights ?? null);
  };
  patchedConstructors.add(constructor);
}
