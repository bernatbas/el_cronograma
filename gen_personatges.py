#!/usr/bin/env python3
# =============================================================================
# gen_personatges.py — Generador de l'índex d'IDs per al joc «Personatge del dia».
#
# Què fa: consulta Wikidata i escriu `personatges.js`, una llista amb NOMÉS els
# QIDs (com a enters, sense la "Q") de persones que compleixen:
#   - són humans              (P31 = Q5)
#   - tenen data de naixement (P569)
#   - tenen article a la Viquipèdia en CATALÀ, CASTELLÀ I ANGLÈS
#     (els TRES sitelinks: cawiki, eswiki, enwiki)
#   Sense límit d'any: agafa des de l'antiguitat fins avui.
#
# PER QUÈ QLEVER I NO query.wikidata.org:
#   El servei oficial (WDQS) té un límit de 60s i sota càrrega talla connexions
#   i retorna 5xx, cosa que obligava a partir la consulta en desenes de trossos.
#   QLever (https://qlever.dev/wikidata) té una còpia completa de Wikidata i és
#   molt més ràpid: fa TOTA la consulta d'un cop, en segons.
#
# Com s'executa (cal INTERNET). Al Mac ja tens Python 3 de sèrie:
#   1) python3 --version   (cal 3.6+)
#   2) Posa aquest fitxer a la carpeta del projecte (al costat de joc.html).
#   3) python3 gen_personatges.py
#   4) Es genera `personatges.js` a la mateixa carpeta, en pocs segons.
#   5) Fes commit de `personatges.js` al git.
#
# NO cal instal·lar res amb pip: només fa servir la llibreria estàndard.
# NO editar `personatges.js` a mà: es regenera amb aquest script.
# =============================================================================

import json
import os
import re
import sys
import time
import datetime
import urllib.request
import urllib.error

# Endpoint de QLever per a Wikidata. El domini antic (qlever.cs.uni-freiburg.de)
# ara redirigeix cap a qlever.dev amb un 308; apuntem directament al nou.
ENDPOINT = 'https://qlever.dev/api/wikidata'
USER_AGENT = "HistoriaBasica/1.0 (bernatbaspujols@gmail.com)"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'personatges.js')

# Una sola consulta amb TOT. Sense filtres per any: QLever no fa timeout.
SPARQL = '''PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX schema: <http://schema.org/>
SELECT DISTINCT ?item WHERE {
  ?item wdt:P31 wd:Q5 ;
        wdt:P569 ?birth .
  ?ca schema:about ?item ; schema:isPartOf <https://ca.wikipedia.org/> .
  ?es schema:about ?item ; schema:isPartOf <https://es.wikipedia.org/> .
  ?en schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
}'''

QID_RE = re.compile(r'Q(\d+)')


class _KeepPostRedirect(urllib.request.HTTPRedirectHandler):
    # Segueix redireccions 307/308 mantenint el POST (mètode + cos). Necessari
    # perquè Python < 3.11 NO tracta el 308 sol: aquí, a més de refer la
    # petició, registrem http_error_308 perquè el teu Python 3.9 el cridi.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if code in (307, 308):
            print('  redirigit (%d) cap a %s' % (code, newurl))
            return urllib.request.Request(
                newurl,
                data=req.data,
                headers=dict(req.header_items()),
                method=req.get_method(),
            )
        return super().redirect_request(req, fp, code, msg, headers, newurl)

    # Python 3.9 no té http_error_308; el fem servir igual que el 301/307.
    http_error_308 = urllib.request.HTTPRedirectHandler.http_error_301


_OPENER = urllib.request.build_opener(_KeepPostRedirect)


def run_query(sparql, attempt=1):
    # POST amb la consulta (protocol SPARQL 1.1) i resposta en TSV (compacte).
    req = urllib.request.Request(
        ENDPOINT,
        data=sparql.encode('utf-8'),
        headers={
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/sparql-query',
            'Accept': 'text/tab-separated-values',
        },
        method='POST',
    )
    try:
        with _OPENER.open(req, timeout=300) as resp:
            return resp.read().decode('utf-8')
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
        if attempt <= 4:
            wait = 3 * attempt
            print('  reintent %d d\'aqu\u00ed %ds (%s)' % (attempt, wait, e))
            time.sleep(wait)
            return run_query(sparql, attempt + 1)
        raise


def main():
    print('Python %d.%d | endpoint: %s'
          % (sys.version_info[0], sys.version_info[1], ENDPOINT))
    print('Consultant QLever (una sola consulta, pot trigar uns segons)...',
          flush=True)
    text = run_query(SPARQL)

    ids = set()
    lines = text.splitlines()
    for line in lines[1:]:  # saltem la capçalera "?item"
        m = QID_RE.search(line)
        if m:
            ids.add(int(m.group(1)))

    # Xarxa de seguretat: si en surten sospitosament poques, alguna cosa ha
    # anat malament (endpoint caigut, format inesperat...). No sobreescrivim.
    if len(ids) < 10000:
        raise SystemExit(
            'ERROR: nomes %d IDs (esperava >100k). No sobreescric personatges.js.\n'
            'Primeres linies rebudes:\n%s' % (len(ids), '\n'.join(lines[:5]))
        )

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
        f.write(header + 'window.HB_PERSONATGES = '
                + json.dumps(sorted_ids, separators=(',', ':')) + ';\n')
    print('personatges.js OK: %d persones -> %s' % (len(sorted_ids), OUT))


if __name__ == '__main__':
    main()
