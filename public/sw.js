/*
 * 오프라인용 서비스워커.
 *
 * 미리 받아두는 목록 같은 건 없다. 한 번 열어본 것이 캐시에 쌓이고,
 * 그 다음부터는 인터넷이 없어도 열린다. 체육관에서 신호 안 잡혀도 쓰라고.
 *
 * - 문서(HTML)는 네트워크 우선 — 새로 배포한 게 바로 반영된다. 끊기면 캐시.
 * - 나머지(파일 이름에 해시가 붙은 js/css, 아이콘)는 캐시 우선 — 내용이 바뀌면
 *   이름이 바뀌니까 오래된 걸 잘못 쓸 일이 없다.
 */
const CACHE = 'hoopboard-v1';

self.addEventListener('install', () => {
  // 새 워커가 기다리지 않고 바로 일하도록
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
          return res;
        } catch {
          // 오프라인 — 지난번에 받아둔 화면을 돌려준다
          const hit = (await caches.match(req)) ?? (await caches.match('./index.html'));
          if (hit) return hit;
          throw new Error('offline and nothing cached');
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    })(),
  );
});
