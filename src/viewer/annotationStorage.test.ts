import {expect,it,vi} from 'vitest';
import {AnnotationStorage} from './annotationStorage';
import {newAnnotationDocument,type AnnotationDocument} from './annotations';
const document=(id='line'):AnnotationDocument=>({...newAnnotationDocument(),objects:[{id,layerId:'base',kind:'polyline',points:[{x:0,y:0},{x:10,y:5}]}]});
function setup(){const files=new Map<string,string>(),old=new Map<string,string>(),backend={read:vi.fn(async(k:string)=>files.get(k)??null),write:vi.fn(async(k:string,v:string)=>{files.set(k,v);})},legacy={getItem:(k:string)=>old.get(k)??null,setItem:(k:string,v:string)=>{old.set(k,v);}};return{files,old,backend,legacy,store:new AnnotationStorage(backend,legacy)};}
it('migrates legacy bytes without deleting or changing them, and restores canonical data when the WebView mirror is lost',async()=>{
 const s=setup(),raw=JSON.stringify(document());s.old.set('arcad.annotations.v1.a',raw);expect(await s.store.load('a')).toEqual(document());expect(s.files.get('a')).toBe(raw);expect(s.old.get('arcad.annotations.v1.a')).toBe(raw);
 s.old.clear();const restarted=new AnnotationStorage(s.backend,s.legacy);expect(await restarted.load('a')).toEqual(document());expect(await restarted.load('b')).toEqual(newAnnotationDocument());
});
it('waits for the durable ACK before mirroring or reporting successful save',async()=>{
 const s=setup();let ack!:()=>void;s.backend.write.mockImplementationOnce(async(k,v)=>{await new Promise<void>(r=>ack=r);s.files.set(k,v);});let done=false;
 const save=s.store.save('a',document()).then(()=>{done=true;});await vi.waitFor(()=>expect(ack).toBeTypeOf('function'));expect(done).toBe(false);expect(s.old.size).toBe(0);ack();await save;expect(done).toBe(true);expect(s.old.get('arcad.annotations.v1.a')).toBe(JSON.stringify(document()));
});
it('queues rapid changes, captures immutable snapshots and preserves the last edit on a fresh instance',async()=>{
 const s=setup(),a=document('a'),b=document('b');const first=s.store.save('a',a),second=s.store.save('a',b);b.objects[0].points[1].x=999;await Promise.all([first,second]);
 expect(s.backend.write.mock.calls.map(c=>JSON.parse(c[1]).objects[0].id)).toEqual(['a','b']);const restored=await new AnnotationStorage(s.backend,s.legacy).load('a');expect(restored.objects[0].id).toBe('b');expect(restored.objects[0].points[1].x).toBe(10);
});
it('propagates disk failure, retains the previous document and can retry without a poisoned queue',async()=>{
 const s=setup();await s.store.save('a',document('old'));s.backend.write.mockRejectedValueOnce(Error('disk full'));await expect(s.store.save('a',document('new'))).rejects.toThrow('disk full');expect(JSON.parse(s.files.get('a')!).objects[0].id).toBe('old');expect(JSON.parse(s.old.get('arcad.annotations.v1.a')!).objects[0].id).toBe('old');await s.store.save('a',document('new'));expect(JSON.parse(s.files.get('a')!).objects[0].id).toBe('new');
});
it('never falls back to an empty or stale document on canonical read or validation failure',async()=>{
 const s=setup();s.old.set('arcad.annotations.v1.a',JSON.stringify(document('stale')));s.files.set('a','{bad');await expect(s.store.load('a')).rejects.toThrow();expect(s.backend.write).not.toHaveBeenCalled();s.backend.read.mockRejectedValueOnce(Error('unreadable'));await expect(s.store.load('a')).rejects.toThrow('unreadable');expect(s.files.get('a')).toBe('{bad');
});
it('does not overwrite corrupt legacy bytes or silently migrate failed writes',async()=>{
 const s=setup();s.old.set('arcad.annotations.v1.a','{bad');await expect(s.store.load('a')).rejects.toThrow();expect(s.backend.write).not.toHaveBeenCalled();s.old.set('arcad.annotations.v1.a',JSON.stringify(document()));s.backend.write.mockRejectedValueOnce(Error('sync failed'));await expect(s.store.load('a')).rejects.toThrow('sync failed');expect(s.files.size).toBe(0);expect(await s.store.load('a')).toEqual(document());
});
it('restores the durable document even if compatibility mirror writes fail and keeps drawings separate',async()=>{
 const s=setup(),store=new AnnotationStorage(s.backend,{getItem:s.legacy.getItem,setItem:()=>{throw Error('WebView quota')}});await store.save('a',document('a'));await store.save('b',document('b'));expect((await new AnnotationStorage(s.backend,s.legacy).load('a')).objects[0].id).toBe('a');expect((await store.load('b')).objects[0].id).toBe('b');
});
it('rejects invalid documents before any write and persists Undo/Redo snapshots',async()=>{
 const s=setup();await expect(s.store.save('a',{...document(),dimensionScale:NaN})).rejects.toThrow();expect(s.backend.write).not.toHaveBeenCalled();await s.store.save('a',document());await s.store.save('a',newAnnotationDocument());expect((await new AnnotationStorage(s.backend,s.legacy).load('a')).objects).toEqual([]);await s.store.save('a',document());expect((await new AnnotationStorage(s.backend,s.legacy).load('a')).objects).toHaveLength(1);
});
