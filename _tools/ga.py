"""
Google Analytics (GA4 Data API) per al dashboard. Nomes biblioteca estandard.

La clau del compte de servei viu FORA del repo (GA_KEY) i no es llegeix mai des del
navegador: el dashboard demana /api/ga/... i el servidor fa la consulta. La signatura
RS256 del JWT la fa l'`openssl` del sistema, perque Python estandard no te RSA.

Doc a DASHBOARD.md, seccio «Analytics».
"""

import base64
import json
import os
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

GA_KEY = os.path.expanduser("~/.config/babilinia/ga-key.json")
GA_PROP = "550219092"
# Abans del 19/11/2026 Analytics es carregava a qualsevol host, i el CI (servidors dels EUA,
# a localhost) sumava ~1.000 «usuaris» al dia. Les dades bones comencen aqui.
GA_DES_DE = "2026-11-19"

_tok = {"v": None, "exp": 0}
_tok_lock = threading.Lock()
_cache = {}          # clau -> (instant, resposta): no repetir consultes en refrescar
CACHE_S = 300


class GAError(Exception):
    pass


def disponible():
    return os.path.isfile(GA_KEY)


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=")


def _sign(msg, pem):
    fd, path = tempfile.mkstemp()
    try:
        os.write(fd, msg)
        os.close(fd)
        # La clau entra per stdin: no toca mai el disc fora del seu fitxer.
        r = subprocess.run(["openssl", "dgst", "-sha256", "-sign", "/dev/stdin", path],
                           input=pem.encode(), capture_output=True, timeout=10)
        if r.returncode:
            raise GAError("openssl: " + r.stderr.decode("utf-8", "replace")[:200])
        return r.stdout
    finally:
        os.unlink(path)


def _token():
    with _tok_lock:
        if _tok["v"] and time.time() < _tok["exp"] - 60:
            return _tok["v"]
        try:
            with open(GA_KEY) as f:
                k = json.load(f)
        except Exception as e:
            raise GAError("No puc llegir la clau (%s): %s" % (GA_KEY, e))
        now = int(time.time())
        head = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
        claim = _b64(json.dumps({
            "iss": k["client_email"],
            "scope": "https://www.googleapis.com/auth/analytics.readonly",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now, "exp": now + 3600}).encode())
        msg = head + b"." + claim
        jwt = msg + b"." + _b64(_sign(msg, k["private_key"]))
        data = urllib.parse.urlencode({
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": jwt.decode()}).encode()
        try:
            r = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", data, timeout=15))
        except urllib.error.HTTPError as e:
            raise GAError("Google no accepta la clau: %s" % e.read().decode("utf-8", "replace")[:200])
        _tok["v"] = r["access_token"]
        _tok["exp"] = now + int(r.get("expires_in", 3600))
        return _tok["v"]


def report(dims, mets, start, end="today", filtre=None, order=None, limit=None):
    """Una consulta runReport. Torna una llista de dicts {dim: valor, met: numero}."""
    body = {"dateRanges": [{"startDate": start, "endDate": end}],
            "dimensions": [{"name": d} for d in dims],
            "metrics": [{"name": m} for m in mets]}
    if filtre:
        body["dimensionFilter"] = filtre
    if order:
        body["orderBys"] = order
    if limit:
        body["limit"] = limit
    clau = json.dumps(body, sort_keys=True)
    hit = _cache.get(clau)
    if hit and time.time() - hit[0] < CACHE_S:
        return hit[1]
    req = urllib.request.Request(
        "https://analyticsdata.googleapis.com/v1beta/properties/%s:runReport" % GA_PROP,
        json.dumps(body).encode(),
        {"Authorization": "Bearer " + _token(), "Content-Type": "application/json"})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=20))
    except urllib.error.HTTPError as e:
        raise GAError("GA %d: %s" % (e.code, e.read().decode("utf-8", "replace")[:300]))
    out = []
    for row in r.get("rows", []):
        d = {}
        for i, h in enumerate(dims):
            d[h] = row["dimensionValues"][i]["value"]
        for i, h in enumerate(mets):
            v = row["metricValues"][i]["value"]
            d[h] = float(v) if "." in v else int(v)
        out.append(d)
    _cache[clau] = (time.time(), out)
    return out


def en_llista(dim, valors):
    return {"filter": {"fieldName": dim, "inListFilter": {"values": list(valors)}}}


def igual(dim, valor):
    return {"filter": {"fieldName": dim, "stringFilter": {"matchType": "EXACT", "value": valor}}}


def i_(*filtres):
    return {"andGroup": {"expressions": list(filtres)}}


