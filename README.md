# 일본어 3000

일본 여행에서 읽고 말할 수 있는 수준(JLPT N4~N3)을 목표로,
3,000문장을 60단계로 나눠 읽어 나가는 학습 웹앱.

문법을 외우지 않고 문장을 계속 읽으며 익히는 것이 원칙이다.
학습 기간은 약 2년을 잡는다.

---

## 지금 상태

| 항목 | 값 |
|---|---|
| 문장 | 1,550 / 3,000 (52%) |
| 단계 | 31 / 60 |
| 사전 | 1,570여 개 |
| 의미 그룹 | 36개 |

---

## 폴더

```
src/                작업 대상
  trainer.html        앱 본체 (HTML·CSS·JS)
  words.js            단어 사전
  sentences-01.js     문장 데이터 (1~31단계)
  groups.js           의미 그룹 + 같은 뜻 짝

tools/
  build.py            src → dist/jp3000.html 합치기
  check.js            데이터 검사기
  append.py           문장 배치 추가 도구

dist/               배포용. Pages가 이 폴더를 그대로 내보낸다
  jp3000.html         합본 (이것만 열면 동작)
  index.html          jp3000.html 로 넘겨주는 짧은 주소용
  manifest.webmanifest
  sw.js               오프라인 캐시
  icon-*.png

docs/
  PLAN.md             전체 작업 규칙과 60단계 구성
  ROUNDS.md           회차 학습 시스템 — 구조와 고칠 자리
  NOTES-PLAN.md       「더 배워보기」 설명 계획
  REVIEW.md           시스템 구조 검토 기록
  CHANGELOG.md        바뀐 내역
```

---

## 작업 흐름

```bash
# 1. 문장이나 코드를 고친다  →  src/ 안의 파일

# 2. 검사
node tools/check.js

# 3. 합치기
python3 tools/build.py

# 4. dist/jp3000.html 을 브라우저로 열어 확인
```

`src/trainer.html`을 직접 열어도 동작한다. 같은 폴더의 `words.js` 등을 불러오기 때문이다.
다만 **파일로 직접 열면 서비스 워커가 뜨지 않으므로** 오프라인 기능은 확인할 수 없다.

### 로컬 서버로 확인하려면

```bash
cd dist && python3 -m http.server 8000
# http://localhost:8000/jp3000.html
```

---

## 배포

저장소는 `MusiCook/jp3000`, GitHub Pages는 `main` / `(root)` 로 켜져 있다.
푸시하면 그대로 배포된다.

```bash
node tools/check.js          # 검사 — 반드시
python3 tools/build.py       # dist/jp3000.html 재생성
# 브라우저로 dist/jp3000.html 열어 확인

git add -A
git commit -m "무엇을 고쳤는지"
git push
```

1~2분 뒤 반영된다.

```
https://musicook.github.io/jp3000/
```

저장소 루트와 `dist` 의 `index.html` 이 `jp3000.html` 로 넘겨준다.
직접 주소는 `https://musicook.github.io/jp3000/dist/jp3000.html`.

- 서비스 워커는 HTTPS에서만 동작한다
- 파일을 새로 올리면 앱이 자동으로 받아두고 「새 내용이 있습니다」를 띄운다
- **`dist/sw.js`의 캐시 이름을 올리지 않으면** 옛 화면이 계속 나올 수 있다

---

## 반드시 지킬 것

**배치를 추가하면 검사기를 돌린다.** 사전 키 충돌은 조용히 일어나고 화면에는
엉뚱한 글자가 나온다. 과거에 네 건이 있었고 두 건은 우연히 발견했다.

**코드를 고칠 때 정규식으로 큰 구간을 다루지 않는다.** 범위를 잘못 잡아 함수
여러 개를 통째로 날린 적이 있다. 정확한 문자열로 바꾸고, 고친 뒤 반드시
브라우저로 열어 확인한다.

**UI를 고친 뒤에는 렌더링까지 확인한다.** CSS만 지워지고 마크업이 남아
버튼이 기본 스타일로 크게 나온 적이 있다.

자세한 규칙은 `docs/PLAN.md`에 있다.

---

## 남은 일

- 32~60단계 문장 1,450개
- 「더 배워보기」 설명 채우기 (`docs/NOTES-PLAN.md` 참고)
- 원어민 검수 — 문법은 맞지만 실제로 쓰지 않는 표현이 섞여 있을 수 있다
- 기기 간 진도 자동 동기화 (지금은 코드 복사)
