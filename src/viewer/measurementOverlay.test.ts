import {afterEach,expect,it,vi} from 'vitest';
import {drawMeasurementOverlay} from './measurementOverlay';
import {measurementAfterPick,measurementValue} from './measurementTools';
import type {MeasurementSettings} from './measurementGeometry';
class Element {attributes:Record<string,string>={};children:Element[]=[];textContent='';setAttribute(k:string,v:string){this.attributes[k]=v}append(e:Element){this.children.push(e)}}
afterEach(()=>vi.unstubAllGlobals());
it('previews and places a radius badge at the chosen location while the arrow remains on the selected arc',()=>{
 vi.stubGlobal('document',{createElementNS:()=>new Element()});let nodes:Element[]=[];const svg={replaceChildren:(...n:Element[])=>{nodes=n}}as unknown as SVGSVGElement;
 const radius={arc:{center:{x:0,y:0},radius:50,start:0,sweep:Math.PI/2,direction:1 as const},point:{x:50,y:0}},empty:MeasurementSettings={enabled:true,mode:'radius',snapping:true,points:[],entity:null},selected=measurementAfterPick(empty,{point:radius.point,radius})!;
 const preview={point:{x:-100,y:100},snapped:null,entity:null},placed=measurementAfterPick(selected,preview)!;
 for(const [s,p]of [[selected,preview],[placed,null]]as const){drawMeasurementOverlay(svg,s,p=>[...p],p,[],[],'R 50 mm');const label=nodes.find(n=>n.attributes.class==='measurement-value-label')!;expect(label.textContent).toBe('R 50 mm');expect(+label.attributes.x).toBe(-100);expect(+label.attributes.y).toBe(105);const leader=nodes.find(n=>n.attributes.class==='measurement-radius-leader')!.attributes.points.split(' ');const tip=leader[1].split(',').map(Number);expect(tip[0]).toBeCloseTo(0,7);expect(tip[1]).toBeCloseTo(50,7);expect(measurementValue(s)).toBe(50);expect(nodes.some(n=>n.attributes.class==='measurement-radius-source')).toBe(true);}
 expect(selected.labelPoint).toBeUndefined();
});
