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
/* 서술은 어미만 갈아 끼워 보기를 만든다.
   「않습니다」 → 않았습니다 / 않겠습니다 / 않을 겁니다
   불규칙이 많으므로 안전한 꼴만 쓰고, 애매하면 만들지 않는다 */
const ENDRULE=[
  /* 끝말 그대로를 갈아 끼우는 짝. 앞의 것이 길수록 먼저 맞춘다.
     「겠·았·었」이 이미 붙은 말은 여기서 먼저 걸러야 한다. 그러지 않으면
     아래 '습니다' 규칙이 어간을 「실례하겠」으로 잘라, 거기에 어미를 또
     붙여 「실례하겠겠습니다」 같은 말을 만들어 낸다 */
  ['겠습니다',   ['겠습니까','지 않겠습니다']],
  ['했습니다',   ['하겠습니다','합니다','하지 않았습니다']],
  ['였습니다',   ['였습니까','겠습니다','지 않았습니다']],
  ['았습니다',   ['았습니까','겠습니다','지 않았습니다']],
  ['었습니다',   ['었습니까','겠습니다','지 않았습니다']],
  ['있습니다',   ['있었습니다','있겠습니다','있을 겁니다','없습니다']],
  ['없습니다',   ['없었습니다','없겠습니다','없을 겁니다','있습니다']],
  ['합니다',     ['했습니다','하겠습니다','할 겁니다','하지 않습니다']],
  ['입니다',     ['이었습니다','일 겁니다','이 아닙니다','입니까']],
  ['않습니다',   ['않았습니다','않겠습니다','않을 겁니다','않습니까']],
  ['습니다',     ['었습니다','겠습니다','을 겁니다','습니까']],
  ['습니까',     ['었습니까','겠습니까','습니다']],
  ['주세요',     ['주시겠습니까','주셨습니다','주지 마세요']],
  ['세요',       ['셨습니다','시겠습니까','지 마세요']],
  ['마세요',     ['마셨습니다','말아 주세요','하세요']],
  ['입니',       ['이었습니','일 겁니']],
  ['있습니',     ['있었습니','있겠습니']],
  ['습니',       ['었습니','겠습니']]
];
/* 만들어 놓고 말이 안 되는 꼴은 버린다.
   한국어 어미는 불규칙이 많아, 규칙을 더 정교하게 짜는 것보다
   만들어 본 뒤 걸러 내는 편이 안전하다 */
const BADEND=[
  /겠겠|았았|었었|겠었|었겠|았겠|겠았|않않/,   /* 어미가 겹쳤다 */
  /(겠|았|었)을 겁니다/,                        /* 어미 뒤에 또 미래 */
  /지 않[^]*지 않/,                             /* 부정이 두 번 */
  /하었|하았|되었었|이었었/
];
const okEnd = v => !BADEND.some(re=>re.test(v));

/* 「았」이냐 「었」이냐는 앞 소리로 갈린다. 잡+았습니다 / 먹+었습니다.
   한글 낱자에서 가운뎃소리를 꺼내 ㅏ·ㅗ 면 「았」으로 바꾼다 */
function fitPast(stem, alt){
  if(alt.indexOf('었')!==0) return alt;
  const c=stem.charCodeAt(stem.length-1);
  if(!(c>=0xAC00&&c<=0xD7A3)) return alt;
  const v=Math.floor((c-0xAC00)/28)%21;
  return (v===0||v===8) ? '았'+alt.slice(1) : alt;      /* ㅏ=0, ㅗ=8 */
}

function endingAlts(word){
  const w=String(word).trim(), out=[];
  for(const [tail,alts] of ENDRULE){
    if(!w.endsWith(tail)) continue;
    const stem=w.slice(0,w.length-tail.length);
    /* 어간이 비면(=끝말이 전부) 그대로, 아니면 어간+새 어미 */
    alts.forEach(a=>{ const v=stem+fitPast(stem,a);
      if(v!==w&&okEnd(v)&&out.indexOf(v)<0) out.push(v); });
    break;                       /* 가장 긴 짝 하나만 쓴다 */
  }
  return out;
}
function kNorm(t){
  const s=String(t).trim();
  const hit=KPAIR.find(p=>p.indexOf(s)>=0);
  if(hit) return hit.join('/');
  /* 사전의 「그 ~」는 뒤에 말이 온다는 표기이지 한국어가 아니다.
     보기로 내놓을 때는 떼어 「그」로 쓴다. 문장 쪽에는 물결표가
     든 말이 하나도 없으므로 정답과 부딪칠 일이 없다 */
  return s.replace(/\([^)]*\)$/,'').replace(/\s*~\s*$/,'').trim();
}
/* 문장에 실제로 나온 「말+조사」 덩어리.
   보기를 만들어 내기 전에 여기 있는 것부터 쓴다 */