# --------------------------------------------------------------------------
# pestanya Analytics
# --------------------------------------------------------------------------

JOCS = ["abansdespres", "ordena", "memory", "contemporanis"]
EV_CRONO = ["cerca_wikidata", "personatge_afegit", "fitxa_oberta", "mostra_context",
            "colleccio_activada", "vista_global", "undo", "reset",
            "colleccio_compartida", "colleccio_enllac"]
PAG_CRONO = ("/", "/index.html")
PAG_JOC = ("/joc.html",)


def _dies(n):
    """Els ultims n dies (avui inclos), sense passar de GA_DES_DE. Format AAAA-MM-DD."""
    from datetime import date, timedelta
    avui = date.today()
    inici = max(avui - timedelta(days=n - 1), date.fromisoformat(GA_DES_DE))
    out, d = [], inici
    while d <= avui:
        out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def _ga_dia(s):   # 20261119 -> 2026-11-19
    return s[:4] + "-" + s[4:6] + "-" + s[6:]


def _per_dia(rows, dies, val, dim=None, clau=None):
    m = {d: 0 for d in dies}
    for r in rows:
        if dim and r[dim] != clau:
            continue
        d = _ga_dia(r["date"])
        if d in m:
            m[d] += r[val]
    return [m[d] for d in dies]


