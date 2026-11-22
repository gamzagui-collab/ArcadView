import {afterEach,expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {strFromU8,unzipSync} from "fflate";
import {takeoffMessages,takeoffText,takeoffLayerName,type TakeoffTextKey} from "./takeoff";
import {translate,type Locale} from "./translations";
import {reviewDimensions} from "../takeoff/dimensionWarnings";
import {takeoffFormula} from "../takeoff/formula";
import {TakeoffFormula} from "../components/TakeoffFormula";
import {ViewerToolbar} from "../components/ViewerToolbar";
import {TakeoffEditor} from "../components/TakeoffEditor";
import {LayerTabs} from "../components/LayerTabs";
import {newTakeoff,type TakeoffObject} from "../takeoff/model";
import {exportTakeoffXlsx} from "../takeoff/xlsx";
import type {DrawingViewer} from "../viewer/DrawingViewer";
const language=vi.hoisted(()=>({locale:"en" as Locale}));
vi.mock("./I18nProvider",()=>({useI18n:()=>({locale:language.locale,t:(key:Parameters<typeof translate>[1])=>translate(language.locale,key)})}));
afterEach(()=>{language.locale="en";});
const wall:TakeoffObject={id:"wall-test",layerId:"takeoff-default",kind:"wall",groupId:"wall",geometry:{type:"path",points:[{x:0,y:0},{x:16000,y:0}]},dimensions:{heightMm:2640,thicknessMm:200},label:{visible:true}};
it("covers both foreign languages and preserves every message's interpolation values",()=>{
 const tokens=(s:string)=>[...s.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();
 for(const [key,values]of Object.entries(takeoffMessages))for(const value of values){expect(value.trim(),key).not.toBe("");expect(value,key).not.toMatch(/[가-힣]/);expect(tokens(value),key).toEqual(tokens(key));}
 expect(takeoffText("tr","{kind} {field} 단위",{kind:"Kolon",field:"Yükseklik"})).toBe("Kolon Yükseklik birimi");
});
it.each(["ko","en","tr"] as Locale[])("translates new toolbar, summary, layer controls and formula editing in %s without rewriting documents",locale=>{
 language.locale=locale;const tx=(key:TakeoffTextKey)=>takeoffText(locale,key);
 const toolbar=renderToStaticMarkup(<ViewerToolbar canMeasure onTakeoff={()=>{}} onCommand={()=>{}}/>);
 expect(toolbar).toContain(`aria-label="${tx("콘크리트 적산")}"`);expect(toolbar).toContain(`>${tx("적산")}</span>`);
 const viewer={getMeasurementGeometry:()=>({unitPreferenceKey:"v1-"+"b".repeat(64)}),getCadFocusOptions:()=>({colors:[],layers:[]})} as unknown as DrawingViewer;
 const identity={name:"drawing.dwg",size:1,lastModified:0};
 const html=renderToStaticMarkup(<TakeoffEditor viewer={viewer} identity={identity} active sourceUnit="mm" onHistory={()=>{}} layersOpen layerTabs={<LayerTabs value="takeoff" onChange={()=>{}}/>} onLayersToggle={()=>{}} onLayersHide={()=>{}}/>);
 expect(html).toContain(tx("[레이어]"));expect(html).toContain(tx("＋ 체적 레이어 추가"));expect(html).toContain(tx("Excel 집계표"));
 const formula=renderToStaticMarkup(<TakeoffFormula object={wall} unit="mm" measurementUnit="mm" onEdit={()=>{}} locale={locale}/>);
 expect(formula).toContain(tx("선택 적산 객체 산식"));expect(formula).toContain(tx("높이"));expect(formula).toContain('class="takeoff-formula-value"');expect(formula).toContain("8.448 m³");
 if(locale!=="ko")expect(toolbar+html+formula).not.toMatch(/[가-힣]/);
 expect(takeoffLayerName(locale,"2동 사용자 이름")).toBe("2동 사용자 이름");expect(identity.name).toBe("drawing.dwg");
});
it.each(["en","tr"] as Locale[])("localizes mixed units, previous/large dimensions and validation failures in %s while retaining quantities",locale=>{
 const before=structuredClone(wall),review=reviewDimensions(wall,["26400","200"],["mm","mm"],"mm",wall.dimensions,locale);
 expect(review.warnings.map(w=>w.code)).toContain("previous-size");expect(review.warnings[0].message).not.toMatch(/[가-힣]/);
 const unusual=reviewDimensions(wall,["2640","200"],["m","mm"],"mm",wall.dimensions,locale);
 expect(unusual.warnings.map(w=>w.code)).toEqual(["mixed-units","large-size","previous-size"]);expect(unusual.warnings.map(w=>w.message).join("")).not.toMatch(/[가-힣]/);
 for(const values of [["bad","200"],["2640000","200"]]){const invalid=reviewDimensions(wall,values,["m","mm"],"mm",undefined,locale);expect(invalid.candidate).toBeNull();expect(invalid.error).not.toMatch(/[가-힣]/);}
 const ko=takeoffFormula(wall,"mm"),localized=takeoffFormula(wall,"mm",locale);expect(localized).not.toBe(ko);expect(localized.result).toBe(ko.result);expect(localized.description).not.toMatch(/[가-힣]/);expect(takeoffFormula(wall,"mm",locale)).toBe(localized);expect(wall).toEqual(before);
});
it.each(["en","tr"] as Locale[])("exports localized sheet names, all columns and live formulas with correct cross-sheet/total references in %s",locale=>{
 const doc=newTakeoff({key:"v1-"+"b".repeat(64),name:"drawing.dwg",size:1,lastModified:0},"mm");doc.objects=[wall,{...wall,id:"area",kind:"slab",groupId:"slab",calculation:"area",geometry:{type:"polygon",points:[{x:0,y:0},{x:8000,y:0},{x:8000,y:5000},{x:0,y:5000}]},dimensions:{}}];
 const before=structuredClone(doc),file=exportTakeoffXlsx(doc,new Date("2026-11-22T00:00:00Z"),locale),zip=unzipSync(file.bytes),text=(p:string)=>strFromU8(zip[p]),main=text("xl/worksheets/sheet1.xml"),basis=text("xl/worksheets/sheet2.xml"),area=text("xl/worksheets/sheet3.xml"),book=text("xl/workbook.xml");
 for(const value of [main,basis,area,book,file.name])expect(value).not.toMatch(/[가-힣]/);
 const tx=(key:TakeoffTextKey)=>takeoffText(locale,key),r=file.mainRows.get(wall.id)!;
 expect(main).toContain(`<f>C${r}*E${r}*F${r}</f><v>8.448</v>`);expect(main).toContain(`&apos;${tx("산출근거")}&apos;!D`);
 expect(main).toContain(tx("레이어 합계"));expect(main).toContain(tx("두께")+" (m)");expect(main).toContain(tx("깊이")+" (m)");expect(main).toContain('TEXT(');expect(main).toContain('SUMIFS(');expect(main).toContain(`${tx("옹벽")} ${tx("소계")}`);expect(book).toContain(`name="${tx("면적집계")}"`);expect(doc).toEqual(before);
});

it("localizes generated volume/area layer names while preserving custom region names",()=>{
 expect(takeoffLayerName("ko","체적2")).toBe("체적2");expect(takeoffLayerName("en","체적2")).toBe("Volume2");expect(takeoffLayerName("tr","면적3")).toBe("Alan3");
 expect(takeoffLayerName("en","2동 1·2호 · 면적1")).toBe("2동 1·2호 · Area1");expect(takeoffLayerName("en","체적 사용자 이름")).toBe("체적 사용자 이름");
});
