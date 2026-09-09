/*
 * sw-test.js — 서비스 워커가 캐시를 갱신하는지 본다
 *
 *     node tools/sw-test.js
 *
 * 저장해 둔 것이 있어도 뒤에서 새것을 받아 캐시에 써야 한다.
 * **그 일을 waitUntil 로 붙잡지 않으면** iOS 는 응답을 내주는 순간
 * 서비스 워커를 재워버려, cache.put 이 영영 실행되지 않는다.
 * 그러면 앱이 옛 화면에 영원히 머문다. 실제로 그 일이 있었다.
 *
 * sw.js 의 fetch 를 손대면 이것을 돌린다.
 */
const fs=require('fs'), vm=require('vm'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','dist','sw.js'),'utf8');

const store={};                                   /* 캐시 흉내 */
let putCount=0, notified=0;
const cache={
  match:async(req)=>store[req.url]?{clone:()=>({text:async()=>store[req.url]})}:undefined,
  put:async(req,res)=>{ putCount++; store[req.url]=await res.text(); },
  addAll:async()=>{}, add:async()=>{}
};
const listeners={};
const ctx={
  console, Promise, JSON, Math, Object, Array, String, RegExp, Set, Date,
  URL, fetch:null,
  caches:{ open:async()=>cache, keys:async()=>[], delete:async()=>true },
  Response:function(b,i){ this.ok=false; this.status=(i||{}).status; },
  self:{
    addEventListener:(t,f)=>{ (listeners[t]=listeners[t]||[]).push(f); },
    location:{origin:'https://x.test'},
    skipWaiting:()=>{}, clients:{matchAll:async()=>{ notified++; return []; }, claim:()=>{}},
    registration:{}
  }
};
ctx.self.self=ctx.self; ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);

function makeRes(body){
  const mk=()=>({ok:true, clone:mk, text:async()=>body});
  const r=mk(); r.ok=true; return r;
}

(async()=>{
  const url='https://x.test/jp3000/dist/jp3000.html';
  store[url]='<html>옛 내용</html>';               /* 이미 저장돼 있다 */
  ctx.fetch=async()=>makeRes('<html>새 내용</html>');

  const waits=[]; let responded=null;
  const ev={ request:{method:'GET', url},
             waitUntil:p=>waits.push(p),
             respondWith:p=>{ responded=p; } };
  listeners.fetch.forEach(f=>f(ev));

  const res=await responded;
  console.log('바로 내준 것      :', await res.clone().text());
  console.log('waitUntil 로 붙잡음:', waits.length>0 ? '예' : '아니오  ← 문제');
  await Promise.all(waits);                        /* iOS 는 여기까지만 살려 둔다 */
  console.log('캐시에 쓴 횟수    :', putCount);
  console.log('캐시에 남은 내용  :', store[url]);
  console.log('바뀜을 알렸나     :', notified>0 ? '예' : '아니오');

  const ok = waits.length>0 && putCount===1 && store[url]==='<html>새 내용</html>' && notified>0;
  console.log(ok ? '\n=== 통과 ===' : '\n=== 실패 ===');
  process.exit(ok?0:1);
})();
