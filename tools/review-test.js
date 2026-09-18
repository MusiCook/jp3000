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
  const ctx={
    QSTAT:stats, WORDS:words, SENT:{}, list:{innerHTML:'',dataset:{}},
    $:el, document:{querySelectorAll:()=>[]}, saveStat:()=>{}, paintRv:()=>{},
    optsKO:()=>['뜻 1','뜻 2','뜻 3','뜻 4'], optsJP:()=>[],
    esc:x=>String(x), ruby:x=>String(x), seedOf:()=>1,
    Date, Math, Object, String
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  return {ctx,el,run:code=>vm.runInContext(code,ctx)};
}

const r=review(49);
r.run('startReview(); buildReview()');
assert.equal(r.el('#tot').textContent,49);
assert.match(r.ctx.list.innerHTML,/1 \/ 49/);

r.run('for(let i=0;i<20;i++) finishReviewWord(RVQ[0]); buildReview()');
assert.equal(r.el('#cnt').textContent,20);
assert.match(r.ctx.list.innerHTML,/오늘 남은 29개/);
r.run('enterReview()');
assert.equal(r.el('#cnt').textContent,20,'다시 들어와도 진도가 초기화되지 않아야 한다');
r.el('#rvNext').onclick();
assert.match(r.ctx.list.innerHTML,/21 \/ 49/);

r.run('for(let i=0;i<20;i++) finishReviewWord(RVQ[0]); buildReview()');
assert.match(r.ctx.list.innerHTML,/오늘 남은 9개/);
r.el('#rvNext').onclick();
assert.match(r.ctx.list.innerHTML,/41 \/ 49/);
r.run('for(let i=0;i<9;i++) finishReviewWord(RVQ[0]); buildReview()');
assert.equal(r.el('#cnt').textContent,49);
assert.equal(r.el('#gauge').style.width,'100%');
assert.match(r.ctx.list.innerHTML,/오늘 복습을 마쳤습니다/);

const small=review(8);
small.run('startReview(); buildReview()');
assert.match(small.ctx.list.innerHTML,/1 \/ 8/);
small.run('for(let i=0;i<8;i++) finishReviewWord(RVQ[0]); buildReview()');
assert.match(small.ctx.list.innerHTML,/오늘 복습을 마쳤습니다/);

const scheduled=review(49,20);
scheduled.run('startReview(); buildReview()');
assert.match(scheduled.ctx.list.innerHTML,/오늘 1 \/ 20/);
assert.match(scheduled.ctx.list.innerHTML,/전체 49개/);
scheduled.run('for(let i=0;i<20;i++) finishReviewWord(RVQ[0]); buildReview()');
assert.match(scheduled.ctx.list.innerHTML,/오늘 복습을 마쳤습니다/);
console.log('오답노트 49개·8개·오늘 20개 진도 확인 완료');
