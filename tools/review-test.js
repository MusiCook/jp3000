/* 오답노트의 오늘 진도와 20개씩 이어 풀기를 실제 화면 코드로 확인한다. */
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','src','trainer.html'),'utf8');
const start=html.indexOf('/* ── 오답노트 · 카드형 복습');
const end=html.indexOf('/* ── 단계 내비',start);
assert(start>=0&&end>start,'오답노트 코드를 찾지 못했습니다');
const source=html.slice(start,end);

function review(count,dueCount=count){
  const elements={};
  const el=id=>elements[id]||(elements[id]={textContent:'',style:{},onclick:null});
  const words={}, stats={};
  for(let i=1;i<=count;i++){
    words['k'+i]={t:'말 '+i,m:'뜻 '+i};
    stats['k'+i]={o:0,x:1,lv:0,due:i<=dueCount?0:Math.floor(Date.now()/86400000)+3};
  }
  const bar={style:{}};
  const list={innerHTML:'',dataset:{},querySelector:sel=>sel==='.rvbar i'?bar:null};
  const ctx={
    QSTAT:stats, WORDS:words, SENT:{}, list,
    $:el, document:{querySelectorAll:()=>[]}, saveStat:()=>{}, paintRv:()=>{},
    optsKO:()=>['뜻 1','뜻 2','뜻 3','뜻 4'], optsJP:k=>[k],
    esc:x=>String(x), ruby:x=>String(x), seedOf:()=>1,
    Date, Math, Object, String
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  return {ctx,el,bar,run:code=>vm.runInContext(code,ctx)};
}

const r=review(49);
r.run('startReview(); buildReview()');
assert.equal(r.el('#tot').textContent,49);
assert.match(r.ctx.list.innerHTML,/1 \/ 49/);

r.run('for(let i=0;i<20;i++) answerReview(true); buildReview()');
assert.equal(r.el('#cnt').textContent,20);
assert.match(r.ctx.list.innerHTML,/오늘 남은 29개/);
r.run('enterReview()');
assert.equal(r.el('#cnt').textContent,20,'다시 들어와도 진도가 초기화되지 않아야 한다');
r.el('#rvNext').onclick();
assert.match(r.ctx.list.innerHTML,/21 \/ 49/);

r.run('for(let i=0;i<20;i++) answerReview(true); buildReview()');
assert.match(r.ctx.list.innerHTML,/오늘 남은 9개/);
r.el('#rvNext').onclick();
assert.match(r.ctx.list.innerHTML,/41 \/ 49/);
r.run('for(let i=0;i<9;i++) answerReview(true); buildReview()');
assert.equal(r.el('#cnt').textContent,49);
assert.equal(r.el('#gauge').style.width,'100%');
assert.match(r.ctx.list.innerHTML,/오늘 복습을 마쳤습니다/);

const small=review(8);
small.run('startReview(); buildReview()');
assert.match(small.ctx.list.innerHTML,/1 \/ 8/);
small.run('for(let i=0;i<8;i++) answerReview(true); buildReview()');
assert.match(small.ctx.list.innerHTML,/오늘 복습을 마쳤습니다/);

const scheduled=review(49,20);
scheduled.run('startReview(); buildReview()');
assert.match(scheduled.ctx.list.innerHTML,/오늘 1 \/ 20/);
assert.match(scheduled.ctx.list.innerHTML,/전체 49개/);
scheduled.run('for(let i=0;i<20;i++) answerReview(true); buildReview()');
assert.match(scheduled.ctx.list.innerHTML,/오늘 복습을 마쳤습니다/);

const once=review(2);
once.run('startReview(); buildReview()');
once.run('answerReview(true)');
assert.equal(once.el('#cnt').textContent,1,'한 번 맞히면 바로 완료 수가 오른다');
assert.equal(once.el('#gauge').style.width,'50%');
assert.equal(once.bar.style.width,'50%','카드의 진행 막대도 바로 움직인다');
assert.equal(once.run('reviewQueue().length'),1,'맞힌 문제는 오늘 남은 수에서 빠진다');
assert.equal(once.ctx.QSTAT.k1.due,once.run('today()')+3);
assert.ok(once.ctx.QSTAT.k1.rev>0,'복습 시각을 저장한다');
once.run('buildReview()');
assert.match(once.ctx.list.innerHTML,/rvopt jp/,'다음 문제는 일본어로 낸다');
once.run('answerReview(false)');
assert.equal(once.el('#cnt').textContent,2,'틀려도 한 번 풀면 오늘 진도가 오른다');
assert.equal(once.el('#gauge').style.width,'100%');
assert.equal(once.bar.style.width,'100%');
assert.equal(once.run('reviewQueue().length'),0,'틀린 문제도 오늘 남은 수에서 빠진다');
assert.equal(once.ctx.QSTAT.k2.due,once.run('today()')+1,'틀린 문제는 다음 날 다시 낸다');
once.run('buildReview()');
assert.match(once.ctx.list.innerHTML,/오늘 복습을 마쳤습니다/);
assert.match(once.ctx.list.innerHTML,/1 \/ 2/,'맞힘과 틀림 집계를 유지한다');

const cleanStart=html.indexOf('function cleanQuiz(q){');
const cleanEnd=html.indexOf('\n(function(){ const r=cleanQuiz',cleanStart);
assert(cleanStart>=0&&cleanEnd>cleanStart,'복습 기록 정리 함수를 찾지 못했습니다');
const cleanCtx={WORDS:{k1:{}},Math,Object};
vm.createContext(cleanCtx);
vm.runInContext(html.slice(cleanStart,cleanEnd),cleanCtx);
const cleaned=cleanCtx.cleanQuiz({
  k1:{o:1,x:1,lv:0,due:0},
  'k1|old':{o:2,x:1,lv:1,due:123,rev:100}
}).q;
assert.equal(cleaned.k1.lv,1,'옛 키를 접을 때 최근 복습 단계를 보존한다');
assert.equal(cleaned.k1.due,123);
assert.equal(cleaned.k1.rev,100);
assert.deepStrictEqual(cleanCtx.cleanQuiz(cleaned).q,cleaned);
console.log('오답노트 49개·8개·오늘 20개 진도 확인 완료');
