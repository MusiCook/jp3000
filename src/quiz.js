/* ============================================================
   퀴즈 보기 만들기

   가려진 자리를 눌렀을 때 나오는 보기 넷을 만든다.
   정답 하나와 오답 셋이다.

   화면을 건드리지 않는 순수한 코드만 둔다. 그래야 브라우저 없이
   그대로 돌려 볼 수 있고, tools/quiz-audit.js 가 문장 전체를 훑어
   이상한 보기를 찾아낼 수 있다.

   보기를 손대면 반드시 다음을 돌린다.

       node tools/quiz-audit.js

   WORDS·SENT·chunkJP·chunkKO·sim·pick3 은 trainer.html 이 갖고 있다.
   이 파일은 불릴 때에만 그것들을 쓰므로 어느 쪽이 먼저 실려도 된다.
   ============================================================ */

function shuffle4(arr,seed){
  const a=arr.slice();
  for(let j=a.length-1;j>0;j--){ const r=Math.floor(seeded(seed+j*3.1)*(j+1));
    const t=a[j]; a[j]=a[r]; a[r]=t; }
  return a;
}
/* 은/는처럼 앞 글자에 따라 갈리는 조사는 한 덩어리로 보여준다 */
const KPAIR=[['은','는'],['이','가'],['을','를'],['와','과'],['이라고','라고'],['이에요','예요'],['으로','로']];
/* 「どうですか / 어떻습니까」나 「はい / 네」처럼 품사만으로
   오답을 고르면 문장에 붙지 않는 말이 섞이는 고정 표현은
   자연스러운 보기끼리 묶는다. 문장에 q가 있으면 상황에 맞게 덮는다. */
const JP_FIXED_ALTS={
  'dou|desu|ka':['ii|desu|ka','warui|desu|ka','daijoubu|desu|ka'],
  'hai':['iie','tabun','mochiron']
};
const KO_FIXED_ALTS={
  '어떻습니까':['좋습니까','나쁩니까','괜찮습니까'],
  '네':['아니요','아마요','물론이죠']
};
function fixedAlts(type,ans,sent){
  const local=sent&&sent.q&&sent.q[type]&&sent.q[type][ans];
  return local||(type==='j'?JP_FIXED_ALTS:KO_FIXED_ALTS)[ans]||[];
}
/* 받침이 있으면 true */
function hasBat(w){
  const s=String(w).trim(); if(!s) return false;
  const c=s.charCodeAt(s.length-1);
  return (c>=0xAC00&&c<=0xD7A3) ? ((c-0xAC00)%28!==0) : false;
}
/* 앞말에 맞는 조사 꼴로 바꾼다.  이름+은 → 이름은 / 주소+은 → 주소는 */
const JOSA=[['은','는'],['이','가'],['을','를'],['과','와'],['으로','로'],['이라고','라고']];
function fitJosa(word,josa){
  const j=String(josa).trim(); if(!j) return '';
  const pair=JOSA.find(p=>p.indexOf(j)>=0);
  if(!pair) return j;
  return hasBat(word)?pair[0]:pair[1];
}
/* 서술(동사·형용사·です) 자리의 오답은 **만들지 않고 고른다.**

   예전에는 「어간 + 어미」로 조립했다. 한국어 어미는 불규칙이 많아 이 길은
   반드시 틀린 말을 낳는다 — 즐겁 + 었습니다 → 즐겁었습니다 (즐거웠습니다).
   받침만 보고 가려낼 수도 없다. 좁다·갈아입다는 받침이 같아도 규칙이다.
   규칙을 더 정교하게 짜는 대신 조립 자체를 버렸다.

   대신 3,000문장에 사람이 써 놓은 표면형에서 고른다. 고를 때는
   **어미를 정답과 같은 칸으로 묶고 낱말만 바꾼다.**

       즐겁습니다(정답)  어렵습니다  맛있습니다  조용합니다

   보기 넷의 어미가 모두 같으니 어미가 단서가 되지 않고 뜻을 묻게 된다.
   일본어 쪽이 이미 이렇게 동작하며 결과가 자연스럽다
   (楽しかったです ↔ 面白かったです / 忙しかったです / 暑かったです).
   시제·의문은 일본어 문제(楽しいです ↔ 楽しかったです)에서 따로 묻는다. */

