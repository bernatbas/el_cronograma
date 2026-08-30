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
import unicodedata
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PORT = 7777
HOST = "127.0.0.1"

# Endpoints previstos pero encara no implementats. El frontend els demana,
# rep 501 i ensenya la seccio en mode demo amb el badge de pendent.
NOT_YET = ()


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
# INGESTA A LA BD — d'un enllac / QID / nom a una entrada de PEOPLE
# --------------------------------------------------------------------------
# Sense IA i sense raspar HTML: cada article de la Viquipedia sap el seu QID, i
# Wikidata dona les dades ja estructurades. Dues crides i prou.
# De moment NOMES persones (es valida P31=Q5) i NOMES en catala.

WD_API = "https://www.wikidata.org/w/api.php"
UA = {"User-Agent": "HB-Control/1.0 (dashboard local)"}
PREC = {6: "mil·lenni", 7: "segle", 8: "decada", 9: "any", 10: "mes", 11: "dia"}

# Ocupacio (P106) -> slug de CAT_COLORS, per ordre d'especificitat: la primera
# que encaixa mana. P106 en dona moltes (Rosa Luxemburg en te 11) i a l'index
# nomes hi caben 2 per persona.
CAT_BY_P106 = [
    ("philosophy", {"Q4964182", "Q1234713", "Q16267607"}),
    # Les ciencies naturals de camp hi faltaven, i el forat feia mal: Darwin obre
    # amb geoleg, explorador, etoleg i naturalista —cap hi era— i acabava sortint
    # de filosofia, que a ell li ve a la sisena posicio.
    ("science",    {"Q901", "Q169470", "Q170790", "Q11063", "Q593644", "Q81096",
                    "Q205375", "Q39631", "Q864503", "Q2374149", "Q13418253",
                    "Q520549", "Q18805", "Q16831721", "Q350979", "Q2055046",
                    "Q10872101"}),
    ("literature", {"Q36180", "Q49757", "Q6625963", "Q214917", "Q482980",
                    "Q1930187", "Q4853732", "Q18939491"}),
    ("music",      {"Q36834", "Q639669", "Q486748", "Q1259917", "Q158852", "Q177220"}),
    ("painting",   {"Q1028181", "Q1281618", "Q11569986", "Q33231", "Q644687"}),
    ("politics",   {"Q82955", "Q193391", "Q116", "Q47064", "Q189290", "Q30461",
                    "Q372436", "Q842782", "Q10076267", "Q1097498"}),
    ("religion",   {"Q42603", "Q2259532", "Q3315492"}),
    ("sport",      {"Q937857", "Q2066131", "Q10833314", "Q3665646", "Q11513337",
                    "Q13141064", "Q13381863", "Q10843402", "Q2309784"}),
]


def _clean_desc(s):
    """La description de Wikidata es una etiqueta per desambiguar en una llista,
    no una descripcio: «filòsof xinès (cir. 551 – cir. 479 aC)». Li traiem el
    parentesi final si porta xifres —els anys ja son als seus camps— i li posem
    majuscula, que es la forma que tenen les de PEOPLE escrites a ma. Queda una
    llavor curta i correcta per ampliar.
    Un parentesi SENSE xifres es contingut («pintor (escola de Barbizon)») i es queda."""
    s = (s or "").strip()
    m = re.match(r"^(.*?)\s*\(([^()]*)\)\s*$", s)
    if m and re.search(r"\d", m.group(2)):
        s = m.group(1).strip()
    return (s[0].upper() + s[1:]) if s else s


def _wd_get(url):
    """GET + JSON contra una API de Wikimedia. None si falla."""
    try:
        r = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(r, timeout=12) as f:
            return json.load(f)
    except Exception:
        return None


def _qid_from_wikipedia(url):
    """Enllac d'article -> (QID, titol). Via pageprops; cap parseig d'HTML."""
    try:
        host = url.split("//", 1)[1].split("/", 1)[0]
        title = urllib.parse.unquote(url.rstrip("/").rsplit("/", 1)[1])
    except Exception:
        return None, None
    d = _wd_get("https://%s/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item"
                "&titles=%s&format=json&origin=*" % (host, urllib.parse.quote(title)))
    if not d:
        return None, title
    for pg in ((d.get("query") or {}).get("pages") or {}).values():
        q = (pg.get("pageprops") or {}).get("wikibase_item")
        if q:
            return q, pg.get("title") or title
    return None, title


