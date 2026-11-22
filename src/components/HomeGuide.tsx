import {useEffect,useRef,useState} from "react";
import {useI18n} from "../i18n/I18nProvider";
import {useUx} from "../i18n/ux";
import {Blueprint} from "./Brand";
import {ChevronRightIcon,FolderIcon} from "./Icons";
import manifest from "../../public/tutorials/manifest.json";

const lessons=["measure","takeoff","layers"] as const;
function GuideAnimation({lesson,active,alt}:{lesson:typeof lessons[number];active:boolean;alt:string}){
 const [url,setUrl]=useState<string|null>(null);
 useEffect(()=>{
  if(!active)return;
  const controller=new AbortController();let live=true,objectUrl:string|undefined;
  // A fresh, revocable resource starts GIF decoding at frame zero. The three
  // local files keep stable cache URLs rather than accumulating query entries.
  void fetch(`/tutorials/${lesson}.gif`,{signal:controller.signal,cache:"force-cache"}).then(r=>{if(!r.ok)throw Error("Guide unavailable");return r.blob();}).then(blob=>{if(live){objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}}).catch(()=>{});
  return()=>{live=false;controller.abort();if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[lesson,active]);
 return <img src={active&&url?url:`/tutorials/${lesson}-poster.png`} data-guide-lesson={lesson} data-guide-animation={active&&url?"playing":"poster"} width={800} height={500} alt={alt} draggable={false}/>;
}
const copy={
 ko:{label:"간단 사용법",intro:"시작하기",previous:"이전 안내",next:"다음 안내",play:"안내 재생",pause:"안내 일시정지",sample:"예시 도면 · 자동 재생",titles:["두 점 사이 거리를 정확하게","선과 규격으로 물량을 빠르게","레이어로 구역을 나눠 관리"],descriptions:["꾹 눌러 스냅 위치를 맞추고 손을 떼세요. 두 번째 점도 같은 방법으로 찍으면 거리가 표시됩니다.","옹벽 선을 찍고 완료를 누르세요. 높이·두께를 입력하면 개별 물량과 현재 레이어 합계가 계산됩니다.","좌측 위 레이어 번호를 누르세요. 그리기·적산 탭에서 구역을 나누고 눈 아이콘으로 표시를 바꿀 수 있습니다."],alts:["예시 평면도에서 손가락 위 포인터를 맞춰 두 점을 찍고 6,000 mm 거리를 확인하는 순서","6m 옹벽 중심선을 찍고 높이 3m, 두께 200mm를 입력해 3.600m³를 계산하는 순서","적산 레이어 A와 B를 전환하고 A를 숨겨 B의 도형과 레이어 합계만 확인하는 순서"]},
 en:{label:"Quick guide",intro:"Get started",previous:"Previous guide",next:"Next guide",play:"Play guide",pause:"Pause guide",sample:"Example drawing · autoplay",titles:["Measure between two points","Turn a path into a quantity","Organize areas with layers"],descriptions:["Press and hold to align the snapped point above your finger, then release. Repeat at the second point to see the distance.","Trace the wall and tap Finish. Enter its height and thickness to see the volume and current-layer total.","Tap the layer number at the top left. Use the Draw and Takeoff tabs to separate areas, and the eye icon to show or hide them."],alts:["A finger positions two snapped points on a sample plan and measures 6,000 mm","A 6m wall with 3m height and 200mm thickness produces 3.600m³","Switch from takeoff layer A to B and hide A to view B and its layer total"]},
 tr:{label:"Hızlı rehber",intro:"Başlayın",previous:"Önceki rehber",next:"Sonraki rehber",play:"Rehberi oynat",pause:"Rehberi duraklat",sample:"Örnek çizim · otomatik oynatım",titles:["İki nokta arasını ölçün","Yoldan beton miktarına","Alanları katmanlarla ayırın"],descriptions:["Basılı tutarak parmağınızın üstündeki yakalama noktasını hizalayın ve bırakın. Mesafe için ikinci noktada tekrarlayın.","Duvarı izleyip Bitir'e dokunun. Yükseklik ve kalınlığı girerek hacmi ve geçerli katman toplamını görün.","Sol üstteki katman numarasına dokunun. Çizim ve Metraj sekmeleriyle alanları ayırın, göz simgesiyle görünürlüğü değiştirin."],alts:["Örnek planda iki noktayı parmakla hizalayarak 6.000 mm ölçme","6m duvar, 3m yükseklik ve 200mm kalınlıkla 3,600m³ hesaplama","Metraj katmanı A'dan B'ye geçip A'yı gizleyerek B'nin toplamını görme"]}
};

/** Offline illustrations only: never mounts a viewer or writes drawing/usage data. */
export function HomeGuide({onLibrary}:{onLibrary():void}){
 const {locale,t}=useI18n(),u=useUx(),text=copy[locale];
 const track=useRef<HTMLDivElement>(null),section=useRef<HTMLElement>(null),pageRef=useRef(0);
 const [page,setPage]=useState(0),[playing,setPlaying]=useState(false),[visible,setVisible]=useState(false),[foreground,setForeground]=useState(true),[reduced,setReduced]=useState(false);
 useEffect(()=>{
  const media=matchMedia("(prefers-reduced-motion: reduce)");setReduced(media.matches);setPlaying(!media.matches);
  const motion=()=>{setReduced(media.matches);if(media.matches)setPlaying(false);},visibility=()=>setForeground(!document.hidden);
  media.addEventListener("change",motion);document.addEventListener("visibilitychange",visibility);visibility();
  const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{threshold:.15});if(section.current)observer.observe(section.current);
  return()=>{observer.disconnect();media.removeEventListener("change",motion);document.removeEventListener("visibilitychange",visibility);};
 },[]);
 const go=(index:number,manual=true)=>{if(manual)setPlaying(false);const el=track.current;if(el)el.scrollTo({left:((index+4)%4)*el.clientWidth,behavior:reduced?"instant":"smooth"});};
 useEffect(()=>{
  if(!playing||!visible||!foreground)return;
  const duration=page?manifest[lessons[page-1]].durationMs:6000;
  const timer=window.setTimeout(()=>go(page+1,false),duration);return()=>clearTimeout(timer);
 },[page,playing,visible,foreground,reduced]);
 useEffect(()=>{
  const el=track.current;if(!el)return;
  const resize=new ResizeObserver(()=>el.scrollTo({left:pageRef.current*el.clientWidth,behavior:"instant"}));resize.observe(el);return()=>resize.disconnect();
 },[]);
 const animated=playing&&visible&&foreground;
 return <section ref={section} className="home-guide" data-locale={locale} aria-label={text.label} aria-roledescription={locale==='ko'?"캐러셀":"carousel"}>
  <div className="home-guide-track" ref={track} onPointerDown={()=>setPlaying(false)} onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(e.key==='ArrowRight'){e.preventDefault();go(page+1);}if(e.key==='ArrowLeft'){e.preventDefault();go(page-1);}}} tabIndex={0} onScroll={()=>{const el=track.current;if(!el?.clientWidth)return;const index=Math.max(0,Math.min(3,Math.round(el.scrollLeft/el.clientWidth)));pageRef.current=index;setPage(index);}}>
   {[0,1,2,3].map(index=><div className={`home-guide-slide${index===0?' home-guide-intro':''}`} key={index} role="group" aria-roledescription={locale==='ko'?"페이지":"slide"} aria-label={`${index+1} / 4 · ${index?text.titles[index-1]:text.intro}`} aria-hidden={page!==index} inert={page!==index}>
    <header className="home-guide-copy"><p className="home-guide-kicker"><span/>{index?`${String(index).padStart(2,'0')} · ${text.label}`:u.workbench}</p>{index?<h2>{text.titles[index-1]}</h2>:<h1>{u.title}</h1>}<p>{index?text.descriptions[index-1]:u.description}</p></header>
    <div className="home-guide-stage">{index===0?<><Blueprint/><button className="open-button home-open" aria-label={t("myDrawings")} onClick={onLibrary}><FolderIcon/><span>{u.open}</span><ChevronRightIcon/></button></>:<><GuideAnimation key={`${index}-${animated&&page===index}`} lesson={lessons[index-1]} active={animated&&page===index} alt={text.alts[index-1]}/><span className="home-guide-sample">{text.sample.split(' · ')[0]}</span></>}</div>
   </div>)}
  </div>
  <nav className="home-guide-controls" aria-label={text.label}>
   <button type="button" aria-label={text.previous} onClick={()=>go(page-1)}><ChevronRightIcon className="home-guide-back"/></button>
   <div className="home-guide-dots">{[text.intro,...text.titles].map((title,index)=><button type="button" key={index} aria-label={title} aria-current={page===index?"step":undefined} onClick={()=>go(index)}><span/></button>)}</div>
   <button type="button" aria-label={text.next} onClick={()=>go(page+1)}><ChevronRightIcon/></button>
   <button type="button" className="home-guide-library" aria-label={u.open} title={u.open} onClick={onLibrary}><FolderIcon/><span>{u.library}</span></button>
   <button type="button" className="home-guide-play" aria-label={playing?text.pause:text.play} aria-pressed={playing} onClick={()=>setPlaying(p=>!p)}>{playing?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg>}</button>
  </nav>
 </section>;
}
