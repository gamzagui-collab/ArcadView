import { Matrix4, Vector3 } from "three";

export type DxfClipPoint = {
  x: number;
  y: number;
};
export type SavedDwgSpatialFilter = { inverseTransform: number[]; transform: number[]; enabled: boolean };
export type SavedDwgSpatialFilters = ReadonlyMap<string, SavedDwgSpatialFilter>;

type Line = {
  start: number;
  end: number;
  next: number;
};

type DxfRecord = {
  type: string;
  end: number;
  handle?: string;
  extensionDictionary?: string;
  dictionaryEntries: Map<string, string>;
  pendingDictionaryKey?: string;
  clipPointCount?: number;
  clipPoints: DxfClipPoint[];
  matrices: number[];
  enabled?: boolean;
  skipFrontDistance?: boolean;
};

type Insertion = {
  offset: number;
  bytes: Uint8Array;
};

const XCLIP_APP_NAME = "IZCAD_XCLIP";
const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

function readLine(bytes: Uint8Array, start: number): Line | null {
  if (start >= bytes.byteLength) {
    return null;
  }

  let end = start;
  while (
    end < bytes.byteLength &&
    bytes[end] !== 0x0a &&
    bytes[end] !== 0x0d
  ) {
    end += 1;
  }

  let next = end;
  if (bytes[next] === 0x0d) {
    next += 1;
  }
  if (bytes[next] === 0x0a) {
    next += 1;
  }

  return { start, end, next };
}

function decodeLine(bytes: Uint8Array, line: Line): string {
  return decoder.decode(bytes.subarray(line.start, line.end)).trim();
}

function parseNumber(
  bytes: Uint8Array,
  line: Line,
): number | undefined {
  const value = Number(decodeLine(bytes, line));
  return Number.isFinite(value) ? value : undefined;
}

function serializeClipPoints(points: readonly DxfClipPoint[]): string {
  return points.map(({ x, y }) => `${x},${y}`).join(";");
}

function encodeXclip(points: readonly DxfClipPoint[]): Uint8Array {
  return encoder.encode(
    `1001\r\n${XCLIP_APP_NAME}\r\n1000\r\n${serializeClipPoints(points)}\r\n1070\r\n0\r\n`,
  );
}

function applyInsertions(
  source: Uint8Array,
  insertions: readonly Insertion[],
): Uint8Array {
  if (insertions.length === 0) {
    return source;
  }

  const ordered = [...insertions].sort(
    (left, right) => left.offset - right.offset,
  );
  const targetSize = ordered.reduce(
    (size, insertion) => size + insertion.bytes.byteLength,
    source.byteLength,
  );
  const target = new Uint8Array(targetSize);
  let sourceOffset = 0;
  let targetOffset = 0;

  for (const insertion of ordered) {
    const unchanged = source.subarray(
      sourceOffset,
      insertion.offset,
    );
    target.set(unchanged, targetOffset);
    targetOffset += unchanged.byteLength;
    target.set(insertion.bytes, targetOffset);
    targetOffset += insertion.bytes.byteLength;
    sourceOffset = insertion.offset;
  }

  target.set(source.subarray(sourceOffset), targetOffset);
  return target;
}

/**
 * LibreDWG writes AutoCAD XCLIP data into the DXF OBJECTS section, but
 * dxf-viewer does not parse that section. Resolve each INSERT's extension
 * dictionary here and copy its spatial-filter boundary into ordinary XDATA,
 * which survives dxf-viewer's entity parser.
 */