def _qid_from_name(name):
    """Nom lliure -> QID. wbsearchentities vol UN sol codi d'idioma, no llista."""
    d = _wd_get(WD_API + "?action=wbsearchentities&format=json&origin=*&type=item"
                "&limit=8&language=ca&uselang=ca&search=" + urllib.parse.quote(name))
    for hit in (d or {}).get("search") or []:
        if re.fullmatch(r"Q\d+", hit.get("id", "")):
            return hit["id"]
    return None


def _wd_year(claims, pid):
    """(any, precisio, quantes_dates_diferents) de P569/P570.
    Prefereix el rank 'preferred'. Alguns antics tenen 5 dates de fonts
    diferents, i cal poder avisar-ne.
    ⚠️ wbgetentities NO desplaça les dates aC: -0384 son 384 aC i prou. El -1
    nomes cal per a SPARQL (veure els avisos del CLAUDE.md)."""
    best, anys = None, set()
    for c in claims.get(pid, []):
        if c.get("rank") == "deprecated":
            continue
        v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value")
        if not v or not v.get("time"):
            continue
        t0 = v["time"]
        try:
            anys.add(int(t0[1:5]) * (-1 if t0[0] == "-" else 1))
        except Exception:
            pass
        if c.get("rank") == "preferred":
            best = v
            break
        if best is None:
            best = v
    if not best:
        return None, None, 0
    t = best["time"]
    try:
        year = int(t[1:5]) * (-1 if t[0] == "-" else 1)
    except Exception:
        return None, None, 0
    return year, best.get("precision"), len(anys)


def _slug_id(name, taken):
    """id a partir del nom: sense accents, minuscules, nomes lletres i xifres."""
    s = unicodedata.normalize("NFD", name or "")
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = re.sub(r"[^A-Za-z0-9]+", "", s).lower()[:22] or "persona"
    base, n = s, 2
    while s in taken:
        s = "%s%d" % (base, n)
        n += 1
    return s


def existing_people():
    """(ids, qids) que ja son a PEOPLE, per no duplicar."""
    src = read("index.html")
    m = re.search(r"const\s+PEOPLE\s*=\s*\[", src)
    if not m:
        return set(), set()
    _, end = count_objects(src, m.end())
    seg = src[m.end():end]
    return (set(re.findall(r"id:'([^']+)'", seg)),
            set(re.findall(r"wd:'(Q\d+)'", seg)))


