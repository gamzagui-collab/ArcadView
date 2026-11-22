import {Color,Vector4,WebGLRenderTarget,type OrthographicCamera,type Scene,type WebGLRenderer} from 'three';
import {MAGNIFIER_ZOOM,magnifierRegion,type MagnifierDetail,type MagnifierPoint,type MagnifierRect} from './pointerMagnifier';

type Source={scene:Scene;GetCamera():OrthographicCamera;GetCanvas():HTMLCanvasElement;GetRenderer():WebGLRenderer};
const contains=(a:MagnifierRect,b:MagnifierRect)=>b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width&&b.y+b.height<=a.y+a.height;
/** Crop a separate camera; the main camera and its control target never move. */
export function magnifierCamera(camera:OrthographicCamera,tile:MagnifierRect,width:number,height:number){
 const crop=camera.clone(),ww=(camera.right-camera.left)/camera.zoom,wh=(camera.top-camera.bottom)/camera.zoom;
 crop.position.x=camera.position.x+(camera.left+camera.right)/(2*camera.zoom)+(tile.x+tile.width/2-width/2)*ww/width;
 crop.position.y=camera.position.y+(camera.top+camera.bottom)/(2*camera.zoom)-(tile.y+tile.height/2-height/2)*wh/height;
 crop.zoom=1;crop.left=-ww*tile.width/width/2;crop.right=-crop.left;crop.top=wh*tile.height/height/2;crop.bottom=-crop.top;
 crop.clearViewOffset();crop.updateProjectionMatrix();crop.updateMatrixWorld();return crop;
}
export function detailTile(point:MagnifierPoint,width:number,height:number,lensWidth:number,lensHeight:number){
 const w=Math.min(width,lensWidth/MAGNIFIER_ZOOM*2),h=Math.min(height,lensHeight/MAGNIFIER_ZOOM*2);
 return{x:Math.max(0,Math.min(width-w,point.x-w/2)),y:Math.max(0,Math.min(height-h,point.y-h/2)),width:w,height:h};
}
/** One bounded original-geometry tile. All GPU and CPU buffers are reused and
 * released with the drawing. No second scene, drawing conversion or storage. */
export class CadMagnifierDetail implements MagnifierDetail{
 private tile:MagnifierRect|null=null;private target:WebGLRenderTarget|null=null;private pixels=new Uint8Array(0);
 private bitmap:HTMLCanvasElement|null=null;private image:ImageData|null=null;private failed=false;
 constructor(private source:Source,private cull:(camera:OrthographicCamera,width:number)=>void,private exact:(draw:()=>void)=>void){}
 invalidate(){this.tile=null;}
 draw(output:HTMLCanvasElement,point:MagnifierPoint,width:number,height:number){
  const source=this.source,canvas=source.GetCanvas(),camera=source.GetCamera(),renderer=source.GetRenderer();
  if(this.failed||renderer.getContext().isContextLost()||camera.view?.enabled||Math.abs(camera.quaternion.x)+Math.abs(camera.quaternion.y)+Math.abs(camera.quaternion.z)>1e-10)return null;
  const sw=canvas.clientWidth,sh=canvas.clientHeight,region=magnifierRegion(point,width,height),x=Math.max(0,region.x),y=Math.max(0,region.y),clip={x,y,width:Math.min(sw,region.x+region.width)-x,height:Math.min(sh,region.y+region.height)-y};
  if(sw<=0||sh<=0||clip.width<=0||clip.height<=0)return null;
  let captureMs:number|null=null;
  try{
   if(!this.tile||!contains(this.tile,clip)){
    const t=performance.now(),tile=detailTile(point,sw,sh,width,height),density=Math.min(2,renderer.getPixelRatio()),scale=Math.min(density,Math.sqrt(786432/(tile.width*tile.height*MAGNIFIER_ZOOM**2)));
    this.capture(tile,Math.max(1,Math.round(tile.width*MAGNIFIER_ZOOM*scale)),Math.max(1,Math.round(tile.height*MAGNIFIER_ZOOM*scale)));
    captureMs=performance.now()-t;
   }
   const tile=this.tile!,bitmap=this.bitmap!,ctx=output.getContext('2d')!,dpr=output.width/width;
   // WebGL rows are bottom-up. Flip while drawing, without a per-pixel JS copy.
   ctx.save();try{ctx.setTransform(dpr,0,0,-dpr,0,height*dpr);ctx.imageSmoothingEnabled=true;
    ctx.drawImage(bitmap,(clip.x-tile.x)*bitmap.width/tile.width,(tile.y+tile.height-clip.y-clip.height)*bitmap.height/tile.height,clip.width*bitmap.width/tile.width,clip.height*bitmap.height/tile.height,(clip.x-region.x)*MAGNIFIER_ZOOM,height-(clip.y+clip.height-region.y)*MAGNIFIER_ZOOM,clip.width*MAGNIFIER_ZOOM,clip.height*MAGNIFIER_ZOOM);
   }finally{ctx.restore();}
   return{captureMs};
  }catch{this.dispose();this.failed=true;return null;}
 }
 private capture(tile:MagnifierRect,width:number,height:number){
  const source=this.source,renderer=source.GetRenderer(),camera=source.GetCamera(),canvas=source.GetCanvas(),crop=magnifierCamera(camera,tile,canvas.clientWidth,canvas.clientHeight);
  if(this.target?.width!==width||this.target?.height!==height){
   this.target?.dispose();this.target=new WebGLRenderTarget(width,height,{depthBuffer:false,stencilBuffer:false});this.target.samples=Math.min(2,renderer.capabilities.maxSamples??0);
   this.pixels=new Uint8Array(width*height*4);this.image=new ImageData(new Uint8ClampedArray(this.pixels.buffer),width,height);
   this.bitmap??=document.createElement('canvas');this.bitmap.width=width;this.bitmap.height=height;
  }
  const target=renderer.getRenderTarget(),viewport=renderer.getViewport(new Vector4()),scissor=renderer.getScissor(new Vector4()),test=renderer.getScissorTest(),clear=renderer.getClearColor(new Color()).clone(),alpha=renderer.getClearAlpha();
  try{
   // setRenderTarget already installs a physical-pixel viewport. The CAD raw
   // shaders emit display RGB, so match the offscreen clear to that space.
   renderer.setRenderTarget(this.target);renderer.setScissorTest(false);renderer.setClearColor(clear.clone().convertLinearToSRGB(),alpha);
   this.cull(crop,width);this.exact(()=>renderer.render(source.scene,crop));renderer.readRenderTargetPixels(this.target!,0,0,width,height,this.pixels);
  }finally{
   renderer.setRenderTarget(target);renderer.setClearColor(clear,alpha);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);this.cull(camera,canvas.clientWidth);
  }
  this.bitmap!.getContext('2d')!.putImageData(this.image!,0,0);this.tile=tile;
 }
 dispose(){this.target?.dispose();this.target=null;this.tile=null;this.pixels=new Uint8Array(0);this.image=null;if(this.bitmap)this.bitmap.width=this.bitmap.height=1;this.bitmap=null;}
}
