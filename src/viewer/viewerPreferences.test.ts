import{afterEach,expect,it,vi}from'vitest';
import{readViewerPreferences,saveViewerPreferences,VIEWER_PREFERENCES_KEY,VIEWER_PREFERENCES_EVENT}from'./viewerPreferences';
afterEach(()=>vi.unstubAllGlobals());
it('defaults nearest to enabled without rewriting older settings and persists a deliberate off choice',()=>{
 const raw=JSON.stringify({magnifierEnabled:false,magnifierSize:'large',nearestSnapEnabled:false});
 expect(readViewerPreferences({getItem:()=>raw})).toEqual({magnifierEnabled:false,magnifierSize:'large',nearestSnapEnabled:false});
 expect(readViewerPreferences({getItem:()=>null}).nearestSnapEnabled).not.toBe(false);
 expect(readViewerPreferences({getItem:()=>JSON.stringify({nearestSnapEnabled:'false'})}).nearestSnapEnabled).not.toBe(false);
});
it('opens with a larger enabled medium lens and tolerates unavailable or corrupt storage',()=>{
 expect(readViewerPreferences({getItem:()=>null})).toEqual({magnifierEnabled:true,magnifierSize:'medium'});
 expect(readViewerPreferences({getItem:()=>'{broken'})).toEqual({magnifierEnabled:true,magnifierSize:'medium'});
 expect(readViewerPreferences({getItem:()=>{throw Error('denied')}})).toEqual({magnifierEnabled:true,magnifierSize:'medium'});
});
it('roundtrips enable/size choices and notifies an already-created lens',()=>{
 const saved=new Map<string,string>(),storage={getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>{saved.set(k,v)}},target=new EventTarget(),changed=vi.fn();vi.stubGlobal('window',target);target.addEventListener(VIEWER_PREFERENCES_EVENT,changed);
 for(const size of ['small','medium','large']as const){expect(saveViewerPreferences({magnifierEnabled:false,magnifierSize:size},storage)).toBe(true);expect(readViewerPreferences(storage)).toEqual({magnifierEnabled:false,magnifierSize:size});}
 expect(changed).toHaveBeenCalledTimes(3);expect(saved.size).toBe(1);expect(saved.has(VIEWER_PREFERENCES_KEY)).toBe(true);
});
it('rejects unknown sizes independently while retaining an explicit off choice',()=>{
 for(const size of ['huge','toString',null,{},300])expect(readViewerPreferences({getItem:()=>JSON.stringify({magnifierEnabled:false,magnifierSize:size})})).toEqual({magnifierEnabled:false,magnifierSize:'medium'});
});
it('reports a write failure without broadcasting a successful preference change',()=>{
 const target=new EventTarget(),changed=vi.fn();vi.stubGlobal('window',target);target.addEventListener(VIEWER_PREFERENCES_EVENT,changed);
 expect(saveViewerPreferences({magnifierEnabled:false,magnifierSize:'large'},{setItem:()=>{throw Error('quota')}})).toBe(false);expect(changed).not.toHaveBeenCalled();
});