/* 끝소리의 받침 번호. 없으면 0, 한글이 아니면 -1 */
function jong(ch){
  const c=String(ch||'').charCodeAt(0);
  return (c>=0xAC00&&c<=0xD7A3) ? (c-0xAC00)%28 : -1;
}
/* 가운뎃소리 번호. ㅏ0 ㅐ1 ㅓ4 ㅔ5 ㅕ6 ㅘ9 ㅙ10 ㅝ14 ㅞ15 ㅣ20 */
function jung(ch){
  const c=String(ch||'').charCodeAt(0);
  return (c>=0xAC00&&c<=0xD7A3) ? Math.floor((c-0xAC00)/28)%21 : -1;
}
/* 과거 어미는 「았·었·였·왔·웠·했」처럼 받침이 ㅆ 인 음절로 드러난다.
   그런데 받침만 보면 「맛있습니까」의 「있」도 걸려 현재가 과거로 바뀐다.
   실제로 그런 일이 있었다 — 03-019 의 보기가 「넓었습니까」·「있었습니까」로 나왔다.
   그래서 가운뎃소리까지 본다. 과거 어미의 소리는 ㅏㅐㅓㅔㅕㅘㅙㅝㅞ 뿐이고,
   「있」의 ㅣ 는 거기에 없다 */
const PASTV=[0,1,4,5,6,9,10,14,15];
const isPast=ch=>jong(ch)===20&&PASTV.indexOf(jung(ch))>=0;
/* 어미의 칸을 **표면 글자만 보고** 나눈다. 어간을 자르지 않으므로
   불규칙에 걸리지 않는다. 과거는 「니다」 앞의 받침 ㅆ 하나로 잡힌다
   (즐거웠습니다 · 했습니다 · 있었습니다) */
/* 「습니다·합니다」의 정중한 끝인가. 「먹으니까」처럼 이유를 말하는 「니까」와
   갈라야 한다. 정중한 꼴은 「습니」거나 앞 음절에 받침 ㅂ 이 있다 (합니다·입니까) */
function polite(w){
  if(/습니(다|까)$/.test(w)) return true;
  return /니(다|까)$/.test(w) && jong(w.slice(-3,-2))===17;   /* 받침 ㅂ */
}
/* 혼자서는 말이 안 되는 어미 조각. 문장 토큰이 갈려 생긴다 */
const KFRAG=/^(습니|습니다|습니까|않습니다|않습니까|습니다요|네요|다|까|요|라고|이라고)$/;
function koForm(v){
  const w=String(v).trim();
  if(/고 나서$/.test(w)) return '순서';
  if(/(다고|라고)$/.test(w)) return '전달';
  if(/(지 않|지 마)/.test(w)) return '부정';
  if(/겠습니(다|까)$/.test(w)) return '추측';
  if(/ 겁니(다|까)$/.test(w)) return '미래';
  if(/(세요|십시오)$/.test(w)) return '요청';
  if(polite(w)){
    const t=w.replace(/니(다|까)$/,'').replace(/습$/,'');
    const past=isPast(t.slice(-1));
    return (past?'과거':'현재')+(/니까$/.test(w)?'의문':'평서');
  }
  if(/다$/.test(w)) return '보통형';
  /* 명사를 꾸미는 꼴. 조용한 · 넓은 · 맛있는 · 매운 */
  if(jong(w.slice(-1))===4||/(은|는)$/.test(w)) return '관형';
  if(/요$/.test(w)) return '요체';
  return '기타';
}
/* pos 를 주면 **조사 자리에서만** 「은/는」처럼 쌍으로 묶는다.
   03-019 의 「이 레스토랑」에서 지시어 「이」가 조사로 묶여 「이/가」가 되고,
   그것이 자기 자리의 오답으로 되돌아왔다. 뜻이 겹쳐 보기가 둘이 되는 셈이다 */
function kNorm(t,pos){
  const s=String(t).trim();
  const hit=(pos==null||pos==='p')?KPAIR.find(p=>p.indexOf(s)>=0):null;
  if(hit) return hit.join('/');
  /* 사전의 「그 ~」는 뒤에 말이 온다는 표기이지 한국어가 아니다.
     보기로 내놓을 때는 떼어 「그」로 쓴다. 문장 쪽에는 물결표가
     든 말이 하나도 없으므로 정답과 부딪칠 일이 없다 */
  return s.replace(/\([^)]*\)$/,'').replace(/\s*~\s*$/,'').trim();
}
/* 문장에 실제로 나온 「말+조사」 덩어리.
   보기를 만들어 내기 전에 여기 있는 것부터 쓴다 */
/* 의문사. 평서문 자리의 오답으로 쓰면 안 된다.
   「저분은 접수처 누구입니다」는 말이 안 되어, 뜻을 몰라도 지워진다.
   낱말을 묻는 문제가 「말이 되는 것 고르기」로 바뀌어 버린다.

   정답 자체가 의문사일 때는 그대로 둔다 — 「어디」와 「어느 쪽」은
   서로 좋은 오답이고, 그때는 가려내는 것이 물어야 할 바다.
   사전 뜻으로 가리므로 낱말이 늘어도 따라온다 */