def overview(n=30):
    dies = _dies(n)
    S, E = dies[0], dies[-1]

    tot = report([], ["activeUsers", "sessions"], S, E)
    tot = tot[0] if tot else {"activeUsers": 0, "sessions": 0}
    per_dia = report(["date"], ["activeUsers"], S, E)
    nvr = report(["date", "newVsReturning"], ["activeUsers"], S, E)
    nvr_tot = {r["newVsReturning"]: r["activeUsers"] for r in report(["newVsReturning"], ["activeUsers"], S, E)}
    fonts = report(["sessionSource", "sessionMedium"], ["sessions"], S, E,
                   order=[{"metric": {"metricName": "sessions"}, "desc": True}], limit=8)
    disp = report(["deviceCategory"], ["activeUsers"], S, E)

    pag_dia = report(["date", "pagePath"], ["activeUsers"], S, E)
    pag_tot = report(["pagePath"], ["activeUsers"], S, E)
    refs = report(["pagePath", "pageReferrer"], ["activeUsers"], S, E, filtre=igual("eventName", "page_view"))

    def usuaris_pag(rows, pags):
        return sum(r["activeUsers"] for r in rows if r["pagePath"] in pags)

    def dia_pag(pags):
        m = {d: 0 for d in dies}
        for r in pag_dia:
            d = _ga_dia(r["date"])
            if d in m and r["pagePath"] in pags:
                m[d] += r["activeUsers"]
        return [m[d] for d in dies]

    def ve_de(r, pags):
        ref = r["pageReferrer"]
        if "babilinia.com" not in ref:
            return False
        path = "/" + ref.split("babilinia.com", 1)[1].lstrip("/").split("?")[0].split("#")[0]
        return path in pags

    # Usuaris que han COMENÇAT algun joc (qualsevol): obrir joc.html no vol dir jugar.
    juguen_dia = report(["date"], ["totalUsers"], S, E, filtre=igual("eventName", "joc_iniciat"))
    juguen = report([], ["totalUsers"], S, E, filtre=igual("eventName", "joc_iniciat"))
    juguen = juguen[0]["totalUsers"] if juguen else 0

    crono_a_joc = sum(r["activeUsers"] for r in refs if r["pagePath"] in PAG_JOC and ve_de(r, PAG_CRONO))
    joc_a_crono = sum(r["activeUsers"] for r in refs if r["pagePath"] in PAG_CRONO and ve_de(r, PAG_JOC))

    ev = report(["date", "eventName"], ["eventCount"], S, E, filtre=en_llista("eventName", EV_CRONO))
    afegits = report(["customEvent:nom"], ["eventCount"], S, E, filtre=igual("eventName", "personatge_afegit"),
                     order=[{"metric": {"metricName": "eventCount"}, "desc": True}], limit=12)
    guia = {r["eventName"]: r for r in report(["eventName"], ["eventCount", "totalUsers"], S, E,
                                               filtre=en_llista("eventName", ["guia_oberta", "guia_tancada"]))}

    embut = report(["customEvent:joc", "eventName"], ["totalUsers"], S, E,
                   filtre=en_llista("eventName", ["joc_vist", "joc_iniciat", "joc_completat"]))
    notes = report(["customEvent:joc"], ["averageCustomEvent:encerts", "averageCustomEvent:errors",
                                         "averageCustomEvent:ratxa"], S, E, filtre=igual("eventName", "joc_completat"))
    nota_dia = report(["date", "customEvent:joc"], ["averageCustomEvent:encerts", "averageCustomEvent:errors"], S, E,
                      filtre=igual("eventName", "joc_completat"))
    jug_dia = report(["date", "customEvent:joc"], ["totalUsers"], S, E, filtre=igual("eventName", "joc_iniciat"))
    extres = {r["eventName"]: r for r in report(["eventName"], ["eventCount", "totalUsers"], S, E,
                                                 filtre=en_llista("eventName", ["joc_comodin_usat", "memory_wiki"]))}
    partides = {r["customEvent:joc"]: r["eventCount"] for r in report(["customEvent:joc"], ["eventCount"], S, E,
                                                                       filtre=igual("eventName", "joc_iniciat"))}

    jocs = []
    for j in JOCS:
        f = {r["eventName"]: r["totalUsers"] for r in embut if r["customEvent:joc"] == j}
        nt = next((r for r in notes if r["customEvent:joc"] == j), {})
        enc = {d: None for d in dies}
        err = {d: None for d in dies}
        jug = {d: 0 for d in dies}
        for r in nota_dia:
            d = _ga_dia(r["date"])
            if r["customEvent:joc"] == j and d in enc:
                enc[d] = round(r["averageCustomEvent:encerts"], 2)
                err[d] = round(r["averageCustomEvent:errors"], 2)
        for r in jug_dia:
            d = _ga_dia(r["date"])
            if r["customEvent:joc"] == j and d in jug:
                jug[d] = r["totalUsers"]
        # Extres propis de cada joc (el comodí només existeix a «Abans o després?»)
        extra = {}
        if j == "abansdespres":
            extra["comodi"] = extres.get("joc_comodin_usat", {}).get("eventCount", 0)
        if j == "memory":
            extra["wiki"] = extres.get("memory_wiki", {}).get("eventCount", 0)
        jocs.append({"id": j, "vist": f.get("joc_vist", 0), "iniciat": f.get("joc_iniciat", 0),
                     "completat": f.get("joc_completat", 0),
                     "encerts": round(nt.get("averageCustomEvent:encerts", 0), 1) if nt else None,
                     "errors": round(nt.get("averageCustomEvent:errors", 0), 1) if nt else None,
                     "ratxa": round(nt.get("averageCustomEvent:ratxa", 0), 1) if nt else None,
                     "partides": partides.get(j, 0), "extra": extra,
                     "encerts_dia": [enc[d] for d in dies], "errors_dia": [err[d] for d in dies],
                     "jugadors_dia": [jug[d] for d in dies]})

    return {
        "dies": dies,
        "global": {
            "usuaris": tot["activeUsers"], "sessions": tot["sessions"],
            "nous": nvr_tot.get("new", 0), "recurrents": nvr_tot.get("returning", 0),
            "per_dia": _per_dia(per_dia, dies, "activeUsers"),
            "nous_dia": _per_dia(nvr, dies, "activeUsers", "newVsReturning", "new"),
            "recurrents_dia": _per_dia(nvr, dies, "activeUsers", "newVsReturning", "returning"),
            "fonts": [{"font": r["sessionSource"], "mitja": r["sessionMedium"], "n": r["sessions"]} for r in fonts],
            "dispositius": sorted([{"d": r["deviceCategory"], "n": r["activeUsers"]} for r in disp], key=lambda x: -x["n"]),
        },
        "pagines": {
            "crono": usuaris_pag(pag_tot, PAG_CRONO), "joc": usuaris_pag(pag_tot, PAG_JOC),
            "crono_dia": dia_pag(PAG_CRONO), "joc_dia": dia_pag(PAG_JOC),
            "crono_a_joc": crono_a_joc, "joc_a_crono": joc_a_crono,
            "juguen": juguen, "juguen_dia": _per_dia(juguen_dia, dies, "totalUsers"),
        },
        "crono": {
            "accions": [{"ev": e, "dia": _per_dia(ev, dies, "eventCount", "eventName", e)} for e in EV_CRONO],
            "afegits": [{"nom": r["customEvent:nom"], "n": r["eventCount"]} for r in afegits if r["customEvent:nom"] not in ("", "(not set)")],
            "guia_oberta": guia.get("guia_oberta", {}).get("totalUsers", 0),
            "guia_tancada": guia.get("guia_tancada", {}).get("totalUsers", 0),
        },
        "jocs": jocs,
    }
