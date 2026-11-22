#!/usr/bin/env python3
"""Genera les pàgines per COMPARTIR en cada idioma (22/11/2026).

WhatsApp, Telegram, X… no executen JavaScript: llegeixen el títol, la descripció i la imatge de
l'HTML de l'adreça EXACTA que es comparteix. Com que index.html i joc.html són les mateixes en tots
els idiomes, la previsualització sempre sortia en català. Per això cada idioma té les seves pàgines
petites, amb les metadades en aquell idioma, que només redirigeixen a la pàgina de veritat amb
?lang=<idioma> (la pàgina el recorda a la sessió, sense tocar la preferència de qui l'obre):

    jocs/<joc>/index.html        català    → /joc.html?lang=ca#/<joc>
    es/jocs/<joc>/index.html     castellà  → /joc.html?lang=es#/<joc>
    es/index.html                castellà  → /?lang=es (+ el que porti l'adreça: ?col=…, #…)
    es/joc.html                  castellà  → /joc.html?lang=es (+ el que porti l'adreça: #/<joc>…)

Les pàgines de veritat, quan van en castellà, reescriuen la barra a /es/ i /es/joc.html (veure «Adreça de
l'idioma» a index.html i joc.html): així el botó de compartir del mòbil també dona l'adreça en castellà,
i en recarregar, aquestes pàgines hi tornen a portar.

Els botons «Comparteix» (joc.html: el text dels resultats; index.html: les col·leccions) fan servir
l'adreça de l'idioma actiu. Copiar l'adreça de la barra del navegador segueix donant la catalana.

Ús:  python3 _tools/gen_compartir.py      (reescriu els fitxers; després, git diff)
Un idioma nou = un bloc a TEXTOS i, a part, la imatge: sh _tools/og/gen_og.sh <idioma> "<lema>".
"""
import os
import re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB = "https://www.babilinia.com"
JOCS = ["ordena", "abansdespres", "memory", "contemporanis", "personatgedia"]

TEXTOS = {
    "ca": {
        "locale": "ca_ES", "img": "/img/og.png", "alt": "Babilinia: la web que no es va fer en un dia",
        "jocs": {
            "ordena": ("Ordena la línia", "Repte diari d’història: posa en ordre fets i personatges, del més antic al més recent."),
            "abansdespres": ("Abans o després?", "Repte diari d’història: va passar abans o després? Aprèn a situar fets i personatges en el temps."),
            "memory": ("Memory", "Repte diari d’història: troba les parelles i posa cara als personatges de la història."),
            "contemporanis": ("Contemporanis?", "Repte diari d’història: van coincidir en vida? Descobreix qui va viure alhora que qui."),
            "personatgedia": ("Personatge del dia", "Cada dia, un personatge real de la història per descobrir: qui era, quan va viure i per què és recordat."),
        },
    },
    "es": {
        "locale": "es_ES", "img": "/img/og-es.png", "alt": "Babilinia: la web que no se hizo en un día",
        # El cronograma i els jocs (es/ i es/joc.html): els textos són els doc_* del diccionari de cada
        # pàgina (els mateixos que hi posa metaIdioma() en arrencar), així no s'escriuen dues vegades.
        "arrel": "index.html",
        "joc": "joc.html",
        "jocs": {
            "ordena": ("Ordena la línea", "Reto diario de historia: pon en orden hechos y personajes, del más antiguo al más reciente."),
            "abansdespres": ("¿Antes o después?", "Reto diario de historia: ¿pasó antes o después? Aprende a situar hechos y personajes en el tiempo."),
            "memory": ("Memory", "Reto diario de historia: encuentra las parejas y ponles cara a los personajes de la historia."),
            "contemporanis": ("¿Contemporáneos?", "Reto diario de historia: ¿coincidieron en vida? Descubre quién vivió a la vez que quién."),
            "personatgedia": ("Personaje del día", "Cada día, un personaje real de la historia para descubrir: quién era, cuándo vivió y por qué se le recuerda."),
        },
    },
}