let CHUNKPOOL=null;
function buildChunkPool(){
  CHUNKPOOL={byHead:{}, byGroup:{}, all:[], jpByHead:{}, jpAll:[]};
  const add=(o,k,v)=>{ if(!k||!v)return; (o[k]=o[k]||[]); if(o[k].indexOf(v)<0) o[k].push(v); };
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
        if(c.plain||c.toks.length<2) return;
        const txt=c.toks.map(x=>x[0]).join('').trim();
        const head=c.toks[0][0].trim();
        if(!txt||txt===head) return;
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
    const t=kNorm(w); if(!t||/^[,.?!]$/.test(t)) return;
    push(KOPOOL.byP,c,t);
    if(s.j.length===s.k.length && WORDS[s.j[i]]) push(KOPOOL.byG,WORDS[s.j[i]].g,{t,p:c});
  }));
  Object.values(WORDS).forEach(w=>{
    if(!w.m) return;
    w.m.split(',').forEach(x=>{ const t=x.trim();
      if(!t||/^~/.test(t)) return;
      const n=kNorm(t); push(KOPOOL.byP,w.p,n); push(KOPOOL.byG,w.g,{t:n,p:w.p}); });
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
  const p=WORDS[head]&&WORDS[head].p;
  if(p==='n'||p==='d') return true;
  return VERBOK.indexOf(pk)>=0;
}

/* 보기 만들기 — 낱말 단위 */
function jpCands(ans){
  const w=WORDS[ans];
  const kanjiOf=t=>t.replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1');
  const kanaOf =t=>t.replace(/\{[^|{}]+\|([^|{}]+)\}/g,'$1');
  const aK=kanjiOf(w.t), aY=kanaOf(w.t);
  const cands=Object.keys(WORDS).map(k=>{ const t=WORDS[k].t;
    let s=Math.max(sim(aK,kanjiOf(t)),sim(aY,kanaOf(t)));
    if(s<0) return {v:k,s:-1};
    if(eqOf(ans,k)!=null) return {v:k,s:-1};
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
  const pool=koPool(w.g,w.p).filter(v=>v===m||syn.indexOf(kNorm(v))<0);
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
    if(!CHUNKPOOL) buildChunkPool();
    /* 단위·접미사가 붙은 덩어리는 실제로 쓰인 것만 쓴다 (三時 ○ / 万時 ×) */
    const isUnit=tail.some(t=>SUFJP.has(t));
    if(isUnit){
      const same=[];
      Object.keys(CHUNKPOOL.jpByHead).forEach(hd=>{
        (CHUNKPOOL.jpByHead[hd]||[]).forEach(v=>{
          if(v!==ans&&v.split('|').slice(1).join('|')===tail.join('|')) same.push(v); }); });
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
      /* 조사만 바꾼 보기 둘 + 앞말을 바꾼 보기 하나 */
      const pt=PARTICLES.filter(k=>WORDS[k]&&k!==tail[0]&&k!=='ka');
      [Math.floor(seeded(seed*1.7)*pt.length),
       Math.floor(seeded(seed*2.9)*pt.length)].forEach(i=>{
        const v=head+'|'+pt[i]; if(pt[i]&&cand.indexOf(v)<0) cand.push(v); });
      const near=pick3(jpCands(head).filter(c=>c.v!==head&&canAttach(c.v,tail[0])),seed)[0];
      if(near&&cand.length<3) cand.push(near+'|'+tail[0]);
    }
    if(cand.length<3&&!isUnit){
      /* 동사에 격조사를 붙이면 「来られますは」 같은 말이 나온다.
         붙을 수 있는 말만 남기고, 그만큼 후보를 더 넓게 본다 */
      pick3(jpCands(head).filter(c=>c.v!==head&&
             (!tail.length||tail.every(t=>canAttach(c.v,t)))),seed).forEach(k=>{
        const v=k+(tail.length?'|'+tail.join('|'):'');
        if(cand.length<3&&cand.indexOf(v)<0&&v!==ans) cand.push(v); });
    }
    if(cand.length<3&&isUnit){
      pick3(CHUNKPOOL.jpAll.filter(v=>v!==ans&&cand.indexOf(v)<0)
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
    const cand=[];
    if(part){
      if(!CHUNKPOOL) buildChunkPool();
      /* 1순위: 같은 앞말이 다른 조사와 쓰인 실제 덩어리 */
      (CHUNKPOOL.byHead[hw]||[]).forEach(v=>{
        if(cand.length<3&&v!==ans&&cand.indexOf(v)<0) cand.push(v); });
      /* 2순위: 같은 뜻갈래의 다른 낱말이 만든 실제 덩어리 */
      if(cand.length<3&&g){
        const gl=(CHUNKPOOL.byGroup[g]||[]).filter(v=>v!==ans&&!v.startsWith(hw));
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
    /* 서술·동사는 어미를 갈아 끼운 보기를 먼저 쓴다 */
    if(!part&&/^[cva]$/.test(toks[0][1])){
      endingAlts(ans).forEach(v=>{ if(cand.length<3&&cand.indexOf(v)<0&&v!==ans) cand.push(v); });
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
      .filter(v=>cutAns||!CUTEND(v))
      .filter(v=>!part||(!NOSUF.test(v)&&!HASJOSA.test(v)&&!CUTEND(v)&&v.length>=hw.length-1));
    if(!part){
      pick3(pool.map(v=>({v,s:sim(hw,v)+0.4})),seed).forEach(v=>{
        if(cand.length<3&&cand.indexOf(v)<0&&v!==ans) cand.push(v); });
    }
    /* 그래도 모자라면 조사만 바꾼 것으로 채운다 */

    opts=shuffle4(cand.slice(0,3).concat([ans]),seed).map(v=>({v,html:esc(v)}));
  }
  return {opts, ans, cls, jkey, rawAns};
}