def resolve_person(q, allow_existing=False):
    """Enllac | QID | nom -> camps per omplir el formulari + avisos."""
    q = (q or "").strip()
    if not q:
        return {"ok": False, "msg": "Escriu un enllac, un QID o un nom"}

    wiki_url, title = "", ""
    if q.startswith("http"):
        if "wikipedia.org" not in q:
            return {"ok": False, "msg": "Nomes enllaços de la Viquipedia"}
        qid, title = _qid_from_wikipedia(q)
        wiki_url = q
        if not qid:
            return {"ok": False, "msg": "Aquest article no te item de Wikidata"}
    elif re.fullmatch(r"[Qq]\d+", q):
        qid = "Q" + q[1:]
    else:
        qid = _qid_from_name(q)
        if not qid:
            return {"ok": False, "msg": "No he trobat res amb aquest nom"}

    e = _wd_get(WD_API + "?action=wbgetentities&ids=%s&props=labels|descriptions|claims|sitelinks"
                "&languages=ca&format=json&origin=*" % qid)
    ent = ((e or {}).get("entities") or {}).get(qid)
    if not ent or "missing" in ent:
        return {"ok": False, "msg": "Wikidata no retorna cap entitat per a " + qid}
    claims = ent.get("claims") or {}

    def ids_of(pid):
        out = []
        for c in claims.get(pid, []):
            if c.get("rank") == "deprecated":
                continue
            v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value")
            if isinstance(v, dict) and v.get("id"):
                out.append(v["id"])
        return out

    # VALIDACIO: nomes persones, igual que el cercador de l'index (humansOnly)
    if "Q5" not in ids_of("P31"):
        return {"ok": False, "msg": "%s no es una persona (de moment nomes persones)" % qid}

    warnings = []   # [{field, msg}]
    ca_link = (ent.get("sitelinks") or {}).get("cawiki") or {}
    ca_title = ca_link.get("title") or ""
    # Ordre a proposit: titol de l'article enganxat > titol de l'article catala >
    # label de Wikidata > el que hagi escrit l'usuari. Hi ha entitats sense label
    # en catala (Q7231) i el label d'un altre idioma donava «Rosa Luxemburgo».
    name = (title or ca_title
            or ((ent.get("labels") or {}).get("ca") or {}).get("value") or "")
    if not name and not q.startswith("http") and not re.fullmatch(r"[Qq]\d+", q):
        name = q
    if not name:
        warnings.append({"field": "dnom", "msg": "Sense nom en catala a Wikidata: escriu-lo tu"})
    desc = _clean_desc(((ent.get("descriptions") or {}).get("ca") or {}).get("value") or "")
    if not desc:
        warnings.append({"field": "ddesc", "msg": "Sense descripcio en catala a Wikidata: escriu-la tu"})

    birth, bp, bn = _wd_year(claims, "P569")
    death, dp, dn = _wd_year(claims, "P570")
    if birth is None:
        warnings.append({"field": "dbirth", "msg": "Wikidata no en dona cap any de naixement. Es obligatori: posa'l tu."})
    elif bp is not None and bp < 9:
        warnings.append({"field": "dbirth", "msg": "La data nomes te precisio de %s, no d'any exacte. Comprova-la." % PREC.get(bp, bp)})
    if death is not None and dp is not None and dp < 9:
        warnings.append({"field": "ddeath", "msg": "La data nomes te precisio de %s, no d'any exacte. Comprova-la." % PREC.get(dp, dp)})
    if bn > 1:
        warnings.append({"field": "dbirth", "msg": "Wikidata en dona %d de diferents, de fonts que no es posen d'acord. He agafat la preferida (%s), pero es una estimacio." % (bn, birth)})
    if dn > 1:
        warnings.append({"field": "ddeath", "msg": "Wikidata en dona %d de diferents, de fonts que no es posen d'acord. He agafat la preferida (%s), pero es una estimacio." % (dn, death)})

    # Mana l'ordre de P106, no el de CAT_BY_P106. Wikidata posa «escriptor»
    # (Q36180) a tothom qui hagi escrit res, i amb l'ordre de la nostra llista
    # —literature abans que music— Verdi i Beethoven sortien de literatura.
    # A P106, en canvi, la principal va primer: Verdi obre amb «compositor»,
    # Leonardo amb «pintor», Voltaire amb «filosof». Per aixo guanya la categoria
    # de l'ocupacio que apareix abans.
    occ = ids_of("P106")
    primera = {}
    for i, q in enumerate(occ):
        for slug, qids in CAT_BY_P106:
            if q in qids:
                primera.setdefault(slug, i)
    cats = sorted(primera, key=primera.get)[:2]
    if not cats:
        warnings.append({"field": "dcat", "msg": "No he pogut deduir la categoria de l'ocupacio (P106) de Wikidata: tria-la tu"})

    gender = ""
    g = ids_of("P21")
    if g:
        gender = "F" if g[0] == "Q6581072" else ("M" if g[0] == "Q6581097" else "")

    if not wiki_url:
        if ca_title:
            wiki_url = "https://ca.wikipedia.org/wiki/" + urllib.parse.quote(ca_title.replace(" ", "_"))
        else:
            warnings.append({"field": "dwiki", "msg": "Aquesta entitat no te article a la Viquipedia catalana"})

    # Ser ja a PEOPLE nomes es un problema si vols AFEGIR-lo. Per clavar-lo com a
    # personatge del dia es indiferent (de fet es bon senyal), i per aixo qui crida
    # pot demanar que no bloquegi.
    ids_taken, qids_taken = existing_people()
    if qid in qids_taken and not allow_existing:
        return {"ok": False, "msg": "%s ja es a PEOPLE" % qid}

    return {"ok": True, "qid": qid, "id": _slug_id(name or qid, ids_taken),
            "name": name, "desc": desc, "birth": birth, "death": death,
            "cats": cats, "gender": gender, "wiki": wiki_url,
            "sitelinks": len(ent.get("sitelinks") or {}), "warnings": warnings}


