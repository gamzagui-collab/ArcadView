import { describe, expect, it } from "vitest";
import {
  detectDrawingFormat,
  fileSizeLimit,
  getFileExtension,
  isArchiveFormat,
  isCadFormat,
  MAX_ARCHIVE_FILE_BYTES, MAX_PDF_FILE_BYTES,
  MAX_DRAWING_FILE_BYTES,
  MAX_CONVERTED_DXF_BYTES,
  replaceExtension,
  toDrawingFile,
  validateDrawingFileSize,
} from "./fileTypes";

describe("drawing file types", () => {
  it("admits CAD sources above the previous 128 MiB cap while bounding originals and expanded DXFs separately", () => {
    for (const name of ["large.dwg", "large.dxf"]) {
      const file = new File(["cad"], name);
      Object.defineProperty(file, "size", { value: 200 * 1024 * 1024, configurable: true });
      expect(toDrawingFile(file).size).toBe(200 * 1024 * 1024);
      Object.defineProperty(file, "size", { value: MAX_DRAWING_FILE_BYTES + 1 });
      expect(() => toDrawingFile(file)).toThrow("FILE_TOO_LARGE");
    }
    expect(() => validateDrawingFileSize(700 * 1024 * 1024, MAX_CONVERTED_DXF_BYTES)).not.toThrow();
    expect(() => validateDrawingFileSize(MAX_CONVERTED_DXF_BYTES + 1, MAX_CONVERTED_DXF_BYTES)).toThrow("FILE_TOO_LARGE");
  });
  it("detects supported extensions without case sensitivity", () => {
    expect(detectDrawingFormat("floor-plan.DXF")).toBe("dxf");
    expect(detectDrawingFormat("model.DwG")).toBe("dwg");
    expect(detectDrawingFormat("document.PDF")).toBe("pdf");
    expect(detectDrawingFormat("package.ZIP")).toBe("zip");
    expect(detectDrawingFormat("package.RAR")).toBe("rar");
  });

  it("rejects missing and unsupported extensions", () => {
    expect(detectDrawingFormat("drawing")).toBeNull();
    expect(detectDrawingFormat("drawing.txt")).toBeNull();
  });

  it("replaces only the final extension", () => {
    expect(replaceExtension("building.v2.dwg", "dxf")).toBe(
      "building.v2.dxf",
    );
  });

  it("returns an empty extension for malformed names", () => {
    expect(getFileExtension("drawing.")).toBe("");
  });

  it("handles surrounding provider whitespace without accepting paths", () => {
    expect(detectDrawingFormat("  drawing.DWG  ")).toBe("dwg");
    expect(() => toDrawingFile(new File(["cad"], "folder/drawing.dxf")))
      .toThrow("UNSUPPORTED_FORMAT");
  });

  it("rejects empty drawings before parsing or saving them", () => {
    expect(() => toDrawingFile(new File([], "empty.dxf"))).toThrow("EMPTY_FILE");
  });

  it("enforces the memory guard on both selected and shared drawings", () => {
    expect(() => validateDrawingFileSize(MAX_DRAWING_FILE_BYTES)).not.toThrow();
    expect(() => validateDrawingFileSize(MAX_DRAWING_FILE_BYTES + 1)).toThrow("FILE_TOO_LARGE");
    expect(() => validateDrawingFileSize(Number.NaN)).toThrow("FILE_READ_FAILED");
    expect(() => validateDrawingFileSize(-1)).toThrow("FILE_READ_FAILED");
  });

  it("keeps PDF and archives apart from CAD and applies an archive memory limit", () => {
    expect(isCadFormat("pdf")).toBe(false);
    expect(isArchiveFormat("zip")).toBe(true);
    expect(isArchiveFormat("dwg")).toBe(false);
    expect(fileSizeLimit("rar")).toBe(MAX_ARCHIVE_FILE_BYTES);
    expect(fileSizeLimit("pdf")).toBe(MAX_PDF_FILE_BYTES);
    expect(() => validateDrawingFileSize(MAX_ARCHIVE_FILE_BYTES + 1, fileSizeLimit("zip")))
      .toThrow("FILE_TOO_LARGE");
  });
});

