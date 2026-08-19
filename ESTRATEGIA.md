# 🧭 Estratègia — Densitat, importància i zoom semàntic

> **Backlog obert i estratègies definides** per al cronograma **Història Bàsica**.
> L'arquitectura i les decisions ja estables són a `CLAUDE.md`; el registre de canvis i el seu
> estat de validació, a `CANVIS.md`.
>
> Estat: **Fase 1 implementada** — motor de zoom semàntic actiu per a esdeveniments (2 files
> permanents, aparició monòtona). Pendent: clustering, límit de carrils >2 i estendre-ho a
> blocs/marcs.
> Última actualització: 2026-08-17

---

## 1. El problema

La db s'anirà omplint **a mà** sobretot d'**esdeveniments** i **blocs** (els personatges ja es poden cercar a Wikidata). Amb el temps, alguns trams (p. ex. el segle XX) quedaran **saturadíssims**. Si a *zoom out* dibuixem tot alhora:

- **Il·legibilitat**: etiquetes trepitjant-se, pantalla il·legible.
- **Rendiment**: milers de nodes DOM alhora poden fer patir sobretot el mòbil.

Dos eixos de densitat: **horitzontal** (molts ítems al mateix tram temporal) i **vertical** (massa carrils solapats).

---

## 2. Principi rector: zoom semàntic (Level of Detail)

Com a Google Maps: **com més allunyat, menys ítems i més importants; en apropar-se, van apareixent els secundaris**, de manera **gradual i orgànica** (amb *fade*), no robòtica.

> La importància decideix **QUAN** apareix un ítem (a partir de quin zoom), **no SI** apareix. A zoom màxim es veu **tot**.

---

## 3. Model d'importància

Puntuació **contínua** (no nivells discrets), a partir de dues fonts:

1. **`sitelinks`** — nombre d'idiomes de l'article a Wikidata (proxy de notorietat). Es baixa un cop i es **cacheja** a la db.
2. **`imp`** — *override* manual (0–100). Si existeix, **mana per sobre** del càlcul automàtic. Per a ítems sense article (p. ex. DELT) o quan volem forçar un valor.

**Fórmula (v1):**

```
metric = imp ?? round( 100 * ln(sitelinks) / ln(300) )
```

- Referència màx. ≈ 300 idiomes → mètrica ~100.
- El logaritme evita que les 2 guerres mundials esclafin la resta.
- **Mínim = 0** (1 sol idioma → 0). El salt 1→2 idiomes és 0→12 (log costerut a la base).
- ⚠️ **A calibrar amb dades reals.** Si el salt 1→2 canta massa, alternativa suau: `ln(sitelinks + 1)`. És només un paràmetre, no cal tocar dades.

**Exemples (esdeveniments actuals):**

| Idiomes | Mètrica |
|--------:|--------:|
| 1 | 0 |
| 2 | 12 |
| 5 | 28 |
| 10 | 40 |
| 38 | 64 |
| 128 | 85 |
| 292 | 100 |

---

## 4. Regla de visibilitat: importància + densitat local

La visibilitat **NO** és un llindar global d'importància. És **densitat-aware** (mecanisme B2, "pressupost de densitat"):