const ASKKO=/^(누구|어느|무엇|어디|언제|얼마|몇|어떤|어떻)/;
function isAskKO(t){ return ASKKO.test(String(t).trim()); }
function isAskId(k){ const w=WORDS[k];
  return !!(w&&w.m&&w.m.split(',').some(x=>isAskKO(x))); }

let CHUNKPOOL=null;
function buildChunkPool(){
  CHUNKPOOL={byHead:{}, byGroup:{}, all:[], jpByHead:{}, jpAll:[], pred:{}};
  const add=(o,k,v)=>{ if(!k||!v)return; (o[k]=o[k]||[]); if(o[k].indexOf(v)<0) o[k].push(v); };
  /* 서술 표면형은 어미의 칸·품사별로 따로 담는다. 낱말(jkey)과 뜻갈래를
     같이 적어 두어, 고를 때 같은 말과 같은 뜻을 빼낼 수 있게 한다.
     한국어 토큰이 「그렇 + 습니다」처럼 갈려 있는 자리가 있어, 덩어리
     하나가 어미만이거나 어간만인 조각일 수 있다. 조각은 혼자 쓰면 말이
     안 되므로 담지 않는다 — 뒤 덩어리가 빈칸 없이 붙어 오면 어간 조각이다 */
  const addPred=(key,v)=>{ const l=(CHUNKPOOL.pred[key]=CHUNKPOOL.pred[key]||[]);
    if(!l.some(x=>x.t===v.t)) l.push(v); };
  for(const lv in SENT){
    if(+lv===RV) continue;
    SENT[lv].s.forEach(s=>{
      const jc=chunkJP(s.j), kc=chunkKO(s.k);
      jc.forEach(c=>{
        if(!c.w||c.ids.length<2) return;
        const key=c.ids.join('|'), head=c.ids[0];
        add(CHUNKPOOL.jpByHead,head,key);
        if(CHUNKPOOL.jpAll.indexOf(key)<0) CHUNKPOOL.jpAll.push(key);
      });
      kc.forEach((c,i)=>{
        if(c.plain) return;
        const txt=c.toks.map(x=>x[0]).join('').trim();
        const head=c.toks[0][0].trim();
        const pos=c.toks[0][1];
        const nx=kc[i+1];
        const glued=!!(nx&&!nx.plain&&!/^\s/.test(nx.toks[0][0]));
        if(txt&&/^[cva]$/.test(pos)&&!glued&&!KFRAG.test(txt)){
          const jk=(jc[i]&&jc[i].ids)?jc[i].ids[0]:null;
          addPred(koForm(txt)+'|'+pos,
            {t:txt, k:jk, g:(jk&&WORDS[jk])?WORDS[jk].g:null});
        }
        if(c.toks.length<2||!txt||txt===head) return;
        add(CHUNKPOOL.byHead,head,txt);
        const j=jc[i];
        if(j&&j.ids&&WORDS[j.ids[0]]) add(CHUNKPOOL.byGroup,WORDS[j.ids[0]].g,txt);
        if(CHUNKPOOL.all.indexOf(txt)<0) CHUNKPOOL.all.push(txt);
      });
    });
  }
}
let KOPOOL=null;
function buildKoPool(){
  KOPOOL={byP:{},byG:{}};
  const push=(o,k,v)=>{ if(!k||!v)return; (o[k]=o[k]||[]).push(v); };
  for(const lv in SENT) SENT[lv].s.forEach(s=>s.k.forEach(([w,c],i)=>{
    const t=kNorm(w,c); if(!t||/^[,.?!]$/.test(t)) return;
    push(KOPOOL.byP,c,t);
    if(s.j.length===s.k.length && WORDS[s.j[i]]) push(KOPOOL.byG,WORDS[s.j[i]].g,{t,p:c});
  }));
  Object.values(WORDS).forEach(w=>{
    if(!w.m) return;
    w.m.split(',').forEach(x=>{ const t=x.trim();
      if(!t||/^~/.test(t)) return;
      const n=kNorm(t,w.p); push(KOPOOL.byP,w.p,n); push(KOPOOL.byG,w.g,{t:n,p:w.p}); });
  });
  for(const k in KOPOOL.byP) KOPOOL.byP[k]=[...new Set(KOPOOL.byP[k])];
  for(const k in KOPOOL.byG){                       /* 같은 말이 겹치면 하나만 */
    const seen={}; KOPOOL.byG[k]=KOPOOL.byG[k].filter(x=>{
      const id=x.t+'\u0000'+x.p; if(seen[id]) return false; seen[id]=1; return true; });
  }
}

/* 오답으로 쓸 말을 고른다.
   같은 뜻갈래에서 **같은 품사인 것만** 쓴다. 품사를 가리지 않으면
   「내일은 [근무]입니다」의 보기로 「봐도」·「도와」 같은 동사꼴이 섞인다.
   뜻갈래에 같은 품사가 모자라면 품사별 모음으로 물러선다 */
