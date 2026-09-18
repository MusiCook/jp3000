/* ============================================================
   기기 간 동기화

   진도를 Firebase 에 올려 폰·PC 에서 이어 하게 한다.

   원본은 늘 이 기기의 localStorage 다. 서버는 사본일 뿐이라,
   인터넷이 없거나 로그인을 하지 않았으면 앱은 지금까지처럼 그대로 돈다.

   SDK 를 쓰지 않고 REST 로 부른다. 합본 HTML 하나로 도는 성질을
   지키기 위해서다. 밖에서 받아 오는 파일이 하나도 없다.

   합치는 규칙은 아래 merge 묶음에 적어 두었다. 진도는 늘어나기만
   하는 자료라 양쪽을 버리지 않고 합칠 수 있다.
   ============================================================ */
(function(){

const CFG  = { key:'AIzaSyCT8QPMUkzHDfeHwagLz_wwSg-Wa0of1Jw', project:'jp3000-aa0ac' };
const AKEY = 'jp3000-auth';                 /* {uid,email,refresh} */
const SK   = { st:KEY, done:'jp3000-solved', quiz:'jp3000-quiz' };
const DOC  = u => 'https://firestore.googleapis.com/v1/projects/'+CFG.project
                + '/databases/(default)/documents/progress/' + u;

/* 화면 설정(글씨·소리·목소리)은 기기마다 다른 게 자연스러워 옮기지 않는다 */

let acct  = null;        /* 로그인 정보 */
let tok   = '', tokAt=0; /* 인증표. 한 시간짜리라 메모리에만 둔다 */
let timer = 0, syncing=null;

try{ acct = JSON.parse(DB.get(AKEY)||'null'); }catch(e){ acct=null; }

/* ── 서버 부르기 ───────────────────────── */

async function post(url, body){
  const r = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
                             body:JSON.stringify(body)});
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
  return j;
}

async function signIn(email, pw){
  const j = await post('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+CFG.key,
                       {email:email, password:pw, returnSecureToken:true});
  acct = {uid:j.localId, email:j.email, refresh:j.refreshToken};
  tok = j.idToken; tokAt = Date.now();
  DB.set(AKEY, JSON.stringify(acct));
}

function signOut(){
  acct=null; tok=''; tokAt=0; clearTimeout(timer);
  DB.set(AKEY,'null');
}

/* 인증표는 한 시간 뒤 만료된다. 50분에 새로 받아 둔다 */
async function token(){
  if(!acct) throw new Error('로그인이 필요합니다');
  if(tok && Date.now()-tokAt < 50*60*1000) return tok;
  const j = await post('https://securetoken.googleapis.com/v1/token?key='+CFG.key,
                       {grant_type:'refresh_token', refresh_token:acct.refresh});
  tok = j.id_token; tokAt = Date.now();
  if(j.refresh_token && j.refresh_token!==acct.refresh){
    acct.refresh = j.refresh_token; DB.set(AKEY, JSON.stringify(acct));
  }
  return tok;
}

/* 진도 한 벌을 통째로 글자열 하나에 담는다.
   Firestore 의 자료형을 쓰지 않으므로 나중에 항목이 늘어도 서버는 그대로다 */
async function pull(){
  const r = await fetch(DOC(acct.uid), {headers:{Authorization:'Bearer '+(await token())}});
  if(r.status===404) return {data:null, version:null}; /* 아직 올린 적이 없다 */
  if(!r.ok) throw new Error('HTTP '+r.status);
  const j = await r.json();
  const s = j.fields && j.fields.data && j.fields.data.stringValue;
  if(!s || !j.updateTime) throw new Error('서버의 진도를 읽을 수 없습니다');
  try{
    const data=JSON.parse(s);
    if(!data || typeof data!=='object' || !data.st || typeof data.st!=='object')
      throw new Error('invalid progress');
    return {data, version:j.updateTime};
  }
  catch(e){ throw new Error('서버의 진도를 읽을 수 없습니다'); }
}

