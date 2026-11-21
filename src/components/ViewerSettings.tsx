import{useLayoutEffect,useRef,useState}from'react';
import{useBackNavigation}from'../app/backNavigation';
import{useI18n}from'../i18n/I18nProvider';
import{readViewerPreferences,saveViewerPreferences,type MagnifierSize,type ViewerPreferences}from'../viewer/viewerPreferences';
export function ViewerSettings({onClose}:{onClose():void}){
 const{locale}=useI18n(),dialog=useRef<HTMLDialogElement>(null),[prefs,setPrefs]=useState(readViewerPreferences),[error,setError]=useState(false);
 const w={ko:{title:'뷰어 설정',close:'설정 닫기',enabled:'돋보기 켜기',size:'돋보기 크기',sizes:['소','중','대'],help:'길게 누르는 동안 5배로 확대합니다.',error:'설정을 저장하지 못했습니다. 다시 선택해 주세요.'},en:{title:'Viewer settings',close:'Close settings',enabled:'Enable magnifier',size:'Magnifier size',sizes:['Small','Medium','Large'],help:'Magnify precision holds by 5×.',error:'Could not save settings. Please try again.'},tr:{title:'Görünüm ayarları',close:'Ayarları kapat',enabled:'Büyüteç açık',size:'Büyüteç boyutu',sizes:['Küçük','Orta','Büyük'],help:'Basılı tutarken 5× büyütür.',error:'Ayarlar kaydedilemedi. Tekrar deneyin.'}}[locale];
 useBackNavigation(onClose,true);
 useLayoutEffect(()=>{const e=dialog.current!;e.showModal();return()=>e.close();},[]);
 const change=(next:ViewerPreferences)=>{if(saveViewerPreferences(next)){setPrefs(next);setError(false);}else setError(true);};
 return <dialog ref={dialog} className="viewer-settings-panel tool-panel" aria-labelledby="viewer-settings-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <header className="viewer-settings-heading"><h2 id="viewer-settings-title">{w.title}</h2><button type="button" onClick={onClose} aria-label={w.close}>×</button></header>
  <label className="viewer-magnifier-enable"><input autoFocus type="checkbox" checked={prefs.magnifierEnabled} onChange={e=>change({...prefs,magnifierEnabled:e.target.checked})}/>{w.enabled}<span>5×</span></label>
  <fieldset className="viewer-magnifier-sizes"><legend>{w.size}</legend><div>{(['small','medium','large']as MagnifierSize[]).map((size,i)=><label key={size}><input type="radio" name="magnifier-size" value={size} checked={prefs.magnifierSize===size} onChange={()=>change({...prefs,magnifierSize:size})}/><span>{w.sizes[i]}</span></label>)}</div></fieldset>
  <p className={error?'viewer-settings-error':'viewer-settings-help'} role={error?'alert':undefined}>{error?w.error:w.help}</p>
 </dialog>;
}
