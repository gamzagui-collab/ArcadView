import {expect,it} from "vitest";
import {strFromU8,unzipSync} from "fflate";
import {newTakeoff,quantity,migrateTakeoff,validateDocument,type TakeoffDocument,type TakeoffObject} from "./model";
import {buildQuantityReport} from "./quantityReport";
import {exportTakeoffXlsx} from "./xlsx";
const drawing={key:"v1-"+"a".repeat(64),name:"현장 도면.dwg",size:30,lastModified:1};
const object=(id:string,kind:TakeoffObject["kind"],points:TakeoffObject["geometry"]["points"],dimensions:TakeoffObject["dimensions"],layerId="takeoff-default"):TakeoffObject=>({id,layerId,kind,groupId:kind,geometry:{type:kind==="slab"||kind==="column"?"polygon":"path",points},dimensions,label:{visible:true}});
function example(){const d=newTakeoff(drawing,"mm");d.layers.push({id:"second",name:"2동 3·4·5호",visible:false});d.objects=[
 object("W01","wall",[{x:0,y:0},{x:12000,y:0},{x:12000,y:8000}],{heightMm:3000,thicknessMm:200}),
 object("W02","wall",[{x:20000,y:0},{x:30000,y:0}],{heightMm:3200,thicknessMm:250},"second"),
 object("B01","beam",[{x:0,y:8000},{x:12000,y:8000}],{widthMm:300,depthMm:600}),
 object("S01","slab",[{x:0,y:12000},{x:8000,y:12000},{x:8000,y:17000},{x:0,y:17000}],{thicknessMm:180},"second"),
 object("C01","column",[{x:22000,y:12000},{x:22600,y:12000},{x:22600,y:12300},{x:22000,y:12300}],{heightMm:3000},"second")];return d;}
