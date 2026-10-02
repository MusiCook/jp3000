/* 대화 복습(R1·R2·R3)을 끼워 넣어도 기존 단계 번호와 수동 진도 코드가
   유지되는지, 화면이 장별로 접히는지 확인한다. */
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','src','trainer.html'),'utf8');
const ORD="const RSTG=[";
const order=html.slice(html.indexOf(ORD),html.indexOf('const $=',html.indexOf(ORD)));
const codes=html.slice(html.indexOf('function encDone('),html.indexOf('function renderStat('));
assert(order.startsWith(ORD)&&codes.startsWith('function encDone('),'실제 앱 코드를 찾지 못했습니다');

const ctx={ST:{v:3,lv:5,pg:0,view:'R1',done:{1:{5:[1,2]},2:{},3:{}},
  bm:{5:7},star:{5:1},r:{5:2},read:{R1:1,R3:1}},SENT:{5:{s:[{},{}]}}};
vm.createContext(ctx);
vm.runInContext(order+codes,ctx);
const RSTG=vm.runInContext('RSTG',ctx);
assert.ok(RSTG.length>=3,'R1·R2·R3 세 자리가 있어야 한다');

/* 목록 순서 — 복습은 정해진 단계 뒤에 하나씩 끼워진다 */
assert.equal(vm.runInContext('activeStage()',ctx),'R1');
RSTG.forEach(([id,after])=>{
  assert.equal(vm.runInContext(`nextStage(${after})`,ctx),id,`${after}단계 뒤는 ${id}`);
  assert.equal(vm.runInContext(`nextStage('${id}')`,ctx),after+1,`${id} 뒤는 ${after+1}단계`);
  assert.equal(vm.runInContext(`rLv('${id}')`,ctx),after);
  assert.equal(vm.runInContext(`rOf(${after})`,ctx),id);
});
/* 복습이 없는 자리는 그대로 다음 번호로 간다 */
const plain=[1,2,3,4,6,7,8,9,11,12,13,14,16].filter(n=>!RSTG.some(([,a])=>a===n));
plain.forEach(n=>assert.equal(vm.runInContext(`nextStage(${n})`,ctx),n+1,
  `${n}단계 뒤에는 복습이 없다`));
assert.equal(vm.runInContext('NAV_ORDER.length',ctx),61+RSTG.length);
assert.equal(vm.runInContext('NAV_ORDER[NAV_ORDER.length-1]',ctx),60,'마지막은 60단계다');

/* 진도 코드 — 읽은 복습을 쉼표로 잇는다 */
const code=vm.runInContext('encST()',ctx);
assert.equal(code.split('|')[1],'5','복습 화면에서도 기존 단계 번호를 내보낸다');
assert.equal(code.split('|')[8],'R1,R3','읽은 것만, 표 순서대로');
ctx.code=code;
const decoded=vm.runInContext('decST(code)',ctx);
assert.deepEqual(Object.keys(decoded.read).sort(),['R1','R3']);
assert.deepEqual(Array.from(decoded.done[1][5]),[1,2]);
assert.equal(decoded.star[5],1);
assert.equal(decoded.view,undefined);

/* 옛 코드도 읽는다 — 한 칸짜리 'R1' 과 아예 없는 칸 */
ctx.code=code.split('|').slice(0,8).concat('R1').join('|');
assert.deepEqual(Object.keys(vm.runInContext('decST(code)',ctx).read),['R1'],
  '한 칸짜리 R1 도 읽는다');
ctx.code=code.split('|').slice(0,8).join('|');
const old=vm.runInContext('decST(code)',ctx);
assert.deepEqual(Object.keys(old.read),[],'기존 J3 코드도 읽는다');
assert.deepEqual(Array.from(old.done[1][5]),[1,2]);
/* 모르는 이름은 받지 않는다 */
ctx.code=code.split('|').slice(0,8).concat('R9,나쁜값').join('|');
assert.deepEqual(Object.keys(vm.runInContext('decST(code)',ctx).read),[]);

