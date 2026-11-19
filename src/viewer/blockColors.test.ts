import { expect, it } from "vitest";
import { DxfScene } from "dxf-viewer/src/DxfScene.js";
import { installBlockLayerColors, installCadColorRendering } from "./blockColors";
import { Color } from "three";
installBlockLayerColors(DxfScene);
it("retains named layer gray in flattened blocks while layer 0 and BYBLOCK still inherit", () => {
  const s: any = new (DxfScene as any)({}); s.layers.set("GRAY", { color: 0x808080 }); s.layers.set("0", { color: 0xffffff });
  expect(s._GetEntityColor({ layer: "GRAY" }, {})).toBe(0x808080);
  expect(s._GetEntityColor({ layer: "GRAY", colorIndex: 256 }, {})).toBe(0x808080);
  expect(s._GetEntityColor({ layer: "0" }, {})).toBe(-1);
  expect(s._GetEntityColor({ layer: "GRAY", colorIndex: 0, color: 0 }, {})).toBe(-2);
  expect(s._GetEntityColor({ layer: "GRAY", colorIndex: 1, color: 0xff0000 }, {})).toBe(0xff0000);
  expect(s._GetEntityColor({ layer: "GRAY", colorIndex: 256, color: 0xc0c0c0 }, {})).toBe(0xc0c0c0);
});
it("passes gray RGB to raw shaders without a second unpaired color-space conversion", () => {
  class Viewer { _CreateSimpleColorMaterialInstance(color: number) { return {uniforms:{color:{value:new Color(color)}}}; } _CreateSimplePointMaterialInstance(color: number) { return this._CreateSimpleColorMaterialInstance(color); } }
  installCadColorRendering(Viewer); const v = new Viewer();
  for (const value of [51,128,192,255]) {
    const material = v._CreateSimpleColorMaterialInstance(value * 0x010101);
    expect(material.uniforms.color.value.toArray()).toEqual([value/255,value/255,value/255]);
    expect(v._CreateSimplePointMaterialInstance(value * 0x010101).uniforms.color.value.r).toBe(value/255);
  }
});
