#!/usr/bin/env python3
"""Falla si hi ha caràcters corruptes (U+FFFD) o bytes UTF-8 invàlids als fitxers font."""
import sys, os

EXTS = (".html", ".js", ".css", ".json", ".md")
EXCLUDE_DIRS = {"node_modules", ".git", "dist", "build", "playwright-report"}

def iter_files():
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            if f.endswith(EXTS):
                yield os.path.join(root, f)

def context(text, idx, pad=40):
    a = max(0, idx - pad)
    b = min(len(text), idx + pad + 1)
    return text[a:idx] + "[[»" + text[idx] + "«]]" + text[idx+1:b]

problems = 0
checked = 0

for path in sorted(iter_files()):
    raw = open(path, "rb").read()

    # 1) Bytes que no són UTF-8 vàlid
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as e:
        print(f"❌ {path}: bytes UTF-8 invàlids a l'offset {e.start}: {e.reason}")
        problems += 1
        text = raw.decode("utf-8", "replace")

    # 2) Caràcter de reemplaçament U+FFFD (corrupció "consolidada" com a UTF-8 vàlid)
    line = 1
    col = 0
    for i, ch in enumerate(text):
        if ch == "\n":
            line += 1
            col = 0
            continue
        col += 1
        if ch == "�":
            snippet = context(text, i).replace("\n", "⏎")
            print(f"❌ {path}:{line} caràcter corrupte U+FFFD (col {col}) → ...{snippet}...")
            problems += 1

    checked += 1

if problems:
    print(f"\n{problems} problema(es) de codificació detectat(s).")
    sys.exit(1)

print(f"✓ Cap caràcter corrupte (0 U+FFFD, UTF-8 vàlid) a {checked} fitxers")