/* 읽은 판이 그대로일 때만 쓴다. 다른 기기가 먼저 올렸으면 다시 받아 합친다. */
async function push(data, version){
  const guard = version ? 'currentDocument.updateTime='+encodeURIComponent(version)
                        : 'currentDocument.exists=false';
  const r = await fetch(DOC(acct.uid)+'?'+guard, {
    method:'PATCH',
    headers:{Authorization:'Bearer '+(await token()), 'Content-Type':'application/json'},
    body: JSON.stringify({fields:{
      data:{stringValue: JSON.stringify(data)},
      at  :{integerValue: String(Date.now())}
    }})
  });
  if(!r.ok){
    const j=await r.json().catch(()=>({}));
    if(r.status===409 || r.status===412 || (j.error&&j.error.status==='FAILED_PRECONDITION')) return false;
    throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
  }
  return true;
}

/* ── 이 기기의 진도 ────────────────────── */

/* 합치기 전에 양쪽을 같은 자로 손본다.
   한쪽만 손보면 저쪽에 남은 옛 키가 합칠 때마다 되살아나,
   「받았습니다 → 새로 열기」가 끝없이 돈다 */
function tidy(s){
  if(s && typeof window.cleanQuiz==='function') s.quiz=window.cleanQuiz(s.quiz).q;
  return s;
}

function snap(){
  const g = k => { try{ return JSON.parse(DB.get(k)||'null'); }catch(e){ return null; } };
  return { st:g(SK.st), done:g(SK.done), quiz:g(SK.quiz) };
}
function put(s){
  DB.set(SK.st,   JSON.stringify(s.st||{}));
  DB.set(SK.done, JSON.stringify(s.done||{}));
  DB.set(SK.quiz, JSON.stringify(s.quiz||{}));
}

/* ── 합치기 ────────────────────────────
   a 가 이 기기, b 가 서버 것이다. 한쪽만 고를 수 있는 자리는 a 를 남긴다 */

const keys = (a,b) => [...new Set([].concat(Object.keys(a||{}), Object.keys(b||{})))];
function maxInto(o,a,b){ keys(a,b).forEach(k=>{ o[k]=Math.max(+(a||{})[k]||0, +(b||{})[k]||0); }); }

function merge(a,b){
  a=a||{}; b=b||{};
  return { st:mergeST(a.st,b.st), done:mergeDone(a.done,b.done), quiz:mergeQuiz(a.quiz,b.quiz) };
}

function mergeST(a,b){
  a=a||{}; b=b||{};
  const o = Object.assign({}, b, a);       /* 모르는 항목은 이 기기 것을 남긴다 */
  o.v  = 3;
  /* 단계 번호는 완료 진도가 아니라 지금 보는 화면이다. 61은 오답노트다.
     다른 기기의 화면으로 끌려가지 않게 이 기기 것을 남긴다. */
  o.lv = a.lv!=null ? +a.lv : (b.lv!=null ? +b.lv : 1);
  o.pg = +a.pg||0;                         /* 보던 쪽은 이 기기 것 */
  o.done = {1:{},2:{},3:{}};
  for(let r=1;r<=3;r++){
    const A=(a.done||{})[r]||{}, B=(b.done||{})[r]||{};
    keys(A,B).forEach(lv=>{
      o.done[r][lv] = [...new Set([].concat(A[lv]||[], B[lv]||[]))].sort((x,y)=>x-y);
    });
  }
  o.r={}; maxInto(o.r, a.r, b.r);          /* 회차는 더 나간 쪽 */
  o.star={}; maxInto(o.star, a.star, b.star);
  /* 북마크와 마지막에 보던 자리는 단계마다 하나뿐이라 합칠 수 없다.
     단계별로 이 기기 것을 남기고, 이 기기에 없는 단계만 저쪽 것을 받는다 */
  o.bm = Object.assign({}, b.bm||{}, a.bm||{});
  o.at = Object.assign({}, b.at||{}, a.at||{});
  return o;
}

