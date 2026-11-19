import { describe, expect, it } from "vitest";
import DxfParser from "dxf-viewer/src/parser/DxfParser.js";
import AttributeParser from "dxf-viewer/src/parser/entities/attribute.js";
import { installAttributeTextCompatibility } from "./attributeText";

class Scene {
  inserts = new Map();
  *_DecomposeAttribute(entity: object) { yield entity; }
  *_DecomposeMText(entity: object) { yield entity; }
  _GetEntityLayer() { return "FORM"; }
  _GetEntityColor() { return 0xffffff; }
}
installAttributeTextCompatibility(AttributeParser, Scene);
const parse = (groups: Array<string | number>) => new DxfParser().parseSync([
  0, "SECTION", 2, "ENTITIES", ...groups, 0, "LINE", 10, 0, 20, 0, 11, 3, 21, 4,
  0, "ENDSEC", 0, "EOF", "",
].join("\n")).entities as unknown as Array<Record<string, unknown>>;

describe("embedded attribute text", () => {
  it("separates nominal MTEXT height/width/direction from ATTRIB fields and exporter context duplicates", () => {
    const entities = parse([0, "ATTRIB", 5, "386488", 8, "FORM", 100, "AcDbText",
      10, 731731, 20, 98895, 40, 200, 1, "현장 예제", 72, 1, 11, 732336, 21, 98995,
      100, "AcDbAttribute", 2, "제목", 70, 0, 74, 2,
      101, "Embedded Object", 10, 732336, 20, 98995, 30, 0, 11, 1, 21, 0, 31, 0,
      41, 3200, 46, 19.325, 40, 200, 71, 5, 72, 1,
      3, "현장 예제\\P", 1, "테스트 공동주택\\P신축공사", 7, "맑은고딕", 44, 1,
      40, 3200, 41, 19.325, 71, 0, 70, 0, 1001, "APP", 1000, "keep", 1070, 1]);
    expect(entities).toHaveLength(2);
    expect(entities[1].type).toBe("LINE");
    expect(entities[0]).toMatchObject({ textHeight: 200, scale: 1, text: "현장 예제\\P테스트 공동주택\\P신축공사",
      endPoint: { x: 732336, y: 98995 }, xdata: { APP: { values: [{ code: 1000, value: "keep" }, { code: 1070, value: 1 }] } },
      izcadMText: { height: 200, width: 3200, attachmentPoint: 5, direction: { x: 1, y: 0 }, text: "현장 예제\\P테스트 공동주택\\P신축공사" } });
    const rendered = [...new Scene()._DecomposeAttribute(entities[0])][0];
    expect(rendered).toMatchObject({ type: "MTEXT", height: 200, width: 3200, layer: "FORM", color: 0xffffff });
  });
  it("preserves ordinary and invisible attributes without consuming the next entity", () => {
    const [entity] = parse([0, "ATTRIB", 10, 12, 20, 34, 40, 200, 41, 0.8, 1, "한글", 70, 1]);
    expect(entity).toMatchObject({ startPoint: { x: 12, y: 34 }, textHeight: 200, scale: 0.8, hidden: true });
    expect(entity.izcadMText).toBeUndefined();
    expect([...new Scene()._DecomposeAttribute(entity)][0]).toBe(entity);
  });
});
