import{afterEach,expect,it,vi}from'vitest';
import{Color,OrthographicCamera,Scene,Vector3,Vector4}from'three';
import{CadMagnifierDetail,detailTile,magnifierCamera}from'./magnifierDetail';
import{magnifierRegion}from'./pointerMagnifier';
afterEach(()=>vi.unstubAllGlobals());
it('projects original CAD positions to the same exact five-times lens coordinates at edges and non-unit camera zoom',()=>{
 const camera=new OrthographicCamera(-100,100,200,-200,.1,2);camera.position.set(1000000,-2000000,1);camera.zoom=2.5;camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const before=JSON.stringify(camera.toJSON());
 for(const p of [{x:270,y:600},{x:0,y:2},{x:539,y:1199}]){
  const tile=detailTile(p,540,1200,253,190),crop=magnifierCamera(camera,tile,540,1200),region=magnifierRegion(p,253,190);
  for(const delta of [{x:0,y:0},{x:3.14,y:-2.72}]){
   const screen={x:p.x+delta.x,y:p.y+delta.y},world=new Vector3(screen.x/540*2-1,1-screen.y/1200*2,0).unproject(camera),q=world.project(crop);
   const x=(q.x+1)/2*tile.width+tile.x,y=(1-q.y)/2*tile.height+tile.y;
   expect((x-region.x)*5).toBeCloseTo(253/2+delta.x*5,7);expect((y-region.y)*5).toBeCloseTo(190/2+delta.y*5,7);
  }
 }
 expect(JSON.stringify(camera.toJSON())).toBe(before);
});
it('keeps a complete sharp lens cached throughout a finger drag at every lens size',()=>{
 for(const width of [161,205,253]){
  const height=width*.75,t=detailTile({x:270,y:600},540,1200,width,height);
  for(const dx of [-115,0,115])for(const dy of [-64,0,64]){
   const r=magnifierRegion({x:270+dx,y:600+dy},width,height);
   expect(r.x).toBeGreaterThanOrEqual(t.x);expect(r.y).toBeGreaterThanOrEqual(t.y);
   expect(r.x+r.width).toBeLessThanOrEqual(t.x+t.width);expect(r.y+r.height).toBeLessThanOrEqual(t.y+t.height);
  }
 }
 for(const p of [{x:0,y:0},{x:2000,y:1000},{x:3999,y:2999}]){const t=detailTile(p,4000,3000,256,192);expect(t.x).toBeGreaterThanOrEqual(0);expect(t.y).toBeGreaterThanOrEqual(0);expect(t.x+t.width).toBeLessThanOrEqual(4000);expect(t.y+t.height).toBeLessThanOrEqual(3000);}
});
it.each([{fail:false,limit:2048},{fail:false,limit:512},{fail:true,limit:2048}])('restores renderer, main camera and culling after an offscreen pass (%j)',({fail,limit})=>{
 const camera=new OrthographicCamera(-100,100,200,-200,.1,2);camera.position.z=1;camera.updateMatrixWorld();const before=JSON.stringify(camera.toJSON()),mainTarget={},vp=new Vector4(3,4,540,1200),scissor=new Vector4(5,6,20,30),clear=new Color('#0b1118');let target:unknown=mainTarget,test=true,alpha=.7,culling=camera;
 const ctx={putImageData:vi.fn(),save:vi.fn(),restore:vi.fn(),setTransform:vi.fn(),drawImage:vi.fn()},bitmap={width:0,height:0,getContext:()=>ctx};
 vi.stubGlobal('document',{createElement:()=>bitmap});vi.stubGlobal('ImageData',class{constructor(public data:Uint8ClampedArray,public width:number,public height:number){}});
 const renderer={capabilities:{maxSamples:4,maxTextureSize:limit},getContext:()=>({isContextLost:()=>false}),getPixelRatio:()=>2,getRenderTarget:()=>target,setRenderTarget:(t:unknown)=>{target=t;vp.set(0,0,1012,760);},getViewport:(v:Vector4)=>v.copy(vp),setViewport:(v:Vector4)=>vp.copy(v),getScissor:(v:Vector4)=>v.copy(scissor),setScissor:(v:Vector4)=>scissor.copy(v),getScissorTest:()=>test,setScissorTest:(v:boolean)=>{test=v},getClearColor:(v:Color)=>v.copy(clear),getClearAlpha:()=>alpha,setClearColor:(v:Color,a:number)=>{clear.copy(v);alpha=a},render:vi.fn(),readRenderTargetPixels:()=>{if(fail)throw Error('GPU read failed')}};
 const source={scene:new Scene(),GetCamera:()=>camera,GetCanvas:()=>({clientWidth:540,clientHeight:1200}),GetRenderer:()=>renderer},detail=new CadMagnifierDetail(source as any,c=>{culling=c},draw=>draw()),output={width:506,getContext:()=>ctx}as any;
 const result=detail.draw(output,{x:270,y:600},253,190);expect(result===null).toBe(fail);expect(target).toBe(mainTarget);expect(vp.toArray()).toEqual([3,4,540,1200]);expect(scissor.toArray()).toEqual([5,6,20,30]);expect(test).toBe(true);expect(alpha).toBe(.7);expect(clear.getHexString()).toBe('0b1118');expect(culling).toBe(camera);expect(JSON.stringify(camera.toJSON())).toBe(before);
 if(!fail){
  // A slow first capture must still stay sharp at the next point. Normal
  // motion reuses the same high-resolution capture instead of downgrading.
  for(let i=0;i<96;i++)expect(detail.draw(output,{x:270+Math.sin(i*.11)*115,y:600+Math.cos(i*.07)*64},253,190)).not.toBeNull();
  expect(renderer.render).toHaveBeenCalledTimes(1);
  const target=(detail as any).target;expect(target.width*target.height).toBeLessThanOrEqual(2097152);expect(target.width).toBeLessThanOrEqual(limit);expect(target.height).toBeLessThanOrEqual(limit);
  detail.draw(output,{x:271,y:600},205,154);expect(renderer.render).toHaveBeenCalledTimes(2);
  detail.draw(output,{x:271,y:600},205,154);expect(renderer.render).toHaveBeenCalledTimes(2);
  detail.invalidate();detail.draw(output,{x:271,y:600},205,154);expect(renderer.render).toHaveBeenCalledTimes(3);
 }
 detail.dispose();expect((detail as any).target).toBe(null);expect((detail as any).pixels.length).toBe(0);
});
