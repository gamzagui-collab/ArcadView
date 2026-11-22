import{useI18n}from'../i18n/I18nProvider';
import{navigationWords}from'../i18n/navigation';
import{ArcadMark}from'./Brand';
import{ChevronRightIcon,FolderIcon}from'./Icons';
import{AppExitButton,ViewerSettingsButton}from'./AppNavigation';
type Props={name:string;format:string;size:string;busy?:boolean;settingsOpen:boolean;onHome():void;onLibrary():void;onSettings():void;onExit():void};
export function DrawingHeader({name,format,size,busy=false,settingsOpen,onHome,onLibrary,onSettings,onExit}:Props){
 const{t,locale}=useI18n(),w=navigationWords[locale];return<header className="viewer-header">
  <button type="button" className="icon-button viewer-home-button" aria-label={w.home} title={w.home} disabled={busy} onClick={onHome}><ChevronRightIcon/></button>
  <div className="file-heading"><ArcadMark className="viewer-brand-mark"/><div><strong>{name}</strong><span><b className="file-format">{format}</b> · {size}</span></div></div>
  <div className="viewer-header-actions"><button type="button" className="open-button compact" aria-label={t('myDrawings')} title={t('myDrawings')} disabled={busy} onClick={onLibrary}><FolderIcon/><span>{t('myDrawings')}</span></button><ViewerSettingsButton open={settingsOpen} disabled={busy} onClick={onSettings}/><AppExitButton disabled={busy} onClick={onExit}/></div>
 </header>;
}