- **Importància** = la *prioritat* (qui guanya quan hi ha baralla per l'espai).
- **Densitat local** = la *porta real* (que hi hagi lloc en aquest tram de píxels, ara).

> Regla: *a cada tram de la línia, mostra els ítems de més prioritat que hi càpiguen sense trepitjar-se.*

Conseqüències:

- **Zona atapeïda** (s. XX): encara que un event tingui importància mitjana, pot quedar amagat perquè competeix amb fites enormes.
- **Zona buida** (p. ex. any 1200): un event de valor baixíssim **es veu igualment**, perquè no competeix amb ningú. La importància només desempata quan falta espai.

### Capes de render (combinables)

- **Fade continu**: a prop del llindar de cada zoom, opacitat intermèdia → aparició/desaparició gradual (transició CSS), no de cop.
- **Mode punts** (B3): a zoom molt baix, sense etiquetes; només punts/ticks. L'etiqueta torna en *hover* o en apropar-se.
- **Clustering** (B4): trams molt densos es fonen en un marcador amb comptador ("⬤ 6 esdeveniments") que s'obre en clicar o en fer zoom.
- **Límit de carrils + "+N"** (B5): eix vertical; apilar fins a X carrils, la resta es col·lapsa.

---

## 5. Cost i arquitectura

- Tot viu en **un sol HTML** (CSS+JS *inline*). El motor és **JavaScript 100% client-side**.
- **Cost de servidor ≈ 0**: només se serveix un fitxer estàtic (GitHub Pages / Netlify…). El navegador fa tota la feina.
- El zoom semàntic + *culling* és **també** estratègia de rendiment: només es pinta el visible i per sobre del llindar.
- L'única xarxa és la cerca en viu de personatges (i els sitelinks), que va contra **Wikidata** (API pública), no contra el nostre servidor. Els sitelinks es cachegen.
- El cost de servidor **només apareixerà amb el backend** (EPIC 1b: comptes, col·leccions públiques/privades, preferits).

---

## 5.1 Col·locació d'esdeveniments: recàlcul en carregar (i events dinàmics)

El motor assigna a cada esdeveniment una **fila permanent** (0/1) i un **llindar de zoom** (`_revealPPY`: a partir de quants px/any apareix el nom). Decisions clau:

- **Quan es calcula:** un sol cop **en carregar la pàgina**, just després de definir la llista d'esdeveniments. Viu **en memòria** (`ev._row`, `ev._revealPPY`); **no es persisteix**.
- **Refrescar la pàgina** → es recalcula des de zero, però l'algoritme és **determinista** (mateixa entrada → mateix resultat). Per això el resultat és idèntic cada cop i no hi ha «ball». Cost: mil·lisegons.
- **No es desa a `localStorage` a propòsit.** Guardar-ho seria optimització prematura; recalcular sempre és barat i evita dades derivades desincronitzades.
- **Events dinàmics (custom / Wikipedia):** en afegir-ne, cal **recalcular-ho tot** — el càlcul és **global, no incremental**. N'hi ha prou amb tornar a cridar la mateixa funció de precàlcul després de fusionar els events nous amb els existents; **no cal reescriure el motor**.
  - Efecte lateral acceptable: un event nou molt important a prop d'un altre pot fer que un event existent canviï de fila **en la següent càrrega** (mai enmig d'una interacció → mai marejament).
- **Cost / escala:** el precàlcul és **O(n²)** (parelles dins de cada fila). Amb desenes o centenars d'events és instantani. Només si algun dia arribem a **milers** valdrà la pena passar a càlcul incremental o cachejar el resultat.
- **On connectar-hi la font futura:** quan els events vinguin de la db/backend o d'una cerca, el flux és carregar-los → fusionar amb `EVENTS` → cridar el precàlcul → render. Punt d'extensió ja previst.

## 5.2 Wikidata: dues APIs, i el ball dels anys aC

**No és una tasca, és un criteri a tenir en compte cada cop que es toqui Wikidata.**

Les dues APIs de Wikidata **serialitzen els anys aC diferent**: el mateix valor surt amb un any de
diferència. Comprovat amb quatre casos:

| Personatge | `wbgetentities` | SPARQL | Real |
|---|---|---|---|
| Aristòtil | `-0384` | `-0383` | 384 aC |
| Sòcrates | `-0470` | `-0469` | 470 aC |
| Cleopatra | `-0069` | `-0068` | 69 aC |
| Juli Cèsar | `-0100` | `-0099` | 100 aC |

No és un error de Wikidata, són dues feines:

- **`wbgetentities`** torna el **model natiu** de Wikidata (sense any zero: el signe va sobre l'any
  històric). És «dona'm aquests ítems»: barata i estable, però no pot filtrar ni ordenar.
- **SPARQL** ha de tornar **tipus XSD** perquè el motor hi pugui comparar i ordenar, i l'ISO 8601
  **sí que té any zero** i numeració astronòmica. És l'única que permet cercar de debò (filtrar,
  ordenar, `LIMIT`), a canvi de límits de servei i més fragilitat.

Per això **no té sentit «fer servir sempre la mateixa»**: si es deixa SPARQL es perd la cerca, i
si es deixa `wbgetentities` es paga el servei de consultes per anar a buscar IDs ja coneguts.

**Criteris:**

- **Cada parser d'anys ha de dir de quina API ve el valor.** Avui `wdYear()` resta 1 (correcte per
  a SPARQL) i el parser del mode `?person=` no resta res (correcte per a `wbgetentities`). **Tots
  dos estan bé.** ⚠️ És exactament la mena de cosa que algú «unifica» per no duplicar codi i
  desplaça tots els anys aC un any. Si algun dia es toca, el que cal és **una sola frontera de
  conversió** amb la font explícita, no un sol parser.