def dicc(fitxer, lang):
    """Les claus doc_* del diccionari I18N[lang] d'una pàgina (cadenes entre cometes simples)."""
    src = open(os.path.join(REPO, fitxer), encoding="utf-8").read()
    i = src.index("const I18N={"); j = src.index("function detectLang", i)
    blk = src[i:j]
    m = re.search(r"(?m)^\s*" + lang + r":\{\s*$", blk)
    if not m:
        raise SystemExit("No trobo el diccionari '%s' a %s" % (lang, fitxer))
    seg = blk[m.end():]
    n = re.search(r"(?m)^\s*[a-z]{2}:\{\s*$", seg)
    seg = seg[:n.start()] if n else seg
    out = dict(re.findall(r"\b(doc_[a-z_]+)\s*:\s*'([^']*)'", seg))
    for k in ("doc_title", "doc_desc", "doc_og_desc"):
        if k not in out:
            raise SystemExit("Falta %s a %s [%s]" % (k, fitxer, lang))
    return out


def esc(s):
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def pagina(lang, cami, titol, desc, og_desc, desti, js_desti, enllac, comentari):
    t = TEXTOS[lang]
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- {comentari}
     GENERADA per _tools/gen_compartir.py: no l'editis a mà, edita el generador. -->
<title>{esc(titol)}</title>
<!-- Previsualització en compartir aquest enllaç: WhatsApp i companyia llegeixen AQUESTA pàgina,
     no el joc, així que les etiquetes han de ser aquí. noindex: a Google no li cal aquesta còpia. -->
<meta name="robots" content="noindex">
<link rel="icon" href="/img/icona.svg" type="image/svg+xml">
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{WEB}{cami}">
<meta name="theme-color" content="#B8503C">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Babilinia">
<meta property="og:locale" content="{t['locale']}">
<meta property="og:title" content="{esc(titol)}">
<meta property="og:description" content="{esc(og_desc)}">
<meta property="og:url" content="{WEB}{cami}">
<meta property="og:image" content="{WEB}{t['img']}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{esc(t['alt'])}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={desti}">
<script>{js_desti}</script>
</head>
<body><a href="{desti}">{esc(enllac)}</a></body>
</html>
"""


def escriu(rel, text):
    p = os.path.join(REPO, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    print("  " + rel)


def main():
    for lang, t in TEXTOS.items():
        pref = "" if lang == "ca" else lang + "/"
        for joc in JOCS:
            nom, desc = t["jocs"][joc]
            desti = f"/joc.html?lang={lang}#/{joc}"
            escriu(f"{pref}jocs/{joc}/index.html", pagina(
                lang, f"/{pref}jocs/{joc}/", f"{nom} · Babilinia", desc, desc, desti,
                f"location.replace('{desti}');", nom,
                f"Enllaç curt per compartir (babilinia.com/{pref}jocs/{joc}): porta directament al joc en "
                f"aquest idioma. Els jocs viuen tots a joc.html i es trien pel #."))
        if "arrel" in t:
            d = dicc(t["arrel"], lang)
            titol, desc, og_desc = d["doc_title"], d["doc_desc"], d["doc_og_desc"]
            # Passa el que porti l'adreça (?col=… d'una col·lecció compartida, #…) a la pàgina de veritat.
            js = (f"var q=location.search.replace(/^\\?/,'');"
                  f"location.replace('/?lang={lang}'+(q?'&'+q:'')+location.hash);")
            escriu(f"{pref}index.html", pagina(
                lang, f"/{pref}", titol, desc, og_desc, f"/?lang={lang}", js, "Babilinia",
                f"El cronograma en aquest idioma, per compartir (babilinia.com/{pref}). Porta a /?lang={lang} "
                f"i hi passa el que porti l'adreça (?col=… d'una col·lecció compartida)."))
        if "joc" in t:
            d = dicc(t["joc"], lang)
            titol, desc, og_desc = d["doc_title"], d["doc_desc"], d["doc_og_desc"]
            js = (f"var q=location.search.replace(/^\\?/,'');"
                  f"location.replace('/joc.html?lang={lang}'+(q?'&'+q:'')+location.hash);")
            escriu(f"{pref}joc.html", pagina(
                lang, f"/{pref}joc.html", titol, desc, og_desc, f"/joc.html?lang={lang}", js, "Babilinia",
                f"Els jocs en aquest idioma (babilinia.com/{pref}joc.html): és l'adreça que posa a la barra joc.html "
                f"quan va en aquest idioma. Porta a /joc.html?lang={lang} amb el #/<joc> que porti."))


if __name__ == "__main__":
    main()
