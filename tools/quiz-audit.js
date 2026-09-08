/*
 * quiz-audit.js — 퀴즈 보기가 멀쩡한지 문장 전체를 훑는다
 *
 *     node tools/quiz-audit.js            문제만 간추려 본다
 *     node tools/quiz-audit.js --all      찾은 것을 모두 늘어놓는다
 *     node tools/quiz-audit.js 1-24       그 문장의 보기를 직접 본다
 *
 * src 를 그대로 브라우저 없이 돌린다. 화면 코드는 가짜 DOM 으로 받아
 * 넘기고, 보기를 만드는 quiz.js 만 진짜로 쓴다.
 *
 * 보기를 손대면 이것을 돌린다. 사람이 3,000문장을 눈으로 볼 수 없다.
 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = path.join(__dirname, '..', 'src');

/* ── src 를 build.py 와 같은 차례로 이어 붙인다 ───────────── */
function load(){
  const html = fs.readFileSync(path.join(SRC,'trainer.html'),'utf8');
  const parts = [];
  html.replace(/<script src="([^"]+)"><\/script>|<script>([\s\S]*?)<\/script>/g,
    (m,file,inline)=>{ parts.push(file ? fs.readFileSync(path.join(SRC,file),'utf8') : inline); return m; });
  return parts;
}

/* 무엇을 물어도 자기를 돌려주는 가짜 DOM.
   화면 코드가 뭘 하든 조용히 받아 넘기려는 것이다 */
const mk = () => new Proxy(function(){}, {
  get:(t,k)=>{ if(k===Symbol.toPrimitive||k==='toString') return ()=>'';
               if(k===Symbol.iterator) return function*(){};
               if(k==='length') return 0;
               return mk(); },
  set:()=>true, apply:()=>mk(), has:()=>true
});

function boot(){
  const ctx = { console, JSON, Math, Object, Array, String, Number, Set, Map, Date, RegExp,
    isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout:()=>0, clearTimeout:()=>{}, requestAnimationFrame:()=>0,
    document:mk(), navigator:{userAgent:'',language:'ko'},
    location:{protocol:'https:',hash:'',pathname:'/',search:''},
    localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
    history:{replaceState:()=>{}}, matchMedia:()=>({matches:false,addEventListener:()=>{}}),
    speechSynthesis:{getVoices:()=>[]}, fetch:()=>Promise.reject(),
    addEventListener:()=>{}, scrollTo:()=>{} };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  /* id 로 저절로 생기는 전역(nav·qpop …)까지 받아 준다 */
  const box = new Proxy(ctx, { has:()=>true,
    get:(t,k)=> (k in t) ? t[k] : (typeof k==='string' ? mk() : undefined),
    set:(t,k,v)=>{ t[k]=v; return true; } });
  vm.createContext(box);
  /* 화면을 그리는 마지막 대목은 가짜 DOM 에서 멈춘다. 그 전에 필요한
     것은 모두 만들어져 있으므로 그대로 둔다 */
  load().forEach(src=>{ try{ vm.runInContext(src, box); }catch(e){} });
  if(typeof ctx.quizOpts !== 'function') throw new Error('quizOpts 를 찾지 못했습니다');
  return ctx;
}

/* ── 무엇을 잘못이라 볼 것인가 ───────────────────────────── */

/* 어미가 겹쳐 말이 안 되는 꼴. 실례하겠겠습니다 / 먹었었습니다 … */
const BADKO = [
  [/겠겠|았았|었었|겠었|었겠|았겠|겠았/,          '어미가 겹쳤다'],
  [/겠을 겁니다|았을 겁니다|었을 겁니다/,          '어미 뒤에 다시 미래'],
  [/겠었|겠습니다.+겠/,                            '어미가 겹쳤다'],
  [/지 않[^ ]*\s*지 않/,                           '부정이 두 번'],
  [/습니습니|입니입니/,                            '어미가 겹쳤다'],
  [/^\s|\s$/,                                      '앞뒤에 빈칸']
];

/* 화면에 보이는 글자 그대로 (후리가나 포함) */
const bare  = t => String(t).replace(/<[^>]*>/g,'').replace(/\s+/g,'');
/* 후리가나를 뺀 겉모습. 何(なん) 과 何(なに) 는 눈으로 구별되지 않는다 */
const kanji = t => bare(String(t).replace(/<rt>[\s\S]*?<\/rt>/g,''));

/* 서술 뒤에 격조사가 붙는 일은 없다. ですは / ですの …
   から·が 는 서술 뒤에 정상이다. 食べますから(먹을 거니까) / ますが(~지만) */
const IMPOSS = /(です|ます|ました|ません|でした)(は|を|に|へ|の|も|まで|より)$/;

/* 어미가 잘린 말. 됩니 / 있었습니 … (어머니·언니는 걸리지 않는다) */
function cutWord(v){
  const w=String(v).trim();
  if(/(습니|시겠|하겠)$/.test(w)) return true;
  if(!/니$/.test(w)||w.length<2) return false;
  const c=w.charCodeAt(w.length-2);
  return (c>=0xAC00&&c<=0xD7A3) && ((c-0xAC00)%28)===17;
}

