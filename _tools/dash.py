#!/usr/bin/env python3
"""
HB · Control — servidor local del dashboard.

    python3 _tools/dash.py        ->  http://127.0.0.1:7777

Nomes escolta a 127.0.0.1: no es accessible des de fora d'aquesta maquina.
No fa servir cap token: el `gh` ja esta autenticat al sistema.

Els endpoints encara no implementats son a NOT_YET: retornen 501 i el frontend
cau a dades d'exemple tot sol, amb el badge de pendent a la seccio.
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
NOT_YET = ("/api/pinned",)


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
    """Nombre d'ítems (events + naixements) per segle, s. I aC fins avui.
    Segles buits inclosos (n=0) per mostrar els buits. Contingut anterior
    al s. I aC (any -100) s'ignora: massa antic per ser útil com a densitat.
    """
    src = read("index.html")
    years = _field_years(src, "EVENTS", "year") + _field_years(src, "PEOPLE", "birth")

    today_c = (date.today().year // 100) * 100
    # Omple tots els segles del rang amb 0
    counts = {c: 0 for c in range(-100, today_c + 100, 100)}
    for y in years:
        c = (y // 100) * 100
        if c in counts:          # ignora el contingut anterior al s. I aC
            counts[c] += 1

    return [
        {"label": _century_label(c), "year": c, "n": counts[c]}
        for c in sorted(counts)
    ]


# --------------------------------------------------------------------------
# diagnosi de la BD (index.html)
# --------------------------------------------------------------------------

MAX_CATS = 2          # el disseny en permet 0-2 (2 = barra ratllada)
MAX_AGE = 110         # longevitat per sobre de la qual val la pena mirar-s'ho


def iter_objects(src, const_name):
    """
    Genera (text_de_l_objecte, numero_de_linia) per cada objecte de primer
    nivell de `const NAME=[...]`. Camina els caracters com count_objects
    (saltant strings i comentaris) pero retorna el contingut, no el compte.
    """
    m = re.search(r"const\s+" + const_name + r"\s*=\s*\[", src)
    if not m:
        return
    i = m.end()
    n = len(src)
    depth = 0
    start = None
    in_str = False
    quote = ""
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
                start = i
            depth += 1
        elif ch in ("}", "]"):
            if depth == 0 and ch == "]":
                return               # tanca l'array: fi
            depth -= 1
            if depth == 0 and start is not None:
                yield (src[start:i + 1], src.count("\n", 0, start) + 1)
                start = None
        i += 1


def _f(obj, field):
    """Valor d'un camp string (`camp:'text'`). None si no hi es."""
    m = re.search(r"\b" + field + r"\s*:\s*'((?:[^'\\]|\\.)*)'", obj)
    return m.group(1) if m else None


def _n(obj, field):
    """Valor d'un camp numeric. None si no hi es o es null."""
    m = re.search(r"\b" + field + r"\s*:\s*(-?\d+)", obj)
    return int(m.group(1)) if m else None


def _cats(obj):
    """Llista de categories de `cats:['A','B']`. [] si el camp no hi es."""
    m = re.search(r"\bcats\s*:\s*\[([^\]]*)\]", obj)
    if not m:
        return []
    return re.findall(r"'([^']*)'", m.group(1))


def _known_cats(src):
    m = re.search(r"const\s+CAT_COLORS\s*=\s*\{(.*?)\}", src, re.DOTALL)
    return set(re.findall(r"'([^']+)'\s*:", m.group(1))) if m else set()


def _dupes(pairs):
    """[(valor, [etiquetes...])] pels valors que surten mes d'una vegada."""
    seen = {}
    for val, who in pairs:
        seen.setdefault(val, []).append(who)
    return [(v, w) for v, w in seen.items() if len(w) > 1]