export function annotateDxfXclips(source: Uint8Array, savedFilters?: SavedDwgSpatialFilters | null): Uint8Array {
  const dictionaries = new Map<string, Map<string, string>>();
  const spatialFilters = new Map<string, DxfClipPoint[] | null>();
  const inserts: Array<{
    end: number;
    handle: string;
    extensionDictionary: string;
  }> = [];
  let current: DxfRecord | null = null;
  let offset = 0;

  const finishRecord = (end: number) => {
    if (!current) {
      return;
    }
    current.end = end;

    if (current.type === "DICTIONARY" && current.handle) {
      dictionaries.set(
        current.handle.toLocaleUpperCase("en-US"),
        current.dictionaryEntries,
      );
    } else if (
      current.type === "SPATIAL_FILTER" &&
      current.handle &&
      current.clipPoints.length >= 2
    ) {
      const pointCount =
        current.clipPointCount ?? current.clipPoints.length;
      const handle = current.handle.toLocaleUpperCase("en-US"), saved = savedFilters?.get(handle);
      const metadata = saved ?? (current.matrices.length === 24 ? {
        inverseTransform: current.matrices.slice(0, 12), transform: current.matrices.slice(12), enabled: current.enabled !== false,
      } : null);
      spatialFilters.set(handle, current.enabled === false || metadata?.enabled === false ? null :
        spatialFilterBlockPoints(current.clipPoints.slice(0, pointCount), metadata));
    } else if (
      current.type === "INSERT" &&
      current.handle &&
      current.extensionDictionary
    ) {
      inserts.push({
        end: current.end,
        handle: current.handle.toLocaleUpperCase("en-US"),
        extensionDictionary:
          current.extensionDictionary.toLocaleUpperCase("en-US"),
      });
    }
  };

  while (offset < source.byteLength) {
    const codeLine = readLine(source, offset);
    if (!codeLine) {
      break;
    }
    const valueLine = readLine(source, codeLine.next);
    if (!valueLine) {
      break;
    }
    offset = valueLine.next;

    const code = parseNumber(source, codeLine);
    if (code === 0) {
      finishRecord(codeLine.start);
      current = {
        type: decodeLine(source, valueLine),
        end: source.byteLength,
        dictionaryEntries: new Map(),
        clipPoints: [],
        matrices: [],
      };
      continue;
    }

    if (!current) {
      continue;
    }

    const value = decodeLine(source, valueLine);
    if (code === 5) {
      current.handle ??= value;
      continue;
    }

    if (current.type === "INSERT") {
      if (code === 360) {
        current.extensionDictionary ??= value;
      }
      continue;
    }

    if (current.type === "DICTIONARY") {
      if (code === 3) {
        current.pendingDictionaryKey = value;
      } else if (
        (code === 350 || code === 360) &&
        current.pendingDictionaryKey
      ) {
        current.dictionaryEntries.set(
          current.pendingDictionaryKey,
          value.toLocaleUpperCase("en-US"),
        );
        current.pendingDictionaryKey = undefined;
      }
      continue;
    }

    if (current.type !== "SPATIAL_FILTER") {
      continue;
    }

    if (code === 71) current.enabled = value !== "0";
    if (code === 72 && value === "1") current.skipFrontDistance = true;
    if (code === 40) {
      if (current.skipFrontDistance) current.skipFrontDistance = false;
      else { const n = Number(value); if (Number.isFinite(n)) current.matrices.push(n); }
    }

    if (code === 70 && current.clipPointCount === undefined) {
      current.clipPointCount = parseNumber(source, valueLine);
    } else if (
      code === 10 &&
      current.clipPoints.length <
        (current.clipPointCount ?? Number.POSITIVE_INFINITY)
    ) {
      const x = parseNumber(source, valueLine);
      if (x !== undefined) {
        current.clipPoints.push({ x, y: Number.NaN });
      }
    } else if (
      code === 20 &&
      current.clipPoints.length > 0 &&
      Number.isNaN(current.clipPoints.at(-1)?.y)
    ) {
      const y = parseNumber(source, valueLine);
      if (y !== undefined) {
        current.clipPoints.at(-1)!.y = y;
      }
    }
  }
  finishRecord(source.byteLength);

  const insertions: Insertion[] = [];
  for (const insert of inserts) {
    const extension = dictionaries.get(insert.extensionDictionary);
    const filterDictionaryHandle =
      extension?.get("ACAD_FILTER");
    const filterDictionary = filterDictionaryHandle
      ? dictionaries.get(filterDictionaryHandle)
      : undefined;
    const spatialFilterHandle =
      filterDictionary?.get("SPATIAL");
    const points = spatialFilterHandle
      ? spatialFilters.get(spatialFilterHandle)
      : undefined;
    if (!points || points.some(({ x, y }) => !Number.isFinite(x) || !Number.isFinite(y))) {
      continue;
    }

    insertions.push({
      offset: insert.end,
      bytes: encodeXclip(points),
    });
  }

  return applyInsertions(source, insertions);
}

/** Clip-space -> original WCS -> block definition coordinates. Native LibreDWG
 * omits these matrices from its DXF, so recover them from the same DWG database.
 * See Autodesk SPATIAL_FILTER DXF reference and ezdxf XClip.get_block_clipping_path.
 */
export function spatialFilterBlockPoints(points: readonly DxfClipPoint[], filter: SavedDwgSpatialFilter | null): DxfClipPoint[] {
  let polygon = [...points];
  if (polygon.length === 2) {
    const [a, b] = polygon;
    polygon = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
  }
  if (!filter) return polygon;
  const matrix = (a: number[]) => new Matrix4().set(...[...a.slice(0, 12), 0, 0, 0, 1] as Parameters<Matrix4["set"]>);
  const clipToWorld = matrix(filter.transform);
  if (Math.abs(clipToWorld.determinant()) < 1e-15) throw new Error("XCLIP boundary transform is singular.");
  const toBlock = matrix(filter.inverseTransform).multiply(clipToWorld.invert());
  return polygon.map(p => { const v = new Vector3(p.x, p.y, 0).applyMatrix4(toBlock); return { x: v.x, y: v.y }; });
}

export function parseDxfXclip(
  entity: {
    xdata?: Record<
      string,
      { values?: Array<{ code: number; value: unknown }> }
    >;
  },
): DxfClipPoint[] | null {
  const values = entity.xdata?.[XCLIP_APP_NAME]?.values;
  const serialized = values?.find(
    ({ code, value }) => code === 1000 && typeof value === "string",
  )?.value;
  if (typeof serialized !== "string") {
    return null;
  }

  const points = serialized.split(";").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });
  return points.length >= 2 &&
    points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))
    ? points
    : null;
}
