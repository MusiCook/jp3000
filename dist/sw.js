/* ============================================================
   일본어 3000 · 서비스 워커
   파일을 기기에 저장해 인터넷 없이도 열리게 한다.
   문장을 새로 올리면 다음에 열 때 조용히 받아 두었다가,
   앱에서 "새 내용이 있습니다"를 알린다.
   ============================================================ */

const VER   = 'jp3000-v2';
const SHELL = [
  './',
  './index.html',
  './jp3000.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

/* 설치: 뼈대를 미리 받아 둔다 */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VER)
      /* 하나씩 받는다. addAll 은 하나만 실패해도 전부 저장하지 않는다 */
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

/* 활성화: 옛 판의 캐시를 지운다 */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 가져오기 전략
   - 저장해 둔 것이 있으면 곧바로 보여 준다 (빠르고, 인터넷이 없어도 열린다)
   - 동시에 뒤에서 새것을 받아 캐시를 갱신한다
   - 내용이 달라졌으면 앱에 알린다 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* 바깥 주소는 건드리지 않는다 */

  e.respondWith(
    caches.open(VER).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: true });

      const fresh = fetch(req).then(async res => {
        if (res && res.ok) {
          const copy = res.clone();
          /* 본문이 달라졌는지 확인해 알린다 */
          if (hit && /\.(html|js)$/.test(url.pathname)) {
            const [a, b] = await Promise.all([hit.clone().text(), res.clone().text()]);
            if (a !== b) notify();
          }
          cache.put(req, copy);
        }
        return res;
      }).catch(() => null);

      return hit || fresh || new Response('', { status: 504 });
    })
  );
});

function notify() {
  self.clients.matchAll({ type: 'window' }).then(cs => {
    cs.forEach(c => c.postMessage({ type: 'updated' }));
  });
}

/* 앱에서 즉시 갱신을 요청할 때 */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'skipWaiting') self.skipWaiting();
});
