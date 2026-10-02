/* ============================================================
   check.js — 문장 데이터 검사기
       node tools/check.js
   미정의 단어 · 중복 문장 · 사전 키 충돌 · 형용사 활용 오류 ·
   의미 그룹 누락 · 가타카나 진도 · 어휘 통계를 한 번에 본다.
   배치를 추가할 때마다 반드시 돌린다.
   ============================================================ */
const fs=require('fs');
const path=require('path');
const dir=path.join(__dirname,'..','src')+path.sep;
global.window=global;
eval(fs.readFileSync(dir+'groups.js','utf8'));
eval(fs.readFileSync(dir+'words.js','utf8'));
fs.readdirSync(dir).filter(f=>/^sentences-\d+\.js$/.test(f)).sort()
  .forEach(f=>eval(fs.readFileSync(dir+f,'utf8')));
const W=window.WORDS, S=window.SENT;
const PUNCT=new Set(['。','、','？','！','…','「','」']);

let err=[], seen=new Map(), vocab=new Set(), pat=new Map();
for(const lv of Object.keys(S).map(Number).sort((a,b)=>a-b)){
  S[lv].s.forEach((s,i)=>{
    const tag=`L${lv}-${String(i+1).padStart(3,'0')}`;
    s.j.forEach(id=>{
      if(W[id]) vocab.add(id);
      else if(!PUNCT.has(id)) err.push(`${tag}  사전에 없는 단어: ${id}`);
    });
    const txt=s.j.map(id=>W[id]?W[id].t:id).join('');
    if(seen.has(txt)) err.push(`${tag}  ${seen.get(txt)} 와 완전 중복: ${txt}`);
    else seen.set(txt,tag);
    const p=s.j.filter(id=>W[id]&&['p','c'].includes(W[id].p)).join('+');
    pat.set(p,(pat.get(p)||0)+1);
    if(!s.k||!s.k.length) err.push(`${tag}  해석 없음`);
    /* 형용사 부정형 오용 검사 */
    s.j.forEach((id,k)=>{
      const a=W[id], nx=s.j[k+1];
      if(!a||!a.adj) return;
      if(a.adj==='i'  && nx==='janaidesu') err.push(`${tag}  い형용사에 じゃないです: ${a.t}`);
      if(a.adj==='i'  && nx==='naidesu')   err.push(`${tag}  い형용사 원형에 ないです (く형이어야 함): ${a.t}`);
      if(a.adj==='na' && nx==='naidesu')   err.push(`${tag}  な형용사에 ないです: ${a.t}`);
      if(a.adj==='iku'&& nx==='janaidesu') err.push(`${tag}  く형에 じゃないです: ${a.t}`);
      if(a.adj==='iku'&& nx!=='naidesu' && nx!=='nakattadesu') err.push(`${tag}  く형 뒤에 ないです/なかったです가 없음: ${a.t}`);
      if(a.adj==='na' && W[nx] && W[nx].p==='n') err.push(`${tag}  な형용사가 명사를 바로 꾸밈 (な 필요): ${a.t}`);
      if(a.adj==='i'  && nx==='deshita')  err.push(`${tag}  い형용사에 でした (かったです여야 함): ${a.t}`);
      if(a.adj==='na' && nx==='kattadesu')err.push(`${tag}  な형용사에 かったです: ${a.t}`);
      if(a.adj==='nana'&& !(W[nx]&&W[nx].p==='n')) err.push(`${tag}  な형 뒤에 명사가 없음: ${a.t}`);
      if(a.adj==='ita'&& nx&&nx!=='。'&&nx!=='、'&&nx!=='ka'&&nx!=='ra'&&nx!=='to') err.push(`${tag}  과거형 뒤에 불필요한 토큰: ${a.t} + ${nx}`);
    });
    /* あまり 뒤 부정 확인 */
    if(s.j.includes('amari') && !s.j.some(x=>x==='naidesu'||x==='janaidesu'))
      err.push(`${tag}  あまり가 부정 없이 쓰임`);
  });
}
/* 사전 키 충돌 검사: 생성기가 기존 항목을 덮어썼는지 확인 */
const src=fs.readFileSync(dir+'words.js','utf8');
const declared=[...src.matchAll(/^"([a-z0-9_]+)":\{/gm)].map(m=>m[1]);
const dupDecl=declared.filter((k,i)=>declared.indexOf(k)!==i);
const genKeys=[...src.matchAll(/\["([a-z0-9_]+)","[^"]*","[^"]*"/g)].map(m=>m[1]);
const clash=[];
genKeys.forEach(g=>{ ['masu','masen','mashita','masendeshita','te'].forEach(sfx=>{
  if(declared.indexOf(g+sfx)>=0) clash.push(g+sfx+' (직접 등록 + 생성기 충돌)'); }); });
if(dupDecl.length) console.log('[키 중복 선언]',[...new Set(dupDecl)].join(', '));
if(clash.length) console.log('[키 충돌]',[...new Set(clash)].join(', '));
if(!dupDecl.length&&!clash.length) console.log('키 충돌 없음');
/* 의미 그룹 누락 검사 */
const nog=Object.keys(W).filter(k=>!W[k].g);
console.log(nog.length?'[그룹 누락] '+nog.length+'개: '+nog.slice(0,25).join(' '):'의미 그룹 이상 없음');
console.log('문장 수 :',[...seen.keys()].length);
console.log('사용 단어:',vocab.size,'/ 사전 등재',Object.keys(W).length);
const unused=Object.keys(W).filter(k=>!vocab.has(k));
if(unused.length) console.log('미사용 단어:',unused.join(', '));
console.log('\n문형 분포 (조사+서술 조합, 상위 8):');
[...pat.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8)
  .forEach(([k,v])=>console.log(`  ${String(v).padStart(2)}회  ${k||'(없음)'}`));
/* 가타카나 진도 */
const KATA=/[ァ-ヴー]/;
const strip=t=>t.replace(/\{([^|]+)\|[^}]+\}/g,'$1');
let kSent=0, kTot=0; const kUsed=new Set();
for(const lv of Object.keys(S)) S[lv].s.forEach(s=>{ kTot++;
  const t=strip(s.j.map(id=>W[id]?W[id].t:id).join(''));
  if(KATA.test(t)) kSent++;
  t.split('').forEach(c=>{ if(KATA.test(c)) kUsed.add(c); }); });
const ALL='アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポャュョッー';
const SMALL='ァィゥェォヴ';
const main=[...kUsed].filter(c=>ALL.indexOf(c)>=0);
const extra=[...kUsed].filter(c=>ALL.indexOf(c)<0);
const miss=[...ALL].filter(c=>!kUsed.has(c));
console.log('\n가타카나 : 문장 '+kSent+'/'+kTot+' ('+(kSent/kTot*100).toFixed(1)+'%) | 기본 글자 '+main.length+'/'+ALL.length+'종'
  +(extra.length?' | 작은 글자 '+extra.join('')+' 포함':''));
if(miss.length) console.log('  안 나온 글자:',miss.join(' '));
/* 「더 배워보기」 설명의 갈래 이름.
   같은 것을 다른 이름으로 부르기 시작하면 화면이 뒤죽박죽이 된다.
   한 번만 쓰인 이름이 늘면 합칠 자리가 없는지 본다 */
const gN=new Map();
Object.values(W).forEach(w=>(w.f||[]).forEach(b=>gN.set(b.g,(gN.get(b.g)||0)+1)));
const gS=[...gN.entries()].sort((a,b)=>b[1]-a[1]);
console.log('');
console.log('설명 갈래 : '+gS.length+'종');
console.log('  '+gS.map(([g,n])=>g+'('+n+')').join('  '));
const gOnce=gS.filter(([,n])=>n===1).length;
if(gOnce>6) console.log('  한 번만 쓰인 이름이 '+gOnce+'개다. 합칠 자리가 없는지 본다');

/* 번호 없는 대화 복습은 문장 검사와 별도로 대응·단어 출처를 확인한다. */
eval(fs.readFileSync(dir+'dialogues.js','utf8'));
const plain=t=>t.replace(/\{([^|{}]+)\|([^|{}]+)\}/g,'$1');
/* 「行きます」가 「行きません」으로, 「並びます」가 「並んでいます」로 나온다.
   활용하는 꼬리를 떼고 어간으로 찾는다. 한자가 있으면 뒤의 가나까지 떼어 낸다 */
const stemOf=t=>{
  let w=plain(t).replace(/(い|な|です|ます)$/,'');
  if(/[一-鿿々]/.test(w)) w=w.replace(/[ぁ-ん]+$/,'');
  return w||plain(t);
};
const RIDS=Object.keys(window.DIALOGUES);
if(!RIDS.length) err.push('대화 복습이 하나도 없음');
RIDS.forEach(id=>{
  const D=window.DIALOGUES[id], CH=D&&D.chapters;
  if(!CH||!CH.length){ err.push(id+'  장(chapters)이 없음'); return; }
  if(!D.nav) err.push(id+'  목록에 쓸 이름(nav)이 없음');
  const turns=CH.reduce((all,c)=>all.concat(c.turns),[]);
  if(turns.length<40) err.push(id+'  발화가 40개보다 적다 — 배운 것을 회수하기 어렵다');
  /* 단어장은 장마다 따로 두되, 한 복습 안에서 같은 말을 또 싣지 않는다.
     복습끼리는 겹쳐도 된다 — 열 단계 뒤에 다시 짚어 주는 편이 낫다 */
  const used=new Set();
  let nw=0, ne=0, nc=0;
  CH.forEach((c,ci)=>{
    const tag=id+`-#${ci+1}`;
    if(!c.title||!c.scene) err.push(`${tag}  장 제목이나 상황 누락`);
    if(c.turns.length<6) err.push(`${tag}  한 장의 발화가 6개보다 적다`);
    (c.cast||[]).forEach(k=>{ if(!D.speakers[k]) err.push(`${tag}  이름 없는 화자: ${k}`); });
    c.turns.forEach((t,i)=>{
      if(!D.speakers[t.who]||!t.jp||!t.ko) err.push(`${tag}-${i+1}  화자·일본어·번역 누락`);
      if(c.cast&&!c.cast.includes(t.who)) err.push(`${tag}-${i+1}  장의 인물 소개에 없는 화자: ${t.who}`);
    });
    const jp=c.turns.map(t=>plain(t.jp)).join('');
    if(!c.glossary||!c.glossary.length) err.push(`${tag}  단어장이 없음`);
    (c.glossary||[]).forEach(g=>{
      const w=W[g.key];
      if(!w){ err.push(`${tag}  사전에 없는 단어 키: ${g.key}`); return; }
      if(!jp.includes(stemOf(w.t))) err.push(`${tag}  이 장에 없는 단어: ${g.key} (${plain(w.t)})`);
      if(used.has(g.key)) err.push(`${id}  단어 중복: ${g.key}`);
      if(!g.meaning||!g.note) err.push(`${tag}  단어 설명 누락: ${g.key}`);
      used.add(g.key); nw++;
    });
    (c.expressions||[]).forEach(x=>{
      if(!x.jp||!x.ko||!x.note) err.push(`${tag}  미리 보는 표현 설명 누락`);
      /* 미리 보는 표현도 대화에 실제로 나와야 한다. 설명만 남은 것을 한 번 놓쳤다 */
      if(!jp.includes(stemOf(x.jp))) err.push(`${tag}  이 장에 없는 표현: ${plain(x.jp)}`);
      ne++;
    });
    (c.culture||[]).forEach(x=>{
      if(!x.text||!x.source||!/^https:\/\//.test(x.url)) err.push(`${tag}  예절·문화 설명이나 출처 누락`);
      nc++;
    });
  });
  if(!nc) err.push(id+'  예절·문화 메모가 하나도 없음');
  console.log(id+' 대화 : '+CH.length+'장 · '+turns.length+'발화 · '
    +nw+'단어 · '+ne+'미리 보는 표현 · '+nc+'문화 메모');
});

console.log(err.length?'\n[문제]\n'+err.join('\n'):'\n문제 없음');
