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
let timer = 0, busy=false;

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
  if(r.status===404) return null;                    /* 아직 올린 적이 없다 */
  if(!r.ok) throw new Error('HTTP '+r.status);
  const j = await r.json();
  const s = j.fields && j.fields.data && j.fields.data.stringValue;
  try{ return s ? JSON.parse(s) : null; }catch(e){ return null; }
}

/* last 는 앱을 덮는 참에 보내는 것. 그때만 keepalive 를 쓴다.
   keepalive 는 보낼 수 있는 양이 64KB로 묶여 있어, 문장이 3,000개로
   늘면 진도가 그 언저리에 닿는다. 평소에는 쓰지 않는다 */
async function push(data, last){
  const r = await fetch(DOC(acct.uid), {
    method:'PATCH', keepalive:!!last,
    headers:{Authorization:'Bearer '+(await token()), 'Content-Type':'application/json'},
    body: JSON.stringify({fields:{
      data:{stringValue: JSON.stringify(data)},
      at  :{integerValue: String(Date.now())}
    }})
  });
  if(!r.ok) throw new Error('HTTP '+r.status);
}

/* ── 이 기기의 진도 ────────────────────── */

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
  o.lv = Math.max(+a.lv||1, +b.lv||1);     /* 더 나간 단계를 쓴다 */
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
  /* 북마크는 단계마다 한 자리뿐이라 합칠 수 없다. 이 기기 것을 남긴다 */
  o.bm = Object.assign({}, b.bm||{}, a.bm||{});
  return o;
}

/* 맞힌 자리. 값이 회차 비트라 OR 하면 그대로 합쳐진다.
   폰에서 3(1·2회차), PC에서 5(1·3회차)면 답은 7 이다 */
function mergeDone(a,b){
  const o={}; keys(a,b).forEach(k=>{ o[k] = ((a||{})[k]|0) | ((b||{})[k]|0); }); return o;
}

/* 맞힘·틀림 횟수. 더하면 부풀고 한쪽만 두면 사라져서 큰 쪽을 남긴다.
   복습 차례를 정하는 참고값이라 이 정도면 된다 */
function mergeQuiz(a,b){
  const o={};
  keys(a,b).forEach(k=>{
    const x=(a||{})[k]||{}, y=(b||{})[k]||{};
    o[k] = { o:Math.max(+x.o||0,+y.o||0), x:Math.max(+x.x||0,+y.x||0) };
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

/* ── 맞추기 ────────────────────────────
   내려받아 합치고, 달라졌으면 저장한 뒤 다시 올린다.
   화면에 이미 그려진 진도가 있어서, 받은 게 있으면 새로 연다 */
async function syncNow(loud){
  if(!acct || busy) return;
  busy = true;
  try{
    const mine = snap();
    const theirs = await pull();
    const base = merge(mine, mine);        /* 견줄 수 있게 같은 모양으로 만든다 */
    const both = merge(mine, theirs);
    const changed = canon(both) !== canon(base);
    if(changed) put(both);
    await push(both);
    if(changed){
      say('다른 기기의 진도를 받았습니다');
      setTimeout(()=>location.reload(), 1200);
    }else if(loud) say('이미 맞춰져 있습니다');
  }catch(e){
    if(loud) say(msg(e));
  }finally{ busy=false; }
}

/* 공부하는 중에는 올리기만 한다. 내려받아 합치면 화면을 새로 열어야 하는데,
   문제를 푸는 중에 그러면 안 된다. 받는 것은 앱을 열 때와 「지금 맞추기」뿐이다 */
function touch(){
  if(!acct) return;
  clearTimeout(timer);
  timer = setTimeout(()=>{ push(snap()).catch(()=>{}); }, 15000);
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

on('bSyncNow', function(){ say('맞추는 중…'); syncNow(true); });

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

/* 앱을 덮을 때 밀린 것을 마저 올린다 */
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden' && acct){
    clearTimeout(timer); push(snap(), true).catch(()=>{});
  }
});

paint();
if(acct) setTimeout(()=>syncNow(false), 800);

})();