def _js_str(s):
    """Literal per a [1] DATA. Les strings son de cometa simple: un ' recte
    deixaria la pagina en blanc, aixi que passa a l'apostrof tipografic."""
    return (s or "").replace("\\", "").replace("'", "\u2019").replace("\n", " ").strip()


def person_literal(d):
    cats = ",".join("'%s'" % c for c in (d.get("cats") or []))
    death = d.get("death")
    parts = [
        "id:'%s'" % d["id"],
        ("wd:'%s'" % d["qid"]) if d.get("qid") else None,
        "name:'%s'" % _js_str(d.get("name")),
        "birth:%d" % int(d["birth"]),
        "death:%s" % ("null" if death in (None, "") else int(death)),
        "cats:[%s]" % cats,
        ("gender:'%s'" % d["gender"]) if d.get("gender") else None,
        ("wiki:'%s'" % d["wiki"]) if d.get("wiki") else None,
        ("desc:'%s'" % _js_str(d["desc"])) if d.get("desc") else None,
    ]
    return "  {" + ",".join(x for x in parts if x) + "},"


def db_add_person(d):
    """Insereix la persona al final de PEOPLE i committeja. Comprova ABANS que
    els essencials hi son i DESPRES que l'array segueix quadrant."""
    name = (d.get("name") or "").strip()
    if not name:
        return False, "Falta el nom"
    try:
        birth = int(str(d.get("birth")).strip())
    except Exception:
        return False, "Falta l'any de naixement (o no es un numero)"
    death = d.get("death")
    if death not in (None, ""):
        try:
            death = int(str(death).strip())
        except Exception:
            return False, "L'any de mort no es un numero"
        if death < birth:
            return False, "Mor abans de neixer"
    pid = (d.get("id") or "").strip()
    if not re.fullmatch(r"[a-z0-9]+", pid or ""):
        return False, "L'id ha de ser lletres minuscules i xifres"

    ids_taken, qids_taken = existing_people()
    if pid in ids_taken:
        return False, "L'id '%s' ja existeix" % pid
    if d.get("qid") and d["qid"] in qids_taken:
        return False, "%s ja es a PEOPLE" % d["qid"]

    src0 = read("index.html")
    m = re.search(r"const\s+PEOPLE\s*=\s*\[", src0)
    if not m:
        return False, "No trobo PEOPLE a l'index.html"
    before, close = count_objects(src0, m.end())

    rec = dict(d)
    rec.update({"id": pid, "birth": birth, "death": death, "name": name})
    head = src0[:close].rstrip()
    if not head.endswith(","):
        head += ","
    new_src = head + "\n" + person_literal(rec) + "\n" + src0[close:]

    # xarxes: l'array ha de quadrar i haver crescut EXACTAMENT en 1
    m2 = re.search(r"const\s+PEOPLE\s*=\s*\[", new_src)
    after, _ = count_objects(new_src, m2.end())
    if after != before + 1:
        return False, "El recompte no quadra (%d -> %d): no toco res" % (before, after)
    if "\ufffd" in new_src:
        return False, "S'han colat caracters corromputs: no toco res"

    with open(os.path.join(REPO, "index.html"), "w", encoding="utf-8") as f:
        f.write(new_src)
    regen_ok, regen_msg = gen_data_js()
    commit_files = ["--", "index.html"] + (["data.js"] if regen_ok else [])
    ok, out = run(["git", "commit", "-m", "BD: afegeix %s" % name] + commit_files)
    suffix = "" if regen_ok else " (data.js NO regenerat: %s)" % regen_msg
    return True, ("Afegit i committejat" + suffix if ok else "Afegit (el commit ha fallat: %s)" % out[:120])


