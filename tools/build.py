#!/usr/bin/env python3
"""
build.py — src 의 조각을 합쳐 dist/jp3000.html 하나로 만든다.

    python3 tools/build.py

trainer.html 안의 <script src="..."> 를 실제 파일 내용으로 바꿔 넣는다.
배포는 dist 폴더를 통째로 올리면 된다.
"""
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
DIST = ROOT / "dist"


def inline(m):
    name = m.group(1)
    p = SRC / name
    if not p.exists():
        print(f"[오류] {name} 이 src 에 없습니다", file=sys.stderr)
        sys.exit(1)
    return f"<script>\n/* ---- {name} ---- */\n" + p.read_text(encoding="utf-8") + "\n</script>"


def main():
    html = (SRC / "trainer.html").read_text(encoding="utf-8")
    out = re.sub(r'<script src="([^"]+)"></script>', inline, html)
    # 판 표시. 설정 맨 아래에 나온다. 「지금 쓰는 것이 새것인가」를
    # 눈으로 확인할 수 있어야 옛 화면을 붙들고 헤매지 않는다
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    out = out.replace('<span id="ver">개발본</span>',
                      '<span id="ver">' + stamp + '</span>')
    DIST.mkdir(exist_ok=True)
    (DIST / "jp3000.html").write_text(out, encoding="utf-8")
    print(f"dist/jp3000.html : {len(out):,} bytes")


if __name__ == "__main__":
    main()
