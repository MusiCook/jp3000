/*
 * tts.js — Gemini 로 문장 음성을 미리 만들어 둔다
 *
 *     node tools/tts.js --models        쓸 수 있는 모델을 본다
 *     node tools/tts.js 1 1-10          1단계 1~10번을 여자·남자 둘 다 만든다
 *     node tools/tts.js 1 1-50 --only f      여자만
 *     node tools/tts.js 1 1-50 --force       이미 있어도 다시 만든다
 *     node tools/tts.js --compare            목소리 8명을 견준다
 *     node tools/tts.js --speed              8명 × 빠르기 4단계를 견준다
 *
 * **브라우저에서 직접 부르지 않는다.** 합본 HTML 은 공개돼 있어 키가
 * 그대로 드러난다. 여기서 미리 만들어 두고 앱은 파일만 재생한다.
 *
 * 만들어진 것은 dist/voice/01-001-f.wav (여자) · 01-001-m.wav (남자) 로 놓이고,
 * dist/voice/listen.html 로 한자리에서 들어 볼 수 있다.
 */
const fs = require('fs'), vm = require('vm'), path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC  = path.join(ROOT, 'src');
const OUT  = path.join(ROOT, 'dist', 'voice');
const API  = 'https://generativelanguage.googleapis.com/v1beta';

/* ── 키 ────────────────────────────────────────
   키만 적힌 파일도, GEMINI_API_KEY=... 꼴도 받는다.
   여기 적힌 이름은 모두 .gitignore 에 들어 있어 저장소에 올라가지 않는다.
   **키는 어떤 경우에도 화면에 찍지 않는다** */
const KEYFILES = ['.gemini-key', 'API_key.txt', 'api_key.txt', '.env'];
function apiKey(){
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  for (const name of KEYFILES) {
    const f = path.join(ROOT, name);
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const m = t.match(/^(?:GEMINI_API_KEY|GOOGLE_API_KEY|GEMINI_KEY)\s*[=:]\s*(.+)$/i);
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
      if (/^AIza[\w-]{20,}$/.test(t)) return t;      /* 키만 적힌 파일 */
    }
  }
  console.error([
    '키를 찾지 못했습니다.',
    '  다음 중 하나에 두세요 — ' + KEYFILES.join(', '),
    '  키만 적거나  GEMINI_API_KEY=...  꼴로 적으면 됩니다.',
    '  (환경변수 GEMINI_API_KEY 도 봅니다)'
  ].join('\n'));
  process.exit(1);
}

/* ── 문장 자료 ──────────────────────────────────── */
function load(){
  const ctx = { window:{} };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['words.js','sentences-01.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx));
  return ctx;
}

/* 읽을 거리. 가나만 보내면 억양이 뭉개져, 한자를 그대로 보내
   모델이 문맥으로 읽게 둔다 */
function textOf(ctx, s){
  return s.j.map(id => {
    const w = ctx.WORDS[id];
    if (!w) return id;
    return w.t.replace(/\{([^|{}]+)\|[^|{}]+\}/g, '$1');
  }).join('');
}

/* ── PCM 을 WAV 로 ──────────────────────────────── */
/* Gemini 는 머리말 없는 16비트 PCM 을 준다.
   재생하려면 44바이트짜리 WAV 머리말을 앞에 붙여야 한다 */
function wav(pcm, rate){
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);              h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);              h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);         h.writeUInt16LE(1, 20);    /* PCM */
  h.writeUInt16LE(1, 22);          h.writeUInt32LE(rate, 24); /* 모노 */
  h.writeUInt32LE(rate * 2, 28);   h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);         h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/* 16비트 모노니까 (바이트 ÷ 2 ÷ 표본율) 이 초가 된다.
   같은 문장이라면 길이가 곧 빠르기다 */
function secOf(file){
  return Math.max(0, fs.statSync(file).size - 44) / 2 / 24000;
}

/* ── 부르기 ────────────────────────────────────── */
async function listModels(key){
  const r = await fetch(API + '/models?pageSize=200&key=' + key);
  const j = await r.json();
  if (!r.ok) { console.error(JSON.stringify(j, null, 2)); process.exit(1); }
  const all = j.models || [];
  const tts = all.filter(m => /tts/i.test(m.name));
  console.log('소리를 낼 수 있는 모델 ' + tts.length + '개');
  tts.forEach(m => console.log('  ' + m.name.replace('models/', '')
    + '   ' + (m.displayName || '')));
  if (!tts.length) {
    console.log('이름에 tts 가 든 모델이 없습니다. 전체 ' + all.length + '개:');
    all.forEach(m => console.log('  ' + m.name.replace('models/', '')));
  }
}