# --------------------------------------------------------------------------
# Regeneració de data.js
# --------------------------------------------------------------------------

def _unescape_js_str(raw):
    """Desescapa el contingut d'una string JS (entre cometes simples)."""
    result = []
    i = 0
    while i < len(raw):
        if raw[i] == '\\' and i + 1 < len(raw):
            nxt = raw[i + 1]
            if nxt == 'u' and i + 5 <= len(raw):
                try:
                    result.append(chr(int(raw[i + 2:i + 6], 16)))
                    i += 6
                    continue
                except ValueError:
                    pass
            result.append(nxt)
            i += 2
        else:
            result.append(raw[i])
            i += 1
    return ''.join(result)


def _split_top_objects(text):
    """Retorna els objectes {...} de primer nivell d'un text d'array JS."""
    objects = []
    i = 0
    n = len(text)
    while i < n:
        if text[i] != '{':
            i += 1
            continue
        depth = 0
        in_str = False
        quote = ''
        j = i
        while j < n:
            c = text[j]
            if in_str:
                if c == '\\':
                    j += 2
                    continue
                if c == quote:
                    in_str = False
            elif c in ("'", '"'):
                in_str = True
                quote = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    objects.append(text[i:j + 1])
                    i = j + 1
                    break
            j += 1
        else:
            break
    return objects


def _extract_people_events(html):
    """Extreu PEOPLE i EVENTS de index.html com a llistes de dicts Python."""

    def get_str(text, field):
        m = re.search(field + r":'((?:[^'\\]|\\.)*)'", text)
        if m:
            return _unescape_js_str(m.group(1))
        m = re.search(field + r':"((?:[^"\\]|\\.)*)"', text)
        return _unescape_js_str(m.group(1)) if m else None

    def get_int(text, field):
        m = re.search(field + r':(-?\d+)', text)
        return int(m.group(1)) if m else None

    def get_death(text):
        m = re.search(r'death:(null|-?\d+)', text)
        if not m:
            return None
        return None if m.group(1) == 'null' else int(m.group(1))

    def get_cats(text):
        m = re.search(r'cats:\[([^\]]*)\]', text)
        if not m:
            return []
        return re.findall(r"['\"]([^'\"]+)['\"]", m.group(1))

    def arr_text(name):
        pat = re.search(r'const\s+' + name + r'\s*=\s*\[', html)
        if not pat:
            return ''
        _, close = count_objects(html, pat.end())
        return html[pat.end():close]

    people = []
    for obj in _split_top_objects(arr_text('PEOPLE')):
        entry = {
            'id':     get_str(obj, 'id'),
            'wd':     get_str(obj, 'wd') or '',
            'name':   get_str(obj, 'name'),
            'birth':  get_int(obj, 'birth'),
            'death':  get_death(obj),
            'cats':   get_cats(obj),
            'gender': get_str(obj, 'gender') or '',
            'wiki':   get_str(obj, 'wiki') or '',
            'desc':   get_str(obj, 'desc') or '',
        }
        if entry['id'] and entry['name'] is not None:
            people.append(entry)

    events = []
    for obj in _split_top_objects(arr_text('EVENTS')):
        entry = {
            'id':        get_str(obj, 'id'),
            'name':      get_str(obj, 'name'),
            'year':      get_int(obj, 'year'),
            'wiki':      get_str(obj, 'wiki') or '',
            'sitelinks': get_int(obj, 'sitelinks') or 0,
            'desc':      get_str(obj, 'desc') or '',
        }
        imp = get_int(obj, 'imp')
        if imp is not None:
            entry['imp'] = imp
        if entry['id'] and entry['name'] is not None:
            events.append(entry)

    return people, events