- **Fer servir SPARQL només per al que només ell pot fer.** Resoldre Q-ids coneguts no ho és: les
  col·leccions ho fan amb un `VALUES ?item { wd:Q… }`, que és una cerca per ID disfressada de
  consulta i amb `wbgetentities` aniria més ràpid i cauria menys.

---

## 5.3 Una persona sense any de naixement no es pinta (2026-08-18)

`x(y) = (y - YEAR_MIN) * pxPerYear` no té cap noció de «no ho sé»: amb `y = null` el `null` es
coerciona a 0 i la barra apareix **a l'any 0** i s'estira fins a «avui» com si fos algú viu des de
l'antiguitat. Un personatge sense `birth` a Wikidata (o amb la data perduda pel camí) es veia com
una franja que travessava tot el cronograma.

**La regla és que `birth` és obligatori per pintar.** No hi ha barra sense any de naixement, i el
cronograma no ha d'endevinar-lo. Implementat en **tres capes**, i cadascuna cobreix una escletxa
diferent — no és redundància per comoditat:

1. **`visiblePeople()` filtra `typeof p.birth === 'number'`.** És l'única capa que garanteix el
   resultat: passi el que passi amunt, res sense any arriba al render. `typeof` i no `!= null`
   perquè un `birth` que hagi passat per un JSON dolent pot ser una string.
2. **`mostraPersonatge()` repara** les dates nul·les d'una entrada que ja era a `PEOPLE`. Abans
   només omplia els camps en **crear** l'entrada, així que una persona desada un dia amb `birth`
   nul es quedava nul·la per sempre, encara que la crida següent portés la data bona. Aquest era el
   bug de debò: la caché de `localStorage` fossilitzava el forat.
3. **El traspàs multi-personatge demana les dades que li falten**: per cada persona que arriba
   sense any es crida `fetchPerson(qid)` a Wikidata i, quan respon, es guarda i es re-renderitza.
   Recuperar la dada és millor que amagar la persona en silenci.

`centerOnPerson()` cau a `defaultView()` si no hi ha `birth`: centrar-se en un any inexistent
enviava la vista a l'any 0, lluny de tot.

**Criteri general**: qualsevol camp que entri a una projecció aritmètica (`x()`, amplades, carrils)
s'ha de validar *pel tipus* al límit del render, no confiar que qui l'ha escrit ho hagi fet bé. El
`null` silenciós no peta, i això és el que el fa car de trobar.

---

## 5.4 Avisos d'un sol ús (2026-08-18)

L'avís de girar el mòbil en vertical surt **un cop per usuari**, no un cop per sessió: el ✕ desa
`historiabasica.rotateDismissed` a `localStorage`. Un consell útil el primer dia és una molèstia el
desè, i qui l'ha tancat ja ha entès que el cronograma es veu millor en horitzontal.

