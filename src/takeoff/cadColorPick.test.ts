import {expect,it,vi} from "vitest";
import {Color,LineSegments,LinearSRGBColorSpace,OrthographicCamera,RawShaderMaterial,Scene,Vector4,type WebGLRenderer} from "three";
import {CadFocusFilter} from "./cadFocus";
import {nearestCadColor,pickCadColor} from "./cadColorPick";
it("selects original RGB at the nearest opaque CAD pixel, including black; ignores empty/masked pixels",()=>{
 const b=new Uint8Array(25*25*4),set=(x:number,y:number,r:number,g:number,blue:number)=>b.set([r,g,blue,255],(y*25+x)*4);
 expect(nearestCadColor(b,25)).toBeNull();set(14,12,255,0,0);set(12,12,0,0,0);
 expect(nearestCadColor(b,25)).toBe("#000000");expect(nearestCadColor(b,25,(x)=>x!==12)).toBe("#ff0000");expect(nearestCadColor(b,25,()=>false)).toBeNull();
});
function setup(){
 const scene=new Scene(),material=new RawShaderMaterial({uniforms:{color:{value:new Color().setHex(0x34aadc,LinearSRGBColorSpace)}}}),line=new LineSegments(undefined,material);scene.add(line);const focus=new CadFocusFilter(scene);focus.set({enabled:true,layers:[],colors:[]});
 const camera=new OrthographicCamera(-100,100,50,-50,.1,100),canvas={getBoundingClientRect:()=>({left:30,top:40,right:230,bottom:140,width:200,height:100})} as HTMLCanvasElement;
 const state={target:null as unknown,viewport:new Vector4(1,2,200,100),scissor:new Vector4(3,4,5,6),scissorTest:true,color:new Color(0x123456),alpha:.6};
 const renderer={autoClear:false,getRenderTarget:()=>state.target,setRenderTarget:(v:unknown)=>{state.target=v;},getViewport:(v:Vector4)=>v.copy(state.viewport),setViewport:(...v:unknown[])=>{state.viewport=v[0] instanceof Vector4?v[0].clone():new Vector4(...v as [number,number,number,number]);},getScissor:(v:Vector4)=>v.copy(state.scissor),setScissor:(v:Vector4)=>{state.scissor=v.clone();},getScissorTest:()=>state.scissorTest,setScissorTest:(v:boolean)=>{state.scissorTest=v;},getClearColor:(c:Color)=>c.copy(state.color),getClearAlpha:()=>state.alpha,setClearColor:(v:Color|number,a:number)=>{state.color=new Color(v);state.alpha=a;},render:vi.fn(()=>{(line.onBeforeRender as Function)();expect(material.uniforms.color.value.getHexString(LinearSRGBColorSpace)).toBe("34aadc");(line.onAfterRender as Function)();}),readRenderTargetPixels:(_t:unknown,_x:number,_y:number,_w:number,_h:number,b:Uint8Array)=>b.set([0x34,0xaa,0xdc,255],(12*25+12)*4)};
 return{renderer:renderer as unknown as WebGLRenderer,state,focus,scene,camera,canvas,line,material};
}
it("samples through focus using a bounded offscreen target and restores camera, renderer and focus",()=>{
 const s=setup(),before=JSON.stringify(s.state),camera=s.camera.toJSON();expect(pickCadColor(s.renderer,s.scene,s.camera,s.focus,s.canvas,{x:130,y:90})).toBe("#34aadc");expect(JSON.stringify(s.state)).toBe(before);expect(s.renderer.autoClear).toBe(false);expect(s.camera.toJSON()).toEqual(camera);
 (s.line.onBeforeRender as Function)();expect(s.material.uniforms.color.value.getHexString(LinearSRGBColorSpace)).toBe("606c78");(s.line.onAfterRender as Function)();
});
it("restores renderer/focus if the offscreen render throws, and rejects taps outside the CAD viewport",()=>{
 const s=setup(),before=JSON.stringify(s.state);vi.mocked(s.renderer.render).mockImplementation(()=>{throw Error("context lost");});expect(()=>pickCadColor(s.renderer,s.scene,s.camera,s.focus,s.canvas,{x:130,y:90})).toThrow("context lost");expect(JSON.stringify(s.state)).toBe(before);expect(pickCadColor(s.renderer,s.scene,s.camera,s.focus,s.canvas,{x:5,y:90})).toBeNull();
 (s.line.onBeforeRender as Function)();expect(s.material.uniforms.color.value.getHexString(LinearSRGBColorSpace)).toBe("606c78");
});
