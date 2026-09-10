/* ============================================================
   일본어 3000 · 서비스 워커
   파일을 기기에 저장해 인터넷 없이도 열리게 한다.
   문장을 새로 올리면 다음에 열 때 조용히 받아 두었다가,
   앱에서 "새 내용이 있습니다"를 알린다.
   ============================================================ */

/* BUILD 는 build.py 가 만들 때마다 새로 찍는다.
   이 파일의 내용이 바뀌어야 브라우저가 서비스 워커를 새로 깔고,
   그때 뼈대를 다시 받는다. 이 줄이 그대로면 앱은 옛것에 머문다 */
const BUILD = '2026-09-10-0907';
const VER   = 'jp3000-' + BUILD;
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

  /* 뒤에서 새것을 받아 두는 일.
     **반드시 waitUntil 로 붙잡아야 한다.** 저장해 둔 것이 있으면
     respondWith 가 곧바로 끝나는데, 그 순간 iOS 는 서비스 워커를
     재워버린다. 그러면 cache.put 이 영영 실행되지 않아 앱이 옛것에
     머문다. 실제로 그 일이 있었다 */
  const fresh = (async () => {
    const cache = await caches.open(VER);
    const hit = await cache.match(req, { ignoreSearch: true });
    let res = null;
    try { res = await fetch(req); } catch (err) { return null; }
    if (res && res.ok) {
      const copy = res.clone();
      /* 본문이 달라졌는지 확인해 알린다 */
      if (hit && /\.(html|js)$/.test(url.pathname)) {
        const [a, b] = await Promise.all([hit.clone().text(), res.clone().text()]);
        if (a !== b) notify();
      }
      await cache.put(req, copy);
    }
    return res;
  })();
  e.waitUntil(fresh);

  e.respondWith((async () => {
    const cache = await caches.open(VER);
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit || (await fresh) || new Response('', { status: 504 });
  })());
});

/* 새 내용을 받았다는 사실을 기억해 둔다.
   페이지가 알림 받을 채비를 마치기 전에 알리면 아무도 못 듣고 사라진다.
   그래서 알리기도 하고, 표시도 남겨 두었다가 물어보면 다시 알려 준다 */
let dirty = false;

function notify() {
  dirty = true;
  self.clients.matchAll({ type: 'window' }).then(cs => {
    cs.forEach(c => c.postMessage({ type: 'updated' }));
  });
}

/* 앱에서 즉시 갱신을 요청할 때 */
self.addEventListener('message', e => {
  if (!e.data) return;
  if (e.data.type === 'skipWaiting') self.skipWaiting();
  /* 페이지가 열리며 「받아 둔 게 있나요」 하고 묻는다 */
  if (e.data.type === 'check' && dirty && e.source) {
    e.source.postMessage({ type: 'updated' });
  }
});
