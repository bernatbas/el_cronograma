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

## [TANCAT] Poblar la BD
Més esdeveniments i marcs. És manual — els blocs de període no es poden cercar a Wikidata.
> Nota (2026-11-17): És una tasca contínua, no un ítem tancable. El 17/11/2026 hi havia 59 esdeveniments (28 afegits aquell dia).

## Escalabilitat dels punts a zoom out
Ara els events en mode punt es veuen semitransparents i va bé. Amb molts events caldrà revisar densitat i soroll visual. Lligat amb el clustering «+N» (Fase 2 del full de ruta, §7 de ESTRATEGIA.md).

## Neteja de localStorage
Podar les entrades de persones per edat i ús via segell `_ts`, o límit dur (~500 persones). Opt-in: l'usuari ho activa explícitament, no es fa sol.

## Opcional: encastar Oswald en base64
Eliminar el FOUT (flash de tipografia de marca) a la primera visita. La solució actual (càrrega no bloquejant + fallback condensat) ja és prou bona; seria perfeccionisme.

## Guia de benvinguda: falta el mòbil
Un tooltip o overlay que expliqui els gestos bàsics (zoom, cerca, col·leccions) a la primera visita.
> Nota (2026-11-17): Feta per a escriptori (sis passos, Shakespeare + La Il·lustració; detall a CLAUDE.md). Falta adaptar-la al mòbil: les col·leccions viuen al popup de configuració, el canvas en horitzontal és baix, i en vertical ja surt l'avís de girar.
> Nota (2026-11-18): Disseny decidit (encara no fet). En comptes de globus, una TIRA: targeta baixa (~60px) i ampla, enganxada a dalt o a baix segons on hi hagi lloc, i un halo sobre el que s'ha de tocar. Mesurat a 740×360: canvas de 300px, la fitxa puja des de baix i en fa 190, el popup de configuració ocupa el centre (420×330) i als costats només queden 160px.
> - Pas 0: targeta centrada, més compacta.
> - Pas 1: tira a baix, halo al cercador. El nom suggerit busca SENSE obrir el teclat (en horitzontal taparia mitja pantalla).
> - Pas 2: tira a dalt mentre la fitxa és oberta (halo a «Mostra context»); després, a baix amb la sorpresa.
> - Pas 3: halo al botó de configuració; amb el popup obert la tira s'amaga i l'halo va a la fila «La Il·lustració». En tancar-lo, torna amb el text de «després».
> - Passos 4 i 5: tira a baix; halo a la icona de Vista global i a la de Jocs.
> - Vertical: opció A. Surt primer la targeta de «gira el mòbil» com ara; la guia espera i comença quan l'usuari gira el mòbil (continua en horitzontal) o tanca la targeta (continua en vertical). Mai se solapen.
> - Pendent: si els textos del mòbil han de ser més curts que els d'escriptori.

## [TANCAT] Editar layout mòbil i replantejar funcions
En mobil no m'acaba de convencer, crec que potser alguna funció simplement s'ha d'eliminar, com veure eres i marcs històrics. També la barra lateral crec que no funciona, suggereixo posar-hi un botó tipus a baix a la dreta de settings (o icone a definir) que permeti modificar la vista amb afegir coleccons, veure personatges de la vista actual, i aquesta interacció que en desktop sí que ofereix la lat bar.
> Nota (2026-11-17): El botó de configuració a baix a la dreta amb el popup de pestanyes (Marcs, Col·leccions, Favorits, A la vista) ja substitueix la barra lateral al mòbil. Treure eres i marcs al mòbil es descarta de moment.

## [TANCAT] Unificar DB: data.js com a font única per a index.html i joc.html
Ara la DB viu embedded a index.html i es copia a data.js. Objectiu: invertir-ho. data.js (o equivalent) és la font única, i cada pàgina carrega el que necessita (PEOPLE+EVENTS per al joc, tot per al cronograma). ERAS, MARCS, COLLECTIONS seguirien embedded a index.html perquè el joc no les necessita. Afecta: db_add_person escriu a data.js, index.html llegeix HB_DATA.PEOPLE via script src. Prerequisit: i18n real (les entrades de PEOPLE podrien tenir L() en data.js). Veure CLAUDE.md opció B.
> Nota (2026-11-14): Fet el 14/11/2026, però al revés del que deia l'enunciat: en comptes de fer de data.js la font, la BD surt de l'index.html a db.js i data.js desapareix. index.html passa de 271K a 221K. El joc en treu window.HB_DATA={PEOPLE,EVENTS}.

