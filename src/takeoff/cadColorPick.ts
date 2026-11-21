import {Color,Vector4,WebGLRenderTarget,type OrthographicCamera,type Scene,type WebGLRenderer} from "three";
import type {CadFocusFilter} from "./cadFocus";

/** Pick the nearest actually rendered CAD pixel. Unlike raycasting, this also
 * handles instanced blocks, hatch triangles and the existing XCLIP shaders.
 * The CAD shader emits original RGB directly (see blockColors.ts). Transparent
 * clear pixels cannot be mistaken for black CAD entities. SVG markup is absent
 * from this pass. The fixed 25px target does not grow with drawing/file size. */
export function nearestCadColor(pixels:Uint8Array,size:number,accept=(x:number,y:number)=>true):string|null{
 let best=Infinity,color:string|null=null;const middle=(size-1)/2;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,d=(x-middle)**2+(y-middle)**2;
  if(pixels[i+3]===0||d>middle**2||d>=best||!accept(x,size-1-y))continue;
  best=d;color="#"+[pixels[i],pixels[i+1],pixels[i+2]].map(v=>v.toString(16).padStart(2,"0")).join("");
 }return color;
}
export function pickCadColor(renderer:WebGLRenderer,scene:Scene,camera:OrthographicCamera,focus:CadFocusFilter,canvas:HTMLCanvasElement,client:{x:number;y:number},accept?:(x:number,y:number)=>boolean):string|null{
 const rect=canvas.getBoundingClientRect(),x=client.x-rect.left,y=client.y-rect.top,size=25,half=12;
 if(rect.width<=0||rect.height<=0||x<0||y<0||x>=rect.width||y>=rect.height)return null;
 const cropped=camera.clone();cropped.setViewOffset(rect.width,rect.height,x-half-.5,y-half-.5,size,size);cropped.updateMatrixWorld();
 const target=new WebGLRenderTarget(size,size,{depthBuffer:true,stencilBuffer:false}),pixels=new Uint8Array(size*size*4),previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new Vector4()),scissor=renderer.getScissor(new Vector4()),scissorTest=renderer.getScissorTest(),clear=renderer.getClearColor(new Color()).clone(),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear,background=scene.background;
 try{
  renderer.setRenderTarget(target);renderer.setViewport(0,0,size,size);renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.autoClear=true;scene.background=null;
  focus.withOriginalColors(()=>renderer.render(scene,cropped));renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
  return nearestCadColor(pixels,size,(px,py)=>{const cx=client.x+px-half,cy=client.y+py-half;return cx>=rect.left&&cx<rect.right&&cy>=rect.top&&cy<rect.bottom&&(!accept||accept(cx,cy));});
 }finally{
  scene.background=background;renderer.autoClear=autoClear;renderer.setClearColor(clear,alpha);renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);target.dispose();
 }
}
