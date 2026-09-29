/* R1을 끼워 넣어도 기존 단계 번호와 수동 진도 코드가 유지되는지 확인한다. */
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','src','trainer.html'),'utf8');
const order=html.slice(html.indexOf("const R1='R1';"),html.indexOf('const $=',html.indexOf("const R1='R1';")));
const codes=html.slice(html.indexOf('function encDone('),html.indexOf('function renderStat('));
assert(order.startsWith("const R1='R1';")&&codes.startsWith('function encDone('),'실제 앱 코드를 찾지 못했습니다');

const ctx={ST:{v:3,lv:5,pg:0,view:'R1',done:{1:{5:[1,2]},2:{},3:{}},bm:{5:7},star:{5:1},r:{5:2},read:{R1:1}},SENT:{5:{s:[{},{}]}}};
vm.createContext(ctx);
vm.runInContext(order+codes,ctx);
assert.equal(vm.runInContext('activeStage()',ctx),'R1');
assert.equal(vm.runInContext('nextStage(5)',ctx),'R1');
assert.equal(vm.runInContext("nextStage('R1')",ctx),6);
assert.equal(vm.runInContext('nextStage(10)',ctx),11,'10단계 뒤 복습은 아직 없다');

const code=vm.runInContext('encST()',ctx);
assert.equal(code.split('|')[1],'5','복습 화면에서도 기존 단계 번호를 내보낸다');
assert.equal(code.split('|')[8],'R1');
ctx.code=code;
const decoded=vm.runInContext('decST(code)',ctx);
assert.equal(decoded.read.R1,1);
assert.deepEqual(Array.from(decoded.done[1][5]),[1,2]);
assert.equal(decoded.star[5],1);
assert.equal(decoded.view,undefined);

ctx.code=code.split('|').slice(0,8).join('|');
const old=vm.runInContext('decST(code)',ctx);
assert.deepEqual(Object.keys(old.read),[],'기존 J3 코드도 읽는다');
assert.deepEqual(Array.from(old.done[1][5]),[1,2]);

const render=html.slice(html.indexOf('function paintDialogue(){'),html.indexOf('function buildKana(){'));
assert(render.startsWith('function paintDialogue(){'),'R1 화면 코드를 찾지 못했습니다');
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
vm.runInContext('buildDialogue()',ctx);
const page=ctx.list.innerHTML;
const d=ctx.window.DIALOGUES.R1;
const total=d.chapters.reduce((n,c)=>n+c.turns.length,0);
assert.equal(elements['#stg'].textContent,'R1');
assert.ok(d.chapters.length>=2,'R1은 여러 장으로 나눈다');
assert.ok(total>=40,'다섯 단계를 회수하려면 발화가 넉넉해야 한다');
assert.equal((page.match(/<div class="dturn">/g)||[]).length,total);
assert.equal((page.match(/<div class="dturn dko">/g)||[]).length,total);
assert.equal((page.match(/class="dchap"/g)||[]).length,d.chapters.length,'장마다 제목과 상황을 낸다');
assert.equal((page.match(/class="dchapko"/g)||[]).length,d.chapters.length,'번역도 같은 장 순서로 낸다');
/* 음성 단추 번호는 장을 넘어 0부터 통짜로 이어진다 */
const ids=(page.match(/class="dspk" data-i="(\d+)"/g)||[]).map(m=>+m.match(/\d+/)[0]);
assert.deepEqual(ids,Array.from({length:total},(x,i)=>i));
assert.equal(vm.runInContext('dialogueTurns(window.DIALOGUES.R1).length',ctx),total);
assert.equal(vm.runInContext('dialogueTurns(window.DIALOGUES.R1)['+(total-1)+'].jp',ctx),
  d.chapters[d.chapters.length-1].turns[d.chapters[d.chapters.length-1].turns.length-1].jp,
  '납작한 배열의 끝은 마지막 장의 마지막 발화다');
assert.equal((page.match(/<details class="dsec">/g)||[]).length,2,'두 접기는 기본 닫힘');
/* 단어장은 사전에 있는 키로만 만들고, 실제로 대화에 나온 말만 싣는다 */
const plain=d.chapters.map(c=>c.turns.map(t=>t.jp).join('')).join('')
  .replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1');
const dup=new Set();
d.glossary.forEach(g=>{
  assert.ok(ctx.WORDS[g.key],'사전에 없는 단어 키: '+g.key);
  assert.ok(!dup.has(g.key),'단어장이 겹친다: '+g.key); dup.add(g.key);
  const w=ctx.WORDS[g.key].t.replace(/\{([^|{}]+)\|[^|{}]+\}/g,'$1');
  const stem=w.replace(/(い|な|です)$/,'');
  assert.ok(plain.includes(stem),'대화에 나오지 않는 단어: '+g.key+' ('+w+')');
});
/* 장마다 나오는 인물만 소개한다 */
d.chapters.forEach(c=>c.turns.forEach(t=>assert.ok((c.cast||[]).includes(t.who),'장의 인물 소개에 없는 화자: '+t.who)));
d.chapters.forEach(c=>(c.cast||[]).forEach(k=>assert.ok(d.speakers[k],'이름 없는 화자: '+k)));
assert.ok(page.indexOf('일본어 대화')<page.indexOf('한국어 번역'));
assert.ok(page.indexOf('한국어 번역')<page.indexOf('대화 속 단어·표현'));
assert.ok(!page.includes('class="msk"')&&!page.includes('class="crown"'));
console.log('R1 화면 순서, 접기, 진도 코드와 단계 이동 확인 완료');
