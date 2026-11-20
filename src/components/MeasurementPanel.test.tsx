import {expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {MeasurementPanel,MeasurementStatus} from "./MeasurementPanel";
import type {MeasurementSettings} from "../viewer/measurementGeometry";
vi.mock("../i18n/I18nProvider",()=>({useI18n:()=>({locale:"en",t:(key:string)=>key})}));
const points=[{x:0,y:0},{x:3000,y:0},{x:3000,y:4000}];
const render=(mode:"path"|"area",displayOnly=false,enabled=true)=>{
 const settings:MeasurementSettings={mode,points,displayOnly,enabled,snapping:true,entity:null};
 const common={settings,sourceUnit:"mm" as const,displayUnit:"mm" as const,feedback:null,precision:0,onFinish:()=>{}};
 return renderToStaticMarkup(<><MeasurementPanel {...common} geometry={null} onPrecision={()=>{}} onHide={()=>{}} onSettings={()=>{}} onSourceUnit={()=>{}} onDisplayUnit={()=>{}}/><MeasurementStatus {...common} onShow={()=>{}} onToggle={()=>{}}/></>);
};
it("renders a last-edge distance and Finish action in both readouts, without a draft total/area/perimeter even while paused",()=>{
 for(const mode of ["path","area"] as const)for(const enabled of [true,false]){
  const html=render(mode,false,enabled);
  expect(html).toContain("4,000 mm");
  expect(html).toContain("Last segment");
  expect(html).toContain('class="measurement-finish"');
  expect(html).not.toContain("7,000 mm");
  expect(html).not.toContain("6,000,000");
  expect(html).not.toContain("mm²");
  expect(html).not.toContain("measurePerimeter");
 }
});
it("reveals final totals only in the saved result and hides Finish after completion",()=>{
 const path=render("path",true),area=render("area",true);
 expect(path).toContain("7,000 mm");
 expect(area).toContain("6,000,000 mm²");
 expect(area).toContain("measurePerimeter");
 for(const html of [path,area]){expect(html).not.toContain("Last segment");expect(html).not.toContain('class="measurement-finish"');}
});