/* 맞힌 자리. 값이 회차 비트라 OR 하면 그대로 합쳐진다.
   폰에서 3(1·2회차), PC에서 5(1·3회차)면 답은 7 이다 */
function mergeDone(a,b){
  const o={}; keys(a,b).forEach(k=>{ o[k] = ((a||{})[k]|0) | ((b||{})[k]|0); }); return o;
}

/* 맞힘·틀림 횟수는 큰 쪽을 남긴다. 더하면 맞춘 횟수가 부풀고,
   한쪽만 고르면 다른 기기에서 쌓은 기록이 사라지기 때문이다.
   복습 단계와 예정일은 낮고 이른 쪽을 남긴다. 한 기기에서 아직
   복습할 것이 다른 기기의 졸업 기록에 밀려 사라지면 안 된다. */
function mergeQuiz(a,b){
  const o={};
  keys(a,b).forEach(k=>{
    const x=(a||{})[k]||{}, y=(b||{})[k]||{};
    const q=o[k]={o:Math.max(+x.o||0,+y.o||0), x:Math.max(+x.x||0,+y.x||0)};
    if(x.lv!=null||y.lv!=null)
      q.lv=Math.min(x.lv==null?Infinity:+x.lv, y.lv==null?Infinity:+y.lv);
    if(x.due!=null||y.due!=null)
      q.due=Math.min(x.due==null?Infinity:+x.due, y.due==null?Infinity:+y.due);
  });
  return o;
}

/* 항목 차례가 달라도 같은 내용이면 같게 보이도록 늘어놓는다 */
function canon(v){
  if(Array.isArray(v)) return '['+v.map(canon).join(',')+']';
  if(v && typeof v==='object')
    return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
  return JSON.stringify(v);
}

/* 화면 위치는 기기별로 달라도 된다. 실제 학습 기록만 비교해야
   오답노트(61)와 일반 단계를 오갈 때마다 서버를 다시 쓰거나
   다른 기기의 진도를 받았다고 알리는 일이 생기지 않는다. */
function progress(s){
  if(!s) return null;
  const st=Object.assign({},s.st||{});
  delete st.lv; delete st.pg; delete st.rv; delete st.at;
  return {st, done:s.done, quiz:s.quiz};
}

/* ── 맞추기 ────────────────────────────
   어느 길에서 올리든 먼저 내려받는다. 그대로 덮어쓰면 다른 기기의
   새 기록이 사라진다. 쓰는 사이 서버가 바뀌면 그 판부터 다시 합친다. */
async function mergeOnServer(){
  for(let i=0;i<5;i++){
    const mine=tidy(snap());
    const remote=await pull();
    const theirs=tidy(remote.data);
    const both=merge(mine,theirs);
    if(!theirs || canon(progress(both))!==canon(progress(theirs))){
      if(!await push(both,remote.version)) continue;
    }
    /* 통신하는 동안 이 기기에서 더 공부했으면 그것도 서버에 보내야 한다. */
    const latest=tidy(snap());
    const final=merge(latest,both); /* 그 사이 이동한 화면 위치도 남긴다 */
    if(canon(progress(final))!==canon(progress(both))) continue;
    const changed=canon(progress(final))!==canon(progress(merge(latest,latest)));
    if(changed){
      put(final);
      if(typeof window.applySyncedProgress==='function') window.applySyncedProgress(final);
    }
    return changed;
  }
  throw new Error('동시에 저장한 기록이 많습니다. 다시 맞춰 주세요');
}

async function syncNow(loud){
  if(!acct) return;
  const started=!syncing;
  if(started) syncing=mergeOnServer().finally(()=>{ syncing=null; });
  try{
    const changed=await syncing;
    if(started && changed) say('다른 기기의 진도를 받았습니다');
    else if(!changed && loud) say('이미 맞춰져 있습니다');
  }catch(e){ if(loud) say(msg(e)); }
}

