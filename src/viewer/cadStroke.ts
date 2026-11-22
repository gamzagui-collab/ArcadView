import {AddEquation,CustomBlending,OneMinusSrcAlphaFactor,SrcAlphaFactor,type Material,type OrthographicCamera,type RawShaderMaterial,type Scene} from "three";
const installed=new WeakSet<object>();
/** Screen coverage, rather than larger GL line widths, keeps dense overview
 * strokes light. Detailed views retain the original full pixel coverage. */
export function overviewCoverage(referenceWidth:number,width:number):number{
 return referenceWidth>0&&width>0?Math.min(1,Math.max(.35,.65*Math.sqrt(referenceWidth/width))):1;
}
export function installCadStrokeShaders(constructor:object){
 if(installed.has(constructor))return;
 const p=(constructor as{prototype:any}).prototype;
 for(const name of ['_CreateSimpleColorMaterial','_CreateSimplePointMaterial']){
  const create=p[name];if(typeof create!=='function')continue;p[name]=function(...args:unknown[]){const m=create.apply(this,args) as RawShaderMaterial;
   m.uniforms.arcadStrokeCoverage={value:1};m.fragmentShader=m.fragmentShader.replace('uniform vec3 color;','uniform vec3 color;\nuniform float arcadStrokeCoverage;').replace('vec4(color, 1.0)','vec4(color, arcadStrokeCoverage)');
   // Continuous coverage avoids the stippled/dashed appearance of MSAA
   // alpha-to-coverage on subpixel CAD lines. Keep opaque scene ordering:
   // shared text/fill meshes still emit alpha=1, including exact pick passes.
   m.blending=CustomBlending;m.blendEquation=AddEquation;m.blendSrc=SrcAlphaFactor;m.blendDst=OneMinusSrcAlphaFactor;return m;
  };
 }
 installed.add(constructor);
}
export class CadStrokeStyle{
 private coverage=1;private sampling=false;private restore:Array<()=>void>=[];
 constructor(scene:Scene,private referenceWidth:number){
  scene.traverse((o:any)=>{if(!o.isLineSegments&&!o.isPoints)return;
   const materials:RawShaderMaterial[]=(Array.isArray(o.material)?o.material:[o.material]).filter((m:Material)=>!!(m as RawShaderMaterial)?.uniforms?.arcadStrokeCoverage),before=o.onBeforeRender,after=o.onAfterRender;
   if(!materials.length)return;
   const points=new Map(materials.map(m=>[m,m.uniforms.pointSize?.value]));
   o.onBeforeRender=(...args:any[])=>{before.apply(o,args);for(const m of materials){const coverage=this.sampling?1:this.coverage;m.uniforms.arcadStrokeCoverage.value=coverage;if(o.isPoints&&points.get(m)!==undefined)m.uniforms.pointSize.value=Math.max(1,points.get(m)*coverage);m.uniformsNeedUpdate=true;}};
   o.onAfterRender=(...args:any[])=>{for(const m of materials){m.uniforms.arcadStrokeCoverage.value=1;if(points.get(m)!==undefined)m.uniforms.pointSize.value=points.get(m);m.uniformsNeedUpdate=true;}after.apply(o,args);};
   this.restore.push(()=>{o.onBeforeRender=before;o.onAfterRender=after;});
  });
 }
 update(camera:OrthographicCamera){this.coverage=overviewCoverage(this.referenceWidth,(camera.right-camera.left)/camera.zoom);}
 withExact<T>(read:()=>T):T{const prior=this.sampling;this.sampling=true;try{return read();}finally{this.sampling=prior;}}
 dispose(){for(const restore of this.restore)restore();this.restore=[];}
}