const xml=(file:ReturnType<typeof exportTakeoffXlsx>,name="xl/worksheets/sheet1.xml")=>strFromU8(unzipSync(file.bytes)[name]);
const value=(sheet:string,ref:string)=>Number(new RegExp(`<c r="${ref}"[^>]*>([\\s\\S]*?)<v>([^<]+)</v>`).exec(sheet)?.[2]);
it("reports all objects including hidden regions, requested dimension columns and four member totals without changing source",()=>{
 const d=example(),before=structuredClone(d),r=buildQuantityReport(d);expect(d).toEqual(before);expect(r.items).toHaveLength(5);expect(r.totals.volumeM3).toBeCloseTo(29.9,12);expect(r.totals.visibleVolumeM3).toBeCloseTo(14.16,12);expect(r.layers[1].items).toHaveLength(3);
 expect(r.items.find(o=>o.id==="W01")).toMatchObject({lengthM:20,heightM:3,widthM:undefined,thicknessM:.2,volumeM3:12});expect(r.items.find(o=>o.id==="B01")).toMatchObject({lengthM:12,widthM:.3,heightM:.6,volumeM3:2.16});expect(r.items.find(o=>o.id==="S01")).toMatchObject({lengthM:8,widthM:5,heightM:undefined,areaM2:40,equivalentWidth:false});expect(r.items.find(o=>o.id==="C01")).toMatchObject({lengthM:.6,widthM:.3,heightM:3,hidden:true});
});
it("uses actual polygon area and marks representative edge/equivalent width for concave areas and rotated rectangles",()=>{
 const d=example(),slab=d.objects.find(o=>o.id==="S01")!;slab.geometry.points=[{x:0,y:0},{x:8000,y:0},{x:8000,y:2000},{x:2000,y:2000},{x:2000,y:5000},{x:0,y:5000}];let r=buildQuantityReport(d).items.find(o=>o.id==="S01")!;expect(r).toMatchObject({lengthM:8,widthM:2.75,areaM2:22,equivalentWidth:true});expect(r.volumeM3).toBeCloseTo(3.96);
 slab.geometry={type:"polygon",points:[{x:0,y:0},{x:8000,y:0},{x:8000,y:5000},{x:0,y:5000}].map(p=>({x:p.x*Math.cos(.4)-p.y*Math.sin(.4),y:p.x*Math.sin(.4)+p.y*Math.cos(.4)}))};r=buildQuantityReport(d).items.find(o=>o.id==="S01")!;expect(r.lengthM).toBeCloseTo(8);expect(r.widthM).toBeCloseTo(5);expect(r.equivalentWidth).toBe(false);
});
it("exports valid OOXML numeric cells with cached formula results, source references, subtotals and a nonduplicated grand total",()=>{
 const file=exportTakeoffXlsx(example(),new Date("2026-11-21T00:00:00Z")),s=xml(file),basis=xml(file,"xl/worksheets/sheet2.xml");expect(file.name).toBe("현장 도면_물량집계.xlsx");expect(file.bytes.subarray(0,2)).toEqual(new Uint8Array([80,75]));expect(Object.keys(unzipSync(file.bytes))).toHaveLength(8);
 for(const item of file.report.items){const row=file.mainRows.get(item.id)!;expect(value(s,"F"+row)).toBeCloseTo(item.volumeM3,12);expect(s).toContain(`r="C${row}"`);expect(s).toContain(`&apos;산출근거&apos;!D${file.basisRows.get(item.id)}`);expect(basis).toContain(item.id);}
 expect(value(s,"F"+file.totalRow)).toBeCloseTo(29.9,12);expect(s).toContain('SUMIFS(');expect(s).toContain('옹벽 소계');expect(s).toContain('보 소계');expect(s).toContain('슬래브 소계');expect(s).toContain('기둥 소계');expect(s).toContain('레이어 합계');expect(s).toContain('도면 전체 총계');expect(s).toContain('환산');expect(s).not.toContain('#REF!');
 const w=file.mainRows.get("W01")!,slab=file.mainRows.get("S01")!;expect(s).toContain(`<c r="D${w}" s="1"/>`);expect(s).toContain(`<c r="E${slab}" s="1"/>`);
});
it("keeps same-named layer IDs separate and exports literal formula-like labels with XML/filename escaping",()=>{
 const d=example();d.layers[1].name=d.layers[0].name;d.drawing.name='=HYPERLINK("bad") & <현장>.dwg';d.layers[0].name='=1+2 & <층>';const f=exportTakeoffXlsx(d),s=xml(f);expect(f.report.layers).toHaveLength(2);expect(f.report.layers[0].items).toHaveLength(2);expect(f.report.layers[1].items).toHaveLength(3);expect(s).toContain('t="inlineStr"');expect(s).toContain('=1+2 &amp; &lt;층&gt;');expect(s).not.toContain('<f>HYPERLINK');expect(f.name).not.toMatch(/[\\/:*?"<>|]/);
});
it("handles empty regions without fictitious objects and rejects invalid source quantities before export",()=>{
 const d=newTakeoff(drawing,"drawing"),f=exportTakeoffXlsx(d);expect(f.report.items).toHaveLength(0);expect(value(xml(f),"F"+f.totalRow)).toBe(0);const bad=example();bad.objects[0].dimensions.heightMm=0;expect(()=>exportTakeoffXlsx(bad)).toThrow();
});
it("computes column area × height and preserves all legacy v2 fields in migration",()=>{
 const d=example(),c=d.objects.find(o=>o.kind==="column")!;expect(quantity(c,"mm").volumeM3).toBeCloseTo(.54,12);expect(quantity({...c,dimensions:{heightMm:6000}},"mm").volumeM3).toBeCloseTo(1.08,12);const {column:removed,...oldDefaults}=d.defaults;void removed;
 const old={...d,schemaVersion:2,groups:d.groups.filter(g=>g.id!=="column"),defaults:oldDefaults,objects:d.objects.filter(o=>o.kind!=="column")},before=structuredClone(old),next=migrateTakeoff(old);expect(old).toEqual(before);expect(next.schemaVersion).toBe(3);expect(next.objects).toEqual(old.objects);expect(next.layers).toEqual(old.layers);expect(next.options).toEqual(old.options);expect(next.defaults.column).toEqual({heightMm:3000});validateDocument(next);expect(buildQuantityReport(next).totals.volumeM3).toBeCloseTo(29.36,12);
});

it("exports areas on a separate numeric sheet, including member/layer/grand totals without adding m² to m³",()=>{
 const d=example();for(const kind of ["wall","beam","slab","column"] as const)d.objects.push({...object("area-"+kind,kind,[{x:0,y:0},{x:8000,y:0},{x:8000,y:5000},{x:0,y:5000}],{},kind==="wall"?"takeoff-default":"second"),calculation:"area",geometry:{type:"polygon",points:[{x:0,y:0},{x:8000,y:0},{x:8000,y:5000},{x:0,y:5000}]}});
 const f=exportTakeoffXlsx(d),vol=xml(f),areas=xml(f,"xl/worksheets/sheet3.xml"),z=unzipSync(f.bytes);expect(f.report.totals.volumeM3).toBeCloseTo(29.9,12);expect(f.report.totals.areaOnlyM2).toBe(160);expect(value(vol,"F"+f.totalRow)).toBeCloseTo(29.9,12);expect(value(areas,"F"+f.areaTotalRow)).toBe(160);expect(f.areaRows.size).toBe(4);expect(f.mainRows.size).toBe(5);
 for(const [id,r]of f.areaRows){expect(value(areas,"F"+r)).toBe(40);expect(areas).toContain(`<f>C${r}*D${r}</f>`);expect(areas).toContain(`<c r="E${r}" s="1"/>`);expect(f.mainRows.has(id)).toBe(false);}
 expect(areas).toContain("면적 (m²)");expect(areas).toContain("옹벽 소계");expect(areas).toContain("레이어 합계");expect(areas).not.toContain("m³");expect(strFromU8(z["xl/workbook.xml"])).toContain('sheet name="면적집계"');expect(strFromU8(z["[Content_Types].xml"])).toContain("/xl/worksheets/sheet3.xml");expect(strFromU8(z["xl/_rels/workbook.xml.rels"])).toContain('Target="worksheets/sheet3.xml"');
});
it("opens the area sheet first for an area-only report and preserves polygon-derived dimensions",()=>{
 const d=example();d.objects=d.objects.filter(o=>o.kind==="slab").map(o=>({...o,calculation:"area",dimensions:{}}));const f=exportTakeoffXlsx(d),z=unzipSync(f.bytes);expect(strFromU8(z["xl/workbook.xml"])).toContain('activeTab="2"');expect(f.report.items[0]).toMatchObject({lengthM:8,widthM:5,heightM:undefined,thicknessM:undefined,areaM2:40,volumeM3:0});expect(value(xml(f,"xl/worksheets/sheet3.xml"),"F"+f.areaTotalRow)).toBe(40);expect(value(xml(f),"F"+f.totalRow)).toBe(0);
});
