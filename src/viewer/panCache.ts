import {Color,LinearFilter,Mesh,OrthographicCamera,PlaneGeometry,RawShaderMaterial,Scene,Vector2,Vector4,WebGLRenderTarget,type WebGLRenderer} from "three";
type View={x:number;y:number;width:number;height:number;pixelsX:number;pixelsY:number};
type Source={camera:OrthographicCamera;scene:Scene;GetCamera():OrthographicCamera;GetCanvas():HTMLCanvasElement;GetRenderer():WebGLRenderer};
export function cameraView(camera:OrthographicCamera,width:number,height:number):View{
 return{x:camera.position.x+(camera.left+camera.right)/(2*camera.zoom),y:camera.position.y+(camera.top+camera.bottom)/(2*camera.zoom),width:(camera.right-camera.left)/camera.zoom,height:(camera.top-camera.bottom)/camera.zoom,pixelsX:width,pixelsY:height};
}
export function cacheMapping(cache:View,view:View){
 const x=(view.x-view.width/2-cache.x+cache.width/2)/cache.width,y=(view.y-view.height/2-cache.y+cache.height/2)/cache.height,sx=view.width/cache.width,sy=view.height/cache.height;
 return{x,y,sx,sy,contains:x>=-1e-7&&y>=-1e-7&&x+sx<=1+1e-7&&y+sy<=1+1e-7};
}
/** One bounded, GPU-only overview tile. Pan/short pinch frames draw one quad;
 * idle renders the original scene. No readPixels, geometry mutation or DB. */
