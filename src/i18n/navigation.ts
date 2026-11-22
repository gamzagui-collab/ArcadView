import type{Locale}from'./translations';
export const navigationWords={
 ko:{home:'메인화면으로',exit:'앱 종료',confirm:'종료하시겠습니까?',cancel:'취소',quit:'종료',quitting:'종료 중…',settings:'뷰어 설정',saveError:'저장을 완료하지 못했습니다. 돌아가서 저장 상태를 확인한 뒤 다시 시도해 주세요.',exitError:'앱을 종료하지 못했습니다. 다시 시도해 주세요.',browserExit:'브라우저에서는 현재 탭을 닫아 종료하세요.',dismiss:'안내 닫기'},
 en:{home:'Go to home',exit:'Exit app',confirm:'Exit the app?',cancel:'Cancel',quit:'Exit',quitting:'Exiting…',settings:'Viewer settings',saveError:'Could not finish saving. Return to check the save status, then try again.',exitError:'Could not exit the app. Please try again.',browserExit:'Close this browser tab to exit.',dismiss:'Dismiss message'},
 tr:{home:'Ana ekrana dön',exit:'Uygulamadan çık',confirm:'Uygulamadan çıkılsın mı?',cancel:'İptal',quit:'Çık',quitting:'Çıkılıyor…',settings:'Görünüm ayarları',saveError:'Kayıt tamamlanamadı. Geri dönüp kayıt durumunu kontrol edin ve yeniden deneyin.',exitError:'Uygulamadan çıkılamadı. Yeniden deneyin.',browserExit:'Çıkmak için bu tarayıcı sekmesini kapatın.',dismiss:'Bildirimi kapat'},
}satisfies Record<Locale,Record<string,string>>;
