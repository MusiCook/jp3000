/* 저장소가 공부 도중 쓰기 실패로 바뀌어도 새 진도를 잃지 않는지 확인한다. */
const fs=require('fs'), vm=require('vm'), path=require('path'), assert=require('assert');
const html=fs.readFileSync(path.join(__dirname,'..','src','trainer.html'),'utf8');
const from=html.indexOf('const DB=(()=>{');
const to=html.indexOf('})();',from)+5;
assert(from>=0&&to>from,'저장소 코드를 찾지 못했습니다');
const source=html.slice(from,to);

function storage(failInitially){
  const saved={'jp3000-solved':'기존 기록'};
  let fail=failInitially;
  const localStorage={
    setItem(k,v){ if(fail) throw new Error('쓰기 실패'); saved[k]=v; },
    removeItem(k){ if(fail) throw new Error('삭제 실패'); delete saved[k]; },
    getItem(k){ return saved[k]??null; }
  };
  const ctx={localStorage,Object};
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  return {db:vm.runInContext('DB',ctx), fail:()=>{fail=true;}};
}

const later=storage(false);
assert.equal(later.db.ok,true);
assert.equal(later.db.set('jp3000v2','예전 진도'),true);
later.fail();
assert.equal(later.db.set('jp3000v2','새 진도'),false);
assert.equal(later.db.ok,false);
assert.equal(later.db.get('jp3000v2'),'새 진도');
assert.equal(later.db.get('jp3000-solved'),'기존 기록');

const first=storage(true);
assert.equal(first.db.ok,false);
assert.equal(first.db.set('jp3000v2','메모리 진도'),false);
assert.equal(first.db.get('jp3000v2'),'메모리 진도');
console.log('저장소 쓰기 실패 뒤 진도 보존과 갱신 차단 상태 확인 완료');
