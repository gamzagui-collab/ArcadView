import {forwardRef,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState} from "react";
import type {ReactNode} from "react";
import {ToolbarStatus} from "./ToolbarStatus";
import type {AnnotationHandleDrag,DrawingViewer,MeasurementPick} from "../viewer/DrawingViewer";
import {annotationGeometry,translateAnnotation,uid,type Annotation} from "../viewer/annotations";
import {distance,pointSegmentDistance,type MeasurementUnit} from "../viewer/measurementGeometry";
import type {DrawingPoint as P} from "../viewer/savedView";
import {objectGrips,reshapeObject} from "../viewer/objectEditing";
import {createMoveSnap} from "../viewer/moveSnapping";
import {UndoHistory,type EditCommand,type EditHistoryState} from "../viewer/undoHistory";
import {drawMeasurementOverlay} from "../viewer/measurementOverlay";
import {parseEditNumber} from "../viewer/offsetGeometry";
import {asAnnotation,cleanPoints,dimensionsError,fromAnnotation,geometryError,insidePolygon,isAreaKind,KINDS,knownUnit,labelPosition,moveTakeoffToLayer,NAMES,newTakeoff,quantity,takeoffVisible,totals,selectedLayerTotals,type Dimensions,type TakeoffDocument,type TakeoffKind,type TakeoffObject} from "../takeoff/model";
import {loadTakeoff,notifyTakeoffCompleted,saveTakeoff} from "../takeoff/storage";
import {drawTakeoff} from "../takeoff/overlay";
import {takeoffDraftPoints} from "../takeoff/draft";
import {saveTakeoffWorkbook} from "../native/takeoffExport";
import {ToolIcon} from "./ToolIcon";
import {VisibilityIcon} from "./Icons";
import {ToolStrip} from "./ToolStrip";
import {TakeoffLayerRow} from "./TakeoffLayerRow";
import "../takeoff/takeoff.css";
export type TakeoffHandle={execute(command:EditCommand):void;objectAction(command:"select"|"delete"):void;showTools():void};
type Props={viewer:DrawingViewer;identity:{name:string;size:number;lastModified:number};active:boolean;sourceUnit:MeasurementUnit;onHistory(state:EditHistoryState):void;layersOpen:boolean;layerTabs:ReactNode;onLayersToggle():void;onLayersHide():void};
type Form={object:TakeoffObject;existing:boolean};
export const TakeoffEditor=forwardRef<TakeoffHandle,Props>(function TakeoffEditor({viewer,identity,active,sourceUnit,onHistory,layersOpen,layerTabs,onLayersToggle,onLayersHide},ref){
 const key=viewer.getMeasurementGeometry().unitPreferenceKey,drawing={key:key??"",...identity};
 const[doc,setDoc]=useState(()=>newTakeoff(drawing,sourceUnit)),docRef=useRef(doc);docRef.current=doc;
 const[loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState(""),[loadRevision,reload]=useState(0),[revisions,setRevisions]=useState<Array<{key:string;count:number;revision:number}>>([]);
 const[tool,setTool]=useState<TakeoffKind|"select"|"insert">("wall"),[open,setOpen]=useState(false),[draft,setDraft]=useState<P[]>([]),[selected,setSelected]=useState<string|null>(null),[vertex,setVertex]=useState<number|null>(null),[snap,setSnap]=useState(true),[notice,setNotice]=useState("");
 const[layerDelete,setLayerDelete]=useState<string|null>(null);
 const[pickingColor,setPickingColor]=useState(false);
 const[exporting,setExporting]=useState(false),exportLock=useRef(false);
 const[form,setForm]=useState<Form|null>(null),[values,setValues]=useState<string[]>([]),[heightUnit,setHeightUnit]=useState<"m"|"mm">("m"),[formError,setFormError]=useState(""),[unitChange,setUnitChange]=useState<MeasurementUnit|null>(null);
 const[busy,setBusy]=useState(false),[saveError,setSaveError]=useState(""),[saved,setSaved]=useState(false),lock=useRef(false),mounted=useRef(true),history=useRef(new UndoHistory<TakeoffDocument>());
 const failed=useRef<{next:TakeoffDocument;record:boolean;done?:()=>void;rollback?:()=>void}|null>(null);
 const svg=useRef<SVGSVGElement>(null),target=useRef<SVGSVGElement>(null),preview=useRef<MeasurementPick|null>(null),dragPreview=useRef<TakeoffObject|null>(null),[dragging,setDragging]=useState(false),renderRef=useRef<()=>void>(()=>{}),firstInput=useRef<HTMLInputElement>(null);
 const selectedObject=doc.objects.find(o=>o.id===selected),visible=doc.objects.filter(o=>takeoffVisible(doc,o)),[cadOptions]=useState(()=>viewer.getCadFocusOptions()),currentLayer=doc.layers.find(l=>l.id===doc.activeLayerId)!;
 const blocked=()=>!loaded||!!loadError||!!revisions.length||lock.current||!!failed.current;
 useLayoutEffect(()=>{setOpen(active);},[active]);
 useEffect(()=>{if(layersOpen)setOpen(false);},[layersOpen]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{let live=true;setLoaded(false);setLoadError("");if(!key){setLoadError("도면 내용 식별자를 준비하지 못했습니다. 다시 열어 주세요.");return;}
  void loadTakeoff(drawing,sourceUnit).then(({document,revisions,existing})=>{if(live){docRef.current=document;setDoc(document);setRevisions(existing?[]:revisions);setHeightUnit(document.options.heightUnit);setLoaded(true);history.current.clear();}}).catch(e=>{if(live)setLoadError(`적산을 불러오지 못했습니다: ${e.message}`);});return()=>{live=false;};
 },[key,loadRevision]);
 const persist=async(next:TakeoffDocument,record=true,done?:()=>void,rollback?:()=>void)=>{
  if(lock.current)return;lock.current=true;setBusy(true);setSaveError("");setSaved(false);
  const current=docRef.current,candidate={...next,revision:current.revision+1};
  try{await saveTakeoff(candidate);if(record)history.current.record(current);failed.current=null;if(mounted.current){docRef.current=candidate;setDoc(candidate);setSaved(true);done?.();}}
  catch(e){failed.current={next,record,done,rollback};if(mounted.current)setSaveError(`저장하지 못했습니다. 기존 적산은 유지됩니다. ${e instanceof Error?e.message:String(e)}`);}
  finally{lock.current=false;if(mounted.current)setBusy(false);}
 };
 const commit=(next:TakeoffDocument,done?:()=>void)=>{if(!blocked())void persist(next,true,done);};
 const cancelDraft=()=>{setPickingColor(false);setDraft([]);preview.current=null;setForm(null);setFormError("");setVertex(null);renderRef.current();};
 const resetTool=(value:typeof tool)=>{viewer.cancelInteraction();cancelDraft();setTool(value);setNotice("");};
 const deleteObject=()=>{if(blocked()||!selected)return;commit({...docRef.current,objects:docRef.current.objects.filter(o=>o.id!==selected)},()=>{setSelected(null);setVertex(null);});};
 const execute=(command:EditCommand)=>{if(blocked())return;if(command==="cancel"){cancelDraft();setSelected(null);setTool("select");return;}cancelDraft();const current=docRef.current,next=history.current[command](current);if(next)void persist(next,false,()=>setSelected(null),()=>{history.current[command==="undo"?"redo":"undo"](next);});};
 useImperativeHandle(ref,()=>({execute,showTools:()=>{onLayersHide();setOpen(true);},objectAction:command=>{if(command==="delete")deleteObject();else{resetTool("select");setOpen(true);}}}));
 useLayoutEffect(()=>{if(active)onHistory({canUndo:history.current.canUndo&&!busy&&!saveError,canRedo:history.current.canRedo&&!busy&&!saveError,selecting:tool==="select"||tool==="insert",canDelete:!!selectedObject&&!busy&&!saveError});},[active,doc,selected,busy,saveError,tool]);
 useLayoutEffect(()=>{if(form){firstInput.current?.focus();firstInput.current?.select();}},[form]);
 const startForm=(object:TakeoffObject,existing:boolean)=>{
  if(!existing&&(!currentLayer.visible||!doc.groups.find(g=>g.id===object.kind)?.visible)){setNotice("현재 레이어와 부재 표시를 켠 후 작성하세요.");setOpen(true);return;}
  if(!knownUnit(doc.unit)){setNotice("도면 1단위의 실제 단위를 선택한 후 확정하세요.");setOpen(true);return;}
  const error=geometryError(object.geometry.points,isAreaKind(object.kind));if(error){setNotice(error);return;}
  const d=object.dimensions;setHeightUnit(doc.options.heightUnit);setValues(object.kind==="wall"?[String(d.heightMm!/(doc.options.heightUnit==="m"?1000:1)),String(d.thicknessMm)]:object.kind==="beam"?[String(d.widthMm),String(d.depthMm)]:object.kind==="column"?[String(d.heightMm!/(doc.options.heightUnit==="m"?1000:1))]:[String(d.thicknessMm)]);setForm({object,existing});setFormError("");preview.current=null;
 };
 const finish=()=>{if(blocked()||tool==="select"||tool==="insert")return;startForm({id:uid(),layerId:doc.activeLayerId,kind:tool,groupId:tool,geometry:{type:isAreaKind(tool)?"polygon":"path",points:cleanPoints(draft,isAreaKind(tool))},dimensions:{...doc.defaults[tool]},label:{visible:true}},false);};
 const finishPoints=(points:P[])=>{if(tool==="select"||tool==="insert")return;startForm({id:uid(),layerId:doc.activeLayerId,kind:tool,groupId:tool,geometry:{type:isAreaKind(tool)?"polygon":"path",points:cleanPoints(points,isAreaKind(tool))},dimensions:{...doc.defaults[tool]},label:{visible:true}},false);};
 const applyForm=()=>{if(!form||blocked())return;const nums=values.map(parseEditNumber);if(nums.some(v=>v===null)){setFormError("유효한 숫자를 입력하세요.");return;}
  const n=nums as number[],dimensions:Dimensions=form.object.kind==="wall"?{heightMm:n[0]*(heightUnit==="m"?1000:1),thicknessMm:n[1]}:form.object.kind==="beam"?{widthMm:n[0],depthMm:n[1]}:form.object.kind==="column"?{heightMm:n[0]*(heightUnit==="m"?1000:1)}:{thicknessMm:n[0]},error=dimensionsError(form.object.kind,dimensions);if(error){setFormError(error);return;}
  const object={...form.object,dimensions};try{quantity(object,doc.unit);}catch(e){setFormError((e as Error).message);return;}
  const next={...doc,defaults:{...doc.defaults,[object.kind]:dimensions},options:{...doc.options,heightUnit},objects:form.existing?doc.objects.map(o=>o.id===object.id?object:o):[...doc.objects,object]};
  commit(next,()=>{setSelected(object.id);setTool("select");cancelDraft();if(!form.existing)notifyTakeoffCompleted({drawingKey:doc.drawing.key,objectId:object.id,kind:object.kind});});
 };
 const hit=(point:P)=>{let found:TakeoffObject|null=null,best=viewer.worldTolerance(14);for(const o of [...visible].reverse()){const p=o.geometry.points;for(let i=1;i<p.length+(isAreaKind(o.kind)?1:0);i++){const d=pointSegmentDistance(point,p[i-1],p[i%p.length]);if(d<=best){found=o;best=d;}}if(!found&&isAreaKind(o.kind)&&insidePolygon(point,p))found=o;}return found;};
 const pick=(pick:MeasurementPick)=>{
  if(blocked()||form)return;
  if(pickingColor){
   if(!pick.cadColor){setNotice("색상을 가져올 원본 도면의 선이나 면을 눌러 주세요.");return;}
   const color=pick.cadColor;
   commit({...doc,options:{...doc.options,keepColors:[...new Set([...doc.options.keepColors,color])]}},()=>{setPickingColor(false);setNotice(`${color} 원본 색상을 유지합니다.`);});return;
  }
  if(tool==="select"){setSelected(hit(pick.point)?.id??null);setVertex(null);setNotice("");return;}
  if(tool==="insert"){
   if(!selectedObject)return;const p=selectedObject.geometry.points;let index=0,best=Infinity;for(let i=1;i<p.length+(isAreaKind(selectedObject.kind)?1:0);i++){const d=pointSegmentDistance(pick.point,p[i-1],p[i%p.length]);if(d<best){best=d;index=i;}}
   const points=cleanPoints([...p.slice(0,index),pick.point,...p.slice(index)],isAreaKind(selectedObject.kind));if(points.length===p.length){setNotice("이미 있는 점입니다.");return;}const error=geometryError(points,isAreaKind(selectedObject.kind));if(error){setNotice(error);return;}commit({...doc,objects:doc.objects.map(o=>o.id===selected?{...o,geometry:{...o.geometry,points}}:o)},()=>{setTool("select");setNotice("점이 추가되었습니다.");});return;
  }
  if(!currentLayer.visible||!doc.groups.find(g=>g.id===tool)?.visible){setNotice("현재 레이어와 부재 표시를 켠 후 작성하세요.");return;}
  if(pick.replaceIndex!==undefined){setDraft(takeoffDraftPoints(draft,pick));setNotice("");return;}
  if(draft.length>=4096){setNotice("한 객체에 최대 4096개 점을 사용할 수 있습니다.");return;}
  if(draft.length&&distance(draft.at(-1)!,pick.point)<=1e-8)return;
  const points=[...draft,pick.point];setDraft(points);setNotice("");if(pick.snapped==="start"&&points.length>=4)finishPoints(points);
 };
 const beginHandle=(client:P):AnnotationHandleDrag|null=>{
  if(blocked()||form||draft.length||!active||tool!=="select")return null;
  const rect=viewer.getCanvasElement().getBoundingClientRect(),screen={x:client.x-rect.left,y:client.y-rect.top};let object=selectedObject,label=false;
  for(const e of [...svg.current!.querySelectorAll<SVGGElement>("[data-takeoff-label]")].reverse()){const rect=e.querySelector("rect");if(!rect)continue;const b=rect.getBoundingClientRect();if(client.x>=b.left&&client.x<=b.right&&client.y>=b.top&&client.y<=b.bottom){object=visible.find(o=>o.id===e.dataset.takeoffLabel);label=true;break;}}
  if(!object)return null;const objectId=object.id,annotation=asAnnotation(object),move=svg.current?.querySelector<SVGCircleElement>(`[data-takeoff-move="${objectId}"]`),free=!label&&!!move&&Math.hypot(screen.x-Number(move.getAttribute("cx")),screen.y-Number(move.getAttribute("cy")))<=18;
  const grip=!free&&!label?objectGrips(annotation).find(g=>{const p=viewer.projectPoints([g.point])[0];return Math.hypot(p.x-screen.x,p.y-screen.y)<=12;}):undefined;if(!free&&!label&&!grip)return null;
  setSelected(objectId);if(grip)setVertex(Number(grip.id.split(":")[1]));const base=label?labelPosition(object):free?object.geometry.points[0]:grip!.point,projected=viewer.projectPoints([base])[0],original=object;let moved=false;
  const candidate=(pick:MeasurementPick)=>{if(label)return{...original,label:{...original.label,position:pick.point}};const a=free?translateAnnotation(annotation,base,pick.point):reshapeObject(annotation,grip!.id,pick.point);return a?fromAnnotation(original,a):null;};
  const clear=()=>{dragPreview.current=null;setDragging(false);preview.current=null;renderRef.current();};dragPreview.current=object;setDragging(true);
  const normal=viewer.getAnnotationTargets(),own=annotationGeometry(visible.filter(o=>o.id!==objectId).map(o=>asAnnotation(o)));
  return{offset:{x:projected.x+rect.left-client.x,y:projected.y+rect.top-client.y},anchor:free?base:original.geometry.points.find(p=>distance(p,base)>1e-8),translation:free?{snap:createMoveSnap(annotation,base),geometry:{...own,entities:[...normal.geometry.entities,...own.entities],snaps:[...normal.geometry.snaps,...own.snaps].sort((a,b)=>a.x-b.x)},masks:normal.masks}:undefined,
   move:p=>{moved||=distance(base,p.point)>viewer.worldTolerance(2);dragPreview.current=candidate(p);renderRef.current();},end:p=>{const next=candidate(p);clear();if(!moved||!next)return;const error=geometryError(next.geometry.points,isAreaKind(next.kind));if(error){setNotice(error);return;}commit({...docRef.current,objects:docRef.current.objects.map(o=>o.id===objectId?next:o)});},cancel:clear};
 };
 const draftObject:TakeoffObject|null=tool!=="select"&&tool!=="insert"&&draft.length?{id:"takeoff-draft",layerId:doc.activeLayerId,groupId:tool,kind:tool,geometry:{type:isAreaKind(tool)?"polygon":"path",points:draft},dimensions:{},label:{visible:false}}:null;
 const render=()=>{
  if(!svg.current||!target.current)return;let temporary=dragPreview.current??draftObject;
  const points=takeoffDraftPoints(draft,preview.current);
  if(!dragPreview.current&&draftObject)temporary={...draftObject,geometry:{...draftObject.geometry,points}};
  drawTakeoff(svg.current,doc,selected,temporary,p=>viewer.projectPoints(p),active);
  drawMeasurementOverlay(target.current,{enabled:active&&tool!=="select"&&tool!=="insert"&&!pickingColor&&!dragging&&!form,mode:"path",points:draft,snapping:snap,entity:null},p=>viewer.projectPoints(p),preview.current,[],[],undefined,points);
 };
 renderRef.current=render;
 useLayoutEffect(()=>{render();},[doc,selected,active,draft,dragging,form]);
 useLayoutEffect(()=>viewer.subscribeView(()=>renderRef.current()),[viewer]);
 useLayoutEffect(()=>{viewer.setTakeoffGeometry(annotationGeometry(visible.filter(o=>!dragging||o.id!==selected).map(o=>asAnnotation(o))));return()=>viewer.setTakeoffGeometry(annotationGeometry([]));},[doc,dragging,selected]);
 useLayoutEffect(()=>{viewer.setTakeoffFocus({enabled:active&&doc.options.focus,layers:[],colors:doc.options.keepColors});return()=>viewer.setTakeoffFocus({enabled:false,layers:[],colors:[]});},[active,doc.options.focus,doc.options.keepColors]);
 useLayoutEffect(()=>{viewer.setBaseDrawingVisible(!active||doc.options.cadVisible);return()=>viewer.setBaseDrawingVisible(true);},[active,doc.options.cadVisible]);
 useEffect(()=>{if(!active)setPickingColor(false);},[active]);
 useLayoutEffect(()=>{viewer.configureAnnotations(active&&!blocked()&&!form&&!unitChange&&!layerDelete?{tool:pickingColor?"cad-color":tool==="select"?"select":"polyline",editableDraftPoints:!pickingColor&&tool!=="select"&&tool!=="insert",snapping:!pickingColor&&snap&&tool!=="select",handleSnapping:snap,points:pickingColor?[]:draft,anchor:pickingColor?undefined:draft.at(-1),onHandleDown:pickingColor?undefined:beginHandle,onPick:pick,onPreview:p=>{preview.current=p;renderRef.current();}}:null,"takeoff");return()=>viewer.configureAnnotations(null,"takeoff");},[viewer,active,doc,draft,tool,snap,selected,form,busy,saveError,loaded,revisions,unitChange,layerDelete,pickingColor]);
 const sum=totals(doc),layerSum=selectedLayerTotals(doc);
 const q=selectedObject?quantity(selectedObject,doc.unit):null;
 const toggleOption=(options:Partial<TakeoffDocument["options"]>)=>commit({...doc,options:{...doc.options,...options}});
 const exportExcel=async()=>{
  if(blocked()||exportLock.current||!docRef.current.objects.length)return;
  const snapshot=docRef.current;exportLock.current=true;setExporting(true);setNotice("Excel 집계표를 준비합니다. 숨긴 레이어를 포함한 저장 객체를 집계합니다.");
  try{
   await new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
   const {exportTakeoffXlsx}=await import("../takeoff/xlsx"),file=exportTakeoffXlsx(snapshot),result=await saveTakeoffWorkbook(file.name,file.bytes);
   if(mounted.current)setNotice(result==="cancelled"?"Excel 저장을 취소했습니다.":result==="download"?"Excel 다운로드를 시작했습니다.":`${file.name} 저장 완료`);
  }catch(error){if(mounted.current)setNotice(`Excel 내보내기에 실패했습니다. ${error instanceof Error?error.message:String(error)}`);}
  finally{exportLock.current=false;if(mounted.current)setExporting(false);}
 };
 const exportButton=<button type="button" className="takeoff-export" disabled={blocked()||exporting||!doc.objects.length} onClick={()=>void exportExcel()} title="숨긴 레이어를 포함한 저장 객체 전체 집계">{exporting?"Excel 저장 중…":"Excel 집계표"}</button>;
 const changeObjectLayer=(layerId:string)=>{if(!selectedObject||blocked())return;const next=moveTakeoffToLayer(doc,selectedObject.id,layerId),layer=doc.layers.find(l=>l.id===layerId)!;viewer.cancelInteraction();commit(next,()=>{setVertex(null);if(!takeoffVisible(next,{...selectedObject,layerId}))setSelected(null);setNotice(`${layer.name}(으)로 이동했습니다.${layer.visible?"":" 숨긴 레이어이므로 화면에 표시되지 않습니다."}`);});};
 const deleteVertex=()=>{if(!selectedObject||vertex===null)return;const points=selectedObject.geometry.points.filter((_,i)=>i!==vertex),error=geometryError(points,isAreaKind(selectedObject.kind));if(error){setNotice(error);return;}commit({...doc,objects:doc.objects.map(o=>o.id===selected?{...o,geometry:{...o.geometry,points}}:o)},()=>setVertex(null));};
 const selectLayer=(id:string)=>{cancelDraft();setSelected(null);commit({...doc,activeLayerId:id,layers:doc.layers.map(l=>l.id===id?{...l,visible:true}:l)});};
 const layerButton=()=>{setOpen(false);onLayersToggle();};
 const compact=<div className="takeoff-compact"><button aria-label="적산 도구 펼치기" onClick={()=>{onLayersHide();setOpen(v=>!v);}} title={`${currentLayer.name} · ${pickingColor?"색상 선택":tool==="select"?"선택":tool==="insert"?"점 추가":NAMES[tool]}`}><ToolIcon name={tool==="select"?"select":tool==="insert"?"polyline":isAreaKind(tool)?"area":"polyline"}/>{draft.length?<b className="status-count" aria-hidden="true">{draft.length}</b>:null}<span className="sr-only">적산 · {pickingColor?"색상 선택":tool==="select"?"선택":tool==="insert"?"점 추가":NAMES[tool]}</span><small className="sr-only">{currentLayer.name}</small></button><button type="button" className="takeoff-label-toggle" aria-label="적산 물량 라벨 표시" aria-pressed={doc.options.labelsVisible!==false} title={doc.options.labelsVisible!==false?"물량 라벨 숨기기":"물량 라벨 표시"} disabled={blocked()} onClick={()=>toggleOption({labelsVisible:doc.options.labelsVisible===false})}><VisibilityIcon/></button>{draft.length?<><button className="takeoff-finish" disabled={blocked()} onClick={finish}>완료</button><button aria-label="적산 이전 점 취소" onClick={()=>setDraft(p=>p.slice(0,-1))}>↶</button></>:null}</div>;
 return <>
  <svg ref={svg} className="takeoff-overlay" aria-hidden="true"/><svg ref={target} className="takeoff-overlay measurement-overlay takeoff-target" aria-hidden="true"/>
  {active?<button type="button" className={`active-layer-badge takeoff-layer-badge ${currentLayer.visible?"":"layer-hidden"}`} aria-label={`적산 레이어 열기 · ${currentLayer.name}`} aria-controls="arcad-layer-panel" aria-expanded={layersOpen} onClick={layerButton} title={currentLayer.name}>적{doc.layers.findIndex(l=>l.id===currentLayer.id)+1}</button>:null}
  {layersOpen?<section id="arcad-layer-panel" className="annotation-panel layer-panel takeoff-layer-panel" role="dialog" aria-label="적산 레이어">
   <header><strong>레이어</strong><span>원본 보존</span><button type="button" aria-label="레이어 닫기" onClick={onLayersHide}>×</button></header>{layerTabs}
   <div className="takeoff-layer-list">{doc.layers.map((l,i)=><TakeoffLayerRow key={l.id} layer={l} number={i+1} selected={l.id===doc.activeLayerId} disabled={blocked()} canRemove={doc.layers.length>1} quantity={sum.layers[l.id]} onSelect={()=>selectLayer(l.id)} onVisible={()=>{cancelDraft();setSelected(null);commit({...doc,layers:doc.layers.map(v=>v.id===l.id?{...v,visible:!v.visible}:v)});}} onRename={name=>commit({...doc,layers:doc.layers.map(v=>v.id===l.id?{...v,name}:v)})} onRemove={()=>setLayerDelete(l.id)}/>)}</div>
   <button className="add-takeoff-layer" disabled={blocked()} onClick={()=>{const id=uid();cancelDraft();setSelected(null);commit({...doc,layers:[...doc.layers,{id,name:`적산 ${doc.layers.length+1}`,visible:true}],activeLayerId:id});}}>＋ 적산 레이어 추가</button>
   <div className="takeoff-export-row">{exportButton}<small>저장된 객체 전체 · 숨김 포함</small></div>
   <div className="takeoff-layer-total">전체 {sum.volumeM3.toFixed(3)} m³ · 표시 {sum.visibleVolumeM3.toFixed(3)} m³</div><small>예: 2동 1·2호 / 2동 3·4·5호. 눈금을 끄면 해당 레이어의 적산만 숨깁니다. 그리기 탭의 표시 설정도 도면에 그대로 적용됩니다.</small>
  </section>:null}
  {active?<>
   <aside className={`takeoff-summary ${doc.options.collapsed?"collapsed":""}`} aria-label="현재 레이어 콘크리트 적산 합계"><button className="takeoff-summary-heading" aria-label={doc.options.collapsed?"적산 합계 펼치기":"적산 합계 접기"} aria-expanded={!doc.options.collapsed} onClick={()=>toggleOption({collapsed:!doc.options.collapsed})} disabled={blocked()}>{doc.options.collapsed?<>합계 <small className="takeoff-summary-scope">[레이어]</small><output data-takeoff-total>{layerSum.volumeM3.toFixed(3)} m³</output></>:<>콘크리트 적산 <small className="takeoff-summary-scope">[레이어]</small></>}<span>{doc.options.collapsed?"⌄":"⌃"}</span></button>
    {!doc.options.collapsed?<><div>{KINDS.map(k=><button key={k} data-takeoff-group={k} aria-pressed={tool===k||selectedObject?.kind===k} onClick={()=>{resetTool(k);onLayersHide();setOpen(true);}}><i style={{background:doc.groups.find(g=>g.id===k)?.color}}/>{NAMES[k]}<b data-volume={k}>{layerSum.groups[k].volumeM3.toFixed(3)} m³</b></button>)}</div><strong>합계 <output data-takeoff-total>{layerSum.volumeM3.toFixed(3)} m³</output></strong><small>표시 {layerSum.visibleVolumeM3.toFixed(3)} m³</small><button className="takeoff-current-total" onClick={layerButton}><span>레이어 보기</span><b>적{doc.layers.findIndex(l=>l.id===currentLayer.id)+1}</b></button><small>중첩·개구부 공제 전</small></>:null}
   </aside>
   <ToolbarStatus>{compact}</ToolbarStatus>
   {open?<section className="takeoff-panel tool-panel" aria-label="독립 적산 도구"><header className="tool-panel-header"><strong className="sr-only">적산 도구</strong><span className="sr-only">{busy?"저장 중…":saved?"저장 완료":"원본 보존"}</span><button onClick={()=>setOpen(false)} aria-label="적산 도구 접기">×</button></header>
    <ToolStrip className="takeoff-tool-row" tabIndex={0}>{KINDS.map(k=><button key={k} data-takeoff-tool={k} aria-pressed={tool===k} disabled={blocked()} onClick={()=>resetTool(k)}><ToolIcon name={isAreaKind(k)?"area":"polyline"}/>{NAMES[k]}</button>)}</ToolStrip>
    <div className="takeoff-display-controls">{exportButton}<div className="takeoff-display-row"><label><input aria-label="원본 도면 표시" type="checkbox" checked={doc.options.cadVisible} disabled={blocked()} onChange={e=>toggleOption({cadVisible:e.target.checked})}/> 원본 도면</label><label><input aria-label="적산 집중 보기" type="checkbox" checked={doc.options.focus} disabled={blocked()} onChange={e=>toggleOption({focus:e.target.checked})}/> 집중 보기</label></div></div>
    {doc.options.focus?<details className="takeoff-focus-settings"><summary>유지할 색상 · {doc.options.keepColors.length}</summary><div className="takeoff-focus-options"><button type="button" className="takeoff-color-pick" disabled={blocked()||!doc.options.cadVisible} onClick={()=>{viewer.cancelInteraction();cancelDraft();setSelected(null);setPickingColor(true);setOpen(false);setNotice("원래 색상을 유지할 도면 객체를 누르세요. 빈 곳은 다시 선택하세요.");}}>도면 객체에서 색상 선택</button><small>아래에서 고른 색만 원래 색상 유지 · 나머지는 회색</small><div className="takeoff-focus-colors">{cadOptions.colors.map(color=><button type="button" key={color} aria-label={`원본색 유지 ${color}`} title={color} aria-pressed={doc.options.keepColors.includes(color)} disabled={blocked()} style={{background:color}} onClick={()=>toggleOption({keepColors:doc.options.keepColors.includes(color)?doc.options.keepColors.filter(v=>v!==color):[...doc.options.keepColors,color]})}>{doc.options.keepColors.includes(color)?"✓":""}</button>)}</div></div></details>:null}
    <details className="takeoff-settings" open={!knownUnit(doc.unit)}><summary>단위·스냅·부재 표시</summary>
    <div className="takeoff-unit-row"><label>도면 1단위 <select aria-label="적산 도면 단위" value={doc.unit} disabled={blocked()} onChange={e=>{const u=e.target.value as MeasurementUnit;if(doc.objects.length)setUnitChange(u);else commit({...doc,unit:u});}}><option value="drawing" disabled={!!doc.objects.length}>단위 확인 필요</option>{["mm","cm","m","in","ft"].map(u=><option key={u} value={u}>{u}</option>)}</select></label><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/> 스냅</label></div>
    <div className="takeoff-groups">{doc.groups.map(g=><div key={g.id}><label><input aria-label={`${NAMES[g.id]} 적산 표시`} type="checkbox" checked={g.visible} disabled={blocked()} onChange={e=>commit({...doc,groups:doc.groups.map(v=>v.id===g.id?{...v,visible:e.target.checked}:v)})}/>{NAMES[g.id]}</label><input type="color" aria-label={`${NAMES[g.id]} 적산 색상`} value={g.color} disabled={blocked()} onChange={e=>commit({...doc,groups:doc.groups.map(v=>v.id===g.id?{...v,color:e.target.value}:v)})}/><span>{sum.groups[g.id].count}개 · {isAreaKind(g.id)?`${sum.groups[g.id].areaM2.toFixed(2)} m²`:`${sum.groups[g.id].lengthM.toFixed(2)} m`}</span></div>)}</div>
    </details>
    {selectedObject?<div className="takeoff-selection" data-selected-takeoff={selectedObject.id}><b>{NAMES[selectedObject.kind]} · {selectedObject.id.slice(0,8)}</b><output>{isAreaKind(selectedObject.kind)?`${q!.areaM2.toFixed(3)} m²`:`${q!.lengthM.toFixed(3)} m`} · {q!.volumeM3.toFixed(3)} m³</output><label className="takeoff-object-layer">적산 레이어 <select aria-label="선택 적산 객체 레이어" value={selectedObject.layerId} disabled={blocked()} onChange={e=>changeObjectLayer(e.target.value)}>{doc.layers.map(l=><option key={l.id} value={l.id}>{l.name}{l.visible?"":" (숨김)"}</option>)}</select></label><div><button disabled={blocked()} onClick={()=>startForm(selectedObject,true)}>규격 수정</button><button disabled={blocked()} onClick={()=>setTool("insert")}>점 추가</button><button disabled={blocked()||vertex===null} onClick={deleteVertex}>선택 점 삭제</button><button disabled={blocked()} onClick={()=>commit({...doc,objects:doc.objects.map(o=>o.id===selected?{...o,label:{...o.label,visible:!o.label.visible}}:o)})}>{selectedObject.label.visible?"라벨 숨김":"라벨 표시"}</button><button disabled={blocked()} onClick={deleteObject}>객체 삭제</button></div><small>원형 점은 꼭짓점 수정 · 아래 십자는 이동 · 라벨을 잡아 위치 이동</small></div>:null}
    <details className="tool-help"><summary aria-label="적산 사용법" title="적산 사용법">?</summary><p>점을 차례로 찍고 완료를 누른 뒤 규격을 입력합니다. 찍은 점을 길게 눌러 수정할 수 있습니다. 슬래브·기둥은 영역을 닫습니다. 기둥 체적은 단면적 × 높이입니다.</p></details>
    {notice?<p className="takeoff-notice" role="status">{notice}</p>:null}
   </section>:null}
   {notice&&!open?<div className="takeoff-notice takeoff-notice-floating" role="status">{notice}<button aria-label={pickingColor?"도면 색상 선택 취소":"적산 안내 닫기"} onClick={()=>{setPickingColor(false);setNotice("");}}>×</button></div>:null}
   {revisions.length?<div className="takeoff-modal"><section role="dialog" aria-modal="true" aria-label="도면 개정 확인"><h3>같은 이름의 다른 도면입니다</h3><p>내용 식별자가 다릅니다. 이전 적산을 이 도면에 자동 적용하지 않습니다.</p><p>이전 적산 {revisions.reduce((n,r)=>n+r.count,0)}개는 원래 도면에 보존됩니다.</p><button disabled={busy||!!saveError} onClick={()=>void persist(doc,false,()=>setRevisions([]))}>새 도면으로 적산 시작</button></section></div>:null}
   {unitChange?<div className="takeoff-modal"><section role="dialog" aria-modal="true" aria-label="적산 단위 변경 확인"><h3>도면 단위를 변경할까요?</h3><p>좌표는 유지하고 모든 저장 객체의 길이·면적·물량을 {unitChange} 기준으로 다시 계산합니다.</p><button onClick={()=>setUnitChange(null)}>취소</button><button onClick={()=>{const unit=unitChange;commit({...doc,unit},()=>setUnitChange(null));}}>변경·다시 계산</button></section></div>:null}
   {form?<div className="takeoff-modal"><form className="takeoff-dimensions" role="dialog" aria-modal="true" aria-label={`${NAMES[form.object.kind]} 적산 규격`} onSubmit={e=>{e.preventDefault();applyForm();}}><h3>{NAMES[form.object.kind]} · {form.existing?"규격 수정":"물량 확정"}</h3><small>도면 단위: {doc.unit} · 중첩·개구부 공제 전</small>
    {(form.object.kind==="wall"?["높이","두께 (mm)"]:form.object.kind==="beam"?["폭 (mm)","깊이 (mm)"]:form.object.kind==="column"?["높이"]:["두께 (mm)"]).map((label,i)=><label key={label}>{label}{(form.object.kind==="wall"||form.object.kind==="column")&&i===0?<select aria-label={`${NAMES[form.object.kind]} 높이 단위`} value={heightUnit} onChange={e=>{const next=e.target.value as "m"|"mm",v=parseEditNumber(values[0]);setValues(p=>p.map((s,i)=>i===0&&v!==null?String(v*(next==="mm"?1000:.001)):s));setHeightUnit(next);}}><option>m</option><option>mm</option></select>:null}<input ref={i===0?firstInput:undefined} aria-label={label} inputMode="decimal" autoComplete="off" value={values[i]??""} disabled={busy} onChange={e=>setValues(p=>p.map((s,j)=>j===i?e.target.value:s))}/></label>)}
    {formError?<p role="alert">{formError}</p>:null}<div><button type="button" disabled={busy} onClick={cancelDraft}>취소</button><button type="submit" disabled={busy||!!saveError}>확정·저장</button></div>
   </form></div>:null}
  </>:null}
  {(active||layersOpen)&&loadError?<div className="takeoff-error" role="alert">{loadError}<button onClick={()=>reload(n=>n+1)}>다시 불러오기</button></div>:null}
  {(active||layersOpen)&&saveError?<div className="takeoff-error" role="alert">{saveError}<button disabled={busy} onClick={()=>{const p=failed.current;if(p)void persist(p.next,p.record,p.done,p.rollback);}}>저장 다시 시도</button><button disabled={busy} onClick={()=>{failed.current?.rollback?.();failed.current=null;setSaveError("");cancelDraft();}}>변경 취소</button></div>:null}
  {layerDelete?<div className="takeoff-modal"><section role="dialog" aria-modal="true" aria-label="적산 레이어 삭제"><h3>적산 레이어를 삭제할까요?</h3><p>{doc.layers.find(l=>l.id===layerDelete)?.name} · 객체 {doc.objects.filter(o=>o.layerId===layerDelete).length}개가 함께 삭제됩니다. 실행 취소로 복원할 수 있습니다.</p><button onClick={()=>setLayerDelete(null)}>취소</button><button disabled={blocked()} onClick={()=>{const layers=doc.layers.filter(l=>l.id!==layerDelete);if(!layers.length)return;cancelDraft();commit({...doc,layers,activeLayerId:doc.activeLayerId===layerDelete?layers[0].id:doc.activeLayerId,objects:doc.objects.filter(o=>o.layerId!==layerDelete)},()=>{setLayerDelete(null);setSelected(null);});}}>삭제</button></section></div>:null}
 </>;
});