function koPool(g,p){
  if(!KOPOOL) buildKoPool();
  const byg=(g&&KOPOOL.byG[g]||[]).filter(x=>x.p===p).map(x=>x.t);
  return byg.length>=6 ? byg : (KOPOOL.byP[p]||[]).slice();
}

/* 정답과 뜻이 같은 말은 오답이 될 수 없다.
   仕事 의 뜻이 「일, 업무」인데 정답이 「근무」면 「업무」도 맞는 답이다 */
function koSyn(jkey){
  const w=WORDS[jkey];
  if(!w||!w.m) return [];
  const out=w.m.split(',').map(x=>kNorm(x.trim())).filter(Boolean);
  Object.keys(WORDS).forEach(k=>{                   /* 같은 뜻으로 인정한 짝까지 */
    if(k!==jkey && typeof eqOf==='function' && eqOf(jkey,k)!=null && WORDS[k].m)
      WORDS[k].m.split(',').forEach(x=>{ const n=kNorm(x.trim()); if(n) out.push(n); });
  });
  return [...new Set(out)];
}

/* 화면에서 거의 같아 보이는가.
   한자가 똑같거나(何 / 何), 한쪽이 다른 쪽의 앞머리이고 남는 것이
   가나 한둘뿐일 때(何 / 何か)를 말한다. 三人·日本人처럼 한자가 더
   붙은 것은 눈에 뚜렷이 달라 걸리지 않는다 */
function alike(a,b){
  if(a===b) return true;
  const x = a.length<b.length ? a : b;
  const y = a.length<b.length ? b : a;
  if(y.indexOf(x)!==0) return false;
  const rest=y.slice(x.length);
  return rest.length<=2 && !/[一-鿿々]/.test(rest);   /* 남는 게 가나뿐 */
}

/* 이 말 뒤에 이 조사가 붙을 수 있는가.
   명사·수식어 뒤에는 무엇이든 붙지만, 서술(동사·형용사·です) 뒤에
   붙는 것은 정해져 있다.  ますから ○  ますが ○  ますは ×  ますの × */
