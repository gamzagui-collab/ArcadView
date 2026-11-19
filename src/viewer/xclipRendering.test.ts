import { describe, expect, it, vi } from "vitest";
import { Mesh, RawShaderMaterial, Scene } from "three";
import { installXclipRendering } from "./xclipRendering";

const polygon = {
  points: [{ x: 0, y: 0 }, { x: 20, y: 20 }],
  blockOffset: { x: 0, y: 0 },
};

describe("XCLIP shader composition", () => {
  it("composes an entire nested clip chain and keeps large-coordinate polygons local before Float32 upload", () => {
    class Viewer {
      scene = new Scene();
      blocks = new Map([["ROOT", { batches: [{key:{layerName:"__IZCAD_NESTED_XCLIP_INNER__0"},vertices:[]}] }]]);
      _LoadBatch() { this.scene.add(new Mesh(undefined, new RawShaderMaterial({ vertexShader:"void main() { vec4 pos = vec4(position, 0.0, 1.0); gl_Position=pos; }",fragmentShader:"void main() { fragColor=vec4(1.0); }" }))); }
      Clear() { this.scene.clear(); }
    }
    installXclipRendering(Viewer); const viewer = new Viewer();
    const large = { points: [{x:135913541.125,y:76530380.25},{x:135913551.125,y:76530390.25}], blockOffset:{x:135913541.125,y:76530380.25} };
    (viewer._LoadBatch as (...a: any[]) => void)({ izcadXclips:{ROOT:large}, izcadNestedXclips:{INNER:{...large,parent:"OUTER"},OUTER:large} },{key:{blockName:"ROOT"}});
    const m = (viewer.scene.children[0] as Mesh).material as RawShaderMaterial;
    expect(m.userData.izcadXclipCount).toBe(3);
    expect(m.uniforms.izcadClipPolygon_1.value[0].toArray()).toEqual([0,0]);
    expect(m.uniforms.izcadClipPolygon_3.value[2].toArray()).toEqual([10,10]);
    expect(m.vertexShader).not.toContain("position + izcadClipOffset");
    viewer.Clear();
  });
  it("keeps outer and nested clips in separate shader scopes and releases replaced materials", () => {
    const baseMaterial = new RawShaderMaterial({
      vertexShader: "void main() { vec4 pos = vec4(position, 0.0, 1.0); gl_Position = pos; }",
      fragmentShader: "void main() { outColor = vec4(1.0); }",
    });
    const baseDispose = vi.spyOn(baseMaterial, "dispose");
    const clonedMaterials: RawShaderMaterial[] = [];
    const originalClone = RawShaderMaterial.prototype.clone;
    const clone = vi.spyOn(RawShaderMaterial.prototype, "clone").mockImplementation(function (this: RawShaderMaterial) {
      const cloned = originalClone.call(this);
      vi.spyOn(cloned, "dispose");
      clonedMaterials.push(cloned);
      return cloned;
    });

    class FakeViewer {
      scene = new Scene();
      blocks = new Map([
        ["BLOCK", { batches: [{ key: { layerName: "__IZCAD_NESTED_XCLIP_N1__0" }, vertices: [] }] }],
      ]);
      _LoadBatch(): void { this.scene.add(new Mesh(undefined, baseMaterial)); }
      Clear(): void { this.scene.clear(); }
    }

    try {
      installXclipRendering(FakeViewer);
      const viewer = new FakeViewer();
      (viewer._LoadBatch as (...args: unknown[]) => void)(
        { izcadXclips: { BLOCK: polygon }, izcadNestedXclips: { N1: polygon } },
        { key: { blockName: "BLOCK" } },
      );
      const material = (viewer.scene.children[0] as Mesh).material as RawShaderMaterial;
      expect(material.fragmentShader.match(/bool izcadInsideClip/g)).toHaveLength(2);
      expect(material.fragmentShader.match(/\{\s*bool izcadInsideClip/g)).toHaveLength(2);
      expect(material.uniforms.izcadClipPolygon_1).toBeDefined();
      expect(material.uniforms.izcadClipPolygon_2).toBeDefined();
      expect(clonedMaterials[0].dispose).toHaveBeenCalledOnce();
      expect(baseDispose).not.toHaveBeenCalled();
      viewer.Clear();
      expect(clonedMaterials[1].dispose).toHaveBeenCalledOnce();
    } finally {
      clone.mockRestore();
      baseDispose.mockRestore();
    }
  });
});
