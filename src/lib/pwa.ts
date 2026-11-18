/**
 * 서비스워커 등록. 이게 있어야 홈 화면에 추가되고 오프라인에서도 열린다.
 *
 * 개발 중에는 켜지 않는다. 캐시가 끼면 고친 게 안 보여서 사람 잡는다.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    // 주소에 맞춰 상대 경로로 등록한다 (어느 하위 폴더에 올려도 그대로 동작)
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 등록이 막혀도(사생활 보호 모드 등) 앱은 평소대로 돌아간다
    });
  });
}