const VERBOK=['kara','ga','ka','node','kedo','shi'];
function canAttach(head,pk){
  const w=WORDS[head], p=w&&w.p;
  /* 「~ないです」·「~なかったです」는 형용사의 く꼴 뒤에만 붙는다 (高くないです).
     명사·부사도 통과시켰더니 「田中ないです」·「机なかったです」가 보기로 나왔다 */
  if(/^(naidesu|nakattadesu)$/.test(pk))
    return p==='a'&&/く$/.test(String(w.t).replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1'));
  if(p==='n'||p==='d') return true;
  /* 「じゃないです」는 な형용사의 기본형 뒤에 붙는다 (静かじゃないです).
     い형용사(高い)나 활용형(難しく)에는 붙지 않는다 */
  if(p==='a'&&/^(janaidesu|janakattadesu|janai|janakatta)$/.test(pk))
    return !/(い|く|な|て|で|た|です|でした)$/.test(String(w.t).replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1'));
  /* 형용사 뒤에는 です가 붙는다 (おいしいです・静かです). 이것을 막아 두었더니
     「おいしいですか」의 보기에서 형용사가 모두 빠지고 명사만 남았다 */
  /* 다만 사전에는 활용형도 형용사로 들어 있다. 「難しく」·「暇な」 뒤에는 です가
     붙지 않고, 「暑かったです」는 이미 です를 품고 있다 */
  if(p==='a'&&pk==='desu'){
    const t=String(WORDS[head].t).replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1');
    return !/(く|な|て|で|です|でした)$/.test(t);
  }
  return VERBOK.indexOf(pk)>=0;
}

/* 형용사 사전 키의 꼴. 사전에는 「静かじゃない」·「高かった」 같은 활용형도
   형용사로 들어 있어, 품사만으로는 기본형과 가를 수 없다.
   「危ない」·「つまらない」는 기본형이므로 「くない」·「じゃない」만 부정으로 본다 */
function jpForm(k){
  const t=String((WORDS[k]||{}).t||'').replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1');
  if(/(くない|じゃない|くなかった|じゃなかった)$/.test(t)) return '부정';
  if(/(かった|だった)$/.test(t)) return '과거';
  if(/たい$/.test(t)) return '희망';
  return '기본';
}

/* 보기 만들기 — 낱말 단위 */
function jpCands(ans){
  const w=WORDS[ans];
  const kanjiOf=t=>t.replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1');
  const kanaOf =t=>t.replace(/\{[^|{}]+\|([^|{}]+)\}/g,'$1');
  const aK=kanjiOf(w.t), aY=kanaOf(w.t);
  const askAns=isAskId(ans);
  const cands=Object.keys(WORDS).map(k=>{ const t=WORDS[k].t;
    let s=Math.max(sim(aK,kanjiOf(t)),sim(aY,kanaOf(t)));
    if(s<0) return {v:k,s:-1};
    if(eqOf(ans,k)!=null) return {v:k,s:-1};
    if(!askAns&&isAskId(k)) return {v:k,s:-1};   /* 평서문 자리에 의문사 금지 */
    /* 何(なん) 과 何(なに) 처럼 한자가 같으면 화면에서 구별되지 않는다.
       「何」와 「何か」처럼 가나 한둘만 더 붙은 것도 마찬가지다 */
    if(k!==ans&&alike(kanjiOf(t),aK)) return {v:k,s:-1};
    if(WORDS[k].g===w.g) s+=1.2;
    if(WORDS[k].p===w.p) s+=0.4;
    return {v:k,s}; });
  /* 보기끼리도 겹치면 안 된다. 人(ひと) 와 人(にん) 이 함께 나오면
     정답이 아닌 쪽도 정답으로 보인다. 점수가 높은 것부터 훑으며
     이미 뽑아 둔 것과 닮은 것은 떨군다 */
  const alive=cands.filter(c=>c.s>=0).sort((a,b)=>b.s-a.s);
  const faces=[aK], TOP=60;                /* 뽑힐 만한 위쪽만 견준다 */
  for(let i=0;i<alive.length&&i<TOP;i++){
    const c=alive[i], f=kanjiOf(WORDS[c.v].t);
    if(faces.some(g=>alike(g,f))) c.s=-1; else faces.push(f);
  }
  return cands;
}
function optsJP(ans,seed){
  return shuffle4(pick3(jpCands(ans),seed).concat([ans]),seed);
}
function optsKO(ans,seed){
  if(!KOPOOL) buildKoPool();
  const w=WORDS[ans], m=(w.m||'').split(',')[0].trim();
  const syn=koSyn(ans);
  const askAns=isAskKO(m);
  const pool=koPool(w.g,w.p)
    .filter(v=>v===m||syn.indexOf(kNorm(v))<0)
    .filter(v=>v===m||askAns||!isAskKO(v));       /* 평서문 자리에 의문사 금지 */
  const cands=pool.map(v=>({v,s:sim(m,v)+0.4}));
  return shuffle4(pick3(cands,seed).concat([m]),seed);
}

/* ── 보기 넷 만들기 ──────────────────────
   type 'j' 는 일본어를, 'ko' 는 뜻을 묻는다.
   o = {ans:'낱말|조사', ci:덩어리 번호, sent:문장, seed:섞는 값} */
function quizOpts(type, o){
  const seed = o.seed;
  let opts, ans, cls, jkey=null, rawAns=null;
  if(type==='j'){
    ans=o.ans; cls='jp';
    const ids=ans.split('|'), head=ids[0], tail=ids.slice(1);
    jkey=head;
    const show=l=>l.map(i=>ruby(WORDS[i].t)).join('');
    const cand=[];
    fixedAlts('j',ans,o.sent).forEach(v=>{
      if(cand.length<3&&v!==ans&&cand.indexOf(v)<0) cand.push(v); });
    /* 정답이 의문사가 아니면 의문사 덩어리를 오답으로 내지 않는다.
       「四番です」 자리에 「何番」이 오면 말이 안 돼 지워지므로,
       수를 몰라도 맞힐 수 있다. isUnit 분기는 jpCands 를 타지 않아
       여기서 따로 걸러야 한다 */
    const askHead=isAskId(head);
    const askChunk=v=>isAskId(String(v).split('|')[0]);
    if(!CHUNKPOOL) buildChunkPool();
    /* 단위·접미사가 붙은 덩어리는 실제로 쓰인 것만 쓴다 (三時 ○ / 万時 ×) */
    const isUnit=tail.some(t=>SUFJP.has(t));
    if(isUnit){
      const same=[];
      Object.keys(CHUNKPOOL.jpByHead).forEach(hd=>{
        (CHUNKPOOL.jpByHead[hd]||[]).forEach(v=>{
          if(v!==ans&&v.split('|').slice(1).join('|')===tail.join('|')
             &&(askHead||!askChunk(v))) same.push(v); }); });
      pick3(same.map(v=>({v,s:sim(show(ans.split('|')),show(v.split('|')))+0.4})),seed)
        .forEach(v=>{ if(cand.length<3&&cand.indexOf(v)<0) cand.push(v); });
      (CHUNKPOOL.jpByHead[head]||[]).forEach(v=>{
        if(cand.length<3&&v!==ans&&cand.indexOf(v)<0) cand.push(v); });
    }
    /* 조사를 갈아 끼우는 것은 명사·수식어 뒤에서만 뜻이 통한다.
       です·ます 같은 서술 뒤에 붙이면 「ですは」·「ですの」가 되고,
       끝의 「か」를 격조사와 바꾸면 「ですの」처럼 있을 수 없는 말이 된다 */
    const headP=WORDS[head]&&WORDS[head].p;
    const swappable=(headP==='n'||headP==='d')&&tail[0]!=='ka';
    if(!isUnit&&swappable&&tail.length===1&&WORDS[tail[0]]&&WORDS[tail[0]].p==='p'){
      /* 낱말 둘 × 조사 둘 을 짝지어 넷을 만든다.

           受付の(정답)  受付は     ← 같은 낱말, 다른 조사
           交番の        交番は     ← 다른 낱말, 같은·다른 조사

         요점은 반복을 없애는 것이 아니라 **반복을 단서로 못 쓰게** 하는
         것이다. 낱말도 조사도 저마다 꼭 두 번씩 나오니, 어느 쪽을 세어도
         답이 드러나지 않는다. 낱말과 조사를 **둘 다** 알아야 풀린다.

         전에는 1:2 (조사 하나 + 낱말 둘)이라 정답 낱말이 2:1:1 로 남아,
         많이 나온 쪽을 고르면 낱말을 몰라도 절반은 맞았다.

         고른 조사는 두 낱말 모두에 붙을 수 있어야 한다. 한쪽에만 붙으면
         「来られますは」 같은 말이 생겨 그것만 지워도 답이 좁혀진다.
         재료가 안 되면 아무것도 넣지 않고 아래 되채우기에 맡긴다 */
      const pt=PARTICLES.filter(k=>WORDS[k]&&k!==tail[0]&&k!=='ka'&&canAttach(head,k));
      const p2=pt[Math.floor(seeded(seed*1.7)*pt.length)];
      const w2=pick3(jpCands(head).filter(c=>c.v!==head&&canAttach(c.v,tail[0])
                 &&(!p2||canAttach(c.v,p2))),seed)[0];
      if(p2&&w2){
        [head+'|'+p2, w2+'|'+tail[0], w2+'|'+p2].forEach(v=>{
          if(cand.length<3&&cand.indexOf(v)<0&&v!==ans) cand.push(v); });
      }
    }
    if(cand.length<3&&!isUnit){
      /* 동사에 격조사를 붙이면 「来られますは」 같은 말이 나온다.
         붙을 수 있는 말만 남기고, 그만큼 후보를 더 넓게 본다 */
      let pool=jpCands(head).filter(c=>c.v!==head&&
             (!tail.length||tail.every(t=>canAttach(c.v,t))));
      /* 「~です」로 끝나는 서술 자리는 같은 품사끼리 견준다. 03-019 의
         「おいしいですか」 보기로 「車内ですか」·「だいたいですか」가 나왔다 —
         형용사 자리에 명사와 부사가 섞이면 품사만 보고 지울 수 있고,
         부사에 です를 붙인 말은 그 자체로 어색하다. 한국어 쪽 서술 보기를
         「어미는 같게, 낱말만 다르게」로 잡은 것과 같은 원칙이다.
         같은 품사가 셋이 안 되면 부사만 빼고 넓힌다 */
      if(tail.some(t=>/^(desu|naidesu|nakattadesu|janaidesu|janakattadesu)$/.test(t))&&headP){
        /* 같은 낱말의 다른 꼴(静かです ↔ 静かじゃないです)도 뺀다. 같은 말이
           두 번 보이면 반복이 단서가 된다. 활용형 키는 기본형과 뜻(m)이 같다 */
        const lemma=WORDS[head]&&WORDS[head].m;
        /* 꼴도 정답과 같아야 한다. 「難しいですか」 옆에 「静かじゃないですか」가
           오면 부정형만 보고 지울 수 있다 */
        const form=jpForm(head);
        let same=pool.filter(c=>c.s>=0&&WORDS[c.v]&&WORDS[c.v].p===headP
          &&WORDS[c.v].m!==lemma&&jpForm(c.v)===form);
        /* 의문사 자리는 품사가 아니라 의문사끼리 견준다. 「いつですか」가 부사로
           잡혀 「早くですか」·「全然ですか」가 보기로 나왔다 */
        if(isAskId(head)){
          const asks=pool.filter(c=>c.s>=0&&isAskId(c.v)&&WORDS[c.v].m!==lemma);
          if(asks.length>=3) same=asks;
        }
        pool=same.length>=3 ? same
          : pool.filter(c=>!(WORDS[c.v]&&WORDS[c.v].p==='d'));
      }
      pick3(pool,seed).forEach(k=>{
        const v=k+(tail.length?'|'+tail.join('|'):'');
        if(cand.length<3&&cand.indexOf(v)<0&&v!==ans) cand.push(v); });
    }
    if(cand.length<3&&isUnit){
      pick3(CHUNKPOOL.jpAll.filter(v=>v!==ans&&cand.indexOf(v)<0&&(askHead||!askChunk(v)))
        .map(v=>({v,s:sim(show(ans.split('|')),show(v.split('|')))+0.3})),seed)
        .forEach(v=>{ if(cand.length<3) cand.push(v); });
    }
    opts=shuffle4(cand.slice(0,3).concat([ans]),seed).map(v=>({v,html:show(v.split('|'))}));
  }else{
    if(!KOPOOL) buildKoPool();
    const s=o.sent, ci=o.ci, ck=chunkKO(s.k)[ci], toks=ck.toks;
    ans=toks.map(x=>x[0]).join('').trim(); rawAns=ans; cls='ko';
    const hw=toks[0][0].trim();
    let part=toks.slice(1).map(x=>x[0].trim()).join('');
    /* 「까」·「요」는 조사가 아니라 어미다. 조사 보기를 만들지 않는다 */
    const ENDTOK=/^(까|요|네|죠|군요|는데요)$/;
    if(ENDTOK.test(part)) part='';
    let g=null;
    const jc=chunkJP(s.j)[ci];
    if(jc&&WORDS[jc.ids[0]]){ jkey=jc.ids[0]; g=WORDS[jkey].g; }
    if(!jkey) jkey=s.j.find(id=>{ const x=WORDS[id];
      return x&&x.m&&x.m.split(',').some(m=>kNorm(m)===kNorm(hw)); })||null;
    if(!g&&jkey) g=WORDS[jkey].g;
    /* 정답이 의문사가 아니면 의문사 보기를 내지 않는다.
       덩어리 분기도 실제 문장에서 뽑아 오므로 「어느 분 것」처럼
       의문사로 시작하는 덩어리가 섞여 들어온다 */
    const askAns=isAskKO(ans);
    const cand=[];
    let predDone=false;              /* 서술 자리를 서술 모음으로 채웠나 */
    fixedAlts('k',ans,s).forEach(v=>{
      if(cand.length<3&&v!==ans&&cand.indexOf(v)<0) cand.push(v); });
    if(part){
      if(!CHUNKPOOL) buildChunkPool();
      /* 1순위: 같은 앞말이 다른 조사와 쓰인 실제 덩어리. **하나만** 쓴다.
         셋을 채우면 「저는 / 저도 / 저의 / 저의 것」처럼 넷이 모두 같은
         앞말이 되어, 낱말을 몰라도 조사만 보고 고르게 된다 */
      (CHUNKPOOL.byHead[hw]||[]).forEach(v=>{
        if(cand.length<1&&v!==ans&&cand.indexOf(v)<0&&(askAns||!isAskKO(v))) cand.push(v); });
      /* 2순위: 같은 뜻갈래의 다른 낱말이 만든 실제 덩어리 */
      if(cand.length<3&&g){
        const gl=(CHUNKPOOL.byGroup[g]||[])
          .filter(v=>v!==ans&&!v.startsWith(hw)&&(askAns||!isAskKO(v)));
        pick3(gl.map(v=>({v,s:sim(ans,v)+0.4})),seed).forEach(v=>{
          if(cand.length<3&&cand.indexOf(v)<0) cand.push(v); });
      }
      /* 3순위: 그래도 모자라면 받침에 맞는 조사로 만들어 쓴다 */
      if(cand.length<3){
        const KP=['은','이','을','과','에','에서','도','까지','부터','으로'];
        const alt=KP.map(x=>fitJosa(hw,x)).filter(x=>kNorm(x)!==kNorm(part));
        alt.forEach(x=>{ const v=hw+x;
          if(cand.length<3&&cand.indexOf(v)<0&&v!==ans) cand.push(v); });
      }
    }
    /* 조사가 붙을 수 없는 말은 앞말 후보에서 뺀다
       (단위·수식어 등: 명 시 분 번 개 장 원 엔 …) */
    const NOSUF=/^(명|시|분|초|번|개|장|권|잔|병|원|엔|도|층|번선|호|일|월|년|주|살|세|배|회|점|위|째|여|약|반)$/;
    /* 이미 조사·어미가 붙어 있거나 띄어쓰기가 든 말에는 조사를 또 붙이지 않는다 */
    const HASJOSA=/(은|는|이|가|을|를|의|에|에서|도|와|과|까지|부터|로|으로|라고|이라고)$|[\s~]/;
    /* 어미가 잘린 말(주시겠습니·됩니 …). 끝이 「니」인데 앞 글자 받침이
       ㅂ이거나 「습」이면 잘린 것이다. 어머니·언니는 그렇지 않아 걸리지 않는다 */
    const CUTEND=v=>{
      const w=String(v).trim();
      if(/(습니|시겠|하겠)$/.test(w)) return true;
      if(!/니$/.test(w)||w.length<2) return false;
      const c=w.charCodeAt(w.length-2);
      return (c>=0xAC00&&c<=0xD7A3) && ((c-0xAC00)%28)===17;   /* 받침 ㅂ */
    };
    /* 서술은 어미가 같은 칸에서 낱말만 바꾼 보기를 쓴다.
       같은 낱말(정답의 jkey)과 같은 뜻으로 인정한 짝은 오답이 될 수 없다 */
    const pos0=toks[0][1];
    if(!part&&/^[cva]$/.test(pos0)){
      if(!CHUNKPOOL) buildChunkPool();
      const box=koForm(ans);
      const same=k=>!!(k&&jkey&&(k===jkey||(typeof eqOf==='function'&&eqOf(jkey,k)!=null)));
      const score=x=>({v:x.t, s:sim(ans,x.t)+(g&&x.g===g?1.2:0)+0.4});
      /* 정답 자체가 조각인 자리에서는 조각도 보기가 된다 (그렇 + 습니다) */
      const okFrag=KFRAG.test(ans);
      const take=list=>pick3(list.filter(x=>x.t!==ans&&!same(x.k)
        &&(okFrag||!KFRAG.test(x.t))
        &&(askAns||!isAskKO(x.t))&&cand.indexOf(x.t)<0).map(score),seed)
        .forEach(v=>{ if(cand.length<3&&cand.indexOf(v)<0&&v!==ans) cand.push(v); });
      take(CHUNKPOOL.pred[box+'|'+pos0]||[]);
      /* 같은 품사로 셋이 안 되면 같은 칸의 다른 품사까지 본다 */
      if(cand.length<3) take([].concat(...'cva'.split('')
        .filter(q=>q!==pos0).map(q=>CHUNKPOOL.pred[box+'|'+q]||[])));
      /* 그래도 모자라면 다른 칸에서 빌린다. 「주세요」 같은 자리는 문장
         전체에 같은 꼴이 둘뿐이라 어미를 고정할 재료가 아예 없다.
         빌려 오더라도 **문장에 사람이 써 놓은 말**만 쓴다. 지어내지 않는다.
         칸마다 따로 고르면 큰 칸이 먼저 차 버리므로 한데 모아 견준다 */
      /* 빌릴 때도 정중한 어미 칸에서만 빌린다. 「기타」·「보통형」 칸에는
         반말과 て형이 섞여 있어 정중한 말 옆에 두면 말투가 튄다 */
      const LEND=['현재평서','과거평서','현재의문','과거의문','추측','미래','부정','요청'];
      if(cand.length<3&&LEND.indexOf(box)>=0)
        take([].concat(...Object.keys(CHUNKPOOL.pred)
          .filter(k=>k!==box+'|'+pos0&&LEND.indexOf(k.split('|')[0])>=0)
          .map(k=>CHUNKPOOL.pred[k])));
      predDone=true;                 /* 아래 일반 모음은 건너뛴다 */
    }
    /* 뜻이 같은 말을 거르는 것은 명사 자리에서만 한다.
       서술 자리에서는 「있습니까」의 보기로 「있습니다」가 나오는 것이
       오히려 물어야 할 바다. 어미가 다르면 뜻도 다르다 */
    const nounAns=toks[0][1]==='n';
    const syn=(nounAns&&jkey)?koSyn(jkey):[];
    /* 「됩니」·「있었습니」처럼 어미가 잘린 말이 모음에 섞여 있다.
       정답이 온전한 말이면 잘린 말을 보기로 내놓지 않는다 */
    const cutAns=CUTEND(ans);
    const pool=koPool(g,toks[0][1])
      .filter(v=>syn.indexOf(kNorm(v))<0)          /* 뜻이 같은 말은 오답이 못 된다 */
      .filter(v=>askAns||!isAskKO(v))              /* 평서문 자리에 의문사 금지 */
      .filter(v=>cutAns||!CUTEND(v))
      .filter(v=>!part||(!NOSUF.test(v)&&!HASJOSA.test(v)&&!CUTEND(v)&&v.length>=hw.length-1));
    /* 서술 자리는 위에서 이미 채웠다. 일반 모음에는 사전의 기본형(「싸다」)과
       어미가 잘린 말(「됩니」)이 섞여 있어, 서술 보기로 내면 꼴이 어긋난다 */
    if(!part&&!predDone){
      pick3(pool.map(v=>({v,s:sim(hw,v)+0.4})),seed).forEach(v=>{
        if(cand.length<3&&cand.indexOf(v)<0&&v!==ans) cand.push(v); });
    }
    /* 그래도 모자라면 조사만 바꾼 것으로 채운다 */

    opts=shuffle4(cand.slice(0,3).concat([ans]),seed).map(v=>({v,html:esc(v)}));
  }
  return {opts, ans, cls, jkey, rawAns};
}
