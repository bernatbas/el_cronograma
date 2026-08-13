#!/usr/bin/env python3
# =============================================================================
# gen_personatges.py — Generador de l'índex d'IDs per al joc «Personatge del dia».
#
# Què fa: consulta Wikidata (WDQS) i escriu `personatges.js`, una llista amb
# NOMÉS els QIDs (com a enters, sense la "Q") de persones que compleixen:
#   - són humans              (P31 = Q5)
#   - tenen data de naixement (P569)
#   - tenen article a la Viquipèdia en CATALÀ, CASTELLÀ I ANGLÈS
#     (els TRES sitelinks: cawiki, eswiki, enwiki)
#
# Com s'executa (cal INTERNET). Al Mac ja tens Python 3 de sèrie:
#   1) Comprova la versió:   python3 --version   (cal 3.6+)
#   2) Posa aquest fitxer a la carpeta del projecte (al costat de joc.html).
#   3) Executa:   python3 gen_personatges.py
#   4) Es genera `personatges.js` a la mateixa carpeta.
#   5) Fes commit de `personatges.js` al git.
#
# NO cal instal·lar res amb pip: només fa servir la llibreria estàndard.
# NO editar `personatges.js` a mà: es regenera amb aquest script.
#
# NOTA TÈCNICA (per què abans petava):
#   La versió anterior filtrava amb FILTER(YEAR(?birth) ...). YEAR() és una
#   funció que s'ha de calcular per a CADA persona, així que no pot fer servir
#   l'índex de dates i cada "franja" acabava escanejant TOTA la base -> timeout
#   (HTTP 500 als 60s de Wikidata). Ara filtrem comparant ?birth directament
#   amb literals xsd:dateTime, que SÍ que és indexable i ràpid.
# =============================================================================

import json
import os
import time
import urllib.parse
import urllib.request
import urllib.error
import re
import datetime

ENDPOINT = 'https://query.wikidata.org/sparql'
# Wikimedia exigeix un User-Agent identificatiu. Posa-hi un contacte real.
USER_AGENT = "HistoriaBasica/1.0 (bernatbaspujols@gmail.com)"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'personatges.js')

QID_RE = re.compile(r'Q(\d+)$')


def build_bounds():
    # Talls per franges d'any de naixement. Ara són només un punt de partida:
    # si una franja fos massa gran i fes timeout, l'script la parteix sol
    # (vegeu collect_range). Més fines a l'època moderna, on hi ha més gent.
    b = [-10000, -4000, -2000, -1000, -500, -200, 0, 200, 400, 600, 800,
         1000, 1150, 1300, 1400, 1500, 1550, 1600, 1650, 1700, 1750]
    b += list(range(1780, 2021, 10))
    b.append(2035)
    return b


def iso_bound(year):
    # Literal xsd:dateTime per a l'1 de gener de `year`.
    # Gestiona anys aC (negatius) i el padding mínim de 4 xifres que demana XSD.
    if year < 0:
        return '"-%04d-01-01T00:00:00Z"^^xsd:dateTime' % (-year)
    return '"%04d-01-01T00:00:00Z"^^xsd:dateTime' % year


def query_for(lo, hi):
    # Comparació directa de dates (indexable) en lloc de YEAR(...).
    # El filtre va just després del binding de ?birth perquè el planificador
    # apliqui el rang com més aviat millor.
    return (
        'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n'
        'SELECT DISTINCT ?item WHERE {\n'
        '  ?item wdt:P31 wd:Q5 ;\n'
        '        wdt:P569 ?birth .\n'
        '  FILTER(?birth >= %s && ?birth < %s)\n'
        '  ?ca schema:about ?item ; schema:isPartOf <https://ca.wikipedia.org/> .\n'
        '  ?es schema:about ?item ; schema:isPartOf <https://es.wikipedia.org/> .\n'
        '  ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .\n'
        '}' % (iso_bound(lo), iso_bound(hi))
    )


def run_query(sparql, attempt=1):
    url = ENDPOINT + '?' + urllib.parse.urlencode({'format': 'json', 'query': sparql})
    req = urllib.request.Request(url, headers={
        'User-Agent': USER_AGENT,
        'Accept': 'application/sparql-results+json',
    })
    try:
        with urllib.request.urlopen(req, timeout=70) as resp:
            data = json.loads(resp.read().decode('utf-8'))
        return [b['item']['value'] for b in data['results']['bindings']]
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as e:
        # Reintents per a errors transitoris (talls de xarxa, 429, 503...).
        if attempt <= 3:
            wait = 2 * attempt
            print('  reintent %d d\'aqu\u00ed %ds (%s)' % (attempt, wait, e))
            time.sleep(wait)
            return run_query(sparql, attempt + 1)
        raise


def collect_range(lo, hi, ids):
    # Consulta una franja. Si falla tot i els reintents (típicament perquè és
    # massa densa i fa timeout), la parteix per la meitat i ho torna a provar,
    # fins a granularitat d'1 any.
    label = '%d..%d' % (lo, hi)
    print('Franja %s ... ' % label, end='', flush=True)
    try:
        rows = run_query(query_for(lo, hi))
    except Exception as e:
        if hi - lo > 1:
            mid = (lo + hi) // 2
            print('falla; partim en %d..%d + %d..%d (%s)' % (lo, mid, mid, hi, e))
            collect_range(lo, mid, ids)
            collect_range(mid, hi, ids)
        else:
            print('FALLA DEFINITIVA a %s (%s) — franja saltada' % (label, e))
        return

    added = 0
    for u in rows:
        m = QID_RE.search(u)
        if m:
            n = int(m.group(1))
            if n not in ids:
                ids.add(n)
                added += 1
    print('%d resultats (+%d nous, total %d)' % (len(rows), added, len(ids)))
    time.sleep(0.3)  # som educats amb el servidor


def main():
    bounds = build_bounds()
    ids = set()
    for i in range(len(bounds) - 1):
        collect_range(bounds[i], bounds[i + 1], ids)

    sorted_ids = sorted(ids)
    today = datetime.date.today().isoformat()
    header = (
        '/* =============================================================================\n'
        " * personatges.js \u2014 \u00cdNDEX d'IDs per al joc \u00abPersonatge del dia\u00bb.\n"
        ' * Generat autom\u00e0ticament amb gen_personatges.py el ' + today + '.\n'
        ' * Cont\u00e9 QIDs de Wikidata (com a enters, sense la "Q") de persones amb\n'
        ' * data de naixement i article a la Viquip\u00e8dia en catal\u00e0, castell\u00e0 i angl\u00e8s.\n'
        ' * NO editar a m\u00e0: regenerar amb gen_personatges.py.\n'
        ' * Total: ' + str(len(sorted_ids)) + ' persones.\n'
        ' * ============================================================================= */\n'
    )
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(header + 'window.HB_PERSONATGES = ' + json.dumps(sorted_ids, separators=(',', ':')) + ';\n')
    print('\npersonatges.js OK: %d persones -> %s' % (len(sorted_ids), OUT))


if __name__ == '__main__':
    main()