def gen_data_js():
    """Regenera data.js a partir de PEOPLE i EVENTS de index.html."""
    import datetime
    html = read("index.html")
    people, events = _extract_people_events(html)
    if not people:
        return False, "No s'han pogut extreure PEOPLE de index.html"

    today = datetime.date.today().isoformat()
    header = (
        "/* " + "=" * 77 + "\n"
        " * data.js — SNAPSHOT PROVISIONAL de la base de dades del cronograma.\n"
        " * Generat automàticament des d'index.html el %s.\n"
        " *\n"
        " * ⚠️  PROVISIONAL: això és una CÒPIA de les dades que ara viuen a index.html,\n"
        " *     feta per facilitar el testeig local (file://). Quan existeixi la DB externa,\n"
        " *     substituir aquest fitxer pel carregador real (fetch a la DB/API) i esborrar\n"
        " *     el snapshot. NO editar a mà: regenerar amb dash.py /api/db/regen.\n"
        " * " + "=" * 77 + " */"
    ) % today
    body = json.dumps({"PEOPLE": people, "EVENTS": events}, ensure_ascii=False, indent=2)
    content = header + "\n\n\nwindow.HB_DATA = " + body + ";\n"
    data_js_path = os.path.join(REPO, "data.js")
    with open(data_js_path, "w", encoding="utf-8") as f:
        f.write(content)
    return True, "data.js regenerat (%d persones, %d events)" % (len(people), len(events))


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

PD_BLOCK = re.compile(r"(const\s+PD_PINNED\s*=\s*\{)(.*?)(\n[ \t]*\};)", re.DOTALL)

# 'AAAA-MM-DD':'Qxxx',   // Nom — motiu
PD_LINE = re.compile(
    r"^\s*['\"](\d{4}-\d{2}-\d{2})['\"]\s*:\s*['\"](Q\d+)['\"]\s*,?\s*(?://\s*(.*?))?\s*$"
)


def parse_pinned():
    """
    [{date, qid, name, note}] ordenat per data. Nomes llegeix; no escriu res.

    El nom surt del comentari de la linia (el troç abans del guio llarg): PD_PINNED
    nomes guarda el QID —que es l'unic que el joc necessita— i el comentari ja hi
    era. Aixi el calendari pinta noms sense haver de trucar a Wikidata.
    """
    src = read("joc.html")
    m = PD_BLOCK.search(src)
    if not m:
        return []
    out = []
    for line in m.group(2).splitlines():
        lm = PD_LINE.match(line)
        if not lm:
            continue
        note = (lm.group(3) or "").strip()
        name = note.split("—")[0].strip() if note else ""
        out.append({
            "date": lm.group(1),
            "qid": lm.group(2),
            "name": name or lm.group(2),
            "note": note,
        })
    out.sort(key=lambda p: p["date"])
    return out


def _pinned_write(entries, commit_msg):
    """Reescriu el bloc PD_PINNED sencer, ordenat per data, i committeja joc.html."""
    src = read("joc.html")
    m = PD_BLOCK.search(src)
    if not m:
        return False, "No trobo el bloc PD_PINNED a joc.html"

    entries = sorted(entries, key=lambda p: p["date"])
    lines = []
    for i, e in enumerate(entries):
        coma = "," if i < len(entries) - 1 else ""
        note = e.get("note") or ""
        # el comentari no pot tancar el bloc ni saltar de linia
        note = note.replace("*/", "").replace("\n", " ").strip()
        lines.append("      '%s':'%s'%s%s" % (
            e["date"], e["qid"], coma, ("    // " + note) if note else ""))
    body = ("\n" + "\n".join(lines)) if lines else ""
    new_src = src[:m.start()] + m.group(1) + body + m.group(3) + src[m.end():]

    if "�" in new_src:
        return False, "S'han colat caracters corromputs: no toco res"
    # xarxa: el bloc reescrit ha de tornar a parsejar amb les entrades que toca
    m2 = PD_BLOCK.search(new_src)
    if not m2 or len([l for l in m2.group(2).splitlines() if PD_LINE.match(l)]) != len(entries):
        return False, "El bloc reescrit no quadra: no toco res"

    with open(os.path.join(REPO, "joc.html"), "w", encoding="utf-8") as f:
        f.write(new_src)
    ok, out = run(["git", "commit", "-m", commit_msg, "--", "joc.html"])
    return True, ("Desat i committejat" if ok else "Desat (el commit ha fallat: %s)" % out[:120])


