/* Regression: screen navigation must not repeatedly receive remote progress. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'sync.js'), 'utf8');
let server = null;
let version = 0;
let writes = 0;

function device(initial) {
  const storage = {
    jp3000v2: JSON.stringify(initial),
    'jp3000-auth': JSON.stringify({uid:'u1', email:'a@b.c', refresh:'R'})
  };
  const timers = [];
  const listeners = {};
  const button = {};
  const ctx = {
    KEY: 'jp3000v2',
    DB: {
      get: k => storage[k] === undefined ? null : storage[k],
      set: (k, v) => { storage[k] = v; return true; }
    },
    say: message => ctx.messages.push(message),
    messages: [],
    applied: 0,
    window: {},
    document: {
      visibilityState: 'visible',
      getElementById: id => id === 'bSyncNow' ? button : null,
      addEventListener: (name, fn) => { listeners[name] = fn; }
    },
    setTimeout: fn => { timers.push(fn); return timers.length; },
    clearTimeout: () => {},
    fetch: async (url, options = {}) => {
      if (url.includes('securetoken'))
        return {ok:true, json:async () => ({id_token:'T', refresh_token:'R'})};
      if (!url.includes('firestore')) throw new Error('unexpected URL');
      if (options.method === 'PATCH') {
        const guard = new URL(url).searchParams;
        if (guard.get('currentDocument.updateTime') !== (server ? 'v'+version : null) ||
            (guard.get('currentDocument.exists') === 'false') !== (server === null))
          return {ok:false, status:412, json:async () => ({})};
        server = JSON.parse(JSON.parse(options.body).fields.data.stringValue);
        writes++; version++;
        return {ok:true, json:async () => ({})};
      }
      if (server === null) return {ok:false, status:404};
      return {ok:true, json:async () => ({
        updateTime:'v'+version,
        fields:{data:{stringValue:JSON.stringify(server)}}
      })};
    }
  };
  ctx.live = initial;
  ctx.window.applySyncedProgress = value => { ctx.live = value.st; ctx.applied++; };
  ctx.window.save = () => { storage.jp3000v2 = JSON.stringify(ctx.live); };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return {
    ctx,
    sync: () => button.onclick(),
    visible: () => listeners.visibilitychange(),
    startup: async () => {
      while (timers.length) await timers.shift()();
    }
  };
}

(async () => {
  const base = {v:3, lv:2, pg:1, r:{}, done:{1:{},2:{},3:{}},
                star:{}, bm:{}, at:{}};
  const stage = device(base);
  await stage.startup();
  assert.equal(writes, 1);

  const review = device({...base, lv:61, pg:0, rv:{lv:2,pg:1}, at:{2:7}});
  await review.startup();
  assert.equal(review.ctx.live.lv, 61);
  assert.equal(review.ctx.applied, 0);
  assert.equal(writes, 1);

  const kana = device({...base, lv:0});
  await kana.startup();
  assert.equal(kana.ctx.live.lv, 0);
  assert.equal(kana.ctx.applied, 0);
  assert.equal(writes, 1);

  review.ctx.live.lv = 3;
  review.ctx.window.save();
  await review.sync();
  assert.equal(review.ctx.live.lv, 3);
  assert.equal(review.ctx.applied, 0);
  assert.equal(writes, 1);

  server.st.done[1][2] = [1]; version++;
  await Promise.all([review.sync(), review.visible()]);
  assert.deepEqual(Array.from(review.ctx.live.done[1][2]), [1]);
  assert.equal(review.ctx.live.lv, 3);
  assert.equal(review.ctx.applied, 1);
  assert.equal(review.ctx.messages.filter(m => m === '다른 기기의 진도를 받았습니다').length, 1);
  const afterReceive = writes;
  await review.sync();
  assert.equal(review.ctx.applied, 1);
  assert.equal(writes, afterReceive);
  assert.equal(review.ctx.messages.filter(m => m === '다른 기기의 진도를 받았습니다').length, 1);
  console.log('sync repeat regression: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
