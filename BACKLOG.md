# Backlog — Història Bàsica

<!-- ## Títol = obert · ## [TANCAT] Títol = tancat (no apareix al dashboard) -->

## Motor d'importància per a personatges
El motor de zoom semàntic (§2–§4 de ESTRATEGIA.md) funciona per a events però no per a personatges: a zoom baix les etiquetes es trepitgen. Mesurat a «Vista global» amb la col·lecció de 18 filòsofs: 18/18 etiquetes desborden la barra (barra mitjana 29px vs noms de 100–190px), 6 col·lisions de nom sobre nom.

Primer pas: estendre PEOPLE amb `sitelinks` i `imp`, baixar sitelinks de Wikidata.
⚠️ No és copiar el motor dels events: un event degrada a mode punt; una persona és un rang (la barra = la durada de la vida). El que sobra a zoom baix és l'etiqueta, no la barra.

Segon pas: toggle «mostra-ho tot / filtra per importància» — Fase 3 del full de ruta.

## Activar es/en (selector d’idioma + traduccions)

El backend i18n ja hi és a les dues pàgines i està provat: activar un idioma són dos passos
(codi a `I18N_SUPPORTED` + bloc a `I18N`). El que falta és el contingut i la manera de canviar-lo.

1. **Selector d’idioma** a la topbar. És bloc compartit: ha de sortir igual a `index.html` i
   `joc.html`, i crida `setLang()` + `applyI18nStatic()` + `render()`. Compte: `applyI18nStatic()`
   ha de tornar a passar per la topbar **abans** de re-mesurar-la (`fitSecnav` mesura amplades).
2. **Omplir els diccionaris**: ~69 claus a l’index, ~113 al joc. Les 11 compartides han de mantenir
   el mateix valor als dos fitxers (tret de `doc_title`, que és propi de cada pàgina).
3. **Traduir el contingut de `[1] DATA`**: passar `name`/`desc` d’eres, marcs, blocs i events a la
   forma `{ca:'…', es:'…'}`. `L()` ja ho accepta i cau a `ca` mentre no hi siguin, així que es pot
   fer de mica en mica sense trencar res. Els noms de `COLLECTIONS` queden fora a propòsit.

Val la pena arreglar dues coses del contracte alhora, i **als dos fitxers**:
- `t()` retorna `''` quan falta una clau, en lloc de la clau. Amb dos idiomes a mig omplir això
  vol dir buits invisibles arreu: millor `return key`.
- El nucli no cobreix `placeholder`; afegir-hi `data-i18n-ph` estalvia posar-los a mà.

## Poblar la BD
Més esdeveniments i marcs. És manual — els blocs de període no es poden cercar a Wikidata.

## Escalabilitat dels punts a zoom out
Ara els events en mode punt es veuen semitransparents i va bé. Amb molts events caldrà revisar densitat i soroll visual. Lligat amb el clustering «+N» (Fase 2 del full de ruta, §7 de ESTRATEGIA.md).

## Neteja de localStorage
Podar les entrades de persones per edat i ús via segell `_ts`, o límit dur (~500 persones). Opt-in: l'usuari ho activa explícitament, no es fa sol.

## Opcional: encastar Oswald en base64
Eliminar el FOUT (flash de tipografia de marca) a la primera visita. La solució actual (càrrega no bloquejant + fallback condensat) ja és prou bona; seria perfeccionisme.

## Opcional: hint d'onboarding
Un tooltip o overlay que expliqui els gestos bàsics (zoom, cerca, col·leccions) a la primera visita.
