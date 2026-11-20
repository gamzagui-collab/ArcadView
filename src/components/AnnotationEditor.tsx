import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AnnotationHandleDrag, DrawingViewer, MeasurementPick } from "../viewer/DrawingViewer";
import type { DrawingPoint } from "../viewer/savedView";
import { distance, type MeasurableEntity, type MeasurementUnit } from "../viewer/measurementGeometry";
import { annotationGeometry, annotationHit, annotationPoints, defaultTextHeight, drawingLayers, ensurePointLayer, isPointAnnotation, isPointTool, POINT_LAYER_ID, POINT_TOOLS, pointLayer, readAnnotations, removeDrawingLayer, saveAnnotations, segments, sourceAnnotation, sourceMoveObjects, translateAnnotation, trimAnnotation, uid, visibleAnnotations, type Annotation, type AnnotationDocument, type AnnotationTool } from "../viewer/annotations";
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
import { editNumber, offsetAnnotation, offsetGuide, parseEditNumber, readOffsetDistance, saveOffsetDistance, type OffsetGuide } from "../viewer/offsetGeometry";
import { GeometryDistanceDialog, OffsetDirections } from "./GeometryEditControls";
import { PrecisionSelect } from "./PrecisionSelect";
import { addPointObject, badgeForeground, completePointText, pointHit, pointMoveSnaps, readPointStyle, savePointStyle, type PointStyle, type PointTextSession } from "../viewer/pointMarkup";
import { PointLeaderEditor, PointStyleControls } from "./PointControls";
import {moveHandlePosition,objectGrips,reshapeObject,rotateObject,rotationDegrees,rotationReference} from "../viewer/objectEditing";
import {rotatePoint} from "../viewer/curveGeometry";
import {extendToBoundary} from "../viewer/extendGeometry";
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
const geometryWords={
  ko:{offset:"옵셋",offsetPick:"옵셋할 선·폴리라인·원·사각형을 선택하세요.",offsetDirection:"화살표를 눌러 옵셋 방향을 선택하세요.",offsetDone:"옵셋 객체 추가됨",offsetInvalid:"이 거리로 옵셋할 수 없습니다. 더 작은 거리나 반대 방향을 선택하세요.",unsupported:"이 객체는 옵셋할 수 없습니다. 선·폴리라인·원·원호를 선택하세요.",invalidMove:"X/Y에 유효한 숫자를 입력하세요. 이동 거리는 0일 수 없습니다.",invalidOffset:"0보다 큰 거리를 입력하세요.",intersection:"교차점 스냅",drawingUnit:"도면 단위"},
  en:{offset:"Offset",offsetPick:"Select a line, polyline, circle or rectangle to offset.",offsetDirection:"Choose an offset direction arrow.",offsetDone:"Offset object added",offsetInvalid:"This offset collapses or crosses itself. Try a smaller distance or the other side.",unsupported:"Select an offsettable line, polyline, circle or arc.",invalidMove:"Enter valid X/Y values with a nonzero displacement.",invalidOffset:"Enter a positive distance.",intersection:"Intersection snap",drawingUnit:"drawing units"},
  tr:{offset:"Ötele",offsetPick:"Ötelenecek çizgi, çoklu çizgi, daire veya dikdörtgeni seçin.",offsetDirection:"Öteleme yönü okunu seçin.",offsetDone:"Paralel nesne eklendi",offsetInvalid:"Bu mesafe şekli daraltır veya kesiştirir. Daha küçük mesafe ya da diğer yönü deneyin.",unsupported:"Çizgi, çoklu çizgi, daire veya yay seçin.",invalidMove:"Sıfır olmayan geçerli X/Y mesafeleri girin.",invalidOffset:"Pozitif bir mesafe girin.",intersection:"Kesişim tutunması",drawingUnit:"çizim birimi"},
};
type OffsetChoice={object:Annotation;guide:OffsetGuide};
type PendingEdit={kind:"move";base:DrawingPoint;target:DrawingPoint}|{kind:"offset";object:Annotation;side:1|-1}|{kind:"rotate";center:DrawingPoint;reference:DrawingPoint};
const editWords={
 ko:{rotate:"회전",extend:"라인 연장",rotateCenter:"회전 중심점을 찍으세요.",rotateTarget:"표시한 기준점이 향할 방향을 찍거나 길게 눌러 회전을 미리 보세요.",rotateSelect:"회전할 객체를 선택하세요.",rotated:"객체 회전됨",invalidRotate:"각도는 1도 단위의 정수로 입력하세요. (+ 반시계 방향)",extendBoundary:"먼저 연장 경계 객체를 선택하세요.",extendTarget:"경계까지 연장할 선·원호의 끝쪽을 누르세요.",extended:"경계까지 연장됨",noExtension:"앞쪽에 만나는 경계가 없습니다. 열린 선·원호를 선택하세요. 스플라인·근사곡선은 연장하지 않습니다.",gripHelp:"길게 눌러 위쪽 조준점으로 선택하세요. 꼭짓점 드래그로 크기·형상을 바꾸고, 하단 십자를 잡으면 자유 이동합니다.",reshaped:"객체 형상 변경됨",invalidGrip:"이 위치로 형상을 변경할 수 없습니다."},
 en:{rotate:"Rotate",extend:"Extend",rotateCenter:"Pick the rotation center.",rotateTarget:"Pick the direction for the reference grip; hold to preview rotation.",rotateSelect:"Select an object to rotate.",rotated:"Object rotated",invalidRotate:"Enter whole degrees (+ counterclockwise).",extendBoundary:"Select the boundary object first.",extendTarget:"Tap near the end of the line or arc to extend to the boundary.",extended:"Extended to boundary",noExtension:"No forward boundary. Choose an open line or circular arc; splines/approximate curves cannot extend.",gripHelp:"Hold for the precision target. Drag grips to reshape, or the lower cross to move freely.",reshaped:"Object reshaped",invalidGrip:"This grip position is invalid."},
 tr:{rotate:"Döndür",extend:"Uzat",rotateCenter:"Dönüş merkezini seçin.",rotateTarget:"Referans noktasının yönünü seçin; önizleme için basılı tutun.",rotateSelect:"Döndürülecek nesneyi seçin.",rotated:"Nesne döndürüldü",invalidRotate:"Tam derece girin (+ saat yönünün tersi).",extendBoundary:"Önce sınır nesnesini seçin.",extendTarget:"Uzayacak çizgi veya yayın uç tarafına dokunun.",extended:"Sınıra uzatıldı",noExtension:"İleride sınır yok. Açık çizgi veya dairesel yay seçin; spline/yaklaşık eğriler uzatılamaz.",gripHelp:"Hassas hedef için basılı tutun. Noktalarla şekli, alt haçla konumu değiştirin.",reshaped:"Nesne yeniden şekillendirildi",invalidGrip:"Bu nokta konumu geçersiz."},
};
const editorTabs=["layers","draw","dimensions","points"]as const;
const pointWords={
 ko:{points:"포인트","point-arrow":"화살표","point-cloud":"구름마크","point-circle":"원형 표시","point-rectangle":"사각형 표시","point-leader":"텍스트 지시선",pointHelp:"두 점으로 표시합니다. 화살표는 두 번째 점이 화살촉이고, 구름·사각형은 대각선 모서리를 찍습니다.",leaderHelp:"가리킬 지점 → 문자 위치를 찍고 입력하세요. 바깥을 누르면 완료, 문자를 길게 누르면 편집합니다.",reserved:"포인트 도구 전용 · 자동 선택",currentLayer:"현재 레이어",pointInvalid:"지시문자는 1~500자로 입력하세요."},
 en:{points:"Points","point-arrow":"Arrow","point-cloud":"Cloud","point-circle":"Circle mark","point-rectangle":"Rectangle mark","point-leader":"Text leader",pointHelp:"Pick two anchors. Arrowheads use the second point; cloud/rectangle use opposite corners.",leaderHelp:"Pick the detail, then label position and type. Tap outside to finish; hold the label to edit.",reserved:"Point tools only · automatic",currentLayer:"Current layer",pointInvalid:"Enter a label of 1–500 characters."},
 tr:{points:"İşaret","point-arrow":"Ok","point-cloud":"Bulut","point-circle":"Daire işareti","point-rectangle":"Dikdörtgen işareti","point-leader":"Yazılı ok",pointHelp:"İki nokta seçin. İkinci nokta ok ucudur; bulut/dikdörtgende karşı köşeleri seçin.",leaderHelp:"Ayrıntı ve yazı konumunu seçip yazın. Dışarıya dokunarak bitirin; yazıya basılı tutarak düzenleyin.",reserved:"Yalnızca işaret araçları · otomatik",currentLayer:"Etkin katman",pointInvalid:"1–500 karakter girin."},
};
type Props={viewer:DrawingViewer;active:boolean;open:boolean;sourceUnit:MeasurementUnit;displayUnit:MeasurementUnit;precision:number;onPrecision(value:number):void;onHide():void;onActivate():void;onPause():void;onHistoryState(state:EditHistoryState):void};
export const AnnotationEditor=forwardRef<AnnotationEditorHandle,Props>(function AnnotationEditor({viewer,active,open,sourceUnit,displayUnit,precision,onPrecision,onHide,onActivate,onPause,onHistoryState},ref){
  const {locale,t}=useI18n(),w={...words[locale],...additions[locale],...geometryWords[locale],...pointWords[locale],...editWords[locale]},u=useUx();
  const [tab,setTab]=useState<typeof editorTabs[number]>("draw");
  const key=viewer.getMeasurementGeometry().unitPreferenceKey;
  const [doc,setDoc]=useState<AnnotationDocument>(()=>{const d=readAnnotations(key);return{...d,activeLayer:d.layers[0].id};});
  const [tool,setTool]=useState<AnnotationTool>("select"),[draft,setDraft]=useState<DrawingPoint[]>([]),[snapping,setSnapping]=useState(true);
  const [selected,setSelected]=useState<string|null>(null),[original,setOriginal]=useState<MeasurableEntity|null>(null),[notice,setNotice]=useState(""),[saved,setSaved]=useState(true);
  const [scaleInput,setScaleInput]=useState(String(doc.dimensionScale));
  const [pending,setPending]=useState<PendingEdit|null>(null),[editValues,setEditValues]=useState<string[]>([]),[editError,setEditError]=useState("");
  const [offsetChoice,setOffsetChoice]=useState<OffsetChoice|null>(null);
  const [boundary,setBoundary]=useState<Annotation|null>(null),[handleActive,setHandleActive]=useState(false),directPreview=useRef<Annotation|null>(null);
  const [pointStyle,setPointStyle]=useState(readPointStyle),[pointSession,setPointSession]=useState<PointTextSession|null>(null),pointSessionRef=useRef(pointSession);pointSessionRef.current=pointSession;
  const [heightInput,setHeightInput]=useState(String(doc.textHeight??defaultTextHeight(sourceUnit))),[textColor,setTextColor]=useState<string|undefined>();
  const [textSession,setTextSession]=useState<TextEditSession|null>(null),textSessionRef=useRef(textSession);textSessionRef.current=textSession;
  const docRef=useRef(doc);docRef.current=doc;
  const heightTouched=useRef(false),redoDraft=useRef<DrawingPoint[]>([]);
  const cancelTextHold=useRef<()=>void>(()=>{});
  const history=useRef(new UndoHistory<AnnotationDocument>()),overlay=useRef<SVGSVGElement>(null),target=useRef<SVGSVGElement>(null),preview=useRef<MeasurementPick|null>(null);
  const visible=useMemo(()=>visibleAnnotations(doc),[doc]);
  const geometry=useMemo(()=>annotationGeometry(handleActive||["move","rotate"].includes(tool)&&draft.length>=1?visible.filter(o=>o.id!==selected):visible),[visible,tool,draft.length,selected,handleActive]);
  const pickingMasks=useMemo(()=>[...visible.filter(o=>o.kind==="mask"),...((handleActive||["move","rotate"].includes(tool)&&draft.length>=1)&&original?[{id:"moving-source",layerId:doc.activeLayer,kind:"mask"as const,points:original.points}]:[])],[visible,tool,draft.length,original,doc.activeLayer,handleActive]);
  const selectedObject=doc.objects.find(o=>o.id===selected);
  const editedModel=useMemo(()=>selectedObject??(original?{...sourceAnnotation(original,doc.activeLayer),id:"source-selection"}:null),[selectedObject,original,doc.activeLayer]);
  const originalText=textSession?.originalId?doc.objects.find(o=>o.id===textSession.originalId):undefined;
  const textChanged=!!textSession&&(originalText?
    textSession.text.replace(/\r\n?/g,"\n")!==originalText.text||textSession.height!==originalText.textHeight||textSession.color!==originalText.color:!!textSession.text.trim());
  const normal=drawingLayers(doc),reserved=pointLayer(doc),current=isPointTool(tool)&&active?{...reserved,color:doc.layers.some(l=>l.id===POINT_LAYER_ID)?reserved.color:pointStyle.color}:doc.layers.find(l=>l.id===doc.activeLayer)!;
  const currentNumber=current.id===POINT_LAYER_ID?4:normal.findIndex(l=>l.id===current.id)+1;
  const commit=(next:AnnotationDocument)=>{if(next.objects.length>3000||next.objects.some(o=>o.points.length>30000)){setNotice(w.limit);return false;}if(next===docRef.current)return true;history.current.record(docRef.current);redoDraft.current=[];docRef.current=next;setDoc(next);setSelected(null);setOriginal(null);setPending(null);setOffsetChoice(null);setNotice("");return true;};
  const make=(points:DrawingPoint[],kind:Annotation["kind"]):Annotation=>({id:uid(),layerId:isPointTool(kind)?POINT_LAYER_ID:doc.activeLayer,kind,points,scale:doc.dimensionScale,...(isPointTool(kind)?{color:pointStyle.color,screenWidth:pointStyle.width,screenFontSize:pointStyle.fontSize}:{})});
  const add=(o:Annotation)=>{if(o.points.length<2||distance(o.points[0],o.points[1])<1e-10){setNotice(w.need);return;}if(commit(isPointAnnotation(o)?addPointObject(doc,o):{...doc,objects:[...doc.objects,o]}))setDraft([]);};
  const choose=(value:AnnotationTool)=>{viewer.cancelInteraction();setBoundary(null);cancelTextHold.current();if(pointSessionRef.current)finishPointText(document.querySelector<HTMLTextAreaElement>('.point-leader-input')?.value??pointSessionRef.current.object.text??'');preview.current=null;redoDraft.current=[];setPending(null);setOffsetChoice(null);setEditError("");setTool(value);if(isPointTool(value))setTab("points");else if(value.startsWith("dimension"))setTab("dimensions");else if(["polyline","circle","rectangle","text"].includes(value))setTab("draw");setDraft([]);setNotice(value==="offset"?w.offsetPick:value==="extend"?w.extendBoundary:value==="rotate"?editedModel?w.rotateCenter:w.rotateSelect:"");if(value!=="move"&&value!=="rotate"){setSelected(null);setOriginal(null);}onActivate();if((value==="text"||value==="offset"||value==="rotate"||value==="extend"||isPointTool(value))&&open)onHide();};
  const updatePointStyle=(style:PointStyle)=>{setPointStyle(style);savePointStyle(style);if(style.color!==pointStyle.color&&doc.layers.some(l=>l.id===POINT_LAYER_ID)){const id=selected;commit({...doc,layers:doc.layers.map(l=>l.id===POINT_LAYER_ID?{...l,color:style.color}:l)});setSelected(id);}};
  const applyPointStyle=()=>{if(!selectedObject||!isPointAnnotation(selectedObject))return;const id=selectedObject.id;commit({...doc,objects:doc.objects.map(o=>o.id===id?{...o,color:pointStyle.color,screenWidth:pointStyle.width,screenFontSize:pointStyle.fontSize}:o)});setSelected(id);};
  const beginPointText=(object:Annotation,originalId?:string)=>{viewer.cancelInteraction();textSessionRef.current=null;setTextSession(null);const session={object,originalId};pointSessionRef.current=session;setPointSession(session);setTool("point-leader");setTab("points");setDraft([]);preview.current=null;setSelected(null);setOriginal(null);onActivate();if(open)onHide();};
  const finishPointText=(text:string,cancel=false)=>{const session=pointSessionRef.current;if(!session)return;if(!cancel){try{const next=completePointText(docRef.current,session,text);if(!commit(next))return;}catch{setNotice(w.pointInvalid);return;}}pointSessionRef.current=null;setPointSession(null);preview.current=null;};
  const updatePointText=(text:string)=>{const current=pointSessionRef.current;if(current){const next={...current,object:{...current.object,text}};pointSessionRef.current=next;setPointSession(next);}};
  const replaceObject=(object:Annotation,source:MeasurableEntity|null=null)=>{
    const d=docRef.current,next=source?{...object,id:uid(),layerId:d.activeLayer}:object;
    const objects=source?[...d.objects,{id:uid(),layerId:d.activeLayer,kind:"mask"as const,points:source.points.map(p=>({...p}))},next]:d.objects.map(o=>o.id===object.id?next:o);
    if(commit({...d,objects})){setSelected(next.id);setDraft([]);return true;}return false;
  };
  const beginHandle=(client:DrawingPoint):AnnotationHandleDrag|null=>{
    if(!active||tool!=="select"||!editedModel||editedModel.kind==="mask"||pending||textSession||pointSession||original&&!current.visible)return null;
    const canvas=viewer.getCanvasElement(),rect=canvas.getBoundingClientRect(),p={x:client.x-rect.left,y:client.y-rect.top},move=moveHandlePosition(editedModel,q=>viewer.projectPoints(q),canvas.clientWidth,canvas.clientHeight),grips=objectGrips(editedModel),step=Math.max(1,Math.ceil(grips.length/512));
    let grip:typeof grips[number]|undefined,best=14;const free=!!move&&Math.hypot(p.x-move.x,p.y-move.y)<=17;
    if(!free)for(const[g,i]of grips.map((g,i)=>[g,i]as const)){if(i%step&&i!==grips.length-1)continue;const q=viewer.projectPoints([g.point])[0],d=Math.hypot(p.x-q.x,p.y-q.y);if(d<=best){best=d;grip=g;}}
    if(!free&&!grip)return null;
    cancelTextHold.current();const object=editedModel,source=original,base=free?object.points[0]:grip!.point,projected=viewer.projectPoints([base])[0];let moved=false;
    directPreview.current=object;setHandleActive(true);preview.current=null;renderRef.current();
    const candidate=(pick:MeasurementPick)=>free?translateAnnotation(object,base,pick.point):reshapeObject(object,grip!.id,pick.point);
    const clear=()=>{directPreview.current=null;setHandleActive(false);preview.current=null;renderRef.current();};
    return{offset:{x:projected.x+rect.left-client.x,y:projected.y+rect.top-client.y},anchor:free?base:object.points.find(q=>distance(q,base)>1e-8),move:pick=>{moved||=distance(base,pick.point)>viewer.worldTolerance(2);const next=candidate(pick);if(next)directPreview.current=next;renderRef.current();},end:pick=>{const next=candidate(pick);clear();if(moved){if(next&&replaceObject(next,source))setNotice(free?w.moved:w.reshaped);else if(!next)setNotice(w.invalidGrip);}},cancel:clear};
  };
  const cancelEdit=()=>{setPending(null);setOffsetChoice(null);setDraft([]);redoDraft.current=[];preview.current=null;setEditError("");};
  const moveDestination=()=>{
    if(pending?.kind!=="move")return null;
    const x=parseEditNumber(editValues[0]??""),y=parseEditNumber(editValues[1]??"");
    return x===null||y===null?null:{x:pending.base.x+x,y:pending.base.y+y};
  };
  const applyEdit=()=>{
    if(!pending)return;
    if(pending.kind==="move"){
      const destination=moveDestination();if(!destination||distance(pending.base,destination)<1e-10){setEditError(w.invalidMove);return;}
      if(selectedObject){const moved=translateAnnotation(selectedObject,pending.base,destination);if(commit({...doc,objects:doc.objects.map(o=>o.id===selected?moved:o)})){setSelected(moved.id);setDraft([]);setNotice(w.moved);}}
      else if(original){const objects=sourceMoveObjects(original,doc.activeLayer,pending.base,destination);if(commit({...doc,objects:[...doc.objects,...objects]})){setSelected(objects[1].id);setDraft([]);setNotice(w.moved);}}
    }else if(pending.kind==="rotate"){
      const value=parseEditNumber(editValues[0]??"");if(value===null||!Number.isInteger(value)||Math.abs(value)>36000){setEditError(w.invalidRotate);return;}
      if(value%360===0){cancelEdit();return;}if(editedModel&&replaceObject(rotateObject(editedModel,pending.center,value),original))setNotice(w.rotated);
    }else{
      const value=parseEditNumber(editValues[0]??"");if(value===null||value<=0){setEditError(w.invalidOffset);return;}
      const result=offsetAnnotation(pending.object,value,pending.side);if(!result){setEditError(w.offsetInvalid);return;}
      const object={...result,id:uid(),layerId:doc.activeLayer};
      if(commit({...doc,objects:[...doc.objects,object]})){const remembered=saveOffsetDistance(value,sourceUnit);setSelected(object.id);setNotice(remembered?w.offsetDone:w.unsaved);setDraft([]);}
    }
  };
  const beginText=(point:DrawingPoint,object?:Annotation)=>{
    viewer.cancelInteraction();
    const height=object?.textHeight??(!heightTouched.current&&docRef.current.textHeight===undefined?Math.min(1e6,viewer.worldTolerance(22)):+heightInput);
    const session:TextEditSession={id:object?.id??uid(),originalId:object?.id,layerId:object?.layerId??docRef.current.activeLayer,point:object?.points[0]??point,text:object?.text??"",height,color:object?object.color:textColor,...(object?.rotation!==undefined?{rotation:object.rotation}:{})};
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
    cancelTextHold.current();viewer.cancelInteraction();setBoundary(null);preview.current=null;
    if(pending||offsetChoice){cancelEdit();if(command!=="cancel")return;}
    if(command==="cancel"){finishText("",true);finishPointText("",true);setDraft([]);redoDraft.current=[];setSelected(null);setOriginal(null);setNotice("");return;}
    if(pointSessionRef.current)finishPointText(pointSessionRef.current.object.text??"");
    if(textSessionRef.current)finishText(textSessionRef.current.text);
    if(command==="undo"&&draft.length){redoDraft.current.push(draft.at(-1)!);setDraft(draft.slice(0,-1));return;}
    if(command==="redo"&&redoDraft.current.length){setDraft([...draft,redoDraft.current.pop()!]);return;}
    if(command==="redo"&&draft.length)return;
    const next=history.current[command](docRef.current);
    if(next){docRef.current=next;setDoc(next);setDraft([]);redoDraft.current=[];setSelected(null);setOriginal(null);setNotice("");}
  };
  useImperativeHandle(ref,()=>({execute:editCommand,finishText(){const point=pointSessionRef.current;if(point){finishPointText(document.querySelector<HTMLTextAreaElement>('.point-leader-input')?.value??point.object.text??'');return true;}const current=textSessionRef.current;if(!current)return false;finishText(document.querySelector<HTMLTextAreaElement>(".canvas-text-input")?.value??current.text);return true;}}));
  const erase=()=>{
    if(!current.visible&&!selected){setNotice(w.hidden);return;}
    if(selected){commit({...doc,objects:doc.objects.filter(o=>o.id!==selected)});setNotice(w.deleted);}
    else if(original){add(make(original.points,"mask"));setNotice(w.masked);}
  };
  const pick=(pick:MeasurementPick)=>{
    if(tool==="extend"){
      if(!current.visible){setNotice(w.hidden);return;}
      if(pointHit(visible,pick.point,18,p=>viewer.projectPoints(p))){setNotice(w.noExtension);return;}
      const hit=annotationHit(visible.filter(o=>!["mask","text"].includes(o.kind)&&!o.kind.startsWith("dimension")),pick.point,viewer.worldTolerance(18),sourceUnit),source=hit?null:pick.entity;
      const object=hit??(source?sourceAnnotation(source,doc.activeLayer):null);if(!object||object.approximate||object.points.length>3000){setNotice(w.noExtension);return;}
      if(!boundary){setBoundary(object);setSelected(null);setOriginal(null);setNotice(w.extendTarget);if(open)onHide();return;}
      const extended=extendToBoundary(object,boundary,pick.point);if(!extended){setNotice(w.noExtension);return;}if(replaceObject(extended,source))setNotice(w.extended);return;
    }
    if(tool==="offset"){
      if(!current.visible){setNotice(w.hidden);return;}
      const hit=pointHit(visible,pick.point,18,p=>viewer.projectPoints(p))??annotationHit(visible,pick.point,viewer.worldTolerance(18),sourceUnit),source=hit?null:pick.entity;
      if(!hit&&!source){setNotice(w.noHit);return;}
      if((hit?.points.length??source?.points.length??0)>3000){setNotice(w.limit);return;}
      const object=hit??sourceAnnotation(source!,doc.activeLayer),guide=offsetGuide(object,pick.point);
      if(!guide){setNotice(w.unsupported);return;}
      setSelected(hit?.id??null);setOriginal(source);setOffsetChoice({object,guide});preview.current=null;setNotice(w.offsetDirection);if(open)onHide();return;
    }
    if(tool==="select"||(["move","rotate"].includes(tool)&&!selected&&!original)){const hit=pointHit(visible,pick.point,18,p=>viewer.projectPoints(p))??annotationHit(visible,pick.point,viewer.worldTolerance(18),sourceUnit);if(["move","rotate"].includes(tool)&&hit?.kind==="mask"){setNotice(w.maskMove);return;}if(hit&&isPointAnnotation(hit))setPointStyle({width:hit.screenWidth??3,color:hit.color??"#ff586d",fontSize:hit.screenFontSize??18});setSelected(hit?.id??null);if(!hit&&pick.entity&&pick.entity.points.length>30000){setOriginal(null);setNotice(w.limit);return;}setOriginal(hit?null:pick.entity);setNotice(hit?isPointTool(hit.kind)?w[hit.kind]:hit.kind:pick.entity?w.source:w.noHit);return;}
    if(tool==="rotate"){
      if(original&&!current.visible){setNotice(w.hidden);return;}
      if(!editedModel||editedModel.kind==="mask"){setNotice(w.maskMove);return;}
      if(!draft.length){if(!rotationReference(editedModel,pick.point)){setNotice(w.need);return;}setDraft([pick.point]);preview.current=null;setNotice(w.rotateTarget);return;}
      const center=draft[0],reference=rotationReference(editedModel,center),angle=reference?rotationDegrees(center,reference,pick.point):null;
      if(!reference||angle===null){setNotice(w.need);return;}setEditValues([String(angle)]);setEditError("");setDraft([center,pick.point]);preview.current=null;setPending({kind:"rotate",center,reference});return;
    }
    if(!current.visible&&!(tool==="move"&&selectedObject)){setNotice(w.hidden);return;}
    if(tool==="text"){
      beginText(pick.point);return;
    }
    if(tool==="move"){
      if(selectedObject?.kind==="mask"){setNotice(w.maskMove);return;}
      if(!draft.length){setDraft([pick.point]);setNotice(pick.snapped==="intersection"?w.intersection:w.moveTarget);return;}
      const base=draft[0];setDraft([base,pick.point]);preview.current=null;setEditValues([editNumber(pick.point.x-base.x),editNumber(pick.point.y-base.y)]);setEditError("");setPending({kind:"move",base,target:pick.point});
      return;
    }
    if(tool==="trim"){
      if(pointHit(visible,pick.point,18,p=>viewer.projectPoints(p))){setNotice(w.unsupported);return;}
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
    if(isPointTool(tool)){
      if(points.length===2){if(["point-cloud","point-rectangle"].includes(tool)&&(Math.abs(points[1].x-points[0].x)<1e-10||Math.abs(points[1].y-points[0].y)<1e-10)){setNotice(w.need);return;}const object=make(points,tool);if(tool==="point-leader")beginPointText(object);else add(object);}else setDraft(points);
    }else if(tool==="polyline"){
      if(points.length>=4&&pick.snapped==="start")add(make(points,"polyline"));else setDraft(points);
    }else if(tool==="circle"||tool==="rectangle"){
      if(points.length===2)add(make(points,tool));else setDraft(points);
    }else if(points.length===3)add(make(points,tool));else setDraft(points);
    if(pick.snapped)setNotice(pick.snapped==="perpendicular"?"⊥":pick.snapped==="start"?"↩":pick.snapped==="insertion"?t("measureInsertion"):pick.snapped);
  };
  const render=()=>{
    if(!overlay.current||!target.current)return;
    let points=preview.current?[...draft,preview.current.point]:draft;
    const kind=tool==="select"||tool==="trim"||tool==="move"||tool==="rotate"||tool==="extend"||tool==="offset"?"polyline":tool;
    let temporary:Annotation|null=points.length>=2?{...make(points,kind),id:"draft"}:null;
    if((kind==="rectangle"||kind==="circle")&&points.length!==2)temporary=null;
    if(isPointTool(kind)&&points.length!==2)temporary=null;
    if(kind.startsWith("dimension")&&points.length!==3)temporary=null;
    if(kind==="text")temporary=null;
    let renderingDoc=textSession?.originalId?{...doc,objects:doc.objects.filter(o=>o.id!==textSession.originalId)}:doc,renderingSelected=selected;
    const destination=pending?.kind==="move"?(moveDestination()??pending.target):preview.current?.point;
    const moving=active&&tool==="move"&&draft.length>=1&&destination;
    if(moving){
      if(selectedObject&&selectedObject.kind!=="mask"){temporary=translateAnnotation(selectedObject,draft[0],destination!);renderingDoc={...doc,objects:doc.objects.filter(o=>o.id!==selected)};renderingSelected=temporary.id;}
      else if(original){const[m,c]=sourceMoveObjects(original,doc.activeLayer,draft[0],destination!);renderingDoc={...doc,objects:[...doc.objects,m]};temporary=c;renderingSelected=c.id;}
    }else if(tool==="move")temporary=null;
    if(tool==="offset"){const value=parseEditNumber(editValues[0]??"");temporary=pending?.kind==="offset"&&value!==null?offsetAnnotation(pending.object,value,pending.side):null;if(temporary)temporary={...temporary,id:"offset-preview",layerId:doc.activeLayer};}
    let rotationAngle:number|null=null;
    if(active&&tool==="rotate"&&editedModel&&draft.length){
      const center=draft[0],reference=pending?.kind==="rotate"?pending.reference:rotationReference(editedModel,center);
      rotationAngle=pending?.kind==="rotate"?parseEditNumber(editValues[0]??""):reference&&preview.current?rotationDegrees(center,reference,preview.current.point):0;
      if(rotationAngle!==null&&Number.isInteger(rotationAngle)){temporary=rotateObject(editedModel,center,rotationAngle);renderingDoc={...doc,objects:doc.objects.filter(o=>o.id!==selected)};renderingSelected=temporary.id;if(original)renderingDoc={...renderingDoc,objects:[...renderingDoc.objects,{id:"rotation-mask",layerId:doc.activeLayer,kind:"mask",points:original.points}]};}
    }else if(tool==="rotate")temporary=null;
    if(tool==="extend"){temporary=null;if(boundary)renderingDoc={...renderingDoc,objects:[...renderingDoc.objects,{...boundary,id:"extend-boundary",color:"#8ce56d"}]};}
    if(active&&tool==="select"&&preview.current){const hit=pointHit(visible,preview.current.point,18,p=>viewer.projectPoints(p))??annotationHit(visible,preview.current.point,viewer.worldTolerance(18),sourceUnit);temporary=hit?{...hit,id:"selection-preview",color:"#ffffff"}:preview.current.entity?{...sourceAnnotation(preview.current.entity,doc.activeLayer),id:"selection-preview",color:"#ffffff"}:null;}
    if(directPreview.current){temporary=directPreview.current;renderingSelected=temporary.id;renderingDoc={...doc,objects:doc.objects.filter(o=>o.id!==selected)};if(original)renderingDoc={...renderingDoc,objects:[...renderingDoc.objects,{id:"grip-mask",layerId:doc.activeLayer,kind:"mask",points:original.points}]};}
    if(pointSession){if(pointSession.originalId)renderingDoc={...renderingDoc,objects:renderingDoc.objects.filter(o=>o.id!==pointSession.originalId)};temporary={...pointSession.object,text:""};}
    const originalOutline=original&&active&&!moving&&!directPreview.current&&!(tool==="rotate"&&draft.length)?editedModel:null;
    drawAnnotations(overlay.current,originalOutline?{...renderingDoc,objects:[...renderingDoc.objects,originalOutline]}:renderingDoc,active?(originalOutline?.id??renderingSelected):null,active?temporary:null,p=>viewer.projectPoints(p),sourceUnit,displayUnit,precision,locale);
    drawMeasurementOverlay(target.current,{enabled:active&&!handleActive&&tool!=="extend"&&tool!=="trim"&&tool!=="offset"&&(tool!=="move"||!!selected||!!original),mode:"path",points:pending?.kind==="move"&&destination?[pending.base,destination]:pending?.kind==="rotate"&&rotationAngle!==null?[pending.center,rotatePoint(pending.reference,pending.center,rotationAngle)]:tool==="select"?[]:draft,snapping,entity:null},p=>viewer.projectPoints(p),preview.current,[],[],rotationAngle!==null?`${rotationAngle}°`:undefined);
    if(active&&tool==="rotate"&&editedModel&&draft.length){const reference=rotationReference(editedModel,draft[0]);if(reference){const[a,b]=viewer.projectPoints([draft[0],reference]),g=document.createElementNS("http://www.w3.org/2000/svg","g"),line=document.createElementNS(g.namespaceURI,"line"),dot=document.createElementNS(g.namespaceURI,"circle");for(const[k,v]of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"#a0b5c5","stroke-width":1.5,"stroke-dasharray":"5 5","data-rotation-reference":"true"}))line.setAttribute(k,String(v));for(const[k,v]of Object.entries({cx:b.x,cy:b.y,r:6,fill:"#071a30",stroke:"#ecfaff","stroke-width":2}))dot.setAttribute(k,String(v));g.append(line,dot);target.current.prepend(g);}}
  };
  const renderRef=useRef(render);renderRef.current=render;
  useLayoutEffect(()=>viewer.subscribeView(()=>renderRef.current()),[viewer]);
  useLayoutEffect(()=>{let mounted=true;void document.fonts?.load('16px ArcadAnnotation').then(()=>{if(mounted)renderRef.current();}).catch(()=>undefined);return()=>{mounted=false;};},[]);
  useLayoutEffect(()=>{viewer.setUserGeometry(geometry,pickingMasks);return()=>viewer.setUserGeometry(annotationGeometry([]),[]);},[viewer,geometry,pickingMasks]);
  useLayoutEffect(()=>{
    const selecting=tool==="select"||tool==="offset"||tool==="extend"||(["move","rotate"].includes(tool)&&!selected&&!original);
    viewer.configureAnnotations(active&&!textSession&&!pointSession&&!pending&&!offsetChoice?{tool:selecting?"select":tool,snapping:snapping&&!selecting&&tool!=="trim",handleSnapping:snapping,onHandleDown:beginHandle,points:draft,anchor:tool.startsWith("dimension")?draft[0]:draft.at(-1),referenceSnaps:(tool==="move"||tool==="rotate")&&selectedObject&&!draft.length?pointMoveSnaps(selectedObject):undefined,onPick:pick,onPreview:p=>{preview.current=p;renderRef.current();}}:null);
    renderRef.current();return()=>viewer.configureAnnotations(null);
  },[viewer,active,tool,draft,snapping,doc,selected,original,sourceUnit,displayUnit,textSession,heightInput,pending,offsetChoice,editValues,pointSession,pointStyle,precision,locale,handleActive,boundary]);
  useLayoutEffect(()=>{if(!active){viewer.cancelInteraction();cancelEdit();setBoundary(null);pointSessionRef.current=null;setPointSession(null);}},[active]);
  useLayoutEffect(()=>{setSaved(saveAnnotations(key,doc));},[key,doc]);
  useLayoutEffect(()=>setScaleInput(String(doc.dimensionScale)),[doc.dimensionScale]);
  useLayoutEffect(()=>{if(!textSessionRef.current&&doc.textHeight!==undefined)setHeightInput(String(doc.textHeight));},[doc.textHeight]);
  const interaction=useRef({visible,beginText,beginPointText});interaction.current={visible,beginText,beginPointText};
  useLayoutEffect(()=>{
    const canvas=viewer.getCanvasElement(),pointers=new Set<number>();let hold:ReturnType<typeof setTimeout>|undefined,start:{x:number;y:number}|null=null;
    const clear=()=>{clearTimeout(hold);hold=undefined;start=null;};
    cancelTextHold.current=clear;
    const down=(event:PointerEvent)=>{
      pointers.add(event.pointerId);clear();if(pointers.size!==1||(event.button!==0&&event.pointerType!=="touch"))return;
      const point=viewer.clientToDrawing({x:event.clientX,y:event.clientY}),label=pointHit(interaction.current.visible,point,4,p=>viewer.projectPoints(p),true);
      if(label){start={x:event.clientX,y:event.clientY};hold=setTimeout(()=>{clear();interaction.current.beginPointText(label,label.id);},HOLD_MS);return;}
      const hit=annotationHit(interaction.current.visible.filter(o=>o.kind==="text"),point,viewer.worldTolerance(5),sourceUnit);
      if(!hit)return;start={x:event.clientX,y:event.clientY};hold=setTimeout(()=>{clear();interaction.current.beginText(hit.points[0],hit);},HOLD_MS);
    };
    const move=(event:PointerEvent)=>{if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>8)clear();};
    const end=(event:PointerEvent)=>{pointers.delete(event.pointerId);clear();};
    canvas.addEventListener("pointerdown",down,true);canvas.addEventListener("pointermove",move,true);canvas.addEventListener("pointerup",end,true);canvas.addEventListener("pointercancel",end,true);
    return()=>{clear();cancelTextHold.current=()=>{};canvas.removeEventListener("pointerdown",down,true);canvas.removeEventListener("pointermove",move,true);canvas.removeEventListener("pointerup",end,true);canvas.removeEventListener("pointercancel",end,true);};
  },[viewer,sourceUnit]);
  useLayoutEffect(()=>{onHistoryState({canUndo:!!draft.length||textChanged||!!pointSession?.object.text?.trim()||history.current.canUndo,canRedo:!textChanged&&!pointSession&&(!!redoDraft.current.length||(!draft.length&&history.current.canRedo))});},[doc,draft,textChanged,pointSession,onHistoryState]);
  const updateScale=()=>{const scale=Number(scaleInput);if(!Number.isFinite(scale)||scale<1||scale>10000){setScaleInput(String(doc.dimensionScale));return;}if(scale===doc.dimensionScale&&!selected)return;const id=selected;commit({...doc,dimensionScale:scale,objects:doc.objects.map(o=>o.id===selected&&o.kind.startsWith("dimension")?{...o,scale}:o)});setSelected(id);};
  return <>
    <svg ref={overlay} className="annotation-overlay" aria-hidden="true"/><svg ref={target} className="measurement-overlay annotation-target-overlay" aria-hidden="true"/>
    <div className={`active-layer-badge ${current.visible?"":"layer-hidden"}`} role="status" aria-label={`${w.currentLayer} ${currentNumber} ${current.name}`} title={`${w.currentLayer} ${currentNumber} · ${current.name}`} style={{background:current.color,color:badgeForeground(current.color)}} data-layer={currentNumber}>{currentNumber}</div>
    {active&&pointSession?<PointLeaderEditor viewer={viewer} session={pointSession} onText={updatePointText} onFinish={finishPointText}/>:null}
    {active&&offsetChoice&&!pending?<OffsetDirections viewer={viewer} guide={offsetChoice.guide} onChoose={side=>{setEditValues([editNumber(readOffsetDistance(sourceUnit))]);setEditError("");setPending({kind:"offset",object:offsetChoice.object,side});}}/>:null}
    {active&&pending?<GeometryDistanceDialog kind={pending.kind} values={editValues} unit={pending.kind==="rotate"?"°":sourceUnit==="drawing"?w.drawingUnit:sourceUnit} error={editError} onChange={values=>{setEditValues(values);setEditError("");}} onApply={applyEdit} onCancel={cancelEdit}/>:null}
    <CanvasTextEditor viewer={viewer} session={textSession} active={active&&tool==="text"&&!open} height={textSession?.height??+heightInput}
      color={(textSession?textSession.color:textColor)??doc.layers.find(l=>l.id===(textSession?.layerId??doc.activeLayer))?.color??"#49cfff"}
      onText={updateText} onStyle={updateTextStyle} onFinish={finishText}/>
    {active?<div className="annotation-status" role="status"><button onClick={onHide}>{current.name} · {w[tool]} {draft.length?`· ${draft.length}`:""}<small>{notice||(!saved?w.unsaved:w.saved)}</small></button><button onClick={onPause} aria-label={w.pause}>Ⅱ</button></div>:null}
    {open?<section className="annotation-panel" data-current-tool={tool} aria-label={w.title}>
      <header><strong>{u.tools}</strong><span><ToolIcon name="shield"/>{u.original}</span><button onClick={onHide} aria-label={w.close}>×</button></header>
      <div className="annotation-tabs" role="tablist" aria-label={w.title}>{editorTabs.map((name,i)=><button id={`arcad-tab-${name}`} role="tab" aria-selected={tab===name} aria-controls={`arcad-section-${name}`} key={name} onClick={()=>setTab(name)} onKeyDown={e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key)){e.preventDefault();const next=e.key==="Home"?0:e.key==="End"?3:(i+(e.key==="ArrowRight"?1:3))%4;setTab(editorTabs[next]);document.getElementById(`arcad-tab-${editorTabs[next]}`)?.focus();}}} tabIndex={tab===name?0:-1}><ToolIcon name={name==="layers"?"layers":name==="draw"?"polyline":name==="points"?"point-arrow":"dimension-linear"}/>{name==="layers"?u.layers:name==="draw"?u.drawing:name==="points"?w.points:u.dimensions}</button>)}</div>
      <div id="arcad-section-layers" role="tabpanel" aria-labelledby="arcad-tab-layers" hidden={tab!=="layers"}>
      <div className="layer-section-heading"><strong>{u.layers}</strong><span>{normal.length} / 3 ＋ 4</span></div>
      <div className="user-layers">{normal.map((l,i)=><div key={l.id} className={l.id===current.id?"active":""}>
        <input type="radio" name="user-layer" aria-label={`${w.layer} ${i+1}`} checked={l.id===doc.activeLayer&&!(isPointTool(tool)&&active)} onChange={()=>{commit({...doc,activeLayer:l.id});setTool("select");setDraft([]);}}/>
        <input type="checkbox" aria-label={`${l.name} 표시`} checked={l.visible} onChange={()=>commit({...doc,layers:doc.layers.map(a=>a.id===l.id?{...a,visible:!a.visible}:a)})}/>
        <input className="layer-name" aria-label={`${w.layer} ${i+1} 이름`} value={l.name} maxLength={24} onChange={e=>commit({...doc,layers:doc.layers.map(a=>a.id===l.id?{...a,name:e.target.value}:a)})}/>
        <input type="color" aria-label={`${w.layer} ${i+1} 색상`} value={l.color} onChange={e=>commit({...doc,layers:doc.layers.map(a=>a.id===l.id?{...a,color:e.target.value}:a)})}/>
        <button aria-label={`${w.remove} ${i+1}`} onClick={()=>{commit(removeDrawingLayer(doc,l.id));setDraft([]);}}>×</button>
      </div>)}</div>
      <div className="reserved-point-layer"><b style={{background:reserved.color,color:badgeForeground(reserved.color)}}>4</b><input type="checkbox" aria-label={`${reserved.name} 표시`} checked={reserved.visible} onChange={()=>{viewer.cancelInteraction();preview.current=null;setDraft([]);const next=ensurePointLayer(doc);commit({...next,layers:next.layers.map(l=>l.id===POINT_LAYER_ID?{...l,visible:!l.visible}:l)});}}/><strong>{reserved.name}<small>{w.reserved}</small></strong><span aria-hidden="true">🔒</span></div>
      <button className="add-user-layer" disabled={normal.length>=3} onClick={()=>{const id=uid();commit({...doc,layers:[...normal,{id,name:`${w.layer} ${normal.length+1}`,color:["#49cfff","#fa68df","#8ce56d"][normal.length],visible:true},...(doc.layers.some(l=>l.id===POINT_LAYER_ID)?[reserved]:[])],activeLayer:id});setTool("select");setDraft([]);}}>＋ {w.add}</button>
      <small className="annotation-restore">{w.restore}</small></div>
      <div id="arcad-section-draw" role="tabpanel" aria-labelledby="arcad-tab-draw" hidden={tab!=="draw"} className="annotation-tools draw-tool-grid">{(["polyline","circle","rectangle","text"]as AnnotationTool[]).map(name=><button key={name} data-tool={name} aria-pressed={tool===name&&active} onClick={()=>choose(name)}><ToolIcon name={name}/><span>{w[name]}</span></button>)}</div>
      <div id="arcad-section-dimensions" role="tabpanel" aria-labelledby="arcad-tab-dimensions" hidden={tab!=="dimensions"} className="annotation-tools dimension-tool-grid">{(["dimension-aligned","dimension-linear"]as AnnotationTool[]).map(name=><button key={name} data-tool={name} aria-pressed={tool===name&&active} onClick={()=>choose(name)}><ToolIcon name={name}/><span>{w[name]}</span></button>)}</div>
      {tab==="dimensions"?<PrecisionSelect value={precision} onChange={onPrecision}/>:null}
      <div id="arcad-section-points" role="tabpanel" aria-labelledby="arcad-tab-points" hidden={tab!=="points"}><div className="annotation-tools point-tool-grid">{POINT_TOOLS.map(name=><button key={name} data-tool={name} aria-pressed={tool===name&&active} onClick={()=>choose(name)}><ToolIcon name={name}/><span>{w[name]}</span></button>)}</div><PointStyleControls style={pointStyle} onChange={updatePointStyle} selected={!!selectedObject&&isPointAnnotation(selectedObject)} onApply={applyPointStyle}/><p className="annotation-help">{tool==="point-leader"?w.leaderHelp:w.pointHelp}</p></div>
      <div className="annotation-tools utility-tool-grid" hidden={tab==="layers"}>{(["select","move","rotate","offset","extend","trim"]as AnnotationTool[]).map(name=><button key={name} data-tool={name} aria-pressed={tool===name&&active} onClick={()=>choose(name)}><ToolIcon name={name}/><span>{w[name]}</span></button>)}<button data-tool="delete" disabled={!selected&&!original} onClick={erase}><ToolIcon name="delete"/><span>{w.erase}</span></button></div>
      <div className="annotation-options" hidden={tab==="layers"}><label><input type="checkbox" checked={snapping} onChange={e=>setSnapping(e.target.checked)}/>{w.snap}</label><label hidden={tab==="points"}>{w.scale} 1:<input aria-label={w.scale} type="number" min={1} max={10000} value={scaleInput} onChange={e=>setScaleInput(e.target.value)} onBlur={updateScale} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}} title={w.scaleHelp}/></label></div>
      {tool==="text"?<p className="annotation-help">{locale==="ko"?"도면을 길게 눌러 위치를 잡고 손을 떼면 바로 입력합니다. 바깥을 누르면 완료되고, 문자를 길게 누르면 다시 편집합니다.":locale==="en"?"Hold and drag to position text, then release to type. Tap outside to finish; hold existing text to edit.":"Konum için basılı tutup sürükleyin, bırakınca yazın. Bitirmek için dışarıya, düzenlemek için metne basılı tutun."}</p>:null}
      <details className="annotation-guidance" hidden={tab==="layers"}><summary>{t("measureHelp")}</summary><p className="annotation-help">{tool==="select"?w.gripHelp:tool==="rotate"?(!editedModel?w.rotateSelect:draft.length?w.rotateTarget:w.rotateCenter):tool==="extend"?(boundary?w.extendTarget:w.extendBoundary):tool==="move"?(!selected&&!original?w.moveSelect:draft.length?w.moveTarget:w.moveBase):tool==="offset"?offsetChoice?w.offsetDirection:w.offsetPick:tool==="text"?w.textHelp:tool==="trim"?w.trimHelp:tool==="polyline"?w.polyHelp:tool.startsWith("dimension")?w.dimHelp:w.twoHelp}</p></details>
      <div className="annotation-actions" hidden={tab==="layers"||!draft.length}><button hidden={tool!=="polyline"} disabled={tool!=="polyline"||draft.length<2} onClick={()=>add(make(draft,"polyline"))}>{w.finish}</button><button disabled={!draft.length} onClick={()=>{setDraft([]);redoDraft.current=[];preview.current=null;renderRef.current();}}>{w.cancel}</button></div>
      <small className="annotation-save" role="status"><ToolIcon name="save"/>{!saved?w.unsaved:notice||w.saved}</small>
    </section>:null}
  </>;
});
