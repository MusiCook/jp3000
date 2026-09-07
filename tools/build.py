#!/usr/bin/env python3
"""
build.py — src 의 조각을 합쳐 dist/jp3000.html 하나로 만든다.

    python3 tools/build.py

trainer.html 안의 <script src="..."> 를 실제 파일 내용으로 바꿔 넣는다.
배포는 dist 폴더를 통째로 올리면 된다.
"""
import re
import sys
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
    DIST.mkdir(exist_ok=True)
    (DIST / "jp3000.html").write_text(out, encoding="utf-8")
    print(f"dist/jp3000.html : {len(out):,} bytes")


if __name__ == "__main__":
    main()
