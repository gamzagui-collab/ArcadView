import { describe, expect, it } from "vitest";
import DxfParser from "dxf-viewer/src/parser/DxfParser.js";
import {
  annotateDxfXclips,
  parseDxfXclip,
  spatialFilterBlockPoints,
} from "./xclipMetadata";

function fixture(): Uint8Array {
  return new TextEncoder().encode(
    [
      "0", "SECTION", "2", "ENTITIES",
      "0", "INSERT", "5", "A1",
      "102", "{ACAD_XDICTIONARY", "360", "D1", "102", "}",
      "2", "BLOCK_A", "10", "0", "20", "0", "30", "0",
      "0", "ENDSEC",
      "0", "SECTION", "2", "OBJECTS",
      "0", "DICTIONARY", "5", "D1", "3", "ACAD_FILTER", "360", "D2",
      "0", "DICTIONARY", "5", "D2", "3", "SPATIAL", "360", "F1",
      "0", "SPATIAL_FILTER", "5", "F1", "70", "2",
      "10", "10", "20", "20", "10", "50", "20", "80",
      "0", "ENDSEC", "0", "EOF", "",
    ].join("\r\n"),
  );
}

describe("DWG XCLIP metadata preservation", () => {
  it("copies a resolved spatial filter onto its INSERT as XDATA", () => {
    const annotated = new TextDecoder().decode(
      annotateDxfXclips(fixture()),
    );

    expect(annotated).toContain(
      "1001\r\nIZCAD_XCLIP\r\n1000\r\n10,20;50,20;50,80;10,80",
    );
  });

  it("can read the annotation after dxf-viewer parsing", () => {
    const parsed = new DxfParser().parseSync(
      new TextDecoder().decode(annotateDxfXclips(fixture())),
    );
    const insert = parsed.entities.find(
      (entity: { type?: string }) => entity.type === "INSERT",
    );
    expect(insert).toBeDefined();
    if (!insert) {
      throw new Error("INSERT fixture was not parsed.");
    }

    expect(parseDxfXclip(insert)).toEqual([
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 50, y: 80 },
      { x: 10, y: 80 },
    ]);
  });
  it("uses saved native matrices omitted from LibreDWG DXF and respects disabled clipping", () => {
    const identity = [1,0,0,0,0,1,0,0,0,0,1,0];
    const metadata = { enabled: true, transform: identity, inverseTransform: [-1,0,0,100,0,-1,0,200,0,0,1,0] };
    const saved = new Map([["F1", metadata]]);
    const text = new TextDecoder().decode(annotateDxfXclips(fixture(), saved));
    expect(text).toContain("90,180;50,180;50,120;90,120");
    saved.set("F1", { ...metadata, enabled: false });
    expect(new TextDecoder().decode(annotateDxfXclips(fixture(), saved))).not.toContain("IZCAD_XCLIP");
  });
  it("expands rectangles before rotation and composes the inverse clip-space matrix in the correct order", () => {
    const points = spatialFilterBlockPoints([{x:10,y:20},{x:30,y:40}], {
      enabled: true, inverseTransform: [0,-1,0,100,1,0,0,200,0,0,1,0],
      transform: [1,0,0,10,0,1,0,20,0,0,1,0],
    });
    expect(points).toEqual([{x:100,y:200},{x:100,y:220},{x:80,y:220},{x:80,y:200}]);
  });
  it("reads complete matrices from standard DXF, after an optional front clipping distance", () => {
    const identity = [1,0,0,0,0,1,0,0,0,0,1,0];
    const inverse = [1,0,0,-10,0,1,0,-20,0,0,1,0];
    const text = new TextDecoder().decode(fixture()).replace("0\r\nENDSEC\r\n0\r\nEOF", [71,1,72,1,40,999,73,0,...[...inverse,...identity].flatMap(v=>[40,v]),0,"ENDSEC",0,"EOF"].join("\r\n"));
    const converted = new TextDecoder().decode(annotateDxfXclips(new TextEncoder().encode(text)));
    expect(converted).toContain("0,0;40,0;40,60;0,60");
  });
});
