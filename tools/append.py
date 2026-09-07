#!/usr/bin/env python3
"""append.py — 배치 추가 전용 도구

    python3 tools/append.py src/sentences-01.js 32 batch.txt

마지막 문장 뒤에 쉼표를 붙이고 새 문장 블록을 끼워 넣는다.
직접 문자열을 이어붙이다 중괄호를 깨뜨리는 실수를 막기 위해 쓴다.
"""
import sys, pathlib, re, subprocess, tempfile

def append(path, level, block):
    p = pathlib.Path(path); h = p.read_text(encoding='utf-8')
    # 해당 SENT[level] 블록의 닫는 "  ]\n};" 를 찾는다
    m = list(re.finditer(r'SENT\[(\d+)\]\s*=\s*\{', h))
    start = next(x.start() for x in m if x.group(1) == str(level))
    end = h.index('\n\n  ]\n};', start)
    head = h[:end]
    tail = h[end + len('\n\n  ]\n};'):]
    out = head + ',\n' + block.rstrip() + '\n\n  ]\n};' + tail
    p.write_text(out, encoding='utf-8')
    # 문법 검증
    r = subprocess.run(['node','-e',
        "global.window=global; global.SENT=undefined; eval(require('fs').readFileSync(process.argv[1],'utf8'))",
        str(p)], capture_output=True, text=True)
    if r.returncode:
        p.write_text(h, encoding='utf-8')   # 되돌린다
        print('문법 오류로 되돌림:\n', r.stderr[:400]); sys.exit(1)
    print('추가 완료')

if __name__ == '__main__':
    append(sys.argv[1], int(sys.argv[2]), pathlib.Path(sys.argv[3]).read_text(encoding='utf-8'))