def pinned_set(d):
    """Clava (o reassigna) un dia. {date, qid, name, note}."""
    ds = (d.get("date") or "").strip()
    qid = (d.get("qid") or "").strip().upper()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", ds):
        return False, "Data invalida (cal AAAA-MM-DD)"
    try:
        datetime.strptime(ds, "%Y-%m-%d")
    except ValueError:
        return False, "Aquesta data no existeix"
    if not re.fullmatch(r"Q\d+", qid):
        return False, "QID invalid"
    if ds < date.today().isoformat():
        return False, "El %s ja ha passat: els dies emesos no es toquen" % ds

    note = (d.get("note") or "").strip()
    if not note:
        name = (d.get("name") or "").strip()
        note = name or qid

    entries = [p for p in parse_pinned() if p["date"] != ds]
    entries.append({"date": ds, "qid": qid, "note": note})
    return _pinned_write(entries, "Joc: clava %s al %s" % (note.split("—")[0].strip(), ds))


def pinned_del(d):
    """Treu un dia clavat."""
    ds = (d.get("date") or "").strip()
    if ds < date.today().isoformat():
        return False, "El %s ja ha passat: l'historic no es desfa" % ds
    pins = parse_pinned()
    keep = [p for p in pins if p["date"] != ds]
    if len(keep) == len(pins):
        return False, "El %s no estava clavat" % ds
    gone = next(p for p in pins if p["date"] == ds)
    return _pinned_write(keep, "Joc: desclava %s (%s)" % (gone["name"], ds))


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
# Aniversaris propers (des de PEOPLE)
# --------------------------------------------------------------------------

# PEOPLE nomes guarda l'ANY: sense mes i dia no hi ha «propers 30 dies». El dia
# el demanem a Wikidata, pero NOMES per als QIDs que ja tenim a la BD —no es cap
# cerca oberta— i es guarda en cau: una data de naixement no canvia mai.
ANNIV_CACHE = os.path.join(REPO, "_tools", ".anniv_cache.json")