/* 말투 지시. 문장 앞에 붙이면 모델이 그대로 따르고, 지시 자체는
   소리로 나오지 않는다.

   Gemini 에는 rate 같은 숫자 손잡이가 없다. 빠르기를 바꾸는 길은
   이 지시문 한 줄뿐이라, 네 단계로 나눠 두고 골라 쓴다.
   느리게 시키면 초보자가 따라오기는 좋은데 억양이 뭉개지고
   늘어져 들린다 — 그 맞바꿈을 귀로 확인하라고 --speed 를 두었다. */
const PACE = [
  { key:'1느림',     hint:'a little slower than normal, articulating every syllable clearly so a beginner can follow' },
  { key:'1a덜느림',  hint:'a gently measured pace — just a touch slower than everyday conversation, unhurried but never laboured' },
  { key:'1b거의보통', hint:'very nearly everyday conversational speed, easing off only enough that no syllable gets swallowed' },
  { key:'2보통',     hint:'a natural, everyday conversational pace' },
  { key:'3조금빠름',  hint:'a relaxed but brisk pace, the way a friend would say it' },
  { key:'4원어민',    hint:'a normal native-to-native speed — do not slow down at all for the listener' }
];
/* 실제로 쓰는 단계. 「1느림」으로 고정한다.

   빠르기를 프롬프트로 미세하게 조절하려 해봤지만 안 된다. 지시문을
   바꾸면 빠르기만 바뀌는 게 아니라 인물까지 같이 바뀌어서, 같은
   Erinome 인데도 딴사람 목소리가 나왔다. 어떤 목소리는 「덜 느리게」가
   「느리게」보다 느려지기까지 했다.
   그래서 지시문은 하나로 못 박고, 빠르기는 재생할 때 RATE 로 건다.
   preservesPitch 가 붙은 브라우저 시간 늘리기라 음정은 안 올라간다 */
const PACE_PICK = '1느림';

/* 재생 배수. 「1느림」을 이만큼 빠르게 틀면 늘어짐만 걷히고
   또박또박한 발음은 남는다. 앱도 이 값을 쓴다 */
const RATE = 1.25;

/* 목소리와 인물. 지시문의 사람이 목소리 성별과 어긋나면 연기가
   흔들리므로, 목소리마다 짝을 지어 둔다 */
/* 앱에서 쓸 두 목소리. 견주기(--compare, --speed)를 거쳐 고른 짝이다 */
const VOICE = { f: 'Erinome', m: 'Enceladus' };

const PERSONA = {
  f: 'a calm, gentle young woman',
  m: 'a calm, friendly young man'
};
const SEX = {
  Leda:'f', Achernar:'f', Vindemiatrix:'f', Aoede:'f',
  Erinome:'f', Sulafat:'f', Despina:'f', Autonoe:'f',
  Puck:'m', Charon:'m', Fenrir:'m', Orus:'m',
  Enceladus:'m', Iapetus:'m', Algieba:'m', Alnilam:'m'
};
function styleFor(pace, voice){
  return 'Read the following Japanese sentence as ' + (PERSONA[SEX[voice]] || PERSONA.f) + '. '
       + 'Speak with correct pitch accent and clear articulation, at '
       + pace.hint + ':';
}
const PACE_NOW = PACE.find(p => p.key === PACE_PICK) || PACE[0];

async function speak(key, model, voice, text, style){
  const said = (style === '' ? text : (style || styleFor(PACE_NOW, voice)) + '\n\n' + text);
  const r = await fetch(API + '/models/' + model + ':generateContent?key=' + key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: said }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
      }
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j.error || j).slice(0, 400));
  const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  const inline = parts.map(p => p.inlineData).filter(Boolean)[0];
  if (!inline) throw new Error('소리가 오지 않았습니다: ' + JSON.stringify(j).slice(0, 400));
  const rate = +((inline.mimeType || '').match(/rate=(\d+)/) || [])[1] || 24000;
  return wav(Buffer.from(inline.data, 'base64'), rate);
}

