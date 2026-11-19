import { describe, expect, it } from "vitest";
import { detectDxfEncoding } from "./dxfEncoding";

function header(version: string, codePage: string, newline = "\r\n"): Uint8Array {
  return new TextEncoder().encode([
    "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", version,
    "9", "$DWGCODEPAGE", "3", codePage, "0", "ENDSEC", "",
  ].join(newline));
}

describe("DXF text encoding", () => {
  it("decodes Korean legacy DXF using Windows-949", () => {
    const encoding = detectDxfEncoding(header("AC1018", "ANSI_949"));
    expect(encoding).toBe("euc-kr");
    expect(new TextDecoder(encoding).decode(new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb]))).toBe("한글");
  });
  it("uses the saved Turkish code page for an older drawing", () => {
    expect(detectDxfEncoding(header("AC1018", "ANSI_1254"))).toBe("windows-1254");
    expect(new TextDecoder(detectDxfEncoding(header("AC1018", "ANSI_1254")))
      .decode(new Uint8Array([0xdd, 0xfd, 0xd0, 0xf0, 0xde, 0xfe])))
      .toBe("İıĞğŞş");
  });

  it("keeps modern Unicode drawings in UTF-8 despite a legacy code page label", () => {
    expect(detectDxfEncoding(header("AC1032", "ANSI_1254"))).toBe("utf-8");
  });

  it("handles LF and CR group-code pairs and other supported code pages", () => {
    expect(detectDxfEncoding(header("AC1015", "ANSI_1251", "\n"))).toBe("windows-1251");
    expect(detectDxfEncoding(header("AC1015", "ANSI_932", "\r"))).toBe("shift_jis");
  });

  it("honors a Unicode BOM and falls back for unavailable code pages", () => {
    const legacyHeader = header("AC1015", "ANSI_1254");
    expect(detectDxfEncoding(new Uint8Array([0xef, 0xbb, 0xbf, ...legacyHeader]))).toBe("utf-8");
    expect(detectDxfEncoding(new Uint8Array([0xff, 0xfe]))).toBe("utf-16le");
    expect(detectDxfEncoding(header("AC1015", "INVALID_CODE_PAGE"))).toBe("utf-8");
  });
});
