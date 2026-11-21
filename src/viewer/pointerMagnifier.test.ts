import {expect,it} from 'vitest';
import {MAGNIFIER_ZOOM,magnifierRegion,magnifierTile} from './pointerMagnifier';
it('centres the lens on the exact snapped point at a fixed magnification',()=>{
 const p={x:123.456,y:235.678},r=magnifierRegion(p,172,129);
 expect(r.x+r.width/2).toBeCloseTo(p.x,12);expect(r.y+r.height/2).toBeCloseTo(p.y,12);
 expect(172/r.width).toBe(MAGNIFIER_ZOOM);expect(129/r.height).toBe(MAGNIFIER_ZOOM);
});
it('keeps an edge target centred instead of shifting it inward to fill the lens',()=>{
 const r=magnifierRegion({x:0,y:4},132,99);
 expect(r.x).toBe(-22);expect(r.y).toBe(-12.5);expect(r.x+r.width/2).toBe(0);
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