## [TANCAT] Desfer el copy de la db i data.js
Per garantir que el joc no canvia al llarg del dia, i el seed no genera contingut diferent, proposo només editar la db embeded, i que un cop al día, al final de dia, programar que es corri l'scrip per sincronitzar data.js només a les 11h30 de la nit cada dia, o algo així. Segurament git pot oferir coses així
> Nota (2026-11-14): Fet el 14/11/2026: no cal cap script diari ni cap còpia, perquè ja no hi ha còpia. db.js és l'original i el carreguen les dues pàgines, així que el joc no pot divergir del cronograma ni a mitja jornada.

## Afegir el mapping de paraules clau a categories en el dashboard
Poder editar el mapping de paraules clau a categories des del dashboard, veure quines paraules clau són les que porten a algú a catalogar-lo com a músic, i afegir les que detecti que hi falten.

## PErmetre editar la categoria quan no es pot detectar i està "sense categoria"

## [TANCAT] verdi, beethoven, david caraben... es marquen com a literatura enlloc de música. Cal revisar si hi ha bug

## [TANCAT] Aniversaris: filtrar només els rodons quan la BD creixi
Ara la caixa «Aniversaris propers» del dashboard llista TOTS els aniversaris dels propers 30 dies perquè amb 59 persones filtrar per rodons la deixava buida gairebé sempre (~0,4 encerts per finestra). Però 869 anys de Ricard Cor de Lleó no és cap efemèride: ningú clava un personatge per celebrar-li els 73 anys de la mort. Quan la BD tingui prou gent, filtrar a múltiples de 50 (o 25) i tornar el títol a «Aniversaris rodons». El camp round ja ve calculat des de anniv_state() a _tools/dash.py: només cal filtrar la llista. Llindar orientatiu: amb ~300 persones ja surten uns 2 rodons per finestra de 30 dies.

## Personatge del dia: text lliure per al motiu de l'homenatge
Ara PD_PINNED només guarda data i QID, i el comentari de la línia és el nom + la descripció de Wikidata. Voldria poder-hi escriure jo el motiu: «avui fa 100 anys de la seva mort», «ahir va guanyar una medalla d'or», etc. Cal decidir on viu aquest text: al comentari de PD_PINNED no serveix perquè el joc no llegeix comentaris — hauria de passar a un objecte {qid, motiu} o a una segona constant. I al joc, decidir on es pinta (sota el nom? un badge?). Afegir el camp al formulari del calendari del dashboard.