/* 공부한 뒤에도 먼저 서버와 합친다. 업로드만 하면 다른 기기 기록을 덮는다. */
function touch(){
  if(!acct) return;
  clearTimeout(timer);
  timer = setTimeout(()=>syncNow(false), 15000);
}

function msg(e){
  const m = String((e&&e.message)||e);
  if(/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(m))
                                     return '이메일이나 비밀번호가 맞지 않습니다';
  if(/MISSING_PASSWORD|MISSING_EMAIL/.test(m)) return '이메일과 비밀번호를 넣어 주세요';
  if(/TOO_MANY_ATTEMPTS/.test(m))    return '시도가 잦았습니다. 잠시 뒤에 다시 해주세요';
  if(/USER_DISABLED/.test(m))        return '멈춰 둔 계정입니다';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))
                                     return '인터넷에 연결되어 있지 않습니다';
  if(/서버의 진도|동시에 저장한/.test(m)) return m;
  if(/HTTP 40[0-9]/.test(m))         return '서버 설정을 확인해 주세요 ('+m+')';
  return '맞추지 못했습니다';
}

/* ── 화면 ──────────────────────────────── */

function paint(){
  const box=document.getElementById('syncin'), form=document.getElementById('syncout'),
        note=document.getElementById('syncnote');
  if(!note) return;
  if(acct){
    box.hidden=false; form.hidden=true;
    note.textContent = acct.email+' 로 로그인되어 있습니다. 앱을 열 때 자동으로 맞춥니다.';
  }else{
    box.hidden=true;  form.hidden=false;
    note.textContent = '로그인하면 폰·PC의 진도가 자동으로 맞춰집니다.';
  }
}

function on(id, fn){ const el=document.getElementById(id); if(el) el.onclick=fn; }

on('bSyncIn', async function(){
  const em=document.getElementById('syncmail'), pw=document.getElementById('syncpw');
  const b=this;
  b.disabled=true; b.textContent='여는 중…';
  try{
    await signIn(em.value.trim(), pw.value);
    pw.value='';
    paint();
    say('로그인했습니다');
    await syncNow(true);
  }catch(e){ say(msg(e)); }
  finally{ b.disabled=false; b.textContent='로그인'; }
});

on('bSyncOut', function(){
  signOut(); paint(); say('로그아웃했습니다. 진도는 이 기기에 그대로 있습니다');
});

on('bSyncNow', function(){ say('맞추는 중…'); return syncNow(true); });

on('bSyncPw', async function(){
  const em=document.getElementById('syncmail');
  const v=(em&&em.value.trim())||(acct&&acct.email)||'';
  if(!v){ say('이메일을 먼저 넣어 주세요'); return; }
  try{
    await post('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+CFG.key,
               {requestType:'PASSWORD_RESET', email:v});
    say('재설정 메일을 보냈습니다');
  }catch(e){ say(msg(e)); }
});

/* 전체 초기화. 서버에 둔 사본도 함께 지운다.
   안 지우면 다음에 맞출 때 지운 진도가 그대로 되살아난다.
   기기마다 사본이 있으므로 쓰는 기기 모두에서 초기화해야 깨끗해진다 */
window.syncWipe = async function(){
  clearTimeout(timer);
  if(!acct) return;
  try{
    await fetch(DOC(acct.uid), {method:'DELETE',
                                headers:{Authorization:'Bearer '+(await token())}});
  }catch(e){}
};

/* ── 앱에 얹기 ─────────────────────────── */

/* 진도가 저장될 때마다 조금 뒤에 올린다 */
['save','saveDone','saveStat'].forEach(n=>{
  const f = window[n];
  if(typeof f!=='function') return;
  window[n] = function(){ const r=f.apply(this,arguments); touch(); return r; };
});

/* 앱으로 돌아왔을 때 다른 기기의 새 진도도 받는다. */
document.addEventListener('visibilitychange',()=>{
  if(!acct) return;
  if(document.visibilityState==='hidden') clearTimeout(timer);
  return syncNow(false);
});

paint();
if(acct) setTimeout(()=>syncNow(false), 800);

})();
