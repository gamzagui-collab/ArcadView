import {expect,it} from 'vitest';
import {MAGNIFIER_ZOOM,magnifierRegion,magnifierTile,magnifierStack} from './pointerMagnifier';
it('centres the lens on the exact snapped point at a fixed magnification',()=>{
 const p={x:123.456,y:235.678},r=magnifierRegion(p,172,129);
 expect(r.x+r.width/2).toBeCloseTo(p.x,12);expect(r.y+r.height/2).toBeCloseTo(p.y,12);
 expect(172/r.width).toBe(MAGNIFIER_ZOOM);expect(129/r.height).toBe(MAGNIFIER_ZOOM);
});
it('keeps an edge target centred instead of shifting it inward to fill the lens',()=>{
 const r=magnifierRegion({x:0,y:4},100,50);
 expect(r.x).toBe(-10);expect(r.y).toBe(-1);expect(r.x+r.width/2).toBe(0);
 const t=magnifierTile({x:0,y:4},1200,516);expect(t).toEqual({x:0,y:0,width:256,height:256});
});
it('bounds each cached tile to 1MiB at DPR2, independent of a large drawing viewport',()=>{
 for(const [width,height]of [[360,760],[4096,2160],[100,80]]){
  const t=magnifierTile({x:width-2,y:height-1},width,height);
  expect(t.x).toBeGreaterThanOrEqual(0);expect(t.y).toBeGreaterThanOrEqual(0);
  expect(t.x+t.width).toBeLessThanOrEqual(width);expect(t.y+t.height).toBeLessThanOrEqual(height);
  expect(t.width*t.height*4*4).toBeLessThanOrEqual(1024*1024);
 }
});
it('keeps every preferred lens size and a readable summary on a tall screen',()=>{
 for(const width of [164,208,256]){const r=magnifierStack(width,520,54,1100,108);expect(r.width).toBe(width);expect(r.summaryTop).toBeGreaterThan(54);expect(r.summaryHeight).toBeGreaterThanOrEqual(108);expect(r.summaryTop+r.summaryHeight).toBe(1100);}
});
it('reserves room for the total below a large lens on short landscape screens',()=>{
 const r=magnifierStack(256,980,54,294,108);expect(r.width).toBeLessThan(256);expect(r.summaryHeight).toBeCloseTo(108);expect(54+(r.width-3)*.75+3+8).toBeCloseTo(r.summaryTop);expect(r.summaryTop+r.summaryHeight).toBeCloseTo(294);
 expect(magnifierStack(256,980,54,294).width).toBe(256);
});
it('fits narrow or temporarily zero-size viewports without negative space',()=>{
 const r=magnifierStack(256,140,54,600,108);expect(r.width).toBe(140);const zero=magnifierStack(256,0,0,0,108);expect(Number.isFinite(zero.width)).toBe(true);expect(zero.summaryHeight).toBe(0);
});
it('uses the released space when the user collapses the summary',()=>{expect(magnifierStack(256,980,54,294,30).width).toBe(256);expect(magnifierStack(256,980,54,294,108).width).toBeLessThan(256);});