Distinció a mantenir: els avisos **informatius** (aquest) es descarten per sempre; els que depenen
del **contingut del dia** (com el pop-up d'invitació del «Personatge del dia») es claven per data,
perquè demà parlen d'algú altre.

---

---

## 6. Esquema de dades

L'esquema de camps de `EVENTS`, `MARCS`, `PEOPLE`, `ERAS` i `COLLECTIONS` viu a **`CLAUDE.md`**
(secció «Dades»), per no tenir-lo en dos llocs i que se'ns desincronitzi.

Aquí només el que és estratègia: `sitelinks` i `imp` (§3) són els camps que alimenten el motor
d'importància.

> ⏳ Pendent: afegir `sitelinks`/`imp` **als blocs** quan estenguem el zoom semàntic als marcs.

---

## 7. Full de ruta (fases)

1. **Dades (fet)**: afegir `sitelinks` + `imp` als esdeveniments.
2. **Fase 1 — render base (fet per a esdeveniments)**: zoom semàntic per mètrica + *fade* continu + mode punts a zoom baix, amb **2 files permanents i aparició monòtona** (sense «ball» ni intercalat). Pendent encara: límit de carrils >2 i estendre-ho a blocs/marcs. (Resol ~90% del dolor.)
3. **Fase 2**: clustering amb comptador i *popover*.
4. **Fase 3 — control d'usuari**: slider "nivell de detall" + filtres per categoria / col·leccions d'events.

---

## 8. Decisions obertes / TBD

- Calibrar la fórmula (`ln(sitelinks)` vs `ln(sitelinks+1)`) amb dades reals.
- Valor final de `imp` per a DELT (ara **8**).
- Estendre importància als **blocs** (`MARCS`).
- Terra mínim de zoom perquè a la vista global del tot els solitaris no facin soroll.


## 9. Mòbil / tàctil — implementat

Ja està fet i és **estat actual**, no estratègia: el detall (barra fina, bottom-sheet, gestos,
terra enganxat a baix, què s'amaga en tàctil, `dvh`) viu a **`CLAUDE.md`** § «Mòbil / tàctil».

Queda obert només: **prova en dispositiu real (Safari iOS)**.

---

## 10. Backlog obert

Els canvis ja **fets** i el seu estat de validació són a `CANVIS.md`; això és el que **encara no
s'ha fet**. (Abans vivia en un quart document, `CONTEXT.md`, que es va fusionar aquí i al
`CLAUDE.md` l'11 d'agost de 2026 i ja no existeix.)

### Bugs

- **El globus dels blocs no surt quan el text queda tallat** ✅ Resolt al canvi #68. Es mesuren els spans interiors (`.segname`, `.segyears`) en lloc del bloc pare, i s'elimina la tolerància `+1` que amagava retallades d'1px.

### UX

- **Vista global auto-desmarcada** ✅ Resolt com a efecte col·lateral: `addFromSearch` crida `clearFitLatch()` (desmarca), i les col·leccions criden `fitToPresent()` (#70). Si el nou personatge queda dins, el botó es queda marcat — és coherent perquè re-clicar tampoc no canviaria res.
- **Repensar l'etiqueta «Treu de la vista»** ✅ Canviat a «Esborra».
- **Tirador d'obrir/tancar la barra** ✅ Fet al canvi #54 (píndola vertical terracota).
- **Eix de l'any: anclar a meitat de pantalla en pantalles grans** ✅ Fet. `floorH` al desktop és `Math.max(contentH, scroll.clientHeight*0.5)`.
- **Textura a la topbar** ✅ Fet al canvi #56 (gra de paper amb `background-blend-mode:soft-light`).
- **Ressaltar el personatge del dia en arribar del joc** ✅ Fet al canvi #64 (`flashBar` + `centerOnPerson`).
- **Clicar el nom a la personbar torna a ressaltar-lo** ✅ Fet al canvi #64 (click al `pname` crida `revealPerson`).
- **Activar una col·lecció ha de reenquadrar** ✅ Resolt al canvi #70. `toggleCollection()` crida `fitToPresent()` a tots els camins (èxit, error/fallback). La decisió anterior («no toca el zoom») es reverteix: la nova conducta és reenquadrar sempre, com fa `addFromSearch`. `CLAUDE.md` actualitzat.

### Motor d'importància per a personatges

- **Calibrar la importància dels personatges**, igual que ja es fa amb els events. **Estratègia
  TBD.** Context per quan s'ataqui:
  - El motor de zoom semàntic (§2–§4) està implementat **només per a events**. Els personatges
    no tenen cap tractament de nivell de detall: a zoom baix no degraden, es trepitgen.
  - Mesurat a «Vista global» amb la col·lecció de 18 filòsofs: **les 18 de 18** etiquetes
    desborden la seva barra (barra mitjana de 29px contra noms de 100–190px), amb un
    desbordament màxim de **160px** i **6 col·lisions** de nom sobre nom.
  - `PEOPLE` **no té els camps** `sitelinks` ni `imp` (només els té `EVENTS`, §6): el primer pas
    és estendre l'esquema i baixar els `sitelinks` de Wikidata també per a les persones.
  - ⚠️ **No és copiar el motor dels events.** Un event és un **punt** i pot degradar a mode punt;
    una persona és un **rang** (la barra = la durada de la vida, i l'amplada no es pot tocar
    sense mentir). El que sobra a zoom baix és **l'etiqueta**, no la barra. Cal decidir què es
    degrada: el nom (amagar-lo i deixar la barra), la barra sencera, o agrupar per carrils.
- **Toggle «mostra-ho tot» / «filtra per importància»**: un control que o bé deixa la vista com
  ara (tot visible) o bé aplica la calibració de dalt. Encaixa amb la **fase 3** del full de ruta
  (§7), que ja preveu un control d'usuari de nivell de detall.

### Dades i escala

- **Poblar la BD**: més esdeveniments i marcs. És **manual** — els blocs de període no es poden
  cercar a Wikidata.
- **Escalabilitat dels punts a zoom out** (Bernat, 2026-08-06). Ara els events en mode punt es
  veuen semitransparents i va bé, però amb **molts** caldrà revisar densitat i soroll visual.
  Lligat amb el clustering «+N» (§7 fase 2).
- **Neteja de `localStorage`** (opt-in): podar per edat i ús via segell `_ts`, o límit dur
  (~500 persones).
- **Script d'ingesta a la BD**: una eina per afegir **persones, events o blocs** sense editar el
  `[1] DATA` a mà. Restriccions i paranys a tenir en compte (tots ja trobats treballant-hi):
  - L'app és **un sol fitxer estàtic sense build**, així que l'script és una eina de
    desenvolupament: el més senzill és que **emeti els literals JS** per enganxar a `[1] DATA`
    (o que els insereixi al fitxer), no que l'app llegeixi res nou en temps d'execució.
  - **Apòstrofs**: cal emetre l'apòstrof tipogràfic `’` (U+2019); un `'` literal trenca l'script.
  - **Dates aC**: Wikidata fa servir numeració astronòmica (sense any 0). Conversió:
    `ourYear = astroYear <= 0 ? astroYear - 1 : astroYear`.
  - **Verificar els Q-id**: cercar pel nom retorna sorpreses (Epictet, Hume i Francis Bacon ja
    van sortir malament). Comprovar amb `wbsearchentities` abans de donar-los per bons.
  - Els **blocs de període no es poden cercar a Wikidata**: per a `MARCS` l'script només pot
    ajudar amb el format, el contingut és manual.

### Opcional

- Encastar Oswald en base64 (.woff2) per eliminar el FOUT del títol a la primera visita.
- Hint d'onboarding.

---

## 12. Dashboard de control (`_tools/`)

Eina de desenvolupament per centralitzar el que ara està escampat entre `git`, `gh`, els tres
documents i l'editor. **Substitueix el punt «Script d'ingesta a la BD»** del backlog, que era la
versió petita d'això mateix.

### Decisions d'arquitectura

- **Dos fitxers**: `_tools/dashboard.html` (frontend sencer) i `_tools/dash.py` (servidor local,
  stdlib de Python, sense dependències).
- **La carpeta comença amb `_` a propòsit**: el repo no té `.nojekyll`, així que Pages passa per
  Jekyll, i Jekyll **no publica** els directoris que comencen amb underscore. El dashboard queda
  fora del web sense haver de gitignorar-lo (i així es versiona com la resta).
- **La regla «sense build ni servidor» no aplica aquí.** És per a `index.html`, que és el producte.
  El dashboard és eina interna i pot demanar un `python3 _tools/dash.py`.
- **Zero tokens.** El backend crida el `gh` ja autenticat del sistema en lloc de guardar un PAT.
  Es va descartar la via «HTML estàtic + GitHub API amb token» per dues raons: hi hauria un secret
  viu al `localStorage`, i sobretot **un fitxer estàtic no pot llegir `.git/`**, per tant no pot
  detectar desincronització — que és precisament una de les coses que es volien.
- **Només escolta a `127.0.0.1`**, mai a `0.0.0.0`. Els subprocessos es criden en forma de llista,
  mai amb `shell=True`.
- **Contracte frontend↔backend tolerant**: un endpoint encara no implementat retorna **501** i el
  frontend cau a dades d'exemple amb la mateixa forma, ensenyant un badge de «pendent». Així es pot
  jutjar tota la UI des del primer dia i el backend pot créixer per trossos sense deixar la pàgina
  a mitges.

### Paranys ja trobats

- **Comptar entrades de `DATA` demana saltar-se els comentaris abans de les cometes.** Els
  comentaris de `[1] DATA` porten apòstrofs catalans (`// Tomàs d'Aquino`); si es tracten com a
  text normal, obren una string fantasma i el recompte se'n va (donava 12 col·leccions en lloc
  de 2).
- **`MARCS` té dos nivells.** Hi ha 2 marcs (Occident, Espanya) i 23 blocs de període dins seu. El
  número que interessa per saber com de plena està la BD és el de **blocs**, que és el contingut
  escrit a mà.
- **`[hidden]` no guanya a `display:flex`.** Un bàner amb `.banner{display:flex}` es veu igualment
  amb l'atribut `hidden` posat; cal una regla `.banner[hidden]{display:none}` explícita.

### Fases

1. **Estat** (fet): git (branca, modificats, ahead/behind), CI via `gh`, comptadors de la BD,
   proper homenatge de `PD_PINNED`. Tot **només lectura**.
2. Cua de validació: passar entrades de `CANVIS.md` de 🧪 a ✅. Primera escriptura, i és la més
   segura — markdown, no JS.
3. Calendari de `PD_PINNED`: clavar i treure homenatges, amb cercador d'aniversaris rodons.
4. Linter de dades: `birth` nul, QIDs duplicats, events sense `sitelinks`, escàner de `U+FFFD` i
   de delimitadors corromputs.
5. **Editor de la BD** (l'últim a propòsit): és l'única peça que escriu literals JS dins el fitxer
   que ja s'ha trencat dues vegades. Requisit no negociable: **test de parseig abans de
   committejar** — carregar `index.html` en un iframe i comprovar que `window.PEOPLE` existeix. Si
   no hi és, no es puja. El camp de nom ja converteix `'` a `’` en escriure i ho diu.

---

## 11. Analítica — Google Analytics 4

Implementat el 2026-08-17. Measurement ID: **`G-0L1N4BT3QQ`** (free, sense límit de visites).
El snippet és als dos fitxers (`index.html` i `joc.html`) just després del `<meta charset>`.

### 11.1 Events de `index.html`

| Event | Quan s'envia | Paràmetres |
|---|---|---|
| `colleccio_activada` | En activar una col·lecció (toggle ON) | `colleccio` |
| `fitxa_oberta` | En obrir la fitxa de detall d'un personatge | `personatge` |
| `mostra_context` | En clicar «Mostra context» dins la fitxa | `personatge` |
| `vista_global` | En clicar el botó «Vista global» | — |
| `reset` | En clicar «Restablir» | — |
| `cerca_wikidata` | En llançar una cerca al cercador | `text` |
| `personatge_afegit` | En afegir un personatge des de Wikidata | `nom`, `qid` |

### 11.2 Events de `joc.html`

| Event | Quan s'envia | Paràmetres |
|---|---|---|
| `joc_vist` | En muntar el joc (primera pantalla visible) | `joc` |
| `joc_iniciat` | Primera interacció real: primera resposta (AbansDespres), primera pista desvetllada (PersonatgeDia), primer drag (OrdenaLinia) | `joc` |
| `joc_completat` | En acabar el joc (bé per victòria, bé per derrota) | `joc`, `resultat` (`guanyat`/`perdut`), `encerts` (número) |
| `joc_comodin_usat` | En clicar el 🃏 comodí (1 cop màxim per partida) | `joc` (`abansdespres`) |
| `joc_2_cronograma` | En clicar «A veure, ensenyam-ho» des del joc | `joc` |

Valors de `joc`: `abansdespres`, `personatgedia`, `ordena`.

`joc_vist` i `joc_iniciat` es disparen **un sol cop per sessió de joc** (flags `gaStarted` / `gaOrdStarted` que es reinicien al muntar cada joc). `joc_completat` es dispara cada cop que la partida acaba.

### 11.3 Custom definitions a crear a GA4

Totes 7 ja creades a GA4 (Admin → Custom definitions → Custom dimensions):

| Nom GA4 | Paràmetre d'event | Scope | Nota |
|---|---|---|---|
| `Colecció` | `colleccio` | Event | |
| `Nom persona` | `nom` | Event | |
| `Encerts` | `encerts` | Event (metric) | A Custom metrics, no dimensions — permet fer mitjanes i sumes |
| `Joc` | `joc` | Event | |
| `Personatge` | `personatge` | Event | |
| `QID` | `qid` | Event | |
| `Resultat` | `resultat` | Event | |
| `Text de cerca` | `text` | Event | |

### 11.4 Com llegir les dades

- **Temps real** (Reports → Realtime): veure events en directe mentre s'usa l'eina.
- **Informe d'events** (Reports → Engagement → Events): volum per event, últims 28 dies.
- **Exploració** (Explore → Blank): per combinar dimensions — p. ex. `Joc` × `Resultat` per veure taxa de victòria per joc.
- **Filtre de bots**: el trànsit de GitHub Pages i bots de Google apareix com a EUA sense interacció. Es pot crear un filtre `Developer traffic` a Admin → Data filters (Developer IP) per excloure les teves visites locals.

### 11.5 Patró per a futurs jocs / botons «Veure al cronograma»

Quan un joc nou tingui el botó de cross-sell cap a `index.html`, afegir **abans** de navegar:

```js
if(typeof gtag!=='undefined') gtag('event','joc_2_cronograma',{joc:'<id_del_joc>'});
```

I al muntar el joc, els tres events habituals (`joc_vist` al `mount`, `joc_iniciat` a la primera acció, `joc_completat` al final), seguint el patró de `gaStarted`.