function audit(ctx){
  const {WORDS, SENT, chunkJP, chunkKO, seedOf, quizOpts} = ctx;
  const found = [];
  const note = (where, kind, detail, opts) => found.push({where, kind, detail, opts});

  for(const lv in SENT){
    if(+lv === ctx.RV) continue;                 /* 복습 단계는 건너뛴다 */
    SENT[lv].s.forEach(s=>{
      const sid = lv+'-'+s.n;

      /* 일본어를 묻는 자리 */
      chunkJP(s.j).forEach((c,ci)=>{
        if(!c.w) return;
        try{
          const q = quizOpts('j', {ans:c.ids.join('|'), seed:seedOf(sid+'-j'+ci)});
          check(sid+' 일본어', q, 'j');
        }catch(e){ note(sid+' 일본어', '터짐', e.message, []); }
      });

      /* 뜻을 묻는 자리 */
      chunkKO(s.k).forEach((c,ci)=>{
        if(c.plain) return;
        try{
          const q = quizOpts('k', {ci, sent:s, seed:seedOf(sid+'-k'+ci)});
          check(sid+' 뜻', q, 'k', c.toks[0][1]);
        }catch(e){ note(sid+' 뜻', '터짐', e.message, []); }
      });
    });
  }

  function check(where, q, type, pos){
    const jp   = type==='j';
    const list = q.opts.map(o=> jp ? bare(o.html) : o.v);
    const face = q.opts.map(o=> jp ? kanji(o.html) : o.v);

    /* 겹치는 보기. 일본어는 후리가나를 빼고 견준다 */
    const seen={};
    face.forEach((t,i)=>{ if(seen[t]!==undefined)
        note(where, jp?'겉모습이 같은 보기':'겹치는 보기','「'+t+'」가 둘',list);
      seen[t]=i; });

    if(list.length < 4) note(where,'보기 부족', list.length+'개뿐', list);

    list.forEach(t=>{
      if(jp){
        if(IMPOSS.test(t)) note(where,'있을 수 없는 말','「'+t+'」 — 서술 뒤에 격조사',list);
        return;
      }
      for(const [re,why] of BADKO)
        if(re.test(t)) return note(where,'이상한 말','「'+t+'」 — '+why,list);
      if(cutWord(t) && !cutWord(String(q.ans)))
        note(where,'잘린 말','「'+t+'」 — 어미가 끊겼다',list);
    });

    /* 정답과 뜻이 같은 보기는 그것도 맞는 답이 된다.
       명사 자리에서만 본다. 서술 자리의 「있습니다 / 있습니까」는
       어미가 다르므로 뜻도 다르고, 그것이 물어야 할 바다 */
    if(!jp && q.jkey && pos==='n' && typeof ctx.koSyn==='function' && typeof ctx.kNorm==='function'){
      const syn = ctx.koSyn(q.jkey).map(x=>ctx.kNorm(x));
      q.opts.forEach(o=>{ if(o.v===q.ans) return;
        if(syn.indexOf(ctx.kNorm(o.v))>=0)
          note(where,'정답과 뜻이 같은 보기','「'+o.v+'」 — 정답 「'+q.ans+'」와 같은 뜻',list); });
    }

    if(q.ans!=null && !q.opts.some(o=>o.v===q.ans))
      note(where,'정답 없음','정답 「'+q.ans+'」', list);
  }
  return found;
}

/* ── 내보내기 ──────────────────────────────────────────── */

function main(){
  const arg = process.argv.slice(2);
  const ctx = boot();

  const one = arg.find(a=>/^\d+-\d+$/.test(a));
  if(one){                                       /* 한 문장만 들여다본다 */
    const [lv,n] = one.split('-');
    const s = (ctx.SENT[lv]||{s:[]}).s.find(x=>x.n===+n);
    if(!s) return console.log('그런 문장이 없습니다: '+one);
    console.log(s.j.map(id=>(ctx.WORDS[id]||{t:id}).t).join(''));
    console.log(s.k.map(t=>t[0]).join('')+'\n');
    ctx.chunkKO(s.k).forEach((c,ci)=>{
      if(c.plain) return;
      const q = ctx.quizOpts('k',{ci, sent:s, seed:ctx.seedOf(one+'-k'+ci)});
      console.log('  뜻  정답 「'+q.ans+'」');
      q.opts.forEach(o=>console.log('        '+(o.v===q.ans?'○ ':'  ')+o.v));
    });
    ctx.chunkJP(s.j).forEach((c,ci)=>{
      if(!c.w) return;
      const q = ctx.quizOpts('j',{ans:c.ids.join('|'), seed:ctx.seedOf(one+'-j'+ci)});
      console.log('  일본어  정답 「'+bare(q.ans)+'」');
      q.opts.forEach(o=>console.log('        '+(o.v===q.ans?'○ ':'  ')+bare(o.html)));
    });
    return;
  }

  const found = audit(ctx);
  const byKind = {};
  found.forEach(f=>{ (byKind[f.kind]=byKind[f.kind]||[]).push(f); });

  console.log('퀴즈 보기 검사\n');
  const kinds = Object.keys(byKind);
  if(!kinds.length){ console.log('문제 없음'); return; }

  const all = arg.includes('--all');
  kinds.sort((a,b)=>byKind[b].length-byKind[a].length).forEach(k=>{
    const list = byKind[k];
    console.log(k+' : '+list.length+'건');
    list.slice(0, all?list.length:6).forEach(f=>{
      console.log('   '+f.where.padEnd(12)+f.detail);
      if(f.opts.length) console.log('      보기  '+f.opts.join('  |  '));
    });
    if(!all && list.length>6) console.log('   … 그 밖 '+(list.length-6)+'건 (--all 로 모두 본다)');
    console.log('');
  });
  console.log('모두 '+found.length+'건');
  process.exitCode = found.length ? 1 : 0;
}

main();
