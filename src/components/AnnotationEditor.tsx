import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DrawingViewer, MeasurementPick } from "../viewer/DrawingViewer";
import type { DrawingPoint } from "../viewer/savedView";
import { distance, type MeasurableEntity, type MeasurementUnit } from "../viewer/measurementGeometry";
import { annotationGeometry, annotationHit, annotationPoints, defaultTextHeight, newAnnotationDocument, readAnnotations, saveAnnotations, segments, sourceMoveObjects, translateAnnotation, trimAnnotation, uid, visibleAnnotations, type Annotation, type AnnotationDocument, type AnnotationTool } from "../viewer/annotations";
import { drawAnnotations } from "../viewer/annotationOverlay";
import { drawMeasurementOverlay } from "../viewer/measurementOverlay";
import { visitCadSegments, type Segment } from "../viewer/cadPicking";
import { useI18n } from "../i18n/I18nProvider";
import { useUx } from "../i18n/ux";
import { ToolIcon } from "./ToolIcon";
import { UndoHistory, type EditCommand, type EditHistoryState } from "../viewer/undoHistory";
import { completeTextEdit, type TextEditSession } from "../viewer/textEditing";
import { CanvasTextEditor } from "./CanvasTextEditor";
import { HOLD_MS } from "../viewer/measurementGesture";
const words={
  ko:{title:"레이어 · 그리기",add:"레이어 추가",remove:"레이어 삭제",layer:"레이어",select:"선택",polyline:"폴리라인",circle:"원",rectangle:"사각형","dimension-aligned":"정렬 치수","dimension-linear":"선형 치수",trim:"라인 삭제 (트림)",erase:"객체 삭제",finish:"완료",cancel:"취소",undo:"실행 취소",snap:"스냅",scale:"치수 배율",saved:"자동 저장됨",unsaved:"저장 실패 — 공간을 확인하세요",close:"그리기 창 닫기",pause:"그리기 중지",pick:"원본 선 또는 추가 객체를 선택하세요",polyHelp:"점을 차례로 찍고 완료를 누르세요. 시작점 스냅으로 닫을 수 있습니다.",twoHelp:"두 점을 선택하세요. 길게 누르면 위쪽 조준점으로 정밀하게 찍습니다.",dimHelp:"기준점 2개 → 치수선 위치를 선택하세요.",trimHelp:"제거할 구간을 누르세요. 보이는 선·원과의 교차점이 절단 경계입니다.",noBoundary:"절단할 교차 경계가 없습니다.",hidden:"숨긴 레이어입니다. 표시를 켜세요.",noHit:"선택할 객체가 없습니다.",masked:"원본 가림 추가",deleted:"객체 삭제됨",trimmed:"선 구간 제거됨",source:"원본 객체",need:"점을 더 선택하세요",limit:"객체 또는 경계 수 한도를 초과했습니다.",scaleHelp:"새 치수와 선택한 치수에 적용",restore:"레이어를 숨기거나 삭제하면 가린 원본이 다시 보입니다."},
  en:{title:"Layers · Draw",add:"Add layer",remove:"Delete layer",layer:"Layer",select:"Select",polyline:"Polyline",circle:"Circle",rectangle:"Rectangle","dimension-aligned":"Aligned dim","dimension-linear":"Linear dim",trim:"Trim line",erase:"Delete object",finish:"Finish",cancel:"Cancel",undo:"Undo",snap:"Snap",scale:"Dim scale",saved:"Auto saved",unsaved:"Save failed — check storage",close:"Close drawing tools",pause:"Stop editing",pick:"Select original geometry or a user object",polyHelp:"Pick vertices, then Finish. Snap back to the start to close.",twoHelp:"Pick two points. Hold for the precision target above your finger.",dimHelp:"Pick two references, then the dimension position.",trimHelp:"Tap the segment to remove. Visible intersections are cutting boundaries.",noBoundary:"No cutting intersection found.",hidden:"Show the active layer first.",noHit:"No selectable object here.",masked:"Original masked",deleted:"Object deleted",trimmed:"Segment trimmed",source:"Original object",need:"Pick more points",limit:"Too many objects or cutting edges.",scaleHelp:"Applies to new and selected dimensions",restore:"Hide or delete a layer to reveal masked originals."},
  tr:{title:"Katmanlar · Çiz",add:"Katman ekle",remove:"Katmanı sil",layer:"Katman",select:"Seç",polyline:"Çoklu çizgi",circle:"Daire",rectangle:"Dikdörtgen","dimension-aligned":"Hizalı ölçü","dimension-linear":"Doğrusal ölçü",trim:"Çizgiyi kırp",erase:"Nesneyi sil",finish:"Bitir",cancel:"İptal",undo:"Geri al",snap:"Tutun",scale:"Ölçü ölçeği",saved:"Kaydedildi",unsaved:"Kaydedilemedi — depolamayı kontrol edin",close:"Çizim araçlarını kapat",pause:"Düzenlemeyi durdur",pick:"Özgün geometri veya kullanıcı nesnesi seçin",polyHelp:"Noktaları seçip Bitir'e dokunun. Başlangıca tutunarak kapatın.",twoHelp:"İki nokta seçin. Hassas yerleştirme için basılı tutun.",dimHelp:"İki referans ve ardından ölçü konumunu seçin.",trimHelp:"Kaldırılacak bölüme dokunun. Görünür kesişimler sınırdır.",noBoundary:"Kesme sınırı bulunamadı.",hidden:"Önce etkin katmanı gösterin.",noHit:"Seçilebilir nesne yok.",masked:"Özgün nesne maskelendi",deleted:"Nesne silindi",trimmed:"Bölüm kırpıldı",source:"Özgün nesne",need:"Daha fazla nokta seçin",limit:"Çok fazla nesne veya kesme kenarı.",scaleHelp:"Yeni ve seçili ölçülere uygulanır",restore:"Özgün nesneyi göstermek için katmanı gizleyin veya silin."},
};
const additions={
  ko:{select:"객체 선택",move:"이동",text:"텍스트",textContent:"문자 내용",textHeight:"문자 높이 (도면 단위)",applyText:"문자 적용",textHelp:"도면을 길게 눌러 위치를 잡고 손을 떼면 입력합니다. 바깥을 누르면 완료되고, 문자를 길게 누르면 다시 편집합니다.",moveSelect:"이동할 객체를 선택하세요.",moveBase:"기준점을 찍으세요. 스냅이 적용됩니다.",moveTarget:"목적점을 찍으세요. 길게 눌러 이동을 미리 볼 수 있습니다.",moved:"객체 이동됨",textInvalid:"내용(1~500자)과 0보다 큰 문자 높이를 입력하세요.",maskMove:"가림 객체는 이동하지 않습니다. 레이어를 숨기거나 가림을 삭제하세요."},
  en:{select:"Select object",move:"Move",text:"Text",textContent:"Text content",textHeight:"Text height (drawing units)",applyText:"Apply text",textHelp:"Hold and drag to position text, then release to type. Tap outside to finish; hold existing text to edit.",moveSelect:"Select the object to move.",moveBase:"Pick the base point. Snapping is available.",moveTarget:"Pick the destination. Hold to preview the move.",moved:"Object moved",textInvalid:"Enter 1–500 characters and a positive height.",maskMove:"Erasures cannot move. Hide the layer or delete the erasure."},
  tr:{select:"Nesne seç",move:"Taşı",text:"Metin",textContent:"Metin içeriği",textHeight:"Metin yüksekliği (çizim birimi)",applyText:"Metni uygula",textHelp:"Konum için basılı tutup sürükleyin, bırakınca yazın. Bitirmek için dışarıya, düzenlemek için metne basılı tutun.",moveSelect:"Taşınacak nesneyi seçin.",moveBase:"Temel noktayı seçin. Tutunma kullanılabilir.",moveTarget:"Hedef noktayı seçin. Önizleme için basılı tutun.",moved:"Nesne taşındı",textInvalid:"1–500 karakter ve pozitif yükseklik girin.",maskMove:"Maskeler taşınamaz. Katmanı gizleyin veya maskeyi silin."},
};
export type AnnotationEditorHandle={execute(command:EditCommand):void;finishText():boolean};
type Props={viewer:DrawingViewer;active:boolean;open:boolean;sourceUnit:MeasurementUnit;displayUnit:MeasurementUnit;onHide():void;onActivate():void;onPause():void;onHistoryState(state:EditHistoryState):void};
export const AnnotationEditor=forwardRef<AnnotationEditorHandle,Props>(function AnnotationEditor({viewer,active,open,sourceUnit,displayUnit,onHide,onActivate,onPause,onHistoryState},ref){
  const {locale,t}=useI18n(),w={...words[locale],...additions[locale]},u=useUx();
  const [tab,setTab]=useState<"layers"|"draw"|"dimensions">("draw");
  const key=viewer.getMeasurementGeometry().unitPreferenceKey;
  const [doc,setDoc]=useState<AnnotationDocument>(()=>{const d=readAnnotations(key);return{...d,activeLayer:d.layers[0].id};});
  const [tool,setTool]=useState<AnnotationTool>("select"),[draft,setDraft]=useState<DrawingPoint[]>([]),[snapping,setSnapping]=useState(true);
  const [selected,setSelected]=useState<string|null>(null),[original,setOriginal]=useState<MeasurableEntity|null>(null),[notice,setNotice]=useState(""),[saved,setSaved]=useState(true);
  const [scaleInput,setScaleInput]=useState(String(doc.dimensionScale));
  const [heightInput,setHeightInput]=useState(String(doc.textHeight??defaultTextHeight(sourceUnit))),[textColor,setTextColor]=useState<string|undefined>();
  const [textSession,setTextSession]=useState<TextEditSession|null>(null),textSessionRef=useRef(textSession);textSessionRef.current=textSession;
  const docRef=useRef(doc);docRef.current=doc;
  const heightTouched=useRef(false),redoDraft=useRef<DrawingPoint[]>([]);
  const cancelTextHold=useRef<()=>void>(()=>{});
  const history=useRef(new UndoHistory<AnnotationDocument>()),overlay=useRef<SVGSVGElement>(null),target=useRef<SVGSVGElement>(null),preview=useRef<MeasurementPick|null>(null);
  const visible=useMemo(()=>visibleAnnotations(doc),[doc]);
  const geometry=useMemo(()=>annotationGeometry(tool==="move"&&draft.length===1?visible.filter(o=>o.id!==selected):visible),[visible,tool,draft.length,selected]);
  const pickingMasks=useMemo(()=>[...visible.filter(o=>o.kind==="mask"),...(tool==="move"&&draft.length===1&&original?[{id:"moving-source",layerId:doc.activeLayer,kind:"mask"as const,points:original.points}]:[])],[visible,tool,draft.length,original,doc.activeLayer]);
  const selectedObject=doc.objects.find(o=>o.id===selected);
  const originalText=textSession?.originalId?doc.objects.find(o=>o.id===textSession.originalId):undefined;
  const textChanged=!!textSession&&(originalText?
    textSession.text.replace(/\r\n?/g,"\n")!==originalText.text||textSession.height!==originalText.textHeight||textSession.color!==originalText.color:!!textSession.text.trim());
  const current=doc.layers.find(l=>l.id===doc.activeLayer)!;
  const commit=(next:AnnotationDocument)=>{if(next.objects.length>3000||next.objects.some(o=>o.points.length>30000)){setNotice(w.limit);return false;}if(next===docRef.current)return true;history.current.record(docRef.current);redoDraft.current=[];docRef.current=next;setDoc(next);setSelected(null);setOriginal(null);setNotice("");return true;};
  const make=(points:DrawingPoint[],kind:Annotation["kind"]):Annotation=>({id:uid(),layerId:doc.activeLayer,kind,points,scale:doc.dimensionScale});
  const add=(o:Annotation)=>{if(o.points.length<2||distance(o.points[0],o.points[1])<1e-10){setNotice(w.need);return;}commit({...doc,objects:[...doc.objects,o]});setDraft([]);};
  const choose=(value:AnnotationTool)=>{cancelTextHold.current();preview.current=null;redoDraft.current=[];setTool(value);if(value.startsWith("dimension"))setTab("dimensions");else if(["polyline","circle","rectangle","text"].includes(value))setTab("draw");setDraft([]);setNotice("");if(value!=="move"){setSelected(null);setOriginal(null);}onActivate();if(value==="text"&&open)onHide();};
  const beginText=(point:DrawingPoint,object?:Annotation)=>{
    viewer.cancelInteraction();
    const height=object?.textHeight??(!heightTouched.current&&docRef.current.textHeight===undefined?Math.min(1e6,viewer.worldTolerance(22)):+heightInput);
    const session:TextEditSession={id:object?.id??uid(),originalId:object?.id,layerId:object?.layerId??docRef.current.activeLayer,point:object?.points[0]??point,text:object?.text??"",height,color:object?object.color:textColor};
    textSessionRef.current=session;setTextSession(session);setHeightInput(String(height));setTool("text");setDraft([]);redoDraft.current=[];preview.current=null;setSelected(null);setOriginal(null);setNotice("");onActivate();if(open)onHide();
  };
  const finishText=(text:string,cancel=false)=>{
    const session=textSessionRef.current;if(!session)return;
    if(!cancel){try{if(!commit(completeTextEdit(docRef.current,{...session,text})))return;}catch{setNotice(w.textInvalid);return;}}
    textSessionRef.current=null;setTextSession(null);preview.current=null;
  };
  const updateText=(text:string)=>{const current=textSessionRef.current;if(current){const next={...current,text};textSessionRef.current=next;setTextSession(next);}};
  const updateTextStyle=(style:{height?:number;color?:string})=>{
    if(style.height!==undefined){heightTouched.current=true;setHeightInput(String(style.height));}
    if(style.color!==undefined)setTextColor(style.color);
    const current=textSessionRef.current;if(current){const next={...current,...(style.height!==undefined?{height:style.height}:{}),...(style.color!==undefined?{color:style.color}:{})};textSessionRef.current=next;setTextSession(next);}
  };
  const editCommand=(command:EditCommand)=>{
    cancelTextHold.current();viewer.cancelInteraction();preview.current=null;
    if(command==="cancel"){finishText("",true);setDraft([]);redoDraft.current=[];setSelected(null);setOriginal(null);setNotice("");return;}
    if(textSessionRef.current)finishText(textSessionRef.current.text);
    if(command==="undo"&&draft.length){redoDraft.current.push(draft.at(-1)!);setDraft(draft.slice(0,-1));return;}
    if(command==="redo"&&redoDraft.current.length){setDraft([...draft,redoDraft.current.pop()!]);return;}
    if(command==="redo"&&draft.length)return;
    const next=history.current[command](docRef.current);
    if(next){docRef.current=next;setDoc(next);setDraft([]);redoDraft.current=[];setSelected(null);setOriginal(null);setNotice("");}
  };
  useImperativeHandle(ref,()=>({execute:editCommand,finishText(){const current=textSessionRef.current;if(!current)return false;finishText(document.querySelector<HTMLTextAreaElement>(".canvas-text-input")?.value??current.text);return true;}}));
  const erase=()=>{
    if(!current.visible){setNotice(w.hidden);return;}
    if(selected){commit({...doc,objects:doc.objects.filter(o=>o.id!==selected)});setNotice(w.deleted);}
    else if(original){add(make(original.points,"mask"));setNotice(w.masked);}
  };
  const pick=(pick:MeasurementPick)=>{
    if(tool==="select"||(tool==="move"&&!selected&&!original)){const hit=annotationHit(visible,pick.point,viewer.worldTolerance(18),sourceUnit);if(tool==="move"&&hit?.kind==="mask"){setNotice(w.maskMove);return;}setSelected(hit?.id??null);if(!hit&&pick.entity&&pick.entity.points.length>30000){setOriginal(null);setNotice(w.limit);return;}setOriginal(hit?null:pick.entity);setNotice(hit?hit.kind:pick.entity?w.source:w.noHit);return;}
    if(!current.visible&&!(tool==="move"&&selectedObject)){setNotice(w.hidden);return;}
    if(tool==="text"){
      beginText(pick.point);return;
    }
    if(tool==="move"){
      if(selectedObject?.kind==="mask"){setNotice(w.maskMove);return;}
      if(!draft.length){setDraft([pick.point]);return;}
      const base=draft[0];if(distance(base,pick.point)<1e-10){setDraft([]);return;}
      if(selectedObject){const moved=translateAnnotation(selectedObject,base,pick.point);if(commit({...doc,objects:doc.objects.map(o=>o.id===selected?moved:o)})){setSelected(moved.id);setDraft([]);setNotice(w.moved);}}
      else if(original){const objects=sourceMoveObjects(original,doc.activeLayer,base,pick.point);if(commit({...doc,objects:[...doc.objects,...objects]})){setSelected(objects[1].id);setDraft([]);setNotice(w.moved);}}
      return;
    }
    if(tool==="trim"){
      const hit=annotationHit(visible.filter(o=>o.kind!=="mask"&&o.kind!=="text"&&!o.kind.startsWith("dimension")),pick.point,viewer.worldTolerance(18),sourceUnit);
      const source=hit?null:pick.entity;
      const candidate=hit??(source?{...make(source.points,"polyline"),id:"original"}:null);
      if(!candidate){setNotice(w.noHit);return;}
      const points=annotationPoints(candidate);if(points.length>30000){setNotice(w.limit);return;}
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y),box={minX:Math.min(...xs),minY:Math.min(...ys),maxX:Math.max(...xs),maxY:Math.max(...ys)};
      const cad:Segment[]=[],ownEdges=source?segments(source.points):[];
      try{
        visitCadSegments(viewer.getMeasurementGeometry(),box,(a,b)=>{
          if(ownEdges.some(([c,d])=>(distance(a,c)<1e-7&&distance(b,d)<1e-7)||(distance(a,d)<1e-7&&distance(b,c)<1e-7)))return;
          if(visible.some(o=>o.kind==="mask"&&segments(o.points).some(([c,d])=>{const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};return Math.abs((d.x-c.x)*(mid.y-c.y)-(d.y-c.y)*(mid.x-c.x))<1e-7&&Math.min(c.x,d.x)<=mid.x&&Math.max(c.x,d.x)>=mid.x&&Math.min(c.y,d.y)<=mid.y&&Math.max(c.y,d.y)>=mid.y;})))return;
          cad.push([a,b]);if(cad.length>20000)throw Error();
        },false);
        const result=trimAnnotation(candidate,visible,cad,pick.point);
        if(!result){setNotice(w.noBoundary);return;}
        if(source)add(make(result.removed,"mask"));
        else commit({...doc,objects:[...doc.objects.filter(o=>o.id!==candidate.id),...result.kept]});
        setNotice(w.trimmed);
      }catch{setNotice(w.limit);}return;
    }
    redoDraft.current=[];const points=[...draft,pick.point];
    if(tool==="polyline"){
      if(points.length>=4&&pick.snapped==="start")add(make(points,"polyline"));else setDraft(points);
    }else if(tool==="circle"||tool==="rectangle"){
      if(points.length===2)add(make(points,tool));else setDraft(points);
    }else if(points.length===3)add(make(points,tool));else setDraft(points);
    if(pick.snapped)setNotice(pick.snapped==="perpendicular"?"⊥":pick.snapped==="start"?"↩":pick.snapped==="insertion"?t("measureInsertion"):pick.snapped);
  };
  const render=()=>{
    if(!overlay.current||!target.current)return;
    let points=preview.current?[...draft,preview.current.point]:draft;
    const kind=tool==="select"||tool==="trim"||tool==="move"?"polyline":tool;
    let temporary:Annotation|null=points.length>=2?{...make(points,kind),id:"draft"}:null;
    if((kind==="rectangle"||kind==="circle")&&points.length!==2)temporary=null;
    if(kind.startsWith("dimension")&&points.length!==3)temporary=null;
    if(kind==="text")temporary=null;
    let renderingDoc=textSession?.originalId?{...doc,objects:doc.objects.filter(o=>o.id!==textSession.originalId)}:doc,renderingSelected=selected;
    const moving=active&&tool==="move"&&draft.length===1&&preview.current;
    if(moving){
      if(selectedObject&&selectedObject.kind!=="mask"){temporary=translateAnnotation(selectedObject,draft[0],preview.current!.point);renderingDoc={...doc,objects:doc.objects.filter(o=>o.id!==selected)};renderingSelected=temporary.id;}
      else if(original){const[m,c]=sourceMoveObjects(original,doc.activeLayer,draft[0],preview.current!.point);renderingDoc={...doc,objects:[...doc.objects,m]};temporary=c;renderingSelected=c.id;}
    }else if(tool==="move")temporary=null;
    const originalOutline=original&&active&&!moving?{...make(original.points,"polyline"),id:"source-selection"}:null;
    drawAnnotations(overlay.current,originalOutline?{...renderingDoc,objects:[...renderingDoc.objects,originalOutline]}:renderingDoc,active?(originalOutline?.id??renderingSelected):null,active?temporary:null,p=>viewer.projectPoints(p),sourceUnit,displayUnit);
    drawMeasurementOverlay(target.current,{enabled:active&&tool!=="select"&&tool!=="trim"&&(tool!=="move"||!!selected||!!original),mode:"path",points:draft,snapping,entity:null},p=>viewer.projectPoints(p),preview.current);
  };
  const renderRef=useRef(render);renderRef.current=render;
  useLayoutEffect(()=>viewer.subscribeView(()=>renderRef.current()),[viewer]);
  useLayoutEffect(()=>{let mounted=true;void document.fonts?.load('16px ArcadAnnotation').then(()=>{if(mounted)renderRef.current();}).catch(()=>undefined);return()=>{mounted=false;};},[]);
  useLayoutEffect(()=>{viewer.setUserGeometry(geometry,pickingMasks);return()=>viewer.setUserGeometry(annotationGeometry([]),[]);},[viewer,geometry,pickingMasks]);
  useLayoutEffect(()=>{
    const selecting=tool==="select"||(tool==="move"&&!selected&&!original);
    viewer.configureAnnotations(active&&!textSession?{tool:selecting?"select":tool,snapping:snapping&&!selecting&&tool!=="trim",points:draft,anchor:tool.startsWith("dimension")?draft[0]:draft.at(-1),onPick:pick,onPreview:p=>{preview.current=p;renderRef.current();}}:null);
    renderRef.current();return()=>viewer.configureAnnotations(null);
  },[viewer,active,tool,draft,snapping,doc,selected,original,sourceUnit,displayUnit,textSession,heightInput]);
  useLayoutEffect(()=>{setSaved(saveAnnotations(key,doc));},[key,doc]);
  useLayoutEffect(()=>setScaleInput(String(doc.dimensionScale)),[doc.dimensionScale]);
  useLayoutEffect(()=>{if(!textSessionRef.current&&doc.textHeight!==undefined)setHeightInput(String(doc.textHeight));},[doc.textHeight]);
  const interaction=useRef({visible,beginText});interaction.current={visible,beginText};
  useLayoutEffect(()=>{
    const canvas=viewer.getCanvasElement(),pointers=new Set<number>();let hold:ReturnType<typeof setTimeout>|undefined,start:{x:number;y:number}|null=null;
    const clear=()=>{clearTimeout(hold);hold=undefined;start=null;};
    cancelTextHold.current=clear;
    const down=(event:PointerEvent)=>{
      pointers.add(event.pointerId);clear();if(pointers.size!==1||(event.button!==0&&event.pointerType!=="touch"))return;
      const point=viewer.clientToDrawing({x:event.clientX,y:event.clientY}),hit=annotationHit(interaction.current.visible.filter(o=>o.kind==="text"),point,viewer.worldTolerance(5),sourceUnit);
      if(!hit)return;start={x:event.clientX,y:event.clientY};hold=setTimeout(()=>{clear();interaction.current.beginText(hit.points[0],hit);},HOLD_MS);
    };
    const move=(event:PointerEvent)=>{if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)clear();};
    const end=(event:PointerEvent)=>{pointers.delete(event.pointerId);clear();};
    canvas.addEventListener("pointerdown",down,true);canvas.addEventListener("pointermove",move,true);canvas.addEventListener("pointerup",end,true);canvas.addEventListener("pointercancel",end,true);
    return()=>{clear();cancelTextHold.current=()=>{};canvas.removeEventListener("pointerdown",down,true);canvas.removeEventListener("pointermove",move,true);canvas.removeEventListener("pointerup",end,true);canvas.removeEventListener("pointercancel",end,true);};
  },[viewer,sourceUnit]);
  useLayoutEffect(()=>{onHistoryState({canUndo:!!draft.length||textChanged||history.current.canUndo,canRedo:!textChanged&&(!!redoDraft.current.length||(!draft.length&&history.current.canRedo))});},[doc,draft,textChanged,onHistoryState]);
  const updateScale=()=>{const scale=Number(scaleInput);if(!Number.isFinite(scale)||scale<1||scale>10000){setScaleInput(String(doc.dimensionScale));return;}if(scale===doc.dimensionScale&&!selected)return;const id=selected;commit({...doc,dimensionScale:scale,objects:doc.objects.map(o=>o.id===selected&&o.kind.startsWith("dimension")?{...o,scale}:o)});setSelected(id);};
  return <>
    <svg ref={overlay} className="annotation-overlay" aria-hidden="true"/><svg ref={target} className="measurement-overlay annotation-target-overlay" aria-hidden="true"/>
    <CanvasTextEditor viewer={viewer} session={textSession} active={active&&tool==="text"&&!open} height={textSession?.height??+heightInput}
      color={(textSession?textSession.color:textColor)??doc.layers.find(l=>l.id===(textSession?.layerId??doc.activeLayer))?.color??"#49cfff"}
      onText={updateText} onStyle={updateTextStyle} onFinish={finishText}/>
    {active?<div className="annotation-status" role="status"><button onClick={onHide}>{current.name} · {w[tool]} {draft.length?`· ${draft.length}`:""}<small>{notice||(!saved?w.unsaved:w.saved)}</small></button><button onClick={onPause} aria-label={w.pause}>Ⅱ</button></div>:null}
    {open?<section className="annotation-panel" data-current-tool={tool} aria-label={w.title}>
      <header><strong>{u.tools}</strong><span><ToolIcon name="shield"/>{u.original}</span><button onClick={onHide} aria-label={w.close}>×</button></header>
      <div className="annotation-tabs" role="tablist" aria-label={w.title}>{(["layers","draw","dimensions"]as const).map((name,i)=><button id={`arcad-tab-${name}`} role="tab" aria-selected={tab===name} aria-controls={`arcad-section-${name}`} key={name} onClick={()=>setTab(name)} onKeyDown={e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){e.preventDefault();const keys=["layers","draw","dimensions"]as const,next=e.key==="Home"?0:e.key==="End"?2:(i+(e.key==="ArrowRight"?1:2))%3;setTab(keys[next]);document.getElementById(`arcad-tab-${keys[next]}`)?.focus();}}} tabIndex={tab===name?0:-1}><ToolIcon name={name==="layers"?"layers":name==="draw"?"polyline":"dimension-linear"}/>{name==="layers"?u.layers:name==="draw"?u.drawing:u.dimensions}</button>)}</div>
      <div id="arcad-section-layers" role="tabpanel" aria-labelledby="arcad-tab-layers" hidden={tab!=="layers"}>
      <div className="layer-section-heading"><strong>{u.layers}</strong><span>{doc.layers.length} / 3</span></div>
      <div className="user-layers">{doc.layers.map((l,i)=><div key={l.id} className={l.id===doc.activeLayer?"active":""}>
        <input type="radio" name="user-layer" aria-label={`${w.layer} ${i+1}`} checked={l.id===doc.activeLayer} onChange={()=>{commit({...doc,activeLayer:l.id});setDraft([]);}}/>
        <input type="checkbox" aria-label={`${l.name} 표시`} checked={l.visible} onChange={()=>commit({...doc,layers:doc.layers.map(a=>a.id===l.id?{...a,visible:!a.visible}:a)})}/>
        <input className="layer-name" aria-label={`${w.layer} ${i+1} 이름`} value={l.name} maxLength={24} onChange={e=>commit({...doc,layers:doc.layers.map(a=>a.id===l.id?{...a,name:e.target.value}:a)})}/>
        <input type="color" aria-label={`${w.layer} ${i+1} 색상`} value={l.color} onChange={e=>commit({...doc,layers:doc.layers.map(a=>a.id===l.id?{...a,color:e.target.value}:a)})}/>
        <button aria-label={`${w.remove} ${i+1}`} onClick={()=>{const layers=doc.layers.filter(a=>a.id!==l.id);const next=layers.length?{...doc,layers,activeLayer:layers[0].id,objects:doc.objects.filter(o=>o.layerId!==l.id)}:newAnnotationDocument();commit(next);setDraft([]);}}>×</button>
      </div>)}</div>
      <button className="add-user-layer" disabled={doc.layers.length>=3} onClick={()=>{const id=uid();commit({...doc,layers:[...doc.layers,{id,name:`${w.layer} ${doc.layers.length+1}`,color:["#49cfff","#fa68df","#8ce56d"][doc.layers.length],visible:true}],activeLayer:id});setDraft([]);}}>＋ {w.add}</button>
      <small className="annotation-restore">{w.restore}</small></div>
      <div id="arcad-section-draw" role="tabpanel" aria-labelledby="arcad-tab-draw" hidden={tab!=="draw"} className="annotation-tools draw-tool-grid">{(["polyline","circle","rectangle","text"]as AnnotationTool[]).map(name=><button key={name} data-tool={name} aria-pressed={tool===name&&active} onClick={()=>choose(name)}><ToolIcon name={name}/><span>{w[name]}</span></button>)}</div>
      <div id="arcad-section-dimensions" role="tabpanel" aria-labelledby="arcad-tab-dimensions" hidden={tab!=="dimensions"} className="annotation-tools dimension-tool-grid">{(["dimension-aligned","dimension-linear"]as AnnotationTool[]).map(name=><button key={name} data-tool={name} aria-pressed={tool===name&&active} onClick={()=>choose(name)}><ToolIcon name={name}/><span>{w[name]}</span></button>)}</div>
      <div className="annotation-tools utility-tool-grid" hidden={tab==="layers"}>{(["select","move","trim"]as AnnotationTool[]).map(name=><button key={name} data-tool={name} aria-pressed={tool===name&&active} onClick={()=>choose(name)}><ToolIcon name={name}/><span>{w[name]}</span></button>)}<button data-tool="delete" disabled={!selected&&!original} onClick={erase}><ToolIcon name="delete"/><span>{w.erase}</span></button></div>
      <div className="annotation-options" hidden={tab==="layers"}><label><input type="checkbox" checked={snapping} onChange={e=>setSnapping(e.target.checked)}/>{w.snap}</label><label>{w.scale} 1:<input aria-label={w.scale} type="number" min={1} max={10000} value={scaleInput} onChange={e=>setScaleInput(e.target.value)} onBlur={updateScale} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}} title={w.scaleHelp}/></label></div>
      {tool==="text"?<p className="annotation-help">{locale==="ko"?"도면을 길게 눌러 위치를 잡고 손을 떼면 바로 입력합니다. 바깥을 누르면 완료되고, 문자를 길게 누르면 다시 편집합니다.":locale==="en"?"Hold and drag to position text, then release to type. Tap outside to finish; hold existing text to edit.":"Konum için basılı tutup sürükleyin, bırakınca yazın. Bitirmek için dışarıya, düzenlemek için metne basılı tutun."}</p>:null}
      <details className="annotation-guidance" hidden={tab==="layers"}><summary>{t("measureHelp")}</summary><p className="annotation-help">{tool==="select"?w.pick:tool==="move"?(!selected&&!original?w.moveSelect:draft.length?w.moveTarget:w.moveBase):tool==="text"?w.textHelp:tool==="trim"?w.trimHelp:tool==="polyline"?w.polyHelp:tool.startsWith("dimension")?w.dimHelp:w.twoHelp}</p></details>
      <div className="annotation-actions" hidden={tab==="layers"||!draft.length}><button hidden={tool!=="polyline"} disabled={tool!=="polyline"||draft.length<2} onClick={()=>add(make(draft,"polyline"))}>{w.finish}</button><button disabled={!draft.length} onClick={()=>{setDraft([]);redoDraft.current=[];preview.current=null;renderRef.current();}}>{w.cancel}</button></div>
      <small className="annotation-save" role="status"><ToolIcon name="save"/>{!saved?w.unsaved:notice||w.saved}</small>
    </section>:null}
  </>;
});
