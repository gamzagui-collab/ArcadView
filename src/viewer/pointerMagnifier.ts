import{MAGNIFIER_WIDTHS,readViewerPreferences,VIEWER_PREFERENCES_EVENT}from'./viewerPreferences';
type Point={x:number;y:number};
type Rect=Point&{width:number;height:number};
export const MAGNIFIER_ZOOM=5;
/** Keep the snapped point at the exact centre, including near viewport edges. */
export function magnifierRegion(point:Point,width:number,height:number):Rect{
 return{x:point.x-width/MAGNIFIER_ZOOM/2,y:point.y-height/MAGNIFIER_ZOOM/2,width:width/MAGNIFIER_ZOOM,height:height/MAGNIFIER_ZOOM};
}
/** A small reusable tile, never a full drawing/viewport bitmap. */
export function magnifierTile(point:Point,width:number,height:number):Rect{
 const w=Math.min(256,width),h=Math.min(256,height);
 return{x:Math.max(0,Math.min(width-w,point.x-w/2)),y:Math.max(0,Math.min(height-h,point.y-h/2)),width:w,height:h};
}
const NS='http://www.w3.org/2000/svg',BG='#0b1118';
const VISUAL=['fill','fill-opacity','fill-rule','stroke','stroke-width','stroke-opacity','stroke-dasharray','stroke-dashoffset','stroke-linecap','stroke-linejoin','stroke-miterlimit','paint-order','opacity','font-family','font-size','font-weight','text-anchor','dominant-baseline','vector-effect','clip-rule'];
let nextId=0;
/** One cached CAD tile plus current vector overlays. No second CAD scene or conversion. */
export class PointerMagnifier{
 private host:HTMLDivElement;
 private body:HTMLDivElement;
 private canvas:HTMLCanvasElement;
 private vectors:SVGSVGElement;
 private tileCanvas:HTMLCanvasElement;
 private tile:Rect|null=null;
 private frame=0;
 private point:Point|null=null;
 private shell:Element|null;
 private id='arcad-lens-'+(++nextId)+'-';
 private prefs=readViewerPreferences();
 private syncPreferences=()=>{this.prefs=readViewerPreferences();this.host.dataset.size=this.prefs.magnifierSize;this.host.style.setProperty('--magnifier-width',MAGNIFIER_WIDTHS[this.prefs.magnifierSize]+'px');if(!this.prefs.magnifierEnabled)this.hide();else if(this.point&&!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;if(this.point)this.draw(this.point);});};
 constructor(private parent:HTMLElement,private source:HTMLCanvasElement,private render:()=>void,private cadVisible:()=>boolean){
  this.host=document.createElement('div');this.host.className='pointer-magnifier';this.host.hidden=true;this.host.setAttribute('aria-hidden','true');
  this.body=document.createElement('div');this.body.className='pointer-magnifier-view';
  this.canvas=document.createElement('canvas');this.vectors=document.createElementNS(NS,'svg');
  this.canvas.className='pointer-magnifier-raster';this.vectors.classList.add('pointer-magnifier-vectors');
  const reticle=document.createElement('div');reticle.className='pointer-magnifier-reticle';
  const zoom=document.createElement('span');zoom.className='pointer-magnifier-zoom';zoom.textContent=MAGNIFIER_ZOOM+'×';
  this.body.append(this.canvas,this.vectors,reticle,zoom);this.host.append(this.body);this.parent.append(this.host);
  this.tileCanvas=document.createElement('canvas');this.tileCanvas.width=this.tileCanvas.height=1;this.shell=parent.closest('.viewer-shell');
  this.syncPreferences();window.addEventListener(VIEWER_PREFERENCES_EVENT,this.syncPreferences);window.addEventListener('storage',this.syncPreferences);
 }
 show(point:Point,world:Point,snapped:string|null){
  if(!this.prefs.magnifierEnabled){this.hide();return;}
  this.point=point;this.host.hidden=false;this.shell?.classList.add('precision-lens-active');
  this.host.dataset.worldX=String(world.x);this.host.dataset.worldY=String(world.y);this.host.dataset.snapped=snapped??'none';
  if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;if(this.point)this.draw(this.point);});
 }
 invalidate(){this.tile=null;}
 hide(){
  cancelAnimationFrame(this.frame);this.frame=0;this.point=null;this.host.hidden=true;this.shell?.classList.remove('precision-lens-active');
  this.vectors.replaceChildren();this.tile=null;this.tileCanvas.width=this.tileCanvas.height=1;
 }
 destroy(){window.removeEventListener(VIEWER_PREFERENCES_EVENT,this.syncPreferences);window.removeEventListener('storage',this.syncPreferences);this.hide();this.canvas.width=this.canvas.height=1;this.host.remove();}
 private draw(point:Point){
  const r=this.source.getBoundingClientRect(),b=this.body.getBoundingClientRect(),width=b.width,height=b.height;
  if(!r.width||!r.height||!width||!height)return;
  const dpr=Math.min(2,window.devicePixelRatio||1),region=magnifierRegion(point,width,height),ctx=this.canvas.getContext('2d');if(!ctx)return;
  const w=Math.round(width*dpr),h=Math.round(height*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=BG;ctx.fillRect(0,0,width,height);
  if(this.cadVisible()){
   const minX=Math.max(0,region.x),minY=Math.max(0,region.y),maxX=Math.min(r.width,region.x+region.width),maxY=Math.min(r.height,region.y+region.height);
   if(maxX>minX&&maxY>minY){
    if(!this.tile||minX<this.tile.x||minY<this.tile.y||maxX>this.tile.x+this.tile.width||maxY>this.tile.y+this.tile.height){
     const tile=magnifierTile(point,r.width,r.height),t=this.tileCanvas.getContext('2d');
     if(t){
      this.tileCanvas.width=Math.max(1,Math.round(tile.width*dpr));this.tileCanvas.height=Math.max(1,Math.round(tile.height*dpr));
      // preserveDrawingBuffer remains false: copy immediately after synchronous Render.
      this.render();t.drawImage(this.source,tile.x*this.source.width/r.width,tile.y*this.source.height/r.height,tile.width*this.source.width/r.width,tile.height*this.source.height/r.height,0,0,this.tileCanvas.width,this.tileCanvas.height);this.tile=tile;
     }
    }
    if(this.tile)ctx.drawImage(this.tileCanvas,(minX-this.tile.x)*this.tileCanvas.width/this.tile.width,(minY-this.tile.y)*this.tileCanvas.height/this.tile.height,(maxX-minX)*this.tileCanvas.width/this.tile.width,(maxY-minY)*this.tileCanvas.height/this.tile.height,(minX-region.x)*MAGNIFIER_ZOOM,(minY-region.y)*MAGNIFIER_ZOOM,(maxX-minX)*MAGNIFIER_ZOOM,(maxY-minY)*MAGNIFIER_ZOOM);
   }
  }
  this.vectors.setAttribute('viewBox',`${region.x} ${region.y} ${region.width} ${region.height}`);
  this.vectors.setAttribute('preserveAspectRatio','none');
  const copies:Element[]=[];
  for(const svg of this.parent.querySelectorAll<SVGSVGElement>(':scope > svg')){
   const rootStyle=getComputedStyle(svg);if(rootStyle.display==='none'||rootStyle.visibility==='hidden'||rootStyle.opacity==='0')continue;
   for(const e of svg.children){
    if(e.matches('.measurement-target,.measurement-target-cross'))continue;
    // The lens has its own fine reticle; don't magnify the active dot/ring over the CAD detail.
    if(e.matches('.measurement-point-ring,.measurement-point-dot')&&Math.hypot(Number(e.getAttribute('cx'))-point.x,Number(e.getAttribute('cy'))-point.y)<.01)continue;
    const a=e.getBoundingClientRect();
    if(e.tagName.toLowerCase()!=='defs'&&(a.right<r.left+region.x-3||a.left>r.left+region.x+region.width+3||a.bottom<r.top+region.y-3||a.top>r.top+region.y+region.height+3))continue;
    const copy=e.cloneNode(true) as SVGElement,originals=[e,...e.querySelectorAll('*')],clones=[copy,...copy.querySelectorAll('*')];
    originals.forEach((original,i)=>{
     const clone=clones[i] as SVGElement,style=getComputedStyle(original);
     for(const attr of [...clone.attributes])if(attr.name==='class'||attr.name.startsWith('data-')||attr.name.startsWith('aria-'))clone.removeAttribute(attr.name);
     for(const prop of VISUAL)clone.style.setProperty(prop,style.getPropertyValue(prop));
     if(clone.id)clone.id=this.id+clone.id;
     const mask=original.getAttribute('mask');if(mask)clone.style.setProperty('mask',mask.replace(/#([^)'"\s]+)/g,'#'+this.id+'$1'));
     for(const name of ['width','height'])if(clone.getAttribute(name)==='100%')clone.setAttribute(name,String(name==='width'?r.width:r.height));
    });copies.push(copy);
   }
  }
  this.vectors.replaceChildren(...copies);
 }
}
