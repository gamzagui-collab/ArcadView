import {expect,it,vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {ViewerToolbar} from "./ViewerToolbar";
vi.mock("../i18n/I18nProvider",()=>({useI18n:()=>({locale:"en",t:(key:string)=>key})}));

it("keeps view actions available separately and exposes selection/deletion with their current availability",()=>{
  const render=(canDelete:boolean)=>renderToStaticMarkup(<ViewerToolbar onCommand={()=>{}} canMeasure selecting canDelete={canDelete}/>);
  const locked=render(false),ready=render(true);
  const fixed=locked.split('class="viewer-tools-scroll"')[0];
  for(const action of ["reset","Undo","Redo"])expect(fixed).toContain(`aria-label="${action}"`);
  expect(locked).toContain('class="viewer-history-dock"');
  expect(locked).toMatch(/class="viewer-cancel-tool"[^>]*aria-label="Cancel tool"/);
  for(const action of ["fit","zoomIn","zoomOut"])expect(locked).not.toContain(`aria-label="${action}"`);
  const scrolling=locked.match(/class="viewer-tools-scroll"[^>]*>([\s\S]*?)<\/div>/)![1];
  expect(scrolling.match(/<button /g)).toHaveLength(4);
  for(const action of ["Undo","Redo","Cancel tool"])expect(scrolling).not.toContain(`aria-label="${action}"`);
  expect(locked).toMatch(/data-tool="select"[^>]*aria-pressed="true"/);
  expect(locked).toMatch(/data-tool="delete"[^>]*disabled=""/);
  expect(ready).not.toMatch(/data-tool="delete"[^>]*disabled/);
  expect(fixed).not.toContain('data-tool="select"');
});

it("does not offer CAD object actions for a PDF viewer",()=>{
  const html=renderToStaticMarkup(<ViewerToolbar onCommand={()=>{}}/>);
  expect(html).not.toContain('data-tool="select"');
  expect(html).not.toContain('data-tool="delete"');
  expect(html).toContain('aria-label="reset"');
});
