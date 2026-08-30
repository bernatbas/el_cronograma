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

## Editar layout mòbil i replantejar funcions
En mobil no m'acaba de convencer, crec que potser alguna funció simplement s'ha d'eliminar, com veure eres i marcs històrics. També la barra lateral crec que no funciona, suggereixo posar-hi un botó tipus a baix a la dreta de settings (o icone a definir) que permeti modificar la vista amb afegir coleccons, veure personatges de la vista actual, i aquesta interacció que en desktop sí que ofereix la lat bar.

## Unificar DB: data.js com a font única per a index.html i joc.html
Ara la DB viu embedded a index.html i es copia a data.js. Objectiu: invertir-ho. data.js (o equivalent) és la font única, i cada pàgina carrega el que necessita (PEOPLE+EVENTS per al joc, tot per al cronograma). ERAS, MARCS, COLLECTIONS seguirien embedded a index.html perquè el joc no les necessita. Afecta: db_add_person escriu a data.js, index.html llegeix HB_DATA.PEOPLE via script src. Prerequisit: i18n real (les entrades de PEOPLE podrien tenir L() en data.js). Veure CLAUDE.md opció B.

## Desfer el copy de la db i data.js
Per garantir que el joc no canvia al llarg del dia, i el seed no genera contingut diferent, proposo només editar la db embeded, i que un cop al día, al final de dia, programar que es corri l'scrip per sincronitzar data.js només a les 11h30 de la nit cada dia, o algo així. Segurament git pot oferir coses així

## Afegir el mapping de paraules clau a categories en el dashboard
Poder editar el mapping de paraules clau a categories des del dashboard, veure quines paraules clau són les que porten a algú a catalogar-lo com a músic, i afegir les que detecti que hi falten.

## PErmetre editar la categoria quan no es pot detectar i està "sense categoria"

## [TANCAT] verdi, beethoven, david caraben... es marquen com a literatura enlloc de música. Cal revisar si hi ha bug

## [TANCAT] Aniversaris: filtrar només els rodons quan la BD creixi
Ara la caixa «Aniversaris propers» del dashboard llista TOTS els aniversaris dels propers 30 dies perquè amb 59 persones filtrar per rodons la deixava buida gairebé sempre (~0,4 encerts per finestra). Però 869 anys de Ricard Cor de Lleó no és cap efemèride: ningú clava un personatge per celebrar-li els 73 anys de la mort. Quan la BD tingui prou gent, filtrar a múltiples de 50 (o 25) i tornar el títol a «Aniversaris rodons». El camp round ja ve calculat des de anniv_state() a _tools/dash.py: només cal filtrar la llista. Llindar orientatiu: amb ~300 persones ja surten uns 2 rodons per finestra de 30 dies.

## Personatge del dia: text lliure per al motiu de l'homenatge
Ara PD_PINNED només guarda data i QID, i el comentari de la línia és el nom + la descripció de Wikidata. Voldria poder-hi escriure jo el motiu: «avui fa 100 anys de la seva mort», «ahir va guanyar una medalla d'or», etc. Cal decidir on viu aquest text: al comentari de PD_PINNED no serveix perquè el joc no llegeix comentaris — hauria de passar a un objecte {qid, motiu} o a una segona constant. I al joc, decidir on es pinta (sota el nom? un badge?). Afegir el camp al formulari del calendari del dashboard.