/* 장을 여닫는 동작은 가짜 DOM 으로 흉내 낼 수 없다. 코드가 있는지만 본다 */
assert.ok(/addEventListener\('toggle'[\s\S]{0,400}dchapsec[\s\S]{0,300}o\.open=false/.test(html),
  '장 하나를 열면 나머지를 닫는 코드가 없다');
assert.ok(html.includes("list.addEventListener('toggle'")&&/},true\);/.test(html),
  'toggle 은 버블링하지 않으므로 캡처로 받아야 한다');
/* 펼친 장은 **제목**을 기준으로 세운다. 머리띠 높이를 재서 비켜 세우는지 본다 */
assert.ok(/getBoundingClientRect\(\)\.top[\s\S]{0,120}offsetHeight/.test(html)
  &&/window\.scrollTo\(\{top:Math\.max\(0,y\)\}\)/.test(html),
  '장을 열 때 제목을 머리띠 아래로 세우는 코드가 없다');
assert.ok(!/d\.scrollIntoView\(/.test(html),
  '장을 통째로 화면에 넣으면(scrollIntoView) 긴 장에서 제목이 밀려난다');

/* ── 화면 ──────────────────────────────── */
const render=html.slice(html.indexOf('function paintDialogue(){'),html.indexOf('function buildKana(){'));
assert(render.startsWith('function paintDialogue(){'),'대화 화면 코드를 찾지 못했습니다');
const elements={};
ctx.$=sel=>elements[sel]||(elements[sel]={textContent:'',style:{},setAttribute(){}});
ctx.document={querySelectorAll:()=>[]};
ctx.list={innerHTML:''};
ctx.ICO={sp:'<svg></svg>'};
ctx.esc=x=>String(x).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
ctx.ruby=ctx.esc;
ctx.paintRv=()=>{};
ctx.window=ctx;
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','words.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src','dialogues.js'),'utf8'),ctx);
vm.runInContext(render,ctx);
const esc=ctx.esc;

RSTG.forEach(([id,after])=>{
  /* 한 복습 안에서는 같은 말을 두 번 싣지 않는다. 복습끼리는 겹쳐도 된다 —
     R1 과 R3 사이에는 열 단계가 있고, 그때 다시 짚어 주는 편이 낫다 */
  const used=new Set();
  const d=ctx.window.DIALOGUES[id];
  assert.ok(d,id+' 대화 데이터가 없다');
  assert.ok(d.nav,id+' 의 목록 이름(nav)이 없다');
  ctx.ST.view=id; ctx.ST.lv=after;
  vm.runInContext('buildDialogue()',ctx);
  const page=ctx.list.innerHTML;
  const total=d.chapters.reduce((n,c)=>n+c.turns.length,0);

  assert.equal(elements['#stg'].textContent,id);
  assert.ok(d.chapters.length>=2,id+' 은 여러 장으로 나눈다');
  assert.ok(total>=40,id+' 발화가 모자라다 — 배운 것을 회수하기 어렵다');
  assert.ok(page.includes(`>${after+1}단계로 가기<`),id+' 의 다음 단계 단추가 틀렸다');
  assert.equal((page.match(/<div class="dturn">/g)||[]).length,total);

  /* 뜻은 발화 안에 접힌 채로 하나씩 들어 있다 — 따로 모아 두지 않는다 */
  assert.equal((page.match(/<div class="dko" lang="ko">/g)||[]).length,total);
  assert.ok(!page.includes('한국어 번역'),'번역을 따로 모은 접기는 없앴다');
  assert.equal((page.match(/aria-expanded="false"/g)||[]).length,total,
    '모든 뜻은 접힌 채로 시작한다');

  /* 장 하나가 통째로 접힌다. 열려 있는 채로 그려지는 장이 없어야 한다 */
  assert.equal((page.match(/<details class="dchapsec">/g)||[]).length,d.chapters.length,
    '장마다 접기 카드 하나');
  assert.ok(!/<details[^>]*open/.test(page),'모든 접기는 닫힌 채로 시작한다');

  /* 뜻과 단어장은 그 장 안에 있다 — 장 카드 바깥에는 남지 않는다 */
  const secs=page.split('<details class="dchapsec">').slice(1);
  assert.equal(secs.length,d.chapters.length);
  secs.forEach((sec,i)=>{
    const c=d.chapters[i], tag=`${id}-#${i+1}`;
    const body=sec.split('<div class="dactions">')[0];
    assert.ok(body.includes(esc(c.title)),tag+' 장 제목이 없다');
    assert.ok(body.includes(esc(c.scene)),tag+' 장 상황이 없다');
    assert.ok(body.includes(esc(c.turns[0].ko)),tag+' 뜻이 그 장 안에 없다');
    assert.equal((body.match(/<div class="dko" lang="ko">/g)||[]).length,c.turns.length,
      tag+' 발화마다 뜻이 하나씩 붙어야 한다');
    assert.ok(body.includes('단어·표현'),tag+' 장 안에 단어 접기가 있어야 한다');
    assert.equal((body.match(/<div class="dturn">/g)||[]).length,c.turns.length,
      tag+' 발화 수가 다르다');
    (c.glossary||[]).forEach(g=>{
      assert.ok(ctx.WORDS[g.key],'사전에 없는 단어 키: '+g.key);
      assert.ok(body.includes(esc(g.meaning)),`${tag} 단어장에 ${g.key} 가 없다`);
    });
  });

  /* 음성 단추 번호는 장을 넘어 0부터 통짜로 이어진다 */
  const nums=(page.match(/class="dspk" data-i="(\d+)"/g)||[]).map(m=>+m.match(/\d+/)[0]);
  assert.deepEqual(nums,Array.from({length:total},(x,i)=>i));
  assert.equal(vm.runInContext(`dialogueTurns(window.DIALOGUES.${id}).length`,ctx),total);
  const last=d.chapters[d.chapters.length-1].turns.slice(-1)[0].jp;
  assert.equal(vm.runInContext(`dialogueTurns(window.DIALOGUES.${id})[${total-1}].jp`,ctx),last,
    '납작한 배열의 끝은 마지막 장의 마지막 발화다');

  /* 단어장은 장마다 두되, 장을 건너뛰거나 복습을 건너뛰며 같은 말을 또 싣지 않는다 */
  d.chapters.forEach((c,i)=>{
    const tag=`${id}-#${i+1}`;
    const jp=c.turns.map(t=>t.jp).join('').replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1');
    assert.ok((c.glossary||[]).length,tag+' 단어장이 없다');
    c.glossary.forEach(g=>{
      assert.ok(!used.has(g.key),'단어장이 겹친다: '+g.key+' ('+tag+')');
      used.add(g.key);
      const w=ctx.WORDS[g.key].t.replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1');
      /* 「行きます」가 「行きません」으로 나온다. 활용하는 꼬리를 떼고 찾는다 */
      let stem=w.replace(/(い|な|です|ます)$/,'');
      if(/[一-鿿々]/.test(stem)) stem=stem.replace(/[ぁ-ん]+$/,'');
      assert.ok(jp.includes(stem||w),`${tag} 에 나오지 않는 단어: ${g.key} (${w})`);
    });
  });

  /* 장마다 나오는 인물만 소개한다 */
  d.chapters.forEach((c,i)=>{
    c.turns.forEach(t=>assert.ok((c.cast||[]).includes(t.who),
      `${id}-#${i+1} 장의 인물 소개에 없는 화자: `+t.who));
    (c.cast||[]).forEach(k=>assert.ok(d.speakers[k],id+' 이름 없는 화자: '+k));
  });
  assert.ok(!page.includes('class="msk"')&&!page.includes('class="crown"'));
});

console.log('대화 복습 '+RSTG.map(([id])=>id).join('·')+
  ' — 장별 접기, 발화별 뜻, 단어장, 진도 코드와 단계 이동 확인 완료');