## [TANCAT] Categoria «arts» genèrica per a les especialitats no mapejades
Desena categoria, paraigua per a tot el que ara cau a «sense categoria» perquè no hi encaixa: arquitectes, fotògrafs, ballarins, dissenyadors, il·lustradors, escultors que no siguin pintors, dramaturgs de teatre. No substitueix painting, music, literature ni cinema: recull el que queda fora. Cal decidir el nom visible (arts? altres arts?) i un color que aguanti la mesura — la família viu a L 61-71 i croma 31-65, i el parell més just actual (science/nocat) està a 19,8 de deltaE. Recordar que una categoria nova vol CINC llocs: CAT_COLORS i cat_<slug> a index.html, guessCats(), CAT_BY_P106 a _tools/dash.py i l opció del selector a dashboard.html. Veure CLAUDE.md.
> Nota (2026-11-17): Feta com a «Art» (slug `art`, bronze #A29058). Hi van arquitectes, escultors, fotògrafs, ballarins, dissenyadors, il·lustradors i teatre; Pintura queda per a pintors i gravadors. Art només compta si va abans que Pintura, Literatura, Música o Cinema. Gaudí és el primer.

## [TANCAT] Col·leccions: favorits i cercador (model Spotify complet)
Ara la barra lateral llista TOTES les col·leccions que existeixen, i això no escala: a Spotify una cosa són les playlists que existeixen i una altra les que tens a la teva biblioteca. Cal separar-ho: (1) un concepte de FAVORIT per a col·leccions —les teves i les d altri—, (2) que el menú lateral i el popup del mòbil només mostrin les que tens a favorits, (3) un cercador per trobar-ne d altres i afegir-les a favorits. Depèn de tenir el directori públic (i per tant servidor) per a les d altri, però el mecanisme de favorits i el cercador es poden fer abans, contra les pròpies i les de sèrie. Nota: el camp vis ja es desa a cada col·lecció des del #149, així que la part de public/privat no necessitarà migració.
> Nota (2026-11-14): Aquesta entrada és per a favoritejar COL·LECCIONS, i no la tanca el que es va fer el 14/11/2026, que són favorits de PERSONES (secció pròpia al lateral + estrella a la fitxa i a «A la vista», a hb_favorits). Però ja deixa el patró fet: estrella buida/plena, i la secció al nivell de «Marcs històrics». Quan es faci això, que segueixi el mateix patró.
> Nota (2026-11-17): Tancada com a duplicada: la idea continua, més detallada, a «Col·leccions com a playlists: catàleg, «Les meves» i compartir».

## [TANCAT] Posar un nom comercial al projecte, comprar el domini i publicar
> Nota (2026-11-17): Fet el 17/11/2026: «Babilinia», domini www.babilinia.com (Cloudflare → GitHub Pages, HTTPS), logo amb la I-zigurat, icona, og.png i metadades a totes les pàgines.

## Reportar error: decidir qui rep el report
El ⚠ de cada persona a «A la vista» i l'entrada del menú ⋮ criden WIP() i només treuen un toast de «En construcció». És l'últim placeholder que queda a la interfície. El que es vol és sense fricció: popup, descrius l'error, s'envia. Això no es pot fer només amb el navegador — hi ha d'haver algú escoltant a l'altra banda. mailto: envia des del correu de l'usuari i la meitat de la gent no té client configurat al mòbil; una incidència de GitHub prellenada demana compte de GitHub. Queda un servei de formularis: sense servidor propi i sense fricció. Cal decidir QUIN servei i QUÈ s'hi envia (el mínim: QID, camp que falla i text; mai res que identifiqui qui ho envia), i dir-ho a la pàgina, perquè són dades que van a un tercer.

## Col·leccions com a playlists: catàleg, «Les meves» i compartir
Idea oberta (16/11/2026), encara per decidir. Les col·leccions haurien de ser com les playlists d'Spotify: en entrar no les veus totes, cadascú es guarda les que vol i les pot compartir amb amics.

Model proposat:
- **Barra lateral**: només «Les meves» (les guardades del catàleg + les creades per un mateix). Avui hi surten totes les de `db.js`.
- **Catàleg**: les de `db.js`, que es troben amb un cercador (o una llista per explorar) i es guarden amb un botó.
- **Compartir**: un botó a cada col·lecció que copia un enllaç. Qui l'obre la veu al canvas i la pot guardar.

⚠️ El límit que ho condiciona: **no hi ha servidor**. Una col·lecció del catàleg es comparteix amb el seu id (`?col=ipcuned`). Una de creada per l'usuari només viu al seu navegador, així que l'enllaç ha de **portar dins la llista de Q-ids** (p. ex. `?col=Nom&q=Q37388,Q37160,…`). La còpia de l'amic és independent: si després hi afegeixes algú, ell no ho veu. Que quedin connectades voldria un servidor, i això és un altre projecte.

Decidit:
- Les notes per persona (p. ex. «precursor de la visió inductivista») **no** van a l'enllaç ni a la col·lecció.

Per decidir:
1. Qui arriba de nou: barra lateral buida o amb una o dues col·leccions suggerides?
2. Catàleg: només cercador, o també una llista per explorar? Amb 7 col·leccions un cercador sobra; amb 50, no.
3. Qui obre un enllaç: veu només aquella col·lecció, o s'afegeix al que ja tenia?

## Dates aproximades als esdeveniments
Les persones tenen el camp `approx` (aprox / disputada) i els jocs no emparellen dues dates incertes a menys de 60 anys (`APX_GAP`). Els esdeveniments no en tenen: la Gran Piràmide o el Codi d'Hammurabi tenen data aproximada i un joc els podria comparar amb un altre esdeveniment a pocs anys. Cal: el camp a `EVENTS` (mateixos tres codis), que la fitxa de l'event ho mostri amb `~`, i que el guard dels jocs també el miri per als events.

## Afegir esdeveniments des del dashboard
Ara el dashboard només afegeix persones; els esdeveniments s'escriuen a mà a `db.js`. Un formulari que, a partir d'un QID de Wikidata, en tregui nom, any, article de la Viquipèdia, descripció i `sitelinks` (el motor de zoom els necessita), i deixi posar `imp` a mà. Compte amb les dates aC (veure CLAUDE.md, «Dates aC de Wikidata»).

## Botó «?» per tornar a veure la guia de benvinguda
Ara la guia només surt sola a la primera visita, i per tornar-la a veure cal afegir `?guia` a l'adreça. Un botó «?» que la reobri. Si va a la topbar és bloc compartit amb el joc.html i s'ha d'encaixar a l'escala de compressió (CLAUDE.md, «El commutador de secció»).