/* ── 들어 볼 페이지 ─────────────────────────────── */
function listenPage(rows, model){
  const body = rows.map(r =>
    '<div class="row">' +
    '<div class="head"><span class="no">' + r.id + '</span>' +
    '<span class="jp">' + r.jp + '</span></div>' +
    '<div class="ko">' + r.ko + '</div>' +
    '<div class="btns">' +
    (r.f ? '<button type="button" class="v f" data-src="./' + r.f + '">여자</button>' : '') +
    (r.m ? '<button type="button" class="v m" data-src="./' + r.m + '">남자</button>' : '') +
    '</div></div>').join('\n');
  return [
    '<!doctype html>',
    '<html lang="ko"><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>일본어 3000 · 음성 시험</title>',
    '<style>',
    '  html{background:#12241F;color:#EDE6DA;color-scheme:dark}',
    '  body{margin:0;padding:20px 16px 60px;font:15px/1.7 -apple-system,BlinkMacSystemFont,system-ui,sans-serif}',
    '  h1{font-size:17px;margin:0 0 4px}',
    '  .sub{color:#7f8f88;font-size:12px}',
    '  .knob{position:sticky;top:0;background:#12241F;padding:12px 0 10px;',
    '    border-bottom:1px solid #233a33;margin:12px 0 6px;z-index:2;',
    '    display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '  .knob input{flex:1;min-width:160px;accent-color:#4EA98A}',
    '  .knob b{font:13px ui-monospace,monospace;color:#CBA258;flex:0 0 52px}',
    '  .knob button{background:#1b332c;color:#EDE6DA;border:1px solid #2f5044;',
    '    border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer}',
    '  .row{border-top:1px solid #233a33;padding:12px 0}',
    '  .head{display:flex;align-items:baseline;gap:10px}',
    '  .jp{font-size:19px}',
    '  .ko{color:#B7D0C5;font-size:13px;margin:2px 0 9px}',
    '  .no{color:#5f7168;font-size:11px;font-family:ui-monospace,monospace;flex:0 0 auto}',
    '  .btns{display:flex;gap:8px}',
    '  .v{border:1px solid #2f5044;border-radius:999px;padding:6px 16px;',
    '    font-size:13px;cursor:pointer;background:#1b332c;color:#EDE6DA}',
    '  .v.f{border-color:#4EA98A;color:#8fe0c2}',
    '  .v.m{border-color:#CBA258;color:#e6c98d}',
    '  .v.on{background:#4EA98A;color:#0d1a16;border-color:#4EA98A}',
    '  .v.m.on{background:#CBA258;color:#1a1408;border-color:#CBA258}',
    '</style>',
    '<body>',
    '<h1>음성 시험 · 1단계</h1>',
    '<div class="sub">' + model + ' · 여자 ' + VOICE.f + ' · 남자 ' + VOICE.m + '</div>',
    '<div class="knob">',
    '  <label for="rt">빠르기</label><b id="rtv">' + RATE.toFixed(2) + '×</b>',
    '  <input id="rt" type="range" min="0.7" max="1.6" step="0.05" value="' + RATE + '">',
    '  <button type="button" data-r="' + RATE + '">기본 ' + RATE + '×</button>',
    '  <button type="button" data-r="1">그대로 1×</button>',
    '</div>',
    body,
    '<script>',
    '(function(){',
    '  var rt=document.getElementById("rt"), rtv=document.getElementById("rtv");',
    '  var au=new Audio(), cur=null;',
    '  function rate(){ return +rt.value }',
    /* preservesPitch 를 켜야 빨라져도 목소리가 높아지지 않는다.
       사파리는 이름이 다르던 때가 있어 둘 다 짚어 준다 */
    '  function setRate(){ rtv.textContent=rate().toFixed(2)+"×";',
    '    au.preservesPitch=au.webkitPreservesPitch=true; au.playbackRate=rate(); }',
    '  rt.addEventListener("input",setRate);',
    '  [].forEach.call(document.querySelectorAll(".knob button"),function(b){',
    '    b.addEventListener("click",function(){ rt.value=this.dataset.r; setRate(); }); });',
    '  function off(){ if(cur){ cur.classList.remove("on"); cur=null; } }',
    '  au.addEventListener("ended",off);',
    '  [].forEach.call(document.querySelectorAll(".v"),function(b){',
    '    b.addEventListener("click",function(){',
    /* 같은 단추를 다시 누르면 멈춘다. 딴 단추면 그리로 갈아탄다 */
    '      var again = (cur===b);',
    '      au.pause(); off();',
    '      if(again) return;',
    '      au.src=b.dataset.src; setRate(); au.currentTime=0;',
    '      au.play(); cur=b; b.classList.add("on");',
    '    }); });',
    '  setRate();',
    '})();',
    '<\/script>',
    '</body></html>'
  ].join('\n');
}

/* ── 목소리 고르기 ───────────────────────────────
   같은 문장을 여러 목소리로 만들어 나란히 들어 본다.
   dist/voice/compare/ 에 놓이고 compare.html 로 듣는다 */
const CAND   = ['Leda','Achernar','Vindemiatrix','Aoede','Erinome','Sulafat','Despina','Autonoe'];
const CAND_M = ['Puck','Charon','Fenrir','Orus','Enceladus','Iapetus','Algieba','Alnilam'];

async function compare(key, model, style, list){
  const voices = (list && !list.startsWith('--')) ? list.split(',') : CAND;
  const ctx = load();
  const pick = ctx.SENT['1'].s.filter(s => [3,6,9].indexOf(s.n) >= 0);
  const dir = path.join(OUT, 'compare');
  fs.mkdirSync(dir, { recursive: true });

  const blocks = [];
  for (const v of voices) {
    const rows = [];
    for (const s of pick) {
      const jp = textOf(ctx, s);
      const file = v + '-' + String(s.n).padStart(3, '0') + '.wav';
      process.stdout.write('  ' + (v + '        ').slice(0, 14) + jp + ' … ');
      try {
        fs.writeFileSync(path.join(dir, file), await speak(key, model, v, jp, style));
        console.log('됨');
        rows.push({ jp, ko: s.k.map(t => t[0]).join(''), file });
      } catch (e) {
        console.log('실패  ' + e.message.slice(0, 120));
        break;
      }
    }
    if (rows.length) blocks.push({ voice: v, rows });
  }

  const html = ['<!doctype html><html lang="ko"><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>목소리 고르기</title><style>',
    ' html{background:#12241F;color:#EDE6DA;color-scheme:dark}',
    ' body{margin:0;padding:20px;font:15px/1.7 -apple-system,system-ui,sans-serif}',
    ' h1{font-size:17px;margin:0 0 16px} h2{font-size:15px;margin:22px 0 8px;color:#4EA98A}',
    ' .row{border-top:1px solid #233a33;padding:10px 0}',
    ' .jp{font-size:17px} .ko{color:#B7D0C5;font-size:12px;margin-bottom:6px}',
    ' audio{width:100%;height:32px}',
    '</style><body><h1>목소리 고르기 · ' + model + '</h1>'];
  blocks.forEach(b => {
    html.push('<h2>' + b.voice + '</h2>');
    b.rows.forEach(r => html.push('<div class="row"><div class="jp">' + r.jp + '</div>' +
      '<div class="ko">' + r.ko + '</div>' +
      '<audio controls preload="none" src="./' + r.file + '"></audio></div>'));
  });
  html.push('<script>',
    '(function(){',
    '  var rt=document.getElementById("rt"), rtv=document.getElementById("rtv");',
    '  var secs=[].slice.call(document.querySelectorAll(".sec"));',
    '  var base=secs.map(function(e){return +e.dataset.sec});',
    '  function apply(){',
    '    var r=+rt.value; rtv.textContent=r.toFixed(2)+"×";',
    /* preservesPitch 를 켜야 빨라져도 목소리가 높아지지 않는다.
       사파리는 이름이 다르던 때가 있어 둘 다 짚어 준다 */
    '    [].forEach.call(document.querySelectorAll("audio"),function(a){',
    '      a.preservesPitch=a.webkitPreservesPitch=true; a.playbackRate=r; });',
    '    secs.forEach(function(e,i){ e.textContent=(base[i]/r).toFixed(2)+"s" });',
    '  }',
    '  rt.addEventListener("input",apply);',
    '  [].forEach.call(document.querySelectorAll(".knob button"),function(b){',
    '    b.addEventListener("click",function(){ rt.value=this.dataset.r; apply(); }); });',
    '  apply();',
    '})();',
    '<\/script>');
  html.push('</body></html>');
  fs.writeFileSync(path.join(dir, 'compare.html'), html.join('\n'), 'utf8');
  console.log('');
  console.log('들어 보기 : dist/voice/compare/compare.html');
}

/* ── 빠르기 고르기 ───────────────────────────────
   같은 문장 하나를 목소리 8명 × 빠르기 4단계로 만들어,
   dist/voice/speed/ 에 놓고 speed.html 로 나란히 듣는다.
   compare/ 는 건드리지 않으니 옛 소리와도 견줄 수 있다 */
async function speeds(key, model, list, num, force, opt){
  opt = opt || {};
  const voices = (list && !list.startsWith('--')) ? list.split(',')
               : (opt.male ? CAND_M : CAND);
  /* --pace 를 주면 그 단계만 굽는다. 빠르기 사다리는 이미 결론이
     났으니, 목소리만 견줄 때는 「1느림」 하나로 족하다 */
  const paces = opt.pace ? PACE.filter(p => p.key.indexOf(opt.pace) === 0) : PACE;
  if (!paces.length) { console.error(opt.pace + ' 단계가 없습니다'); process.exit(1); }
  let kept = 0;
  const ctx = load();
  const n = +num || 3;
  const s = ctx.SENT['1'].s.find(x => x.n === n);
  if (!s) { console.error('1단계에 ' + n + '번 문장이 없습니다'); process.exit(1); }
  const jp = textOf(ctx, s), ko = s.k.map(t => t[0]).join('');
  const dir = path.join(OUT, 'speed');
  fs.mkdirSync(dir, { recursive: true });

  console.log('문장  ' + jp + '   (' + ko + ')');
  console.log('목소리 ' + voices.length + '명 × 빠르기 ' + paces.length + '단계 = '
    + voices.length * paces.length + '개');
  console.log('이미 있는 것은 건너뜁니다. 다시 만들려면 --force');
  console.log('');

  const blocks = [];
  for (const v of voices) {
    const rows = [];
    for (const p of paces) {
      const file = v + '-' + p.key + '.wav';
      const dest = path.join(dir, file);
      if (fs.existsSync(dest) && !force) {
        rows.push({ pace: p.key, file, sec: secOf(dest) });
        kept++; continue;                    /* 페이지만 다시 그린다 */
      }
      process.stdout.write('  ' + (v + '            ').slice(0, 14) + p.key + ' … ');
      try {
        fs.writeFileSync(dest, await speak(key, model, v, jp, styleFor(p, v)));
        console.log('됨');
        rows.push({ pace: p.key, file, sec: secOf(dest) });
      } catch (e) {
        console.log('실패  ' + e.message.slice(0, 120));
      }
    }
    if (rows.length) blocks.push({ voice: v, rows });
  }

  /* 이번에 구운 것만 그리면, 남자를 굽는 순간 여자가 페이지에서
     사라진다. 그러니 폴더에 있는 것을 모두 긁어 다시 그린다 */
  const order = CAND.concat(CAND_M);
  const seen = {};
  fs.readdirSync(dir).forEach(f => {
    const m = f.match(/^(.+)-([^-]+)\.wav$/);
    if (!m) return;
    (seen[m[1]] = seen[m[1]] || []).push({ pace: m[2], file: f, sec: secOf(path.join(dir, f)) });
  });
  const all = Object.keys(seen)
    .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map(v => ({ voice: v, sex: SEX[v] === 'm' ? '남' : '여',
      rows: seen[v].sort((a, b) =>
        PACE.findIndex(p => p.key === a.pace) - PACE.findIndex(p => p.key === b.pace)) }));

  const html = ['<!doctype html><html lang="ko"><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>빠르기 고르기</title><style>',
    ' html{background:#12241F;color:#EDE6DA;color-scheme:dark}',
    ' body{margin:0;padding:20px;font:15px/1.7 -apple-system,system-ui,sans-serif}',
    ' h1{font-size:17px;margin:0 0 2px} h2{font-size:15px;margin:24px 0 6px;color:#4EA98A}',
    ' .sub{color:#7f8f88;font-size:12px;margin-bottom:4px}',
    ' .jp{font-size:19px;margin:10px 0 18px}',
    ' .row{display:flex;align-items:center;gap:10px;border-top:1px solid #233a33;padding:8px 0}',
    ' .pace{flex:0 0 78px;color:#B7D0C5;font-size:12px}',
    ' .sec{flex:0 0 46px;text-align:right;font:11px ui-monospace,monospace}',
    ' .bar{flex:0 0 130px;height:6px;background:#1b332c;border-radius:3px;overflow:hidden}',
    ' .bar i{display:block;height:100%;background:#4EA98A}',
    ' audio{flex:1;min-width:0;height:32px}',
    ' .tip{color:#7f8f88;font-size:12px;margin:0 0 16px;line-height:1.8}',
    ' .knob{position:sticky;top:0;background:#12241F;padding:12px 0 10px;',
    '   border-bottom:1px solid #233a33;margin-bottom:14px;z-index:2;',
    '   display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
    ' .knob input{flex:1;min-width:200px;accent-color:#4EA98A}',
    ' .knob b{font:13px ui-monospace,monospace;color:#CBA258;flex:0 0 58px}',
    ' .knob button{background:#1b332c;color:#EDE6DA;border:1px solid #2f5044;',
    '   border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer}',
    '</style><body>',
    '<h1>빠르기 고르기</h1>',
    '<div class="sub">' + model + '</div>',
    '<div class="jp">' + jp + '<span class="sub">　' + ko + '</span></div>',
    '<p class="tip">막대와 초는 소리의 길이입니다. 같은 문장이니 <b>짧을수록 빠릅니다</b>.<br>' +
    '길이가 비슷하면 실제로 빠르기가 같은 것이라, 귀로 더 재보지 않아도 됩니다.</p>',
    '<div class="knob">',
    '  <label for="rt">재생 속도</label><b id="rtv">1.00×</b>',
    '  <input id="rt" type="range" min="0.7" max="1.6" step="0.05" value="' + RATE + '">',
    '  <button type="button" data-r="' + RATE + '">기본 ' + RATE + '×</button>',
    '  <button type="button" data-r="1">그대로 1×</button>',
    '</div>',
    '<p class="tip">지금 기본은 <b>「1느림」 · ' + RATE + '×</b> 입니다. ' +
    '음정은 그대로 두고 길이만 줄이니, 앱에서 들릴 소리가 이것입니다.<br>' +
    '지시문으로 빠르기를 조절하면 인물까지 바뀌므로, 단계는 「1느림」 하나만 보시면 됩니다.</p>'];
  const longest = Math.max.apply(null,
    all.reduce((a, b) => a.concat(b.rows.map(r => r.sec)), [0.01]));
  all.forEach(b => {
    html.push('<h2>' + b.voice + ' <span class="sub">' + b.sex + '</span></h2>');
    b.rows.forEach(r => html.push('<div class="row"><div class="pace">' + r.pace + '</div>' +
      '<div class="sec" data-sec="' + r.sec.toFixed(3) + '">' + r.sec.toFixed(2) + 's</div>' +
      '<div class="bar"><i style="width:' + (r.sec / longest * 100).toFixed(1) + '%"></i></div>' +
      '<audio controls preload="metadata" src="./' + r.file + '"></audio></div>'));
  });
  html.push('<script>',
    '(function(){',
    '  var rt=document.getElementById("rt"), rtv=document.getElementById("rtv");',
    '  var secs=[].slice.call(document.querySelectorAll(".sec"));',
    '  var base=secs.map(function(e){return +e.dataset.sec});',
    '  function apply(){',
    '    var r=+rt.value; rtv.textContent=r.toFixed(2)+"×";',
    /* preservesPitch 를 켜야 빨라져도 목소리가 높아지지 않는다.
       사파리는 이름이 다르던 때가 있어 둘 다 짚어 준다 */
    '    [].forEach.call(document.querySelectorAll("audio"),function(a){',
    '      a.preservesPitch=a.webkitPreservesPitch=true; a.playbackRate=r; });',
    '    secs.forEach(function(e,i){ e.textContent=(base[i]/r).toFixed(2)+"s" });',
    '  }',
    '  rt.addEventListener("input",apply);',
    '  [].forEach.call(document.querySelectorAll(".knob button"),function(b){',
    '    b.addEventListener("click",function(){ rt.value=this.dataset.r; apply(); }); });',
    '  apply();',
    '})();',
    '<\/script>');
  html.push('</body></html>');
  fs.writeFileSync(path.join(dir, 'speed.html'), html.join('\n'), 'utf8');

  /* 길이를 나란히 찍어 준다. 단계를 올려도 길이가 그대로면
     지시문이 먹히지 않은 것이니, 귀로 헤매기 전에 여기서 드러난다 */
  console.log('');
  console.log('길이(초)      ' + paces.map(p => (p.key + '          ').slice(0, 10)).join(''));
  blocks.forEach(b => console.log((b.voice + '            ').slice(0, 14) +
    paces.map(p => { const r = b.rows.find(x => x.pace === p.key);
      return ((r ? r.sec.toFixed(2) + 's' : '-') + '          ').slice(0, 10); }).join('')));

  console.log('');
  if (kept) console.log('그대로 둔 것 ' + kept + '개');
  console.log('들어 보기 : dist/voice/speed/speed.html');
}

/* ── 본체 ──────────────────────────────────────── */
async function main(){
  const arg = process.argv.slice(2);
  const key = apiKey();

  if (arg.includes('--models')) return listModels(key);

  const flag = (n, d) => { const i = arg.indexOf(n); return i >= 0 ? arg[i + 1] : d; };
  const model = flag('--model', 'gemini-3.1-flash-tts-preview');
  const voice = flag('--voice', '');   /* 주면 여자·남자 대신 이 목소리로 */
  const style = flag('--style', null);
  const force = arg.includes('--force');

  if (arg.includes('--compare')) return compare(key, model, style, flag('--compare', ''));
  if (arg.includes('--speed'))   return speeds(key, model, flag('--speed', ''), flag('--n', 3), force,
    { pace: flag('--pace', ''), male: arg.includes('--male') });

  const lv = arg.find(a => /^\d+$/.test(a)) || '1';
  const span = arg.find(a => /^\d+-\d+$/.test(a)) || '1-10';
  const from = +span.split('-')[0], to = +span.split('-')[1];
  /* --only f 나 --only m 을 주면 한쪽만 굽는다 */
  const only = flag('--only', '');
  const sides = ['f', 'm'].filter(x => !only || only === x);

  const ctx = load();
  const L = ctx.SENT[lv];
  if (!L) { console.error(lv + '단계가 없습니다'); process.exit(1); }

  fs.mkdirSync(OUT, { recursive: true });
  const rows = [];
  let made = 0, kept = 0;

  outer:
  for (const s of L.s) {
    if (s.n < from || s.n > to) continue;
    const id = String(lv).padStart(2, '0') + '-' + String(s.n).padStart(3, '0');
    const jp = textOf(ctx, s);
    const ko = s.k.map(t => t[0]).join('');
    const row = { id, jp, ko };

    for (const side of ['f', 'm']) {
      const file = id + '-' + side + '.wav';
      const dest = path.join(OUT, file);
      if (fs.existsSync(dest)) row[side] = file;      /* 페이지에는 늘 올린다 */
      if (sides.indexOf(side) < 0) continue;
      if (fs.existsSync(dest) && !force) { kept++; continue; }

      process.stdout.write('  만드는 중  ' + file + '  ' + jp + ' … ');
      try {
        const buf = await speak(key, model, voice || VOICE[side], jp, style);
        fs.writeFileSync(dest, buf);
        row[side] = file; made++;
        console.log((buf.length / 1024).toFixed(0) + 'KB');
      } catch (e) {
        console.log('실패');
        console.error('    ' + e.message);
        process.exitCode = 1;
        rows.push(row);
        break outer;
      }
    }
    rows.push(row);
  }

  if (rows.length) {
    fs.writeFileSync(path.join(OUT, 'listen.html'), listenPage(rows, model), 'utf8');
    let total = 0;
    rows.forEach(r => ['f', 'm'].forEach(k => { if (!r[k]) return;
      total += fs.statSync(path.join(OUT, r[k])).size; }));
    console.log('');
    console.log('만든 것 ' + made + ' · 그대로 둔 것 ' + kept
      + ' · 모두 ' + (total / 1024 / 1024).toFixed(2) + 'MB');
    console.log('들어 보기 : dist/voice/listen.html');
  }
}

main();
