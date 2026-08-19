#!/usr/bin/env python3
"""
HB · Control — servidor local del dashboard.

    python3 _tools/dash.py        ->  http://127.0.0.1:7777

Nomes escolta a 127.0.0.1: no es accessible des de fora d'aquesta maquina.
No fa servir cap token: el `gh` ja esta autenticat al sistema.

FASE 1 — nomes lectura. L'unic endpoint implementat es /api/status; la resta
retornen 501 i el frontend cau a dades d'exemple tot sol.
"""

import json
import os
import re
import subprocess
import sys
from datetime import date, datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PORT = 7777
HOST = "127.0.0.1"

# Endpoints previstos pero encara no implementats. El frontend els demana,
# rep 501 i ensenya la seccio en mode demo amb el badge de pendent.
NOT_YET = ("/api/pinned", "/api/lint")


# --------------------------------------------------------------------------
# utilitats
# --------------------------------------------------------------------------

def run(args, cwd=REPO, timeout=15):
    """Executa un proces sense shell. Retorna (ok, stdout). Mai llenca."""
    try:
        p = subprocess.run(
            args, cwd=cwd, timeout=timeout,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        out = p.stdout.decode("utf-8", "replace").strip()
        return (p.returncode == 0, out)
    except Exception:
        return (False, "")


def read(path):
    """Llegeix un fitxer del repo en text. Cadena buida si no hi es."""
    try:
        with open(os.path.join(REPO, path), "rb") as f:
            return f.read().decode("utf-8", "replace")
    except Exception:
        return ""


def ago(iso_ts):
    """'2026-08-19T11:20:49Z' -> 'fa 2 h'. Cadena buida si no es parseja."""
    if not iso_ts:
        return ""
    try:
        ts = datetime.strptime(iso_ts.replace("Z", "+0000"), "%Y-%m-%dT%H:%M:%S%z")
    except Exception:
        return ""
    secs = (datetime.now(timezone.utc) - ts).total_seconds()
    if secs < 90:
        return "ara mateix"
    mins = secs / 60
    if mins < 60:
        return "fa %d min" % int(mins)
    hours = mins / 60
    if hours < 24:
        return "fa %d h" % int(hours)
    days = int(hours / 24)
    return "fa %d dia" % days if days == 1 else "fa %d dies" % days


# --------------------------------------------------------------------------
# git
# --------------------------------------------------------------------------

def git_state():
    ok, branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    branch = branch if ok else "?"

    ok, porcelain = run(["git", "status", "--porcelain"])
    dirty = len([l for l in porcelain.splitlines() if l.strip()]) if ok else 0

    # --left-right compta darrere...davant respecte del remot
    ahead = behind = 0
    ok, counts = run(["git", "rev-list", "--left-right", "--count",
                      "origin/%s...HEAD" % branch])
    if ok and counts:
        parts = counts.split()
        if len(parts) == 2:
            behind, ahead = int(parts[0]), int(parts[1])

    return {"branch": branch, "dirty": dirty, "ahead": ahead, "behind": behind}


# --------------------------------------------------------------------------
# CI (gh)
# --------------------------------------------------------------------------

def ci_state():
    blank = {"conclusion": "unknown", "name": "CI", "when": "", "url": ""}
    ok, out = run([
        "gh", "run", "list", "--workflow", "CI", "--limit", "1",
        "--json", "conclusion,status,displayTitle,createdAt,url",
    ], timeout=25)
    if not ok or not out:
        return blank
    try:
        runs = json.loads(out)
    except Exception:
        return blank
    if not runs:
        return blank
    r = runs[0]
    # Un run en curs no te conclusion: ho marquem com a "in_progress"
    concl = r.get("conclusion") or ("in_progress" if r.get("status") != "completed" else "unknown")
    return {
        "conclusion": concl,
        "name": (r.get("displayTitle") or "CI")[:48],
        "when": ago(r.get("createdAt", "")),
        "url": r.get("url", ""),
    }


# --------------------------------------------------------------------------
# comptadors de la base de dades (dins index.html)
# --------------------------------------------------------------------------

def count_objects(src, i):
    """
    Compta els objectes de primer nivell d'un array, comencant a `i` (just
    despres del [ que l'obre). Retorna (compte, index_del_claudator_de_tancar).

    Camina els caracters portant la compta de profunditat i saltant-se el que
    hi ha dins de strings, perque una descripcio amb un [ o un { no desquadri
    el recompte. Les strings de DATA son sempre de cometa simple.

    ⚠️ Els comentaris s'han de saltar ABANS de mirar les cometes: dins de DATA
    n'hi ha molts i porten apostrofs catalans («// Tomas d'Aquino»), que si no
    es tracten obren una string fantasma i desquadren tot el recompte.
    """
    depth = 0            # profunditat DINS de l'array
    count = 0
    in_str = False
    quote = ""
    n = len(src)
    while i < n:
        ch = src[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                in_str = False
            i += 1
            continue
        # comentaris primer que res (veure l'avis del docstring)
        if ch == "/" and i + 1 < n:
            nxt = src[i + 1]
            if nxt == "/":
                j = src.find("\n", i)
                i = n if j == -1 else j + 1
                continue
            if nxt == "*":
                j = src.find("*/", i + 2)
                i = n if j == -1 else j + 2
                continue
        if ch in ("'", '"', "`"):
            in_str = True
            quote = ch
            i += 1
            continue
        if ch in ("{", "["):
            if depth == 0 and ch == "{":
                count += 1
            depth += 1
        elif ch in ("}", "]"):
            if depth == 0 and ch == "]":
                return (count, i)        # tanca l'array: fi
            depth -= 1
        i += 1
    return (count, n)


def count_entries(src, name):
    """Objectes de primer nivell de `const NAME=[ ... ]`."""
    m = re.search(r"const\s+" + name + r"\s*=\s*\[", src)
    if not m:
        return 0
    return count_objects(src, m.end())[0]


def count_marc_blocks(src):
    """
    Blocs de periode de dins de MARCS. Es el numero que importa de veritat:
    els marcs nomes son dos contenidors (Occident, Espanya), pero els blocs
    son contingut escrit a ma i son els que diuen com de plena esta la BD.
    """
    m = re.search(r"const\s+MARCS\s*=\s*\[", src)
    if not m:
        return 0
    _, end = count_objects(src, m.end())
    total = 0
    for bm in re.finditer(r"blocks\s*:\s*\[", src[m.end():end]):
        total += count_objects(src, m.end() + bm.end())[0]
    return total


def db_state():
    src = read("index.html")
    return {
        "people": count_entries(src, "PEOPLE"),
        "events": count_entries(src, "EVENTS"),
        "marcs": count_entries(src, "MARCS"),
        "blocks": count_marc_blocks(src),
        "collections": count_entries(src, "COLLECTIONS"),
        "eras": count_entries(src, "ERAS"),
    }


# --------------------------------------------------------------------------
# Personatge del dia (PD_PINNED, dins joc.html)
# --------------------------------------------------------------------------

def parse_pinned():
    """[{date, qid}] ordenat per data. Nomes llegeix; no escriu res."""
    src = read("joc.html")
    m = re.search(r"const\s+PD_PINNED\s*=\s*\{(.*?)\}", src, re.DOTALL)
    if not m:
        return []
    body = m.group(1)
    found = re.findall(r"['\"](\d{4}-\d{2}-\d{2})['\"]\s*:\s*['\"](Q\d+)['\"]", body)
    return [{"date": d, "qid": q} for d, q in sorted(found)]


def pd_state():
    pins = parse_pinned()
    today = date.today().isoformat()
    upcoming = [p for p in pins if p["date"] > today]
    cushion = None
    if upcoming:
        nxt = datetime.strptime(upcoming[0]["date"], "%Y-%m-%d").date()
        cushion = (nxt - date.today()).days
    return {
        "pinned": len(pins),
        "future": len(upcoming),
        "next": upcoming[0]["date"] if upcoming else None,
        "cushion": cushion,
    }


# --------------------------------------------------------------------------
# densitat de contingut per segle
# --------------------------------------------------------------------------

_ROMAN_VALS = [
    (1000,'M'),(900,'CM'),(500,'D'),(400,'CD'),(100,'C'),(90,'XC'),
    (50,'L'),(40,'XL'),(10,'X'),(9,'IX'),(5,'V'),(4,'IV'),(1,'I'),
]

def _to_roman(n):
    r = ''
    for v, s in _ROMAN_VALS:
        while n >= v:
            r += s; n -= v
    return r


def _century_label(c):
    """Etiqueta per al segle que comença a l'any c (múltiple de 100)."""
    if c >= 0:
        return "s. " + _to_roman(c // 100 + 1)
    else:
        return "s. " + _to_roman((-c) // 100) + " aC"


def _field_years(src, const_name, field_name):
    """Extreu tots els valors numèrics de 'field_name:N' dins de 'const NAME=[...]'."""
    m = re.search(r'const\s+' + const_name + r'\s*=\s*\[', src)
    if not m:
        return []
    _, end = count_objects(src, m.end())
    chunk = src[m.end():end]
    return [int(x) for x in re.findall(r'\b' + field_name + r'\s*:\s*(-?\d+)', chunk)]


def density_state():
    """Nombre d'ítems (events + naixements) per segle, ordenat cronològicament."""
    src = read("index.html")
    years = _field_years(src, "EVENTS", "year") + _field_years(src, "PEOPLE", "birth")
    if not years:
        return []
    counts = {}
    for y in years:
        c = (y // 100) * 100   # Python floor-division: funciona bé per a negatius
        counts[c] = counts.get(c, 0) + 1
    return [
        {"label": _century_label(c), "year": c, "n": counts[c]}
        for c in sorted(counts)
    ]


# --------------------------------------------------------------------------
# backlog (BACKLOG.md)
# --------------------------------------------------------------------------

BACKLOG_FILE = "BACKLOG.md"


def parse_backlog():
    """Retorna la llista d'ítems oberts de BACKLOG.md (els [TANCAT] s'oculten)."""
    content = read(BACKLOG_FILE)
    items = []
    current_title = None
    current_closed = False
    current_lines = []

    for line in content.splitlines():
        if line.startswith("## "):
            if current_title is not None:
                body = "\n".join(current_lines).strip()
                if not current_closed:
                    items.append({"title": current_title, "body": body})
            title = line[3:].strip()
            current_closed = title.startswith("[TANCAT]")
            if current_closed:
                title = title[len("[TANCAT]"):].strip()
            current_title = title
            current_lines = []
        elif current_title is not None:
            current_lines.append(line)

    if current_title is not None:
        body = "\n".join(current_lines).strip()
        if not current_closed:
            items.append({"title": current_title, "body": body})

    return items


def _backlog_load():
    path = os.path.join(REPO, BACKLOG_FILE)
    with open(path, encoding="utf-8") as f:
        return f.readlines(), path


def _find_section(lines, title):
    """(start, end) de la secció amb aquest títol, o ValueError."""
    start = None
    for i, line in enumerate(lines):
        t = line.rstrip("\n")
        if t in ("## " + title, "## [TANCAT] " + title):
            start = i
            break
    if start is None:
        raise ValueError("Ítem no trobat: " + title)
    end = len(lines)
    for i in range(start + 1, len(lines)):
        if lines[i].startswith("## "):
            end = i
            break
    return start, end


def _save(path, lines):
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(lines)


def backlog_close(title):
    try:
        lines, path = _backlog_load()
        start, _ = _find_section(lines, title)
        if "[TANCAT]" in lines[start]:
            return False, "Ja estava tancat"
        lines[start] = "## [TANCAT] " + lines[start][3:]
        _save(path, lines)
        return True, "Tancat"
    except Exception as e:
        return False, str(e)


def backlog_delete(title):
    try:
        lines, path = _backlog_load()
        start, end = _find_section(lines, title)
        del lines[start:end]
        _save(path, lines)
        return True, "Eliminat"
    except Exception as e:
        return False, str(e)


def backlog_annotate(title, note):
    try:
        lines, path = _backlog_load()
        start, end = _find_section(lines, title)
        note_line = "> Nota (%s): %s\n" % (date.today().isoformat(), note.strip())
        insert = end
        while insert > start + 1 and lines[insert - 1].strip() == "":
            insert -= 1
        lines.insert(insert, note_line)
        _save(path, lines)
        return True, "Nota afegida"
    except Exception as e:
        return False, str(e)


def backlog_add(title, body):
    try:
        path = os.path.join(REPO, BACKLOG_FILE)
        with open(path, encoding="utf-8") as f:
            content = f.read()
        section = "\n## " + title.strip() + "\n"
        if body and body.strip():
            section += body.strip() + "\n"
        content = content.rstrip("\n") + "\n" + section
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return True, "Afegit"
    except Exception as e:
        return False, str(e)


# --------------------------------------------------------------------------
# servidor
# --------------------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        # Silenci: nomes ens interessen els errors, no cada GET.
        pass

    def _send(self, code, body, ctype):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, code, payload):
        self._send(code, json.dumps(payload, ensure_ascii=False), "application/json; charset=utf-8")

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b""
        try:
            data = json.loads(body) if body else {}
        except Exception:
            data = {}

        if path == "/api/push":
            try:
                p = subprocess.run(
                    ["git", "push"], cwd=REPO, timeout=60,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                )
                out = (p.stdout + p.stderr).decode("utf-8", "replace").strip()
                self._json(200, {"ok": p.returncode == 0, "output": out})
            except Exception as e:
                self._json(200, {"ok": False, "output": str(e)})
            return

        if path == "/api/shutdown":
            self._json(200, {"ok": True})
            import threading
            threading.Timer(0.3, self.server.shutdown).start()
            return

        if path == "/api/backlog/close":
            title = data.get("title", "").strip()
            if not title:
                self._json(400, {"ok": False, "msg": "Títol obligatori"})
                return
            ok, msg = backlog_close(title)
            self._json(200 if ok else 404, {"ok": ok, "msg": msg})
            return

        if path == "/api/backlog/delete":
            title = data.get("title", "").strip()
            if not title:
                self._json(400, {"ok": False, "msg": "Títol obligatori"})
                return
            ok, msg = backlog_delete(title)
            self._json(200 if ok else 404, {"ok": ok, "msg": msg})
            return

        if path == "/api/backlog/annotate":
            title = data.get("title", "").strip()
            note = data.get("note", "").strip()
            if not title or not note:
                self._json(400, {"ok": False, "msg": "Títol i nota obligatoris"})
                return
            ok, msg = backlog_annotate(title, note)
            self._json(200 if ok else 404, {"ok": ok, "msg": msg})
            return

        if path == "/api/backlog/add":
            title = data.get("title", "").strip()
            if not title:
                self._json(400, {"ok": False, "msg": "Títol obligatori"})
                return
            ok, msg = backlog_add(title, data.get("body", ""))
            self._json(200 if ok else 500, {"ok": ok, "msg": msg})
            return

        self._send(404, "no", "text/plain; charset=utf-8")

    def do_GET(self):
        path = self.path.split("?", 1)[0]

        if path in ("/", "/index.html", "/dashboard.html"):
            html = ""
            try:
                with open(os.path.join(HERE, "dashboard.html"), "rb") as f:
                    html = f.read()
            except Exception:
                self._send(500, "dashboard.html no trobat", "text/plain; charset=utf-8")
                return
            self._send(200, html, "text/html; charset=utf-8")
            return

        if path == "/api/status":
            try:
                payload = {
                    "ci": ci_state(),
                    "db": db_state(),
                    "pd": pd_state(),
                }
                payload.update(git_state())
                self._json(200, payload)
            except Exception as e:
                self._json(500, {"error": str(e)})
            return

        if path == "/api/density":
            try:
                self._json(200, density_state())
            except Exception as e:
                self._json(500, {"error": str(e)})
            return

        if path == "/api/backlog":
            try:
                self._json(200, parse_backlog())
            except Exception as e:
                self._json(500, {"error": str(e)})
            return

        if path in NOT_YET:
            self._json(501, {"implemented": False, "endpoint": path})
            return

        self._send(404, "no", "text/plain; charset=utf-8")


def main():
    if not os.path.isdir(os.path.join(REPO, ".git")):
        sys.exit("ERROR: %s no sembla un repo git." % REPO)
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    print("HB · Control  ->  http://%s:%d" % (HOST, PORT))
    print("repo: %s" % REPO)
    print("Ctrl+C per aturar.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nAturat.")
        srv.server_close()


if __name__ == "__main__":
    main()
