// dxf-viewer defers BYLAYER colors in blocks, then flattens them using the
// INSERT's layer. AutoCAD keeps each explicitly named child layer's color;
// only layer 0 inherits the insertion layer. Resolve named colors first.
const patched = new WeakSet<object>();
export function installBlockLayerColors(constructor: object): void {
  if (patched.has(constructor)) return;
  const p = (constructor as { prototype: any }).prototype, color = p._GetEntityColor;
  p._GetEntityColor = function(entity: any, context: any) {
    // Group 420 TrueColor takes precedence over an accompanying 62=256.
    if (entity.colorIndex === 256 && entity.color != null) return entity.color;
    if (context && entity.layer && entity.layer !== "0" &&
      (entity.colorIndex === undefined || entity.colorIndex === 256) && entity.color == null) {
      const layer = this.layers.get(entity.layer);
      if (layer?.color != null) return layer.color;
    }
    return color.call(this, entity, context);
  };
  patched.add(constructor);
}
import { LinearSRGBColorSpace } from "three";

const viewers = new WeakSet<object>();
/** The pinned RawShaderMaterial writes RGB directly; it has no output color
 * conversion. Keep CAD RGB components intact instead of converting them to
 * linear and then displaying those linear values as sRGB. */
export function installCadColorRendering(constructor: object): void {
  if (viewers.has(constructor)) return;
  const p = (constructor as { prototype: any }).prototype;
  for (const method of ["_CreateSimpleColorMaterialInstance", "_CreateSimplePointMaterialInstance"]) {
    const create = p[method];
    p[method] = function(color: number, ...args: unknown[]) {
      const material = create.call(this, color, ...args);
      material.uniforms.color.value.setHex(color, LinearSRGBColorSpace);
      return material;
    };
  }
  viewers.add(constructor);
}
