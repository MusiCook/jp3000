/*
 * sync-test.js — 진도 합치기가 맞는지 본다
 *
 *     node tools/sync-test.js
 *
 * 서버와 두 기기를 흉내내어 sync.js 를 그대로 돌린다.
 * 합치는 규칙을 손대면 반드시 이것을 돌린다. 여기가 틀리면
 * 진도가 조용히 사라지고, 사라진 줄도 모른다.
 */
const fs=require('fs'), vm=require('vm'), path=require('path');
const SRC=fs.readFileSync(path.join(__dirname,'..','src','sync.js'),'utf8');

let server=null;                    /* Firestore 문서 한 개를 흉내낸다 */
let pushes=0;

function device(local){
  const store={...local, 'jp3000-auth':JSON.stringify({uid:'u1',email:'a@b.c',refresh:'R'})};
  const timers=[];
  const ctx={
    KEY:'jp3000v2',
    DB:{ get:k=>store[k]!==undefined?store[k]:null, set:(k,v)=>{store[k]=v;return true;} },
    say:m=>{ctx.said.push(m);}, said:[],
    window:{}, location:{reload(){ctx.reloaded=true;}}, reloaded:false,
    document:{ getElementById:()=>null, addEventListener:()=>{} },
    setTimeout:(f,ms)=>{timers.push(f);return timers.length;}, clearTimeout:()=>{},
    console,
    fetch: async (url,opt={})=>{
      if(url.includes('securetoken'))
        return {ok:true,status:200,json:async()=>({id_token:'T',refresh_token:'R'})};
      if(url.includes('firestore')){
        if(opt.method==='PATCH'){
          pushes++;
          server=JSON.parse(JSON.parse(opt.body).fields.data.stringValue);
          return {ok:true,status:200,json:async()=>({})};
        }
        if(server===null) return {ok:false,status:404,json:async()=>({})};
        return {ok:true,status:200,json:async()=>({fields:{data:{stringValue:JSON.stringify(server)}}})};
      }
      throw new Error('예상 못한 호출 '+url);
    }
  };
  ctx.globalThis=ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC,ctx);
  return {ctx, store, run:async()=>{ while(timers.length){ await timers.shift()(); await new Promise(r=>setImmediate(r)); } }};
}

(async()=>{
  /* 폰: 1단계를 1회차로 25개 풀고, 3번 자리를 1회차에서 맞혔다 */
  const phone = device({
    'jp3000v2': JSON.stringify({v:3,lv:2,pg:0,r:{1:2},done:{1:{1:[1,2,3]},2:{},3:{}},star:{1:1},bm:{1:2},at:{1:3,2:7}}),
    'jp3000-solved': JSON.stringify({'a':1,'b':1}),
    'jp3000-quiz'  : JSON.stringify({'a':{o:3,x:1}})
  });
  await phone.run();
  console.log('폰 올림  →', JSON.stringify(server));

  /* PC: 같은 계정인데 2단계를 풀었고, a 를 2회차에서도 맞혔다 */
  const pc = device({
    'jp3000v2': JSON.stringify({v:3,lv:1,pg:1,r:{2:1},done:{1:{2:[7,8]},2:{1:[1]},3:{}},star:{},bm:{2:9},at:{1:20}}),
    'jp3000-solved': JSON.stringify({'a':2,'c':1}),
    'jp3000-quiz'  : JSON.stringify({'a':{o:1,x:5}})
  });
  await pc.run();

  const st=JSON.parse(pc.store['jp3000v2']), dn=JSON.parse(pc.store['jp3000-solved']);
  const qz=JSON.parse(pc.store['jp3000-quiz']);
  const ok=[];
  const t=(n,c)=>{ ok.push(c); console.log((c?'  OK  ':'  실패  ')+n); };
  console.log('\nPC 에서 합친 결과');
  t('단계는 더 나간 쪽(2)',            st.lv===2);
  t('1회차 1단계 유지 [1,2,3]',        JSON.stringify(st.done[1][1])==='[1,2,3]');
  t('1회차 2단계 유지 [7,8]',          JSON.stringify(st.done[1][2])==='[7,8]');
  t('2회차 진도 유지 [1]',             JSON.stringify(st.done[2][1])==='[1]');
  t('별 합쳐짐',                        st.star[1]===1);
  t('회차 큰 쪽 r={1:2,2:1}',          st.r[1]===2&&st.r[2]===1);
  t('북마크는 이 기기 것 우선',         st.bm[2]===9&&st.bm[1]===2);
  t('맞힌 자리 OR  a=1|2=3',           dn.a===3);
  t('폰에만 있던 b 살아있음',           dn.b===1);
  t('PC에만 있던 c 살아있음',           dn.c===1);
  t('퀴즈 기록 큰 쪽 o=3 x=5',         qz.a.o===3&&qz.a.x===5);
  t('받은 게 있으니 새로 연다',         pc.ctx.reloaded===true);
  /* 마지막에 보던 자리는 기기마다 다르다. 이 기기 것을 남기되,
     이 기기에 없는 단계는 저쪽 것을 받아 둔다 */
  t('보던 자리는 이 기기 것 우선',       st.at && st.at[1]===20);
  t('이 기기에 없는 단계는 받는다',      st.at && st.at[2]===7);
  console.log('\n서버 최종 →', JSON.stringify(server));

  /* 같은 기기에서 한 번 더 — 이번엔 달라진 게 없어야 한다 */
  const again = device({
    'jp3000v2': pc.store['jp3000v2'],
    'jp3000-solved': pc.store['jp3000-solved'],
    'jp3000-quiz': pc.store['jp3000-quiz']
  });
  await again.run();
  t('두 번째에는 새로 열지 않는다',     again.ctx.reloaded===false);

  console.log(ok.every(Boolean) ? '\n=== 전부 통과 ===' : '\n=== 실패 있음 ===');
  process.exit(ok.every(Boolean)?0:1);
})();
