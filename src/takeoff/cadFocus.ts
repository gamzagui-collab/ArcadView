import {Color,LinearSRGBColorSpace,type Material,type Object3D,type RawShaderMaterial,type Scene} from "three";
type RenderObject=Object3D&{material?:Material|Material[];_dxfViewerLayer?:{name:string}};
export type CadFocus={enabled:boolean;layers:string[];colors:string[]};
const colorOf=(m:Material)=>(m as RawShaderMaterial).uniforms?.color?.value as Color|undefined;
const hex=(c:Color)=>"#"+c.getHexString(LinearSRGBColorSpace);
/** Per-draw uniform overrides preserve shared materials, block transforms,
 * XCLIP shaders and original CAD colors. No geometry or cache is rebuilt. */
export class CadFocusFilter{
 private restore:Array<()=>void>=[];
 private originals=new WeakMap<Material,Color>();
 private sampling=false;
 constructor(private scene:Scene){}
 private original(m:Material){let c=this.originals.get(m);if(!c){const value=colorOf(m);if(!value?.isColor)return null;c=value.clone();this.originals.set(m,c);}return c;}
 options(){const layers=new Set<string>(),colors=new Set<string>();this.scene.traverse(raw=>{const o=raw as RenderObject;if(!o.material)return;if(o._dxfViewerLayer?.name)layers.add(o._dxfViewerLayer.name);for(const m of Array.isArray(o.material)?o.material:[o.material]){const c=this.original(m);if(c)colors.add(hex(c));}});return{layers:[...layers].sort(),colors:[...colors].sort()};}
 set(filter:CadFocus){
  this.clear();if(!filter.enabled)return;const colors=new Set(filter.colors.map(c=>c.toLowerCase())),gray=new Color().setHex(0x606c78,LinearSRGBColorSpace);
  this.scene.traverse(raw=>{const o=raw as RenderObject;if(!o.material)return;const materials=Array.isArray(o.material)?o.material:[o.material],before=o.onBeforeRender,after=o.onAfterRender;
   for(const m of materials)this.original(m);
   o.onBeforeRender=function(...args){before.apply(this,args);for(const m of materials){const original=filterInstance.original(m),value=colorOf(m);if(original&&value){value.copy(filterInstance.sampling||colors.has(hex(original))?original:gray);(m as RawShaderMaterial).uniformsNeedUpdate=true;}}};
   const filterInstance=this;
   o.onAfterRender=function(...args){for(const m of materials){const original=filterInstance.original(m);if(original)colorOf(m)?.copy(original);}after.apply(this,args);};
   this.restore.push(()=>{o.onBeforeRender=before;o.onAfterRender=after;for(const m of materials){const c=this.original(m);if(c)colorOf(m)?.copy(c);}});
  });
 }
 clear(){for(const restore of this.restore)restore();this.restore=[];}
 /** Offscreen color picking uses the original per-draw color while retaining
  * clipping/instancing callbacks. Always restore focus, even if WebGL fails. */
 withOriginalColors<T>(read:()=>T):T{const previous=this.sampling;this.sampling=true;try{return read();}finally{this.sampling=previous;}}
}