export class PanCache{
 private target:WebGLRenderTarget|null=null;private cached:View|null=null;private last:View|null=null;
 private timer:ReturnType<typeof setTimeout>|undefined;private dead=false;private failed=false;private heavy=false;private mode='detail';
 private quadScene=new Scene();private quadCamera=new OrthographicCamera(-1,1,1,-1,0,1);
 private material=new RawShaderMaterial({depthTest:false,depthWrite:false,uniforms:{image:{value:null},offset:{value:new Vector2()},scale:{value:new Vector2(1,1)}},vertexShader:'precision highp float; in vec3 position; in vec2 uv; out vec2 tex; void main(){tex=uv;gl_Position=vec4(position,1.0);}',fragmentShader:'precision highp float; uniform sampler2D image; uniform vec2 offset; uniform vec2 scale; in vec2 tex; out vec4 fragColor; void main(){fragColor=texture(image,offset+tex*scale);}',glslVersion:'300 es'});
 private quad=new Mesh(new PlaneGeometry(2,2),this.material);
 constructor(private source:Source,private draw:()=>void,private cull:(camera:OrthographicCamera)=>void){this.quad.frustumCulled=false;this.quadScene.add(this.quad);}
 private view(){const canvas=this.source.GetCanvas();return cameraView(this.source.GetCamera(),canvas.clientWidth,canvas.clientHeight);}
 private supported(){const c=this.source.GetCamera();return!c.view?.enabled&&Math.abs(c.quaternion.x)+Math.abs(c.quaternion.y)+Math.abs(c.quaternion.z)<1e-10;}
 private changed(a:View,b:View){return a.x!==b.x||a.y!==b.y||a.width!==b.width||a.height!==b.height||a.pixelsX!==b.pixelsX||a.pixelsY!==b.pixelsY;}
 private mark(mode:string){this.mode=mode;const canvas=this.source.GetCanvas();if(canvas.dataset)canvas.dataset.renderMode=mode;}
 private direct(){const start=performance.now();this.cull(this.source.GetCamera());this.draw();this.heavy=this.source.scene.children.length>=1500&&performance.now()-start>=9;this.mark('detail');}
 render(){
  if(this.dead)return;
  const view=this.view(),changed=this.last&&this.changed(this.last,view);this.last=view;
  if(this.failed||!this.supported()||view.pixelsX<=0||view.pixelsY<=0){this.direct();return;}
  if(this.cached&&this.cached.pixelsX===view.pixelsX&&this.cached.pixelsY===view.pixelsY&&(changed||this.mode==='cached')){
   const map=cacheMapping(this.cached,view),ratio=view.width/(this.cached.width/2);
   if(map.contains&&ratio>=.65&&ratio<=1.25){this.blit(map);this.schedule();return;}
  }
  if(changed&&this.heavy){this.capture();if(this.cached){this.blit(cacheMapping(this.cached,view));this.schedule();return;}}
  this.direct();
  if(this.heavy){
   if(changed){this.capture();}
   this.schedule();
  }
 }
 /** The exact native scene is required for the precision magnifier. */
 detail(){clearTimeout(this.timer);this.timer=undefined;this.direct();}
 invalidate(){clearTimeout(this.timer);this.timer=undefined;this.cached=null;this.last=null;this.mark('detail');}
 private schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=undefined;if(this.dead)return;try{if(this.mode==='cached')this.direct();if(this.heavy){const view=this.view(),map=this.cached&&cacheMapping(this.cached,view);if(!map?.contains||map.x<.08||map.y<.08||map.x+map.sx>.92||map.y+map.sy>.92||Math.abs(view.width/(this.cached!.width/2)-1)>.05)this.capture();}}catch{this.failed=true;this.cached=null;this.direct();}},140);}
 private capture(){
  const renderer=this.source.GetRenderer(),camera=this.source.GetCamera(),view=this.view();if(!this.supported()||!this.heavy)return;
  // <=2M resolved RGBA pixels (8MiB), plus a 2-sample AA buffer. One tile per
  // drawing, immediately released on destroy; never a full-drawing bitmap.
  const scale=Math.min(renderer.getPixelRatio(),Math.sqrt(2097152/(view.pixelsX*view.pixelsY*4)),3072/(Math.max(view.pixelsX,view.pixelsY)*2));
  const width=Math.max(1,Math.floor(view.pixelsX*2*scale)),height=Math.max(1,Math.floor(view.pixelsY*2*scale));
  if(this.target?.width!==width||this.target?.height!==height){this.target?.dispose();this.target=new WebGLRenderTarget(width,height,{depthBuffer:false,stencilBuffer:false,minFilter:LinearFilter,magFilter:LinearFilter});this.target.samples=Math.min(2,renderer.capabilities.maxSamples??0);}
  const prior=renderer.getRenderTarget(),viewport=renderer.getViewport(new Vector4()),scissor=renderer.getScissor(new Vector4()),test=renderer.getScissorTest(),clear=renderer.getClearColor(new Color()).clone(),alpha=renderer.getClearAlpha(),expanded=camera.clone(),mx=(camera.left+camera.right)/2,my=(camera.top+camera.bottom)/2;
  expanded.left=mx-(camera.right-camera.left);expanded.right=mx+(camera.right-camera.left);expanded.bottom=my-(camera.top-camera.bottom);expanded.top=my+(camera.top-camera.bottom);expanded.updateProjectionMatrix();expanded.updateMatrixWorld();
  // setRenderTarget installs its physical-pixel viewport. setViewport would
  // multiply it by the display DPR a second time and crop the cached scene.
  // CAD raw shaders already emit display RGB. Match that space for the FBO
  // background too; otherwise Three clears offscreen targets with linear RGB.
  try{this.source.camera=expanded;this.cull(expanded);renderer.setRenderTarget(this.target);renderer.setClearColor(clear.clone().convertLinearToSRGB(),alpha);renderer.setScissorTest(false);this.draw();this.cached={...view,width:view.width*2,height:view.height*2};this.material.uniforms.image.value=this.target.texture;}
  catch{this.failed=true;this.cached=null;this.target?.dispose();this.target=null;}
  finally{this.source.camera=camera;renderer.setRenderTarget(prior);renderer.setClearColor(clear,alpha);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);this.cull(camera);}
 }
 private blit(map:ReturnType<typeof cacheMapping>){this.material.uniforms.offset.value.set(map.x,map.y);this.material.uniforms.scale.value.set(map.sx,map.sy);this.source.GetRenderer().render(this.quadScene,this.quadCamera);this.mark('cached');}
 dispose(){this.dead=true;clearTimeout(this.timer);this.target?.dispose();this.target=null;this.cached=null;this.quad.geometry.dispose();this.material.dispose();this.quadScene.clear();}
}