def lint_state():
    """
    Diagnosi de la base de dades: incoherencies que la pagina no et dira
    (no petara, simplement pintara alguna cosa rara o no la pintara).
    Retorna [{sev, txt, who}] amb sev = bad (error) | warn (avis) | ok.
    """
    src = read("index.html")
    cats_ok = _known_cats(src)
    now = date.today().year
    out = []

    def bad(txt, who=""):
        out.append({"sev": "bad", "txt": txt, "who": who})

    def warn(txt, who=""):
        out.append({"sev": "warn", "txt": txt, "who": who})

    people = list(iter_objects(src, "PEOPLE"))
    events = list(iter_objects(src, "EVENTS"))
    colls = list(iter_objects(src, "COLLECTIONS"))
    eras = list(iter_objects(src, "ERAS"))

    # --- ids i QIDs duplicats -------------------------------------------
    for const, items in (("PEOPLE", people), ("EVENTS", events),
                         ("COLLECTIONS", colls)):
        for val, who in _dupes([(_f(o, "id"), "línia %d" % ln)
                                for o, ln in items if _f(o, "id")]):
            bad("%s: id duplicat ‘%s’" % (const, val), " · ".join(who))

    for val, who in _dupes([(_f(o, "wd"), _f(o, "name") or "?")
                            for o, _ in people if _f(o, "wd")]):
        bad("PEOPLE: el QID %s surt %d vegades" % (val, len(who)),
            " · ".join(who))

    # --- personatges -----------------------------------------------------
    for obj, ln in people:
        nom = _f(obj, "name") or ("línia %d" % ln)
        b, d = _n(obj, "birth"), _n(obj, "death")
        viu = re.search(r"\bdeath\s*:\s*null", obj) is not None

        if b is None:
            bad("%s: sense any de naixement" % nom, "línia %d" % ln)
        elif d is not None and d < b:
            bad("%s: mor (%d) abans de néixer (%d)" % (nom, d, b),
                "línia %d" % ln)
        elif d is not None and d - b > MAX_AGE:
            warn("%s: %d anys de vida (%d–%d)" % (nom, d - b, b, d),
                 "revisa-ho, o bé és correcte i ja està")
        elif b > now:
            bad("%s: neix l'any %d, que encara no ha arribat" % (nom, b),
                "línia %d" % ln)

        if d is None and not viu:
            bad("%s: sense any de mort ni death:null" % nom, "línia %d" % ln)

        cs = _cats(obj)
        if len(cs) > MAX_CATS:
            warn("%s: %d categories (el disseny en pinta %d)"
                 % (nom, len(cs), MAX_CATS), " · ".join(cs))
        if len(set(cs)) < len(cs):
            bad("%s: categoria repetida" % nom, " · ".join(cs))
        for c in sorted(set(cs) - cats_ok):
            bad("%s: categoria desconeguda ‘%s’" % (nom, c),
                "no és a CAT_COLORS")

        if not _f(obj, "wd"):
            warn("%s: sense QID" % nom,
                 "no es podrà referenciar des d'una col·lecció")
        if not _f(obj, "wiki"):
            warn("%s: sense enllaç a la Viquipèdia" % nom, "línia %d" % ln)
        if not _f(obj, "desc"):
            warn("%s: sense descripció" % nom, "la fitxa sortirà buida")

    # --- events ----------------------------------------------------------
    for obj, ln in events:
        nom = _f(obj, "name") or ("línia %d" % ln)
        if _n(obj, "year") is None:
            bad("%s: sense any" % nom, "línia %d" % ln)
        if _n(obj, "sitelinks") is None and _n(obj, "imp") is None:
            warn("%s: sense sitelinks ni imp" % nom,
                 "el motor de zoom no sabrà quan mostrar-lo")
        if not _f(obj, "desc"):
            warn("%s: sense descripció" % nom, "la fitxa sortirà buida")

    # --- eres i blocs de marc --------------------------------------------
    for obj, ln in eras:
        nom = _f(obj, "name") or ("línia %d" % ln)
        s, e = _n(obj, "start"), _n(obj, "end")
        if s is not None and e is not None and e <= s:
            bad("ERAS · %s: acaba (%d) abans o quan comença (%d)"
                % (nom, e, s), "línia %d" % ln)

    mm = re.search(r"const\s+MARCS\s*=\s*\[", src)
    if mm:
        _, mend = count_objects(src, mm.end())
        for bmm in re.finditer(r"blocks\s*:\s*\[", src[mm.end():mend]):
            off = mm.end() + bmm.end()
            for obj, ln in iter_objects("const X=[" + src[off:mend], "X"):
                s, e = _n(obj, "start"), _n(obj, "end")
                nom = _f(obj, "name") or "bloc sense nom"
                if s is not None and e is not None and e <= s:
                    bad("MARCS · %s: acaba (%d) abans o quan comença (%d)"
                        % (nom, e, s), "dins de blocks")
            break   # iter_objects ja recorre tots els blocs del primer marc

    # --- col·leccions ----------------------------------------------------
    for obj, ln in colls:
        nom = _f(obj, "name") or ("línia %d" % ln)
        wds = re.search(r"\bwds\s*:\s*\[([^\]]*)\]", obj)
        # Els comentaris de dins de wds porten apostrofs rectes («d'Aquino»)
        # que desquadrarien l'extraccio: es treuen abans de llegir els QIDs.
        raw = re.sub(r"//[^\n]*", "", wds.group(1)) if wds else ""
        qids = re.findall(r"'([^']*)'", raw)
        if not qids:
            warn("%s: col·lecció buida" % nom, "línia %d" % ln)
        for q in qids:
            if not re.fullmatch(r"Q\d+", q):
                bad("%s: ‘%s’ no té forma de QID" % (nom, q), "línia %d" % ln)
        dup = _dupes([(q, q) for q in qids])
        if dup:
            warn("%s: QIDs repetits" % nom,
                 " · ".join(v for v, _ in dup))

    # --- integritat del fitxer -------------------------------------------
    if "�" in src:
        n_bad = src.count("�")
        lines = [str(src.count("\n", 0, m.start()) + 1)
                 for m in re.finditer("�", src)]
        bad("%d caràcter%s corromput%s (U+FFFD)"
            % (n_bad, "s" if n_bad != 1 else "", "s" if n_bad != 1 else ""),
            "línies " + ", ".join(lines[:8]))

    if not out:
        out.append({"sev": "ok", "txt": "Cap incoherència a la base de dades",
                    "who": "%d personatges · %d events · %d eres · %d col·leccions"
                           % (len(people), len(events), len(eras), len(colls))})
    return out


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

        if path == "/api/lint":
            try:
                self._json(200, lint_state())
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
