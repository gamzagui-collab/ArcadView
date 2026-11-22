import{expect,it,vi,afterEach}from'vitest';
import{IDBFactory,IDBObjectStore}from'fake-indexeddb';
import{addCalculationLayer,removeCalculationLayer,selectCalculationLayer,separateCalculationLayers,switchCalculationLayer}from'./calculationLayers';
import{calculationOf,moveTakeoffToLayer,newTakeoff,quantity,totals,validateDocument,type TakeoffDocument,type TakeoffObject}from'./model';
import{loadTakeoff,saveTakeoff}from'./storage';
import{UndoHistory}from'../viewer/undoHistory';
const drawing={key:'v1-'+'a'.repeat(64),name:'layers.dwg',size:20,lastModified:1};
const fresh=()=>newTakeoff(drawing,'m');
const wall:TakeoffObject={id:'W01',layerId:'takeoff-default',kind:'wall',groupId:'wall',geometry:{type:'path',points:[{x:0,y:0},{x:20,y:0}]},dimensions:{heightMm:3000,thicknessMm:200},label:{visible:true,position:{x:2,y:1}}};
const area:TakeoffObject={id:'A01',layerId:'takeoff-default',kind:'slab',groupId:'slab',calculation:'area',geometry:{type:'polygon',points:[{x:0,y:0},{x:8,y:0},{x:8,y:5},{x:0,y:5}]},dimensions:{},label:{visible:false}};
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('creates only the initial volume layer and lazily creates one area layer on mode change',()=>{
 const d=fresh(),snapshot=structuredClone(d);expect(d.layers).toEqual([{id:'takeoff-default',name:'체적1',visible:true,calculation:'volume'}]);
 const a=switchCalculationLayer(d,'area','A');expect(a.layers.map(l=>l.name)).toEqual(['체적1','면적1']);expect(a.activeLayerId).toBe('A');expect(a.options.calculation).toBe('area');
 const v=switchCalculationLayer(a,'volume','unused');expect(v.activeLayerId).toBe('takeoff-default');expect(switchCalculationLayer(v,'area','another').activeLayerId).toBe('A');expect(v.layers).toHaveLength(2);expect(d).toEqual(snapshot);
});
it('numbers each mode independently and restores its last selected layer after serialization',()=>{
 let d=addCalculationLayer(fresh(),'V2');d=switchCalculationLayer(d,'area','A1');d=addCalculationLayer(d,'A2');d=switchCalculationLayer(d,'volume','unused');expect(d.activeLayerId).toBe('V2');d=addCalculationLayer(d,'V3');expect(d.layers.map(l=>l.name)).toEqual(['체적1','체적2','면적1','면적2','체적3']);
 const restored=separateCalculationLayers(JSON.parse(JSON.stringify(d)));expect(switchCalculationLayer(restored,'area','unused2').activeLayerId).toBe('A2');expect(switchCalculationLayer(restored,'volume','unused3').activeLayerId).toBe('V3');
});
it('preserves custom names and does not restart numbering when a default is renamed',()=>{
 const d=fresh();d.layers[0].name='2동 1·2호';const next=addCalculationLayer(d,'V2');expect(next.layers.map(l=>l.name)).toEqual(['2동 1·2호','체적2']);next.layers[1].name='체적8';expect(addCalculationLayer(next,'V9').layers.at(-1)?.name).toBe('체적9');
});
it('splits an old mixed layer deterministically while preserving all object data and total quantities',()=>{
 const d=fresh();d.layers=[{id:'takeoff-default',name:'적산 1',visible:false}];d.objects=[wall,area];d.options.calculation='area';delete d.options.calculationLayers;const before=structuredClone(d),next=separateCalculationLayers(d);
 expect(next.layers.map(l=>[l.name,l.calculation,l.visible])).toEqual([['체적1','volume',false],['면적1','area',false]]);expect(next.activeLayerId).toBe('takeoff-default:area');
 for(const o of next.objects){const original=d.objects.find(v=>v.id===o.id)!;expect({...o,layerId:original.layerId}).toEqual(original);expect(quantity(o,next.unit)).toEqual(quantity(original,d.unit));expect(next.layers.find(l=>l.id===o.layerId)?.calculation).toBe(calculationOf(o));}
 expect(totals(next).volumeM3).toBe(12);expect(totals(next).areaOnlyM2).toBe(40);expect(totals(next).visibleVolumeM3).toBe(0);expect(next.revision).toBe(d.revision);expect(d).toEqual(before);expect(separateCalculationLayers(next)).toBe(next);expect(separateCalculationLayers(before)).toEqual(next);validateDocument(next);
});
it('keeps a custom legacy region name and its context when separating mixed objects',()=>{
 const d=fresh();d.layers=[{id:'takeoff-default',name:'2동 1·2호',visible:true}];d.objects=[wall,area];const next=separateCalculationLayers(d);expect(next.layers.map(l=>l.name)).toEqual(['2동 1·2호','2동 1·2호 · 면적1']);expect(next.objects[0]).toBe(wall);expect(next.objects[1].id).toBe(area.id);
});
it('classifies area-only legacy layers and resolves derived ID/name collisions without merging regions',()=>{
 const d=fresh();d.layers=[{id:'takeoff-default',name:'적산 1',visible:true},{id:'takeoff-default:area',name:'면적1',visible:false}];d.objects=[wall,area,{...area,id:'A02',layerId:'takeoff-default:area'}];const next=separateCalculationLayers(d);expect(next.layers.map(l=>l.name)).toEqual(['체적1','면적2','면적1']);expect(new Set(next.layers.map(l=>l.id)).size).toBe(3);expect(next.objects[1].layerId).toBe('takeoff-default:area:2');expect(next.objects[2].layerId).toBe('takeoff-default:area');
});
it('selecting a layer synchronizes mode, remembers its selection and preserves other visibility settings',()=>{
 let d=switchCalculationLayer(fresh(),'area','A1');d=addCalculationLayer(d,'A2');d.layers=d.layers.map(l=>({...l,visible:false}));const next=selectCalculationLayer(d,'takeoff-default');expect(next.options.calculation).toBe('volume');expect(next.layers.map(l=>l.visible)).toEqual([true,false,false]);expect(switchCalculationLayer(next,'area','unused').activeLayerId).toBe('A2');
});
it('restricts object transfer to matching calculation layers without changing object specs or labels',()=>{
 let d=switchCalculationLayer(fresh(),'area','A1');d=addCalculationLayer(d,'V2','volume');d.objects=[wall,{...area,layerId:'A1'}];expect(()=>moveTakeoffToLayer(d,'W01','A1')).toThrow('체적과 면적');expect(()=>moveTakeoffToLayer(d,'A01','V2')).toThrow('체적과 면적');const moved=moveTakeoffToLayer(d,'W01','V2');expect({...moved.objects[0],layerId:wall.layerId}).toEqual(wall);
});
it('deleting the active layer selects a compatible remaining mode and drops stale remembered IDs',()=>{
 let d=switchCalculationLayer(fresh(),'area','A1');d=addCalculationLayer(d,'A2');d.objects=[{...area,layerId:'A2'},wall];const after=removeCalculationLayer(d,'A2');expect(after.activeLayerId).toBe('A1');expect(after.options.calculation).toBe('area');expect(after.objects).toEqual([wall]);const volume=removeCalculationLayer(after,'A1');expect(volume.activeLayerId).toBe('takeoff-default');expect(volume.options.calculation).toBe('volume');expect(volume.options.calculationLayers?.area).toBeUndefined();expect(removeCalculationLayer(volume,'takeoff-default')).toBe(volume);
});
it('undo/redo restores layer creation, calculation choice and remembered selections as one edit',()=>{
 const h=new UndoHistory<TakeoffDocument>(),before=fresh(),after=switchCalculationLayer(before,'area','A1');h.record(before);const undone=h.undo(after)!;expect(undone).toEqual(before);expect(h.redo(undone)).toEqual(after);
});
it('reopens separate layer membership and remembers both mode selections',async()=>{
 vi.stubGlobal('indexedDB',new IDBFactory());let d=switchCalculationLayer(fresh(),'area','A1');d=addCalculationLayer(d,'A2');d=addCalculationLayer(d,'V2','volume');d.objects=[{...wall,layerId:'V2'},{...area,layerId:'A2'}];await saveTakeoff(d);const reopened=separateCalculationLayers((await loadTakeoff(drawing,'mm')).document);expect(reopened).toEqual(d);expect(switchCalculationLayer(reopened,'area','unused').activeLayerId).toBe('A2');expect(totals(reopened).areaOnlyM2).toBe(40);
});
it('only persists a legacy separation on a successful save and preserves original mixed data on failure',async()=>{
 vi.stubGlobal('indexedDB',new IDBFactory());const legacy=fresh();legacy.layers=[{id:'takeoff-default',name:'적산 1',visible:true}];delete legacy.options.calculationLayers;legacy.objects=[wall,area];await saveTakeoff(legacy);const next=separateCalculationLayers((await loadTakeoff(drawing,'mm')).document);expect((await loadTakeoff(drawing,'mm')).document).toEqual(legacy);
 const put=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(()=>{throw new DOMException('full','QuotaExceededError')});await expect(saveTakeoff(next)).rejects.toThrow('full');put.mockRestore();expect((await loadTakeoff(drawing,'m')).document).toEqual(legacy);await saveTakeoff(next);expect((await loadTakeoff(drawing,'m')).document).toEqual(next);
});
