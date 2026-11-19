import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import "dxf-viewer/src/DxfScene.js";
import { TextRenderer } from "dxf-viewer/src/TextRenderer.js";

const opentype = createRequire(import.meta.url)("opentype.js") as {
  parse(data: ArrayBuffer): { charToGlyphIndex(character: string): number };
};
const bytes = readFileSync(new URL("../../public/fonts/NanumGothic-Regular.ttf", import.meta.url));
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
const symbolBytes = readFileSync(new URL("../../public/fonts/IzCadSymbols-Regular.ttf", import.meta.url));
const symbols = opentype.parse(symbolBytes.buffer.slice(symbolBytes.byteOffset, symbolBytes.byteOffset + symbolBytes.byteLength) as ArrayBuffer);

describe("bundled Korean drawing font", () => {
  it("covers Korean, digits and CAD symbols in the single universal family", async () => {
    const data = readFileSync(new URL("../../public/fonts/IzCadUniversal-Regular.ttf", import.meta.url));
    const universal = opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
    const text = "0123456789ABCxyz한글현장도면∅㎡";
    for (const c of text) expect(universal.charToGlyphIndex(c), c).toBeGreaterThan(0);
    for (let code = 0xac00; code <= 0xd7a3; code++) expect(universal.charToGlyphIndex(String.fromCodePoint(code))).toBeGreaterThan(0);
    expect(await new TextRenderer([async () => universal]).FetchFonts(text)).toBe(true);
  });
  it("covers all 11,172 modern Hangul syllables in both the font and renderer", async () => {
    let hangul = "";
    for (let code = 0xac00; code <= 0xd7a3; code++) {
      expect(font.charToGlyphIndex(String.fromCodePoint(code)), `U+${code.toString(16)}`).toBeGreaterThan(0);
      hangul += String.fromCodePoint(code);
    }
    expect(await new TextRenderer([async () => font]).FetchFonts(hangul)).toBe(true);
  });

  it("renders actual Korean glyph outlines instead of question-mark fallbacks", async () => {
    const renderer = new TextRenderer([async () => font, async () => symbols]);
    expect(await renderer.FetchFonts("한글 도면 치수 측정 ∅ ㎡ ?")).toBe(true);
    const render = (text: string) => [...renderer.Render({ text, startPos: { x: 0, y: 0 }, fontSize: 10, color: 0xffffff })]
      .flatMap(entity => entity.vertices);
    const hangul = render("한");
    expect(hangul.length).toBeGreaterThan(0);
    expect(hangul.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    expect(hangul).not.toEqual(render("?"));
    expect(render("∅")).not.toEqual(render("?"));
    expect(render("㎡")).not.toEqual(render("?"));
  });
});