def _anniv_cache():
    try:
        with open(ANNIV_CACHE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _fetch_daymonth(qids):
    """{qid: {'b':'MM-DD'|None, 'd':'MM-DD'|None}} per als qids que falten al cau."""
    out = {}
    for i in range(0, len(qids), 50):          # l'API accepta 50 ids per crida
        lot = qids[i:i + 50]
        data = _wd_get(WD_API + "?action=wbgetentities&ids=%s&props=claims"
                       "&format=json&origin=*" % "|".join(lot))
        for qid in lot:
            ent = ((data or {}).get("entities") or {}).get(qid) or {}
            claims = ent.get("claims") or {}
            rec = {"b": None, "d": None}
            for pid, key in (("P569", "b"), ("P570", "d")):
                for c in (claims.get(pid) or []):
                    val = (((c.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {})
                    # precisio 11 = dia. Menys que aixo no serveix per a un aniversari.
                    if val.get("precision", 0) < 11:
                        continue
                    t = val.get("time") or ""
                    m = re.match(r"[+-]\d+-(\d{2})-(\d{2})", t)
                    if m and m.group(1) != "00" and m.group(2) != "00":
                        rec[key] = m.group(1) + "-" + m.group(2)
                        break
            out[qid] = rec
    return out


ANNIV_ROUND = 25       # que compta com a rodo: quarts de segle (25, 50, 75, 100...)
ANNIV_WINDOW = 365     # horitzo en dies


def anniv_state(window=ANNIV_WINDOW):
    """
    Aniversaris RODONS (de naixement o de mort) dels propers `window` dies.

    Nomes multiples de 25: ningu clava un personatge per celebrar-li 73 anys de
    res. Aixo fa la llista molt escassa, i per aixo la finestra es de dotze mesos
    i no de trenta dies: un centenari es una efemeride d'escala anual i es
    planifica amb temps —a 90 dies la caixa sortia buida; a un any, hi ha els 200
    de Beethoven i els 300 de Newton—. Els multiples de 100 van marcats a part.
    """
    people = [p for p in _extract_people_events(read("index.html"))[0] if p.get("wd")]
    cache = _anniv_cache()
    falten = [p["wd"] for p in people if p["wd"] not in cache]
    if falten:
        try:
            cache.update(_fetch_daymonth(falten))
            with open(ANNIV_CACHE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=1, sort_keys=True)
        except Exception:
            pass                                # sense xarxa: tirem del que ja hi hagi

    today = date.today()
    out = []
    for p in people:
        rec = cache.get(p["wd"]) or {}
        for key, camp, mena in (("b", "birth", "naixement"), ("d", "death", "mort")):
            md, orig = rec.get(key), p.get(camp)
            if not md or orig is None:
                continue
            mm, dd = int(md[:2]), int(md[3:])
            for any_ in (today.year, today.year + 1):   # la finestra pot creuar l'any
                try:
                    quan = date(any_, mm, dd)
                except ValueError:                       # 29 de febrer en any no de traspas
                    continue
                if not (today <= quan <= today + timedelta(days=window)):
                    continue
                anys = any_ - orig
                if anys <= 0 or anys % ANNIV_ROUND:
                    continue
                out.append({
                    "date": quan.isoformat(), "qid": p["wd"], "name": p["name"],
                    "desc": p.get("desc", ""), "kind": mena, "years": anys,
                    "century": anys % 100 == 0,
                })
    out.sort(key=lambda a: a["date"])
    return out


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
    """Escriu i normalitza el final del fitxer a UN sol salt de linia: esborrar
    una seccio deixava una linia buida de mes, i cada escriptura n'anava
    acumulant una (es veia al diff, no a la pagina)."""
    text = "".join(lines).rstrip("\n") + "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def _commit_backlog(msg):
    """Committeja el BACKLOG.md tot sol, perque un item afegit des del dashboard no
    es quedi com un canvi solt que es pot perdre. Path-limited A PROPOSIT: si en
    Bernat te l'index.html a mig editar, un commit ampli se l'enduria pel mig.
    Si no hi ha res a committejar, git retorna != 0 i ho deixem passar."""
    ok, out = run(["git", "commit", "-m", msg, "--", BACKLOG_FILE])
    return ok, out


def backlog_close(title):
    try:
        lines, path = _backlog_load()
        start, _ = _find_section(lines, title)
        if "[TANCAT]" in lines[start]:
            return False, "Ja estava tancat"
        lines[start] = "## [TANCAT] " + lines[start][3:]
        _save(path, lines)
        _commit_backlog("Backlog: tanca «%s»" % title.strip())
        return True, "Tancat"
    except Exception as e:
        return False, str(e)


def backlog_delete(title):
    try:
        lines, path = _backlog_load()
        start, end = _find_section(lines, title)
        del lines[start:end]
        _save(path, lines)
        _commit_backlog("Backlog: elimina «%s»" % title.strip())
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
        _commit_backlog("Backlog: nota a «%s»" % title.strip())
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
        _commit_backlog("Backlog: afegeix «%s»" % title.strip())
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

        if path == "/api/db/resolve":
            self._json(200, resolve_person(data.get("q", ""),
                                           bool(data.get("allow_existing"))))
            return

        if path == "/api/db/add":
            ok, msg = db_add_person(data)
            self._json(200, {"ok": ok, "msg": msg})
            return

        if path == "/api/db/regen":
            ok, msg = gen_data_js()
            self._json(200, {"ok": ok, "msg": msg})
            return

        if path == "/api/pinned/set":
            ok, msg = pinned_set(data)
            self._json(200, {"ok": ok, "msg": msg})
            return

        if path == "/api/pinned/del":
            ok, msg = pinned_del(data)
            self._json(200, {"ok": ok, "msg": msg})
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

        if path == "/api/pinned":
            try:
                self._json(200, parse_pinned())
            except Exception as e:
                self._json(500, {"error": str(e)})
            return

        if path == "/api/anniversaries":
            try:
                self._json(200, anniv_state())
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
