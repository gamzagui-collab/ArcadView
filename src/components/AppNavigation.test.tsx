import{expect,it,vi}from'vitest';
import{renderToStaticMarkup}from'react-dom/server';
import{DrawingHeader}from'./DrawingHeader';
import{ExitConfirmation}from'./AppNavigation';
import{navigationWords}from'../i18n/navigation';
const language=vi.hoisted(()=>({locale:'ko' as 'ko'|'en'|'tr'}));
vi.mock('../i18n/I18nProvider',()=>({useI18n:()=>({locale:language.locale,t:(key:string)=>key})}));
it.each(['ko','en','tr']as const)('keeps home, library, settings and exit distinct and ordered in %s',locale=>{
 language.locale=locale;const w=navigationWords[locale],html=renderToStaticMarkup(<DrawingHeader name="long drawing.dwg" format="DWG" size="13 MB" settingsOpen={false} onHome={()=>{}} onLibrary={()=>{}} onSettings={()=>{}} onExit={()=>{}}/>),actions=html.split('class="viewer-header-actions"')[1];
 expect(html).toContain(`aria-label="${w.home}"`);expect(html).toContain('class="icon-button viewer-home-button"');expect(actions.indexOf('myDrawings')).toBeLessThan(actions.indexOf(w.settings));expect(actions.indexOf(w.settings)).toBeLessThan(actions.indexOf(w.exit));expect(html).not.toContain('aria-label="close"');
});
it.each(['ko','en','tr']as const)('requests explicit confirmation without triggering exit on render in %s',locale=>{
 language.locale=locale;const confirm=vi.fn(async()=>{}),html=renderToStaticMarkup(<ExitConfirmation onCancel={()=>{}} onConfirm={confirm}/>),w=navigationWords[locale];expect(html).toContain('role="alertdialog"');expect(html).toContain(w.confirm);expect(html).toContain(w.cancel);expect(html).toContain(w.quit);expect(confirm).not.toHaveBeenCalled();
});
