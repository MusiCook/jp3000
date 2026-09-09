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

console.log(err.length?'\n[문제]\n'+err.join('\n'):'\n문제 없음');
