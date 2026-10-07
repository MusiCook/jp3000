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
  /* quiz.js 의 const 는 vm 안에서 전역 속성이 되지 않는다 (function 만 된다).
     손으로 적어 둔 보기 표를 꺼내 두어야 「사람이 쓴 말」로 셀 수 있다 */
  ctx.KO_FIXED_ALTS = vm.runInContext(
    'typeof KO_FIXED_ALTS!=="undefined"?KO_FIXED_ALTS:{}', box);
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

  /* 어미 칸 분류기 자체를 먼저 본다. 분류가 틀리면 보기도 검사도 같이 틀려
     아무것도 걸리지 않는다 — 「맛있습니까」가 과거로 분류되어 실제로 그랬다 */
  const FORMS = [
    ['맛있습니까','현재의문'], ['있습니다','현재평서'], ['없습니다','현재평서'],
    ['재미있습니다','현재평서'], ['있었습니다','과거평서'], ['맛있었습니까','과거의문'],
    ['즐거웠습니다','과거평서'], ['했습니다','과거평서'], ['갔습니다','과거평서'],
    ['바빴습니다','과거평서'], ['합니까','현재의문'], ['먹으니까','기타']
  ];
  FORMS.forEach(([w,want])=>{ const got=ctx.koForm(w);
    if(got!==want) found.push({where:'koForm', kind:'분류기 오류',
      detail:'「'+w+'」를 '+got+'(으)로 본다. '+want+'이어야 한다', opts:[]}); });
  /* 사람이 쓴 한국어 — 문장의 서술 표면형과, 손으로 적어 둔 보기.
     이 밖의 말이 보기로 나오면 코드가 활용형을 만들어 냈다는 뜻이다 */
  const REAL = new Set(), BOX = {};
  for(const lv in SENT){
    if(+lv === ctx.RV) continue;
    SENT[lv].s.forEach(s=>{
      chunkKO(s.k).forEach(c=>{
        if(c.plain||!/^[cva]$/.test(c.toks[0][1])) return;
        const t=c.toks.map(x=>x[0]).join('').trim();
        if(!t) return;
        REAL.add(t);
        const k=ctx.koForm(t)+'|'+c.toks[0][1];
        (BOX[k]=BOX[k]||new Set()).add(t);
      });
      if(s.q&&s.q.k) Object.keys(s.q.k).forEach(a=>
        [].concat(s.q.k[a]).forEach(v=>REAL.add(String(v).trim())));
    });
  }
  Object.keys(ctx.KO_FIXED_ALTS||{}).forEach(a=>
    ctx.KO_FIXED_ALTS[a].forEach(v=>REAL.add(String(v).trim())));
  const note = (where, kind, detail, opts) => found.push({where, kind, detail, opts});

  for(const lv in SENT){
    if(+lv === ctx.RV) continue;                 /* 복습 단계는 건너뛴다 */
    SENT[lv].s.forEach(s=>{
      const sid = lv+'-'+s.n;

      /* 일본어를 묻는 자리 */
      chunkJP(s.j).forEach((c,ci)=>{
        if(!c.w) return;
        try{
          const q = quizOpts('j', {ans:c.ids.join('|'), sent:s, seed:seedOf(sid+'-j'+ci)});
          check(sid+' 일본어', q, 'j');
        }catch(e){ note(sid+' 일본어', '터짐', e.message, []); }
      });

      /* 뜻을 묻는 자리 */
      chunkKO(s.k).forEach((c,ci)=>{
        if(c.plain) return;
        try{
          const q = quizOpts('k', {ci, sent:s, seed:seedOf(sid+'-k'+ci)});
          /* 뒤에 조사가 붙은 덩어리는 서술이 아니다. quiz.js 와 같게 센다 */
          let part=c.toks.slice(1).map(x=>x[0].trim()).join('');
          if(/^(까|요|네|죠|군요|는데요)$/.test(part)) part='';
          check(sid+' 뜻', q, 'k', c.toks[0][1], !part);
        }catch(e){ note(sid+' 뜻', '터짐', e.message, []); }
      });
    });
  }

  function check(where, q, type, pos, pred){
    const jp   = type==='j';
    const list = q.opts.map(o=> jp ? bare(o.html) : o.v);
    const face = q.opts.map(o=> jp ? kanji(o.html) : o.v);

    /* 「~ないです」는 형용사의 く꼴 뒤에만 온다. 田中ないです · 机なかったです */
    if(jp) q.opts.forEach((o,i)=>{
      const id=String(o.v).split('|'), at=id.findIndex(x=>/^(naidesu|nakattadesu)$/.test(x));
      if(at<1) return;
      const h=WORDS[id[at-1]], ht=h?String(h.t).replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1'):'';
      if(!h||h.p!=='a'||!/く$/.test(ht))
        note(where,'있을 수 없는 말','「'+list[i]+'」 — ないです 앞이 형용사 く꼴이 아니다',list);
    });

    /* 겹치는 보기. 일본어는 후리가나를 빼고 견준다.
       똑같은 것뿐 아니라 何 / 何か 처럼 거의 같아 보이는 것도 본다 */
    /* 다만 「十番」과 「十番の」처럼 조사만 다른 것은 걸러선 안 된다.
       조사가 붙는지를 묻는 것이 그 문제의 요지다 */
    const ids = q.opts.map(o=> jp ? String(o.v).split('|') : null);
    const partOnly=(i,k)=>{
      const a=ids[i], b=ids[k]; if(!a||!b) return false;
      const [x,y] = a.length<b.length ? [a,b] : [b,a];
      return x.length<y.length && x.every((t,n)=>y[n]===t);
    };
    const same=(i,k)=> face[i]===face[k] ||
      (jp && typeof ctx.alike==='function' && ctx.alike(face[i],face[k]) && !partOnly(i,k));
    face.forEach((t,i)=>{ for(let k=0;k<i;k++) if(same(i,k)){
        note(where, jp?'겉모습이 같은 보기':'겹치는 보기',
             '「'+face[k]+'」와 「'+t+'」', list); break; } });

    if(list.length < 4) note(where,'보기 부족', list.length+'개뿐', list);

    list.forEach(t=>{
      if(jp){
        if(IMPOSS.test(t)) note(where,'있을 수 없는 말','「'+t+'」 — 서술 뒤에 격조사',list);
        /* 형용사 활용형 뒤의 です. 難しくです · 暇なです · 暑かったですです */
        if(/(く|な)です(か)?$|ですです/.test(t))
          note(where,'있을 수 없는 말','「'+t+'」 — 활용형 뒤에 です',list);
        return;
      }
      for(const [re,why] of BADKO)
        if(re.test(t)) return note(where,'이상한 말','「'+t+'」 — '+why,list);
      /* 「그 ~」 같은 사전 표기는 한국어가 아니다. 정답이 그런 꼴이
         아닌 한 보기로 나와서는 안 된다 */
      if(/~/.test(t) && !/~/.test(String(q.ans)))
        note(where,'사전 표기가 남았다','「'+t+'」 — 물결표',list);
      if(cutWord(t) && !cutWord(String(q.ans)))
        note(where,'잘린 말','「'+t+'」 — 어미가 끊겼다',list);
    });

    /* 서술 자리의 보기는 넷의 **어미가 같은 칸**이어야 한다.
       어미가 섞이면 (즐겁습니다 / 즐겁었습니다) 어미만 보고 고를 수 있고,
       무엇보다 만들어 낸 활용형은 거의 틀린 말이다. 그래서 서술 보기는
       문장에 사람이 써 놓은 표면형이어야 한다 — 그것도 여기서 본다 */
    if(!jp && pred && /^[cva]$/.test(String(pos)) && typeof ctx.koForm==='function'){
      const box=ctx.koForm(q.ans);
      /* 그 칸에 정답 말고 셋이 더 있으면 어미를 고정할 수 있었다는 뜻이다.
         「주세요」처럼 문장 전체에 같은 꼴이 둘뿐인 칸은 빌려 올 수밖에 없다 */
      const enough=(BOX[box+'|'+pos]||new Set()).size>=4;
      list.forEach(t=>{
        if(ctx.koForm(t)!==box){
          if(enough) note(where,'어미가 다른 보기',
            '「'+t+'」 — 정답 「'+q.ans+'」는 '+box+' 칸이고 재료도 있다',list);
        }else if(!REAL.has(t))
          note(where,'문장에 없는 꼴','「'+t+'」 — 만들어 낸 활용형으로 보인다',list);
      });
    }

    /* 정답과 뜻이 같은 보기는 그것도 맞는 답이 된다.
       명사 자리에서만 본다. 서술 자리의 「있습니다 / 있습니까」는
       어미가 다르므로 뜻도 다르고, 그것이 물어야 할 바다 */
    if(!jp && q.jkey && pos==='n' && typeof ctx.koSyn==='function' && typeof ctx.kNorm==='function'){
      const syn = ctx.koSyn(q.jkey).map(x=>ctx.kNorm(x));
      q.opts.forEach(o=>{ if(o.v===q.ans) return;
        if(syn.indexOf(ctx.kNorm(o.v))>=0)
          note(where,'정답과 뜻이 같은 보기','「'+o.v+'」 — 정답 「'+q.ans+'」와 같은 뜻',list); });
    }

    /* 넷 중 셋 이상이 같은 앞말이고, **다른 것이 조사뿐**이면
       낱말을 묻지 못한다. 뒤의 조사만 보고 고를 수 있기 때문이다.
       (受付は / 受付も / 受付の — 受付 를 몰라도 맞힌다)

       수사+조수사는 걸러선 안 된다. 五個 / 五枚 / 五番 은 앞말이 같아도
       **변하는 쪽(조수사)이 바로 묻고 싶은 내용**이라 문제가 성립한다.
       조사는 p='p', 조수사는 p='n' 이라 품사로 갈린다 */
    const KOJOSA=/(은|는|이|가|을|를|의|도|와|과|에서|에|까지|부터|으로|로|\s*것)$/;
    const headOf = (o,i) => jp ? String(o.v).split('|')[0]
                               : String(o.v).replace(KOJOSA,'').trim();
    if(q.ans!=null && q.opts.length>=4){
      const ah = jp ? String(q.ans).split('|')[0]
                    : String(q.ans).replace(KOJOSA,'').trim();
      const hit = q.opts.filter(o=>headOf(o)===ah);
      /* 같은 앞말을 쓴 보기들의 꼬리가 모두 조사인가 */
      const onlyJosa = !jp || hit.every(o=>{
        const t=String(o.v).split('|').slice(1);
        return t.length>0 && t.every(k=>WORDS[k]&&WORDS[k].p==='p');
      });
      if(hit.length>=3 && onlyJosa)
        note(where,'같은 앞말이 셋 이상',
             '「'+ah+'」가 '+hit.length+'개 — 조사만 보고 고를 수 있다', list);
    }

    /* 평서문 자리에 의문사를 내놓으면, 뜻을 몰라도 말이 안 되는 쪽을
       지워 맞힐 수 있다. 정답이 의문사면 그때는 그대로 둔다 */
    const ASKKO=/^(누구|어느|무엇|어디|언제|얼마|몇|어떤|어떻)/;
    const askOf = v => jp
      ? (()=>{ const k=String(v).split('|')[0], w=WORDS[k];
               return !!(w&&w.m&&w.m.split(',').some(x=>ASKKO.test(x.trim()))); })()
      : ASKKO.test(String(v).trim());
    if(q.ans!=null && !askOf(q.ans)){
      const bad=q.opts.filter(o=>o.v!==q.ans&&askOf(o.v));
      if(bad.length) note(where,'평서문에 의문사 보기',
        bad.map(o=>'「'+o.v+'」').join(' ')+' — 말이 안 돼 지워진다', list);
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
      const q = ctx.quizOpts('j',{ans:c.ids.join('|'), sent:s, seed:ctx.seedOf(one+'-j'+ci)});
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
