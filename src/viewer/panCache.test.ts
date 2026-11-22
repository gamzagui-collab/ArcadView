import{afterEach,expect,it,vi}from'vitest';
import{Color,OrthographicCamera,Scene,Vector4}from'three';
import{PanCache,cameraView,cacheMapping}from'./panCache';
afterEach(()=>vi.useRealTimers());
const view=(x=0,width=100)=>({x,y:0,width,height:200,pixelsX:500,pixelsY:1000});
it('maps a translated/zoomed camera into the cached world rectangle without losing edges',()=>{
 const cached={...view(),width:200,height:400};expect(cacheMapping(cached,view())).toEqual({x:.25,y:.25,sx:.5,sy:.5,contains:true});
 expect(cacheMapping(cached,view(50)).contains).toBe(true);expect(cacheMapping(cached,view(50.01)).contains).toBe(false);
 expect(cacheMapping(cached,view(-25,50))).toMatchObject({x:.25,sx:.25,contains:true});
 const c=new OrthographicCamera(-30,70,80,-120);c.position.set(1000,2000,1);c.zoom=2;expect(cameraView(c,500,1000)).toMatchObject({x:1010,y:1990,width:50,height:100});
});
function fixture(){
 vi.useFakeTimers();const camera=new OrthographicCamera(-50,50,100,-100),scene=new Scene(),canvas={clientWidth:500,clientHeight:1000,dataset:{}};scene.children.length=1500;
 let target:any=null;const render=vi.fn(),renderer:any={capabilities:{maxSamples:4},render,getClearColor:(c:Color)=>c.set('#0b1118'),getClearAlpha:()=>1,setClearColor:vi.fn(),getPixelRatio:()=>2,getRenderTarget:()=>target,setRenderTarget:(t:any)=>{target=t;},getViewport:(v:Vector4)=>v.set(1,2,500,1000),setViewport:vi.fn(),getScissor:(v:Vector4)=>v.set(3,4,200,400),setScissor:vi.fn(),getScissorTest:()=>true,setScissorTest:vi.fn()};
 const source:any={camera,scene,GetCamera(){return this.camera},GetCanvas:()=>canvas,GetRenderer:()=>renderer},draw=vi.fn(()=>{vi.advanceTimersByTime(12);}),cull=vi.fn(),cache=new PanCache(source,draw,cull);
 return{camera,source,renderer,cache,draw,render,canvas,cull,getTarget:()=>target};
}
it('uses a bounded GPU tile while panning, then returns to the exact original scene at rest',()=>{
 const f=fixture();f.cache.render();vi.advanceTimersByTime(141);const captured=(f.cache as any).target;expect(captured.width*captured.height).toBeLessThanOrEqual(2097152);expect(captured.samples).toBe(2);expect(f.source.camera).toBe(f.camera);expect(f.getTarget()).toBe(null);expect(f.renderer.setScissorTest).toHaveBeenLastCalledWith(true);expect(f.renderer.setClearColor.mock.calls[0][0].r).toBeCloseTo(11/255);expect(f.renderer.setClearColor.mock.calls[1][0].getHexString()).toBe('0b1118');expect(f.renderer.setViewport).toHaveBeenCalledWith(expect.any(Vector4));expect(f.renderer.setViewport.mock.calls.every((args:unknown[])=>args.length===1)).toBe(true);
 f.draw.mockClear();f.camera.position.x=10;f.cache.render();expect(f.draw).not.toHaveBeenCalled();expect(f.render).toHaveBeenCalledOnce();expect(f.canvas.dataset).toMatchObject({renderMode:'cached'});
 vi.advanceTimersByTime(141);expect(f.draw).toHaveBeenCalled();expect(f.canvas.dataset).toMatchObject({renderMode:'detail'});f.cache.dispose();
});
it('invalidates focus/visibility changes, preserves the real camera on capture failure and disposes resources',()=>{
 const f=fixture();f.cache.render();f.draw.mockImplementationOnce(()=>{throw Error('GPU allocation failed')});vi.advanceTimersByTime(141);expect(f.source.camera).toBe(f.camera);expect(f.getTarget()).toBe(null);expect((f.cache as any).target).toBe(null);f.cache.invalidate();f.cache.render();expect(f.canvas.dataset).toMatchObject({renderMode:'detail'});const dispose=vi.spyOn((f.cache as any).material,'dispose');f.cache.dispose();expect(dispose).toHaveBeenCalledOnce();
});
it('does not reuse a tile across resized viewports or unusual camera rotations',()=>{
 const f=fixture();f.cache.render();vi.advanceTimersByTime(141);f.draw.mockClear();f.canvas.clientWidth=600;f.cache.render();expect(f.draw).toHaveBeenCalled();f.draw.mockClear();f.camera.rotation.z=.2;f.cache.render();expect(f.draw).toHaveBeenCalled();f.cache.dispose();
});
