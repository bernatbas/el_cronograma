# 🎮 Estratègia — Jocs d'Història Bàsica

> Doc mestre del projecte **paral·lel de jocs**, derivat del cronograma «Història Bàsica».
> Aquí anotem visió, decisions i backlog. La base del cronograma **NO es toca des d'aquí**
> (es desenvolupa en un altre entorn); aquí treballem en paral·lel amb `joc.html`.

## 1. Concepte
Un «hub» de jocs sobre el mateix contingut històric (persones, esdeveniments, marcs).
Un sol fitxer `joc.html` amb un menú i diversos jocs com a «modes». Mateixa filosofia que
l'app principal: **un sol HTML, offline-friendly, sense build**.

## 2. Jocs previstos
> **Tots els jocs són *daily challenge***: un sol intent al dia, mateix repte per a tothom
> (no hi ha mode lliure/infinit de moment). "Repte diari" ja **no** és un joc a part.
1. 🕰️ **Ordena la línia** — posar 4–5 items en ordre cronològic.
2. ⚖️ **Abans o després?** — encadenat *higher/lower* (implementat com a daily).
3. 🕵️ **Endevina el personatge** — pistes progressives.
4. 🤝 **Contemporanis?** — dues persones van coincidir en vida?

## 3. Decisions (registre)
- **2026-08-12 · Dades: snapshot provisional (`data.js`).** De moment **dupliquem** la DB en un
  `data.js` (còpia de PEOPLE/EVENTS/MARCS d'index.html) per poder testejar en local amb doble
  clic (`file://`). És **PROVISIONAL**: quan hi hagi DB externa, es substitueix pel carregador
  real (fetch). *Alternativa avaluada i ajornada*: llegir directament d'index.html via **iframe
  ocult** (same-origin) — sense duplicar, però no funciona amb `file://` (Chrome bloqueja la
  lectura entre fitxers), només a GitHub Pages / servidor local.
- **2026-08-12 · Arquitectura: un sol HTML + router per hash.** Cada joc és una «pantalla»
  (`joc.html#/<id>`); res de fitxers per joc ni pop-ups. El botó enrere del navegador i els
  enllaços directes funcionen. Cada joc serà un mòdul amb `mount()/unmount()` (a implementar).
- **2026-08-12 · Font de dades: només la nostra DB per començar.** El «mode infinit» amb
  Wikidata queda **ajornat** (veure backlog). La DB no s'esgota tan ràpid perquè els jocs són
  **combinatoris** (plantilles × dades).
- **2026-08-12 · Primer joc = «Abans o després?» (encadenat).** Mecànica *higher/lower*: es manté
  un item de **referència** (any visible) i apareix un item **nou** (any ocult). L'usuari respon
  si el nou és **abans** o **després**. Encert → el nou passa a referència i la cadena continua i
  suma; error → fi de partida. Es desa la **millor ratxa** a `localStorage`
  (`hb_abansdespres_best`). Arquitectura: mòdul amb `mount()/unmount()` registrat a `MODULES`;
  el router crida `unmount()` en sortir.
- **2026-08-12 · Contingut dels jocs cronològics: esdeveniments + persones; MAI marcs/eres.**
  Els anys d'inici/fi de marcs/eres són massa imprecisos (p. ex. l'edat mitjana no acaba en un any
  concret), així que **s'exclouen** del pool. Per a **persones** cal **especificar sempre**
  l'àncora temporal: cada carta indica si és **any de naixement** (🎂) o **any de mort** (🕯️).
  Cada persona genera fins a **dos items** (naixement i mort) → més varietat amb dataset petit.
  Es descarten empats d'any (es re-tria candidat) per evitar preguntes ambigües.
- **2026-08-12 · Definició del Repte diari.** Serà la **mateixa mecànica encadenada**: «quants de
  seguits en fas sense fallar», però amb **seqüència determinista pel dia** (mateix repte per a
  tothom) + ratxa de dies.
- **2026-08-12 · GIR: el *daily challenge* és el model de TOTS els jocs, no un joc a part.**
  Cada joc es juga **un cop al dia** amb seqüència determinista. S'elimina la targeta «Repte
  diari» del menú. De moment **no** hi ha mode lliure/infinit per practicar (es reconsiderarà en
  el futur). Per tant no cal cap refactor de "dos modes": «Abans o després?» **és** el daily.
- **2026-08-12 · Daily challenge — disseny tècnic (implementat i verificat).**
  - **Determinisme:** llavor = **data local** (`YYYY-MM-DD`) → hash FNV-1a → PRNG *mulberry32* →
    barreja sembrada del pool (ordenat de forma **estable per `id`** abans de sembrar). Mateix
    codi + mateixa data + mateix `data.js` = mateix repte per a tothom, **sense servidor ni
    pujades diàries**. Funciona en 100% local, GitHub Pages i servidor.
  - **Frontera del dia:** **mitjanit LOCAL** de cada jugador (`new Date()` del navegador).
  - **Baralla FINITA sense rebarreig** → si te la fas tota, «ronda perfecta». Es salten empats
    d'any de forma determinista.
  - **Cada persona apareix NOMÉS UN COP per dia** (naixement O mort, triat per la llavor del dia):
    mai es compara el naixement d'algú amb la seva pròpia mort ni surt duplicada; entre dies pot
    alternar. Fet i verificat 2026-08-12 (recorregut complet: 36 persones + 15 esdeveniments, 0 duplicats, 0 autocomparacions).
  - **Un intent/dia:** en acabar es desa a `localStorage` (`hb_ad_daily` = `{date,score,perfect}`).
    Si tornes a entrar el mateix dia → pantalla de resultat **bloquejada** (no es pot rejugar).
    Bloqueig **tou** (client-side); anti-trampa dur → quan hi hagi backend.
  - **Ratxa de dies consecutius:** `hb_ad_streak` = `{last,days}` (+1 si `last`=ahir, si no reinicia).
  - **Pantalla de resultat:** marcador + ratxa de dies + **compte enrere** fins a mitjanit local
    + **botó de compartir** (text estil Wordle sense spoilers; Web Share API al mòbil, còpia al
    porta-retalls al desktop).
  - **Sense versionat de dataset ni històric** de moment (no oferim "juga el d'ahir").
  - **UI/UX:** capçalera del joc amb títol + data, disseny centrat (max 560px) per desktop,
    botons grans i tàctils per mòbil. Distintiu 📅 "Repte diari" a les targetes actives.
- **2026-08-12 · Refinament UI/UX del joc (implementat i verificat desktop + mòbil).**
  - **Icones coherents:** 🎯 **diana** = encerts seguits (dins la partida i al resultat); 🔥 **foc** =
    dies consecutius. Abans el foc s'usava per a les dues coses (incoherència, corregida).
  - Marcador 🎯 alineat a la **dreta** (número + etiqueta), amb pols en encertar.
  - Cartes **sense els ròtuls "Referència/Nou"**: la referència és "fixada" (fons suau + 📌) i la
    nova és "elevada" (ombra) i **entra animada**; el `?` marca que és la desconeguda.
  - Cartes **sense l'etiqueta Persona/Esdeveniment**: esdeveniments només 📜; persones mantenen
    🎂 naixement / 🕯️ mort (imprescindible saber quin any es compara).
  - **Instrucció** com a subtítol sota el títol; **data + 📅 Repte diari** al **peu**, sota els botons.
  - **Animació Fase 1** (sense llibreries): entrada de la carta nova + flip de l'any en revelar-se;
    respecta `prefers-reduced-motion`. **Sense swipe** (Fase 2 descartada: poc intuïtiu).
  - Botons Abans/Després amb aparença més "premible" (ombra inferior, hover/active, targets grans).
  - Pantalla final: dues estadístiques 🎯 encerts + 🔥 dies. Botó compartir: Web Share al mòbil/Mac,
    còpia al porta-retalls a Windows (menys vistós però funcional).
- **2026-08-12 · Comodí, contrast de cartes i color de marca (implementat i verificat).**
  - **Comodí "Passa (1)":** botó estret i secundari **entre** Abans i Després. Es pot fer servir
    **un sol cop per repte**; en gastar-lo queda deshabilitat. En passar, apareix un nou candidat
    **sense sumar ni restar** encerts (no compta com a fallada). Si en passar s'esgota la baralla,
    compta com a ronda perfecta. Segueix sent determinista (només avança la baralla). Estat `skipUsed`.
  - **Cartes = mateix color** (fons blanc totes). La **fixada** es distingeix per **vora gruixuda
    terracota (2px) i SENSE hover**; la **nova** per **ombra elevada** (+ animació d'entrada). Es
    retira el fons beix de la referència perquè no es camuflava amb el fons de pàgina.
  - **Color de marca (terracota #B8503C, del topbar):** fletxes dels botons i insígnia **VS** en
    terracota; *hover* dels botons amb vora + text terracota i ombra inferior càlida. Sense colors nous.
  - **Subtítol d'instrucció eliminat** (el joc s'entén visualment). Separació entre 🎯 i el número.
- **2026-08-12 · Afinat visual (ronda 3, implementat i verificat).**
  - Vora de la carta fixada més gruixuda (**3px** terracota). **Sense pin 📌** i **sense icôna 📜**
    d'esdeveniment (les persones mantenen 🎂/🕯️, imprescindible).
  - Més **separació** entre el marcador superior i la carta fixada (marge 20px).
  - Botó **"Passa (1)"** ara **estèticament igual** que Abans/Després (mateixa vora, fons, ombra,
    alçada i comportament hover/active), només més estret.
  - **Revelació de l'any més lenta**: flip 0.5s i la carta es manté ~2.0s (encert) / ~2.1s (error)
    abans d'avançar, per tenir temps de llegir l'any.
  - **Marcador d'encerts = opció A**: pastilla compacta `🎯 N` (fons terracota suau), sense el text
    "encerts seguits". Manté el pols en encertar.
- **2026-08-12 · Generador de "game path" per dificultat (implementat + script d'anàlisi).**
  - **Mètrica de dificultat perceptiva:** `g = |ln(edatA/edatB)|` amb `edat = ANY_REF − any` (ANY_REF=2026).
    Captura "quant fa": g petit = ítems propers en percepció = DIFÍCIL; g gran = FÀCIL. Els mateixos
    anys de diferència pesen menys com més antic (Cleòpatra) i més en època recent (Tomeu Penya).
  - **Construcció:** passeig voraç sembrat des de la llavor del dia. A cada pas es tria banda
    (gruix difícil vs respir fàcil) i un ítem dins la banda, tot amb el mateix rng → 100% determinista.
    No és corba creixent (descartada per difícil de calibrar): **dificultat plana amb respirs**.
  - **CONFIG ajustable** dins el mòdul `AbansDespres`: `gHardMax` (0.55), `gEasyMin` (0.70),
    `gEasyMax` (1.25), `pRespir` (0.22), `warmup` (2), `refYear` (2026).
  - **2026-08-13 · Respirs acotats:** abans la banda fàcil era `g >= 0.90` sense sostre → apareixien
    salts trivials (g=3..7). Ara és una **finestra `gEasyMin..gEasyMax`** (respir moderat). Resultat
    (200 dies): TRIVIAL (g>1.25) 33%→8%, mediana 0.40→0.39, mitjana 0.95→0.64. Els ~8% de trivials
    restants són inevitables a la cua d'ítems molt antics (no hi ha parella moderada disponible).
  - **Cost:** O(n²) amb n≈51 → pocs milers d'operacions, <1 ms. Es calcula UN cop en obrir el joc
    (client, a partir de la data local). Sense servidor.
  - **Script d'anàlisi:** `_analisi.js` (Playwright, usa el codi real via el hook `window.__AD`). 200 dies:
    mediana de g 1.46 → 0.39 i DIFÍCIL 21% → 66% vs. baseline aleatori. Bandes: DIFÍCIL / MIG /
    RESPIR (finestra) / TRIVIAL. Serveix per calibrar el CONFIG.
- **Desplegament (test):** joc 100% estàtic (HTML+JS+localStorage, sense backend). Cal pujar **`joc.html`
  + `data.js`** (mateixa carpeta). **GitHub Pages sí** que ho serveix (només serveix fitxers; el JS
  s'executa al navegador). Enllaç directe a un joc: `joc.html#/abansdespres`. Des de l'`index` només
  cal un botó/enllaç relatiu a `joc.html`.

## 4. Contracte de dades (`window.HB_DATA`)
- `PEOPLE[]`: `{ id, wd, name, birth, death, cats:[], gender, wiki, desc }` (anys negatius = aC)
- `EVENTS[]`: `{ id, name, year, wiki, sitelinks, desc }`
- `MARCS[]`:  `{ id, name, color, blocks:[ { name, start, end, wiki } ] }`

Nota: `sitelinks` = mètrica d'importància (per graduar dificultat). `birth/death` permeten
calcular solapaments («contemporanis»).

## 5. Backlog
- [x] Implementar la lògica del **primer joc**: «Abans o després?» (encadenat) — fet i verificat 2026-08-12.
- [x] **Convertir «Abans o després?» en *daily challenge*** (determinista per data + 1 intent/dia + ratxa de dies + compartir) — fet i verificat 2026-08-12.
- [ ] Implementar la resta de jocs (tots com a daily): següent recomanat «Ordena la línia».
- [ ] Millores «Abans o després?»: mostrar breu `desc` en revelar (context educatiu), so/feedback hàptic.
- [ ] Rànquing/estadístiques personals (distribució de resultats, ratxa màxima).
- [ ] *(Futur)* Reconsiderar un **mode lliure/infinit** per practicar, a part del daily.
- [ ] *(Amb backend)* Bloqueig dur anti-trampa + rànquings globals + fixar data des del servidor.
- [ ] Graduar **dificultat** amb `sitelinks` (fàcil = coneguts, difícil = obscurs).
- [ ] Substituir `data.js` (snapshot) pel **carregador de la DB externa** quan existeixi.
- [ ] *(Ajornat)* **Mode infinit amb Wikidata** + control de qualitat: llindar de sitelinks,
      exigir etiqueta+desc en català i dates presents, whitelist de categories, cache d'«aprovats».
- [ ] Alinear **paleta i tipografia** exactes amb l'app principal (Oswald non-blocking).

### Cartes verticals en horitzontal — «Abans o després?» (2026-08-17)
En landscape tàctil les cartes tenien *feel* horitzontal (barretes amples i baixes: `align-items:center` + padding baix). En Bernat vol un *feeling de carta* (retrat) aprofitant que hi ha espai de sobres i SENSE scroll a cap dispositiu.
- **Fix:** dins del media horitzontal-tàctil, `.game{height:100%;grid-template-rows:auto 1fr}` (la fila de cartes ocupa tota l'alçada sobrant de `main`, que ja és `flex:1` sota `body{height:100svh}`). `.cards2` passa a columnes estretes `minmax(0,220px) auto minmax(0,220px)` amb `justify-content:center` i `align-items:stretch` → dues cartes RETRAT centrades amb la insígnia VS al mig. `.itemcard` és `flex-column` amb `justify-content:center` (contingut al centre, aire a dalt/baix). `#candslot` (embolcall de la carta nova) també s'estira i passa l'alçada a la `.itemcard` de dins (`flex:1`). Tipografia una mica més gran (nom 18px, any 32px).
- Verificat amb Playwright/Chromium (executablePath del chromium de sistema) a 667×375, 740×360, 844×390 i 932×430 (hasTouch+isMobile): cartes ~191–220px amples × 238–308px altes (retrat), 0 scroll, 0 errors JS. NOTA: el binari de Playwright no està baixat al sandbox; s'usa `/usr/local/bin/chromium`.

### Pantalla de RESULTAT compacta en horitzontal — «Abans o després?» (2026-08-17)
En landscape tàctil la `.gameover` mantenia les mides grans (padding 32px, números 42px, `head` amb títol+data redundant) → alçada fixa de **371px**, no cabia i el `footer` (en flux) tapava el text → calia scroll (pitjor des que hi ha footer).
- **Fix (només dins el media horitzontal-tàctil):** reduïts padding (14px 24px), `rtitle` 18px, `stat .v` 42→30px, i marges/tipografies de `locknote`/`countdown`/CTA.
- **Capçalera:** decisió d'en Bernat (17/08) = MANTENIR la capçalera `⚖️ Abans o després? · Repte diari · data` però compacta (`gamehead h2` 15px, `.sub` 11px) — aporta la DATA del repte i hi cap de sobres. Alçada final **265px**. (Primer ho havia amagat sense preguntar; corregit segons regla 2.)
- **Centrat vertical elegant:** `main:has(.gameover){display:flex;flex-direction:column;justify-content:center;align-items:center}` — només afecta la pantalla de resultat. *Fallback* segur: si un navegador no suporta `:has()`, la regla s'ignora i la targeta queda a dalt, però ja compacta i sense scroll.
- Verificat amb Chromium a 844×390, 667×375 i 740×320 (hasTouch+isMobile, daily completat via localStorage): `overflow:false` a totes, 0 errors.

### Aire a «Ordena la línia» en horitzontal + footer més petit (2026-08-17)
En Bernat: en horitzontal la llista d'Ordena quedava «suuuper enganxada» al footer (poc aire). Filosofia acordada: **disseny elegant, una mica d'aire sempre benvingut**.
- **Nota important:** al sandbox el mode compacte SÍ s'aplicava i ja deixava ~65px de marge; a la captura del mòbil d'en Bernat les targetes es veien més grosses i enganxades → possible que la versió **desplegada a github.io fos més antiga** que el `joc.html` actual. Cal **redeployar** per veure els canvis.
- **Canvi (només media horitzontal-tàctil):** `.ordlist` passa a `align-self:center` (abans `start`) i `gap` 4→6px → aire equilibrat a dalt i a baix.
- ⚠️ **FOOTER = NO TOCAR:** en Bernat ja l'ha ajustat ell (és més petit del que es veu en captures velles). Vaig canviar-lo per error (22→18px) i s'ha **revertit** a `min-height:22px; font-size:10px`. No modificar el footer sense demanar-ho.
- Verificat amb Chromium (estat resolt) a 667×375, 740×360, 844×390, 932×430 i stress 800×340: 0 scroll, aire dalt/baix equilibrat només amb el centrat de la llista.

### CI / tests automàtics a master (2026-08-17)
En Bernat ha muntat un **entorn de CI**: en pujar a `master` es corren tests automàtics bàsics (detecció d'errors de JS, botons que falten, i similars). Si algun push peta, en Bernat **passarà el log del test** perquè el diagnostiqui i corregeixi.

### Revisió de copys «Ordena la línia» (2026-08-17) — pas a pas amb en Bernat
APLICAT i verificat amb Chromium (0 errors JS):
- **Menú — descripció:** "Posa 4–5 fets o personatges…" → **"Ordena aquests 5 fets històrics correctament."**
- **Menú — etiquetes alineades a sota:** `.tagd`/`.soon` passen a `margin-top:auto` → les etiquetes queden a la base de la targeta, en línia independentment de la llargada de la descripció (només afecta el grid multi-columna d'escriptori; en mòbil ja usaven grid-area).
- **Mentre jugues:** eliminat el subtítol de reentrada ("Repte d'avui · consulta…"); quan `locked`, `render()` no pinta cap `.sub`. El subtítol de joc fresc es manté.
- **Títols de fallada per nombre d'errors** (comptats a `applyReveal` → `wrong`, passats a `showBanner`): ≤2 = "Ai, per poc! 😅"; ==3 = "Suposo que la idea era bona però… 🤔"; ≥4 = "Osti quin desastre… 🙈". (Emojis PROVISIONALS, a confirmar per en Bernat.)
- **Eliminat codi de recuperació** (`revealNeutral`+`showRecoverNote`): era temporal de l'inici, ja no passa. `renderResolved` simplificat amb fallback de seguretat silenciós.
- **Missatge sense dades** (data.js absent o insuficient, només a Ordena): "No hi ha (prou) dades per jugar." → **"Ens hem quedat sense història! N'estem fabricant de nova. Torna demà 🛠️"**. (NO s'ha tocat el mateix text a «Abans o després?».)
- **`renderLocked`** = codi mort (mai s'invoca), no s'ha tocat.

PENDENT de decisió d'en Bernat: (a) nova icòna del joc (🕰️ no li agrada) — proposar alternatives; (b) emojis definitius dels títols de fallada; (c) **afegir botó Comparteix a Ordena** (equivalent al d'«Abans o després?») — mostrat mockup, pendent d'aprovar.

*Últim update: 2026-08-12 («Abans o després?» convertit en *daily challenge*: determinista per data, 1 intent/dia, ratxa de dies, compte enrere i compartir — implementat i verificat).*


---

## Joc nou: «Personatge del dia» (2026-08-13)

**Concepte:** joc de DESCOBRIMENT (no competitiu). Cada dia presenta una persona real, la mateixa per a tothom durant 24h (per poder-ho comentar amb amics). Objectiu: descobrir i aprendre.

**Font de dades:** dades de cada persona en VIU de Wikidata (client-side, CORS `origin=*`). No es cura el contingut: la gràcia és que surti gent poc coneguda. La bossa d'on es tria (el "pool") NO és tot Wikidata, sinó una llista pregenerada (v. Selecció).

### Selecció (decisió final: índex offline, "opció A")

Es va DESCARTAR el sondeig de QIDs random en viu (era ràpid amb filtre ampli ca/es/en però NO garantia localització i, en estrènyer a només-ca, es tornava lentíssim: ~0,16% de vàlids → ~12 lots).

En lloc d'això:
1. **Offline (generador):** `gen_personatges.py` (o `_gen_personatges.js`, són idèntics) consulta Wikidata i escriu `personatges.js` = `window.HB_PERSONATGES = [enters]`, una llista NOMÉS d'IDs (QIDs sense la "Q"), ~120-150k persones (AND ca+es+en). Sense noms ni dades.
2. **Runtime:** la llavor del dia `mulberry32(seedFromStr('pd:'+data))` tria un índex de la llista → un QID. Es baixa la seva fitxa en viu amb `wbgetentities` (props=labels|descriptions|claims|sitelinks/urls, languages=ca|es|en). Mateix personatge per a tothom, determinista.

**Filtre (s'aplica al GENERADOR, no en runtime):**
- Humà (`P31=Q5`).
- Amb data de naixement (`P569`) — necessari per pintar-lo al cronograma.
- Amb article a la Viquipèdia en CATALÀ **I** CASTELLÀ **I** ANGLÈS (AND dels tres sitelinks: cawiki + eswiki + enwiki). Assegura que la fitxa i el link funcionin en els tres idiomes de cara a la i18n; el nom i el link prioritzen el català (idioma de treball actual).

**Varietat (decisió d'en Bernat: AND(ca+es+en)):** OR(ca/es/en)≈2,3M però sense localització garantida; AND(3)≈120-150k, gent més coneguda però amb els 3 idiomes assegurats; només-ca≈180k. Es tria **AND(3)**: en Bernat prioritza tenir els tres idiomes coberts per a la i18n, assumint menys varietat i personatges més coneguts. (Al principi es va valorar només-ca, però el requisit real és AND.)

**Repetició (decisió: acceptada, es deixa com està):** amb pool ~130k (AND dels 3 idiomes) i tria diària independent, la primera repetició s'espera als ~450 dies (~1,3 anys) de joc diari; repetir algú dels últims 2 mesos ≈0,03%/dia. Estadísticament menyspreable → NO es fa baralla. IMPORTANT: descartada qualsevol llista de "ja vistos" PER USUARI, perquè trencaria que tothom vegi el mateix el mateix dia.

**Fitxa (camps):** imatge (P18 → Commons Special:FilePath), nom, descripció curta, ocupació (P106), nacionalitat (P27), anys de vida (P569–P570), enllaç a Viquipèdia.

**Accions:**
- ⭐ Afegir a favorits — stub a `localStorage` (`hb_favorits`), enllaçarà amb Favorits reals més endavant.
- 📅 Veure al cronograma — escriu `hb_view_person` (caché: qid,name,birth,death,img,desc) i navega a `index.html?person=Q<ID>`.
- 🔗 Llegeix-ne més — enllaç a la Viquipèdia.

**Àlbum:** cada personatge descobert s'afegeix a `hb_personatge_album` (dedup per qid). Es mostra el recompte «Has descobert N personatges».

**Cost computacional:** amb l'índex offline, **1 sola crida** en viu (la fitxa del QID triat); es cacheja a `hb_personatge_cache` per no re-consultar el mateix dia. Millora pendent: **precompute en background** en carregar la pàgina de jocs (fire-and-forget) perquè estigui llest en obrir el joc.

**Rendiment/seguretat:** render amb DOM APIs + `textContent` (dades de Wikidata tractades com no fiables, sense injecció HTML).

**localStorage nou:** `hb_personatge_cache` {date,person}, `hb_personatge_album` […], `hb_favorits` […], `hb_view_person` {…}.

**Menu:** afegit a GAMES amb id `personatgedia` (🎭), registrat a MODULES, badge propi «🌟 Descobreix» (via `g.discover`, diferent del «📅 Repte diari» dels reptes).

### Generadors i cicles de vida
- `_gen_data.js` → `data.js`: **PROVISIONAL**. Snapshot de les dades curades de l'`index.html` per testejar en local. Desapareix quan hi hagi la DB externa (es substituirà pel carregador real).
- `gen_personatges.py` (ús al Mac, només stdlib, sense pip) / `_gen_personatges.js` (Node 18+): **PERMANENT / manteniment**. Genera `personatges.js`. Cal regenerar-lo cada X temps (mesos/any) perquè la Viquipèdia catalana creix. Futur: automatitzar amb un GitHub Action programat. Recordatori: editar `USER_AGENT` amb un contacte real (Wikimedia ho exigeix).

### Contracte amb l'index (traspas al cronograma) — PENDENT
Documentat en detall a `REQUISITS_INDEX.md`. Resum: `index.html` ha de llegir `?person=Q<ID>`, resoldre dades (primer caché `hb_view_person`, si no re-consultar Wikidata pel QID) i pintar en «mode personatge únic». Els canvis de l'index els fa en Bernat.

### Estat actual (2026-08-13)
- ✅ Joc integrat al menú (`personatgedia`, badge «🌟 Descobreix»), fitxa, favorits (stub), àlbum, traspàs al cronograma — tot verificat amb Playwright (Wikidata simulada, sandbox sense internet).
- ✅ Runtime reconnectat a l'índex offline (mètode A): llegeix `window.HB_PERSONATGES` de `personatges.js`, tria diària sembrada, 1 fetch per fitxa, precompute en background i comentaris al mòdul. Verificat amb Playwright + un `personatges.js` de MOSTRA (3 entrades: 937, 1339, 7259).
- ⏳ PENDENT: en Bernat corre `gen_personatges.py` amb internet per generar el `personatges.js` real (~180k) i el puja al git (substituint la mostra). Per desplegar cal pujar `joc.html` + `personatges.js` (i `data.js`).

### Layout horitzontal (mobil tactil) — «Abans o despres?» (2026-08-13)
El cronograma es mes eficient en horitzontal, aixi que el joc tambe es repensa en columnes (no nomes apretat).
- **Trigger (nomes CSS, sense JS):** `@media (orientation:landscape) and (pointer:coarse) and (max-height:600px)`. Es a dir: horitzontal + tactil + alcada petita. El limit d'alcada deixa fora les TAULETES en horitzontal (tenen prou espai i es queden amb el layout normal). Decisio d'en Bernat: nomes mobils.
- **Disposicio:** titol a dalt (amb marcador a la dreta) · carta fixa a l'esquerra · carta nova al mig (VS entremig) · botons apilats a la dreta = zona del polze DRET (per a dretans, decisio d'en Bernat).
- **Ordre dels botons (dalt->baix):** Abans, Despres, Comodi (via `order`; el DOM segueix sent Abans/Comodi/Despres).
- Cartes i botons mes compactes en aquest mode; el peu (`.gamefoot`) s'amaga per guanyar alcada.
- Verificat amb Playwright (viewport 760x360, hasTouch+isMobile): grid actiu, ordre i posicions correctes, tot dins de l'alcada; en desktop 1200x800 NO s'activa.
- PENDENT (2a fase): repensar el «Personatge del dia» en horitzontal (imatge a un costat, text a l'altre). De moment es deixa el layout actual.

### Layout «Personatge del dia» — imatge sencera + sense scroll + horitzontal (2026-08-14)
Tres correccions de layout de la fitxa:
- **Imatges tallades (mobil i desktop):** `.pimg` passava de `object-fit:cover` (retallava els retrats) a **`object-fit:contain`** (mostra la imatge sencera, amb fons neutre als costats). Alcada base 320px.
- **Mobil vertical sense scroll:** alcada d'imatge `clamp(150px,32vh,250px)`, marges/xips/botons mes compactes, descripcio limitada a 2 linies. Verificat: scrollHeight == innerHeight (390x844).
- **Horitzontal tactil (des del cronograma):** mateix trigger que «Abans o despres?» `@media (orientation:landscape) and (pointer:coarse) and (max-height:600px)`. La `.pcard` passa a grid de 3 columnes: **foto esquerra | info centre | botons a la dreta** (en columna, amplada completa). Card d'alcada `calc(100dvh - 96px)` per no fer scroll. Verificat 844x390.
- Canvi de marcatge menor al render: `.pacts` (botons) ara es fill directe de `.pcard` (abans dins de `.pbody`) perque pugui ser columna propia en horitzontal. En vertical es veu igual.

### Ocupacions en femeni — «Personatge del dia» (2026-08-14)
Les targetes/xips d'ocupacio surten de Wikidata: ocupacio (P106) i nacionalitat (P27), agafant l'etiqueta en ca (fallback es/en). Problema: l'etiqueta principal de Wikidata sol ser en masculi generic, aixi que en dones sortia "matematic", "programador"... (estrany).
- **Fix:** es llegeix el genere de la persona (P21 == Q6581072 => dona) i, per a les ocupacions, s'usa la forma en femeni de l'etiqueta si Wikidata la te (P2521, "female form of label", text monolingue ca>es>en). Si no hi ha forma femenina, es manté l'etiqueta per defecte. La nacionalitat NO es genera.
- Implementacio runtime: nous helpers `monolingual()` i `isFemale()`; `labelsFor()` ara baixa `labels|claims` i retorna `{label, female}` per item; `build()` tria femeni si escau.
- Verificat amb Playwright (mock): dona => "matematica"/"compositora"; home => "matematic"/"compositor".

### Fix layout horitzontal «Personatge del dia» — es tallava per sota (2026-08-14)
En live, el layout horitzontal s'activava correctament (3 columnes) pero la targeta es tallava per sota: l'alcada fixa `calc(100dvh - 96px)` no encertava l'alcada real de la topbar del mobil, aixi que la card sortia mes alta que la pantalla i, sense scroll, no s'hi arribava.
- **Fix robust (sense numeros magics):** dins del media horitzontal-tactil, `body{display:flex;flex-direction:column}` + `main{flex:1;min-height:0}` => la barra ocupa la seva alcada natural i main omple exactament la resta. La `.pwrap` i `.pcard` passen a `height:100%`. Aixi s'ajusta sigui quina sigui l'alcada de la topbar.
- Descripcio limitada a 3 linies i xips/botons una mica mes compactes per seguretat.
- Verificat amb Playwright (contingut llarg, 3 mides: 844x390, 740x360, 667x375): card dins de pantalla, 3 botons visibles, ordre foto|info|botons, cap scroll.

### Ajust horitzontal «Personatge del dia» — foto mes petita + fix Safari (2026-08-14)
En live seguia demanant un mini-scroll: la foto omplia tota l'alcada i, sobretot a Safari/Chrome iOS, la barra d'adreces deixa menys espai del que calcula 100dvh, aixi que el body sobresortia.
- **Fix Safari:** al media horitzontal-tactil, `body{height:100svh;min-height:0}` (svh = alcada petita amb barres visibles) => mai sobresurt de la pantalla visible.
- **Foto mes petita:** columna de la imatge mes estreta (minmax(120px,24%)) i `.pimg{height:90%;align-self:center}` (marge de seguretat, centrada). Verificat Chromium: imatge ~81-83% de la targeta, cap scroll a 844x390 / 667x375 / 740x320.
- NOTA: Safari no es pot provar al sandbox (nomes Chromium); svh es l'arreglo estandard per al dvh d'iOS. Cal confirmacio en dispositiu real.

## Joc 3: «Ordena la línia» (2026-08-14)
Nou mòdul `OrdenaLinia` a joc.html, registrat a MODULES amb id `ordena`.

**Disseny (confirmat amb Bernat):**
- **Repte diari**: mateixos 5 elements per a tothom (deterministes per la llavor del dia `ord:<data>`), 1 sol intent al dia. L'ORDRE INICIAL dels 5 sí que és 100% aleatori (Math.random, es regenera cada càrrega fins que envies).
- **Selecció de 5** amb la mateixa mètrica que «Abans o després?» (g=|ln(edatA/edatB)|, refYear 2026): 1 àncora + 2 difícils propers (g<=0.55) + 1 mig (g in [0.70,1.10]) + 1 fàcil lluny (g>=1.20). Anys sempre distints. Mateix pool que AD (esdeveniments + persones amb naixement O mort segons la llavor; sense marcs).
- **Targeta**: nom + matís 🎂 naixement / 🕯️ mort / 📜 esdeveniment. Any ocult (?) fins enviar.
- **Drag & drop** vertical amb Pointer Events (ratolí + tàctil): "ghost" fix segueix el dit, la fila original queda buida i es reinsereix entre germans pel punter. touch-action:none a `.orditem`. Ordre = ordre del DOM (`syncOrder`).
- **Botó**: "Ho tinc!".
- **Revelació**: tot bé => tots verds + festa (okpulse) + títol "Ben ordenat! 🎉". Error => es revelen els anys i NOMÉS es marquen en vermell (.no) els mal col·locats (posició actual != posició correcta); els ben col·locats queden neutres (.rev). Sense puntuació, és SÍ/NO.
- **Ratxa** `hb_ord_streak`={last,days}: dies consecutius ENCERTANT; fallar => days=0. Estat diari `hb_ord_daily`={date,correct}; en remuntar un dia ja jugat => pantalla de bloqueig (gameover) amb ratxa + compte enrere fins mitjanit.
- **Horitzontal tàctil** (mateix trigger que AD/Personatge): llista compacta perquè els 5 càpiguen sense scroll (sub amagat, files padding 4px, fonts reduïdes). Verificat Chromium a 844x390 / 740x360 / 667x375: 5 files, cap scroll, botó visible.

**localStorage nou:** `hb_ord_daily`, `hb_ord_streak`.

**Verificat (Playwright/Chromium, tool _ptest.js):** estructura 5 distints amb forma de dificultat (grup proper + un de lluny); drag reordena el DOM; submit correcte => verd+festa+ratxa=1; submit erroni (invers) => 4 vermells, 0 verds, ratxa=0; bloqueig diari mostra gameover; horitzontal sense scroll a 3 mides. NOTA: drag verificat amb ratolí (Pointer Events unificats); el tàctil real caldrà confirmar-lo al mòbil. Safari no es pot provar al sandbox.

## Ajust meta «Ordena la línia» (2026-08-14)
Els esdeveniments ja NO mostren cap etiqueta (abans "📜 esdeveniment"); només les persones porten 🎂 naixement / 🕯️ mort. La fila d'esdeveniment omet del tot el div `.ometa`. Verificat Chromium.

## Menu compacte (mobil) + consulta del resultat a «Ordena la línia» (2026-08-14)
**Menu de jocs (mobil, <=600px):** targetes horitzontals i lleugeres (grid: icôna esquerra centrada, títol+descripció+badge apilats a la dreta), padding 12/14, gap 10, icôna 26px, títol 15px, desc 12px. Verificat Chromium 390x844: les 5 targetes hi caben SENSE scroll.
**«Ordena la línia» reentrada:** en enviar es desa també l'ordre jugat (`hb_ord_daily`={date,correct,order:[keys]}). En tornar a entrar el mateix dia ja NO es mostra només el resum: es reconstrueixen els 5 elements en l'ordre que va posar el jugador, amb els anys revelats i el resultat marcat (tot verd si encert, només vermells els mal col·locats si error) + banner/ratxa/compte enrere a sota. Bloquejat (no es pot tornar a arrossegar ni reenviar). Refactor: `applyReveal(animate)` (reutilitzat per submit i reentrada; sense flip en reentrar) + `renderResolved(daily)`. `renderLocked` antic queda com a codi mort. Fallback per partides antigues sense `order` desat: ordre cronològic. Verificat Chromium: reentrada erroni (4 vermells, banner "No del tot") i correcte (5 verds, banner "Ben ordenat", ratxa 1).

## Reentrada de partides ANTIGUES (sense ordre desat) a «Ordena la línia» (2026-08-14)
Les partides jugades ABANS d'afegir el desat d'ordre (`hb_ord_daily` només {date,correct}) no es poden reconstruir amb el teu ordre real. En aquest cas NO es pinten verd/vermell (seria enganyós): es mostren els 5 en ordre cronològic amb els anys revelats (neutres) + nota "D'aquesta partida no vam desar el teu ordre..." + títol segons `correct` desat (Vas encertar/No vas encertar) + ratxa + compte enrere. Funcions noves: `revealNeutral()` i `showRecoverNote(correct)`. A partir d'ara (nous enviaments) es desa `order` i es marca tot correctament. La ratxa (`hb_ord_streak`) sempre s'ha desat, no es perd. Verificat Chromium.

## Ajustos menu + horitzontal (2026-08-14)
- **Subtítol del menú eliminat del tot** (`<p class="lead">Cada joc és un repte diari…</p>` fora, a tots els dispositius). Això elimina el mini-scroll del menú vertical al mòbil (390×844: docH==innerH).
- **Menú horitzontal (landscape coarse):** nou bloc `@media (orientation:landscape) and (pointer:coarse) and (max-height:600px)` amb `.menu{grid-template-columns:repeat(auto-fill,minmax(138px,1fr));gap:8px}` i `.gamecard` compacta (padding 10/11, ic 22px, t 13.5, d 11 clamp 2, badge 10px). Ara els 5 caben en 1 fila sense scroll (844×390).
- **FIX amplada `main` en horitzontal:** amb `body{display:flex;flex-direction:column}`, el `main{margin:0 auto}` NO s'estirava (quedava ~446px → només 2 targetes/fila). Afegit `margin:0;max-width:none;width:100%` al `main` dins del bloc landscape coarse. Ara main ocupa tot l'ample (844). Re-verificat que «Personatge del dia» horitzontal segueix sense scroll a 740×360, 844×390, 667×375.
- **«Ordena la línia» horitzontal:** mateixa lògica que «Abans o després?». `.ordwrap` passa a grid `1fr minmax(140px,190px)` amb àrees `head/head`, `bar/foot`, `list/foot`: la pila (llista) a l'esquerra, el botó «Ho tinc!» a la dreta centrat verticalment. En enviar, el banner de resultat surt també a la dreta (mateix `.ordfoot`). Verificat: listCx<btnCx abans, bannerCx>listCx després, sense scroll.
- **Botó casa renombrat:** «Inici» → «Tots els jocs» (botó `#back` que torna al menú de jocs).

## Nova base joc.html de l'usuari (2026-08-17)
Bernat ha generat la llista SENCERA de personatges (personatges.js real, al seu costat/GitHub) i ha adjuntat una nova versió de joc.html. Adoptada com a BASE de treball (substitueix la meva última). Diff vs la meva última = només estètic:
- **body** ara `display:flex;flex-direction:column` + **main** `flex:1 0 auto;width:100%;box-sizing:border-box` → empeny el footer al peu.
- **Footer nou** `.footer` (barra fosca #1E1E1D al peu): «© 2026 HISTÒRIA BASica» + «Dades de Wikidata · CC0» amb enllaços. Ha de ser IDÈNTIC al d'index.html. Versió mòbil compacta al bloc max-width:600.
- **Topbar** amb gra de paper (SVG feTurbulence inline, ha de ser idèntic a index.html).
- Separador secnav mogut de `.secnav::after` a `.modeswitch::after` (`.secnav.sep .modeswitch::after`).
- Marca i footer diuen «HISTÒRIA BASica» (abans «HISTÒRIA BÀSICA»): wordmark amb «BAS» (cognom d'en Bernat), sense l'accent de «Bàsica». **CONFIRMAT (2026-08-17): és volgut, és el nom comercial i es queda.** No corregir l'accent.
- JS secnav: `if(search&&!plega)`, debounce 180→300, resize dins rAF, listener `screen.orientation.change` (+350ms) i `pageshow` (bfcache) per recalcular la barreta.
Verificat (Chromium): footer a totes les seccions, jocs horitzontals sense scroll (footerTop 368/390), menú vertical i horitzontal OK, 0 errors JS. NOTA: al sandbox segueixo amb el personatges.js STARTER (la llista sencera només la té l'usuari).


---

## Registre 17/08/2026 — Revamp «Ordena la línia» (reposat) + incident sandbox

### Incident sandbox (IMPORTANT)
- El sandbox es va **reiniciar i esborrar tots els fitxers** del projecte entre torns; a més va quedar en estat inconsistent (edicions aplicades que després desapareixien).
- Recuperat via re-pujada de `joc.html` + `ESTRATEGIA_JOC.md` per part de l'usuari. `data.js` real i `personatges.js` NO estan al sandbox (els té l'usuari en local).
- **Regla nova:** fer `cp joc.html joc.backup.html` després de cada tram verificat. Hi ha un `/data/data.js` que és un **FIXTURE DE PROVA** (no el real) només per poder testar amb Chromium.

### Canvis aplicats i verificats (Chromium) a «Ordena la línia»
- **Icona** del catàleg i capçalera: 🕰️ → **↕️** (PROVISIONAL, pendent de validació visual de l'usuari).
- **Descripció** al catàleg: "Ordena aquests 5 fets històrics correctament."
- **Subtítol** només mentre es juga (desapareix un cop resolt).
- **Títols de fallada** segons nombre de mal col·locats: ≤2 "Ai, per poc! 😅"; ===3 "Suposo que la idea era bona però… 🙄" (eye roll); ≥4 "Osti quin desastre… 🙈". Encert: "Ben ordenat! 🎉".
- **Botó «📤 Comparteix»** injectat via DOM dins de `.ordbanner` (evita problemes d'escapat). Handler `ordDoShare` → `navigator.share` amb fallback a clipboard ("Copiat! ✅").
- **Text a compartir (estil Wordle)**: `↕️ Història BASica · Ordena la línia — {dd/mm}` + línia de quadrets 🟩/🟥 (per posició) + `🔥 {N} dies seguits` + **link dinàmic** (`location.origin+location.pathname`; en sandbox surt `file:///…`, en producció serà la URL de /joc). Salt de línia amb `String.fromCharCode(10)`.
- `applyReveal` ara retorna `{allCorrect, wrong, marks[]}`; `submit` i `renderResolved` passen `marks` a `showBanner`.

### Resultats verificació scroll (pantalla de resultats)
- **Landscape**: 0 scroll a totes les mides provades. ✅
- **Portrait normal** (iPhone 12 390×844 i superiors): 0 scroll. ✅
- **Portrait petit**: iPhone SE 375×667 → **109px de scroll vertical**; 360×640 encara més. Sense el botó ja hi havia ~62px de base (el bàner de resultats és més alt que la pantalla de joc); el botó hi suma la resta.
- **PENDENT DECISIÓ USUARI** (regla "si no hi cap ho comentem, no xapuses"): (A) acceptar scroll petit només a la pantalla de resultats en mòbils petits en vertical; o (B) condensar el bàner de resultats en pantalles baixes (p. ex. fusionar/treure alguna línia) perquè hi càpiga tot sense scroll.

### Pendents
- Confirmar icona ↕️ definitiva.
- Decidir tractament del scroll a SE portrait.
- Re-desplegar a bernatbas.github.io (joc.html + data.js + personatges.js) quan estigui validat.

### Actualització scroll — RESOLT (opció lletra més petita)
- Decisió de l'usuari: en comptes de treure elements, **reduir mida de lletra i marges** en pantalles baixes (hi ha espai horitzontal de sobres).
- Afegit `@media (orientation:portrait) and (max-height:770px)` a «Ordena la línia»: redueix `.ordhead h2`, `.onm` (noms) a 13px, `.ometa`, `.oyr`, padding de `.orditem` (6px 12px), gap de la llista, i tot el bàner de resultats (`.rtitle`,`.streak`,`.locknote`,`.countdown`) + `.btnrow .cta`.
- **Verificat Chromium**: Vscroll=0 i Hscroll=0 a 375×667, 360×640, 390×844 (vertical) i landscape; botó present, 0 errors JS. Problema del scroll TANCAT.

### Bug landscape «Ordena la línia» (test real usuari) — RESOLT
- **Símptoma** (mòbil real, obert en vertical i girat a horitzontal): la 5a targeta i el footer quedaven tallats/trepitjats en la pantalla de resultats en landscape.
- **Causa**: la graella de landscape d'Ordena tenia la fila de la llista com a `1fr` i `.ordlist{align-self:center}` sense overflow. Amb l'alçada real reduïda per la barra de Safari (~50-80px menys que el viewport teòric), la llista es desbordava per sota i trepitjava el footer. En headless (sense barra) hi cabia just just i no es reproduïa.
- **Fix**: a la media query landscape d'Ordena, `grid-template-rows` de la llista passa a `minmax(0,1fr)` i `.ordlist{align-self:stretch;overflow-y:auto;-webkit-overflow-scrolling:touch;}`. Així la llista mai desborda: si l'espai és molt just fa un petit scroll intern (només la llista), i el footer + botó Comparteix queden sempre visibles.
- **Verificat Chromium** amb alçades landscape retallades simulant la barra (300/320/360px) i plenes: pageVscroll=0, overlap=ok, footerVisible=true, botoVisible=true a tots els casos; scroll intern de llista només 25-45px en els casos més extrems. 0 errors JS.
- **Llçó**: els tests headless no reprodueixen la barra del navegador mòbil; cal simular alçades landscape retallades (~300-360px) per validar el pitjor cas.

### Scroll infinit en mòbil (Chrome real) + model header/footer — RESOLT
- **Símptoma** (mòbil real, Chrome): en algunes vistes es podia fer scroll molt més del necessari, amb un gran espai buit sota el footer. No es reproduïa en headless.
- **Causa**: el `body` feia `min-height:100dvh` i era la PÀGINA SENCERA la que scrollejava (patró sticky-footer). Amb la barra dinàmica del navegador mòbil (que s'amaga/mostra i fa variar `dvh`), això genera scroll extra. El headless no té barra dinàmica, per això no sortia.
- **Fix (model fix definitiu)**: `body{height:100dvh;overflow:hidden}` (mai scrolleja la pàgina) + `main{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}`. Així el header queda fix a dalt, el footer fix a baix, i NOMÉS el contingut central (main) scrolleja si cal. Elimina tota la classe de bugs de scroll de pàgina a qualsevol navegador i orientació.
- **Validat Chromium** (bateria _valida.js): menú + 3 jocs × portrait (852/844/640/667) i landscape (300/330/360/430) = 32 casos: pageScroll=0, headTop=0, footer sempre visible al fons, 0 errors. El main scrolleja intern només quan cal (menú en pantalla molt baixa).
- **Llçó**: per a apps d'una pantalla en mòbil, usar `height:100dvh + overflow:hidden` al body i deixar scrollar un contenidor intern, en comptes de `min-height:100dvh` amb scroll de pàgina.

### Icona d'Ordena
- Revertida de ↕️ (fletxa, provisional) a 🕰️ (rellotge) a petició de l'usuari. Afecta catàleg, títol del joc, i prefix del text de compartir.

### Missatge d'error de dades — unificat (decisió usuari)
- **Decisió**: usar SEMPRE el missatge divertit "Ens hem quedat sense història! N'estem fabricant de nova. Torna demà 🛠️" a tot arreu (menú i dins de cada joc), en comptes del missatge tècnic de data.js.
- **Motiu**: si mai falla, l'usuari no s'espanta i el dev ja sap que només pot venir d'un lloc (data.js). A més, tècnicament el joc quasi mai s'obrirà sense data (petaria abans el propi joc.html) → super corner case, però està bé que cada joc capturi l'error igualment.
- **Aclariment `pickFive` (per què `!five`)**: el pool diari = tots els EVENTS + un ítem per persona (naix/mort segons llavor). Retorna null només si hi ha <5 ítems amb any numèric o <5 anys DIFERENTS (cada ítem necessita any distint). El pool es reconstrueix sencer cada dia (determinista per llavor, sense marcar ítems com a gastats) → el contingut NO s'esgota mai amb el temps; qualsevol fallada és de dades. Per això té sentit un missatge únic.
- **Canvi aplicat**: `renderMenu` (línia ~1134) passa del missatge tècnic al divertit. Ordena ja el feia servir (buildAndRender/renderResolved).
- **Validat Chromium** (data.js bloquejat amb route abort): menú i #/ordena mostren el mateix text, 0 errors JS.

## Registre: Fallback d'imatge + invitació a contribuir (Personatge del dia)
- **imgUrl (P18) → imgSource**: `build()` ara marca l'origen de la imatge: `'wikidata'` (P18), `'wikipedia'` (fallback) o `null` (cap).
- **Fallback Viquipèdia**: nova funció `wikiImage(lang,title)` → API REST de resum (`/api/rest_v1/page/summary/{títol}`), agafa `thumbnail.source` o `originalimage.source`. Només s'invoca quan NO hi ha P18. Idioma/títol des dels sitelinks ja descarregats (ca→es→en). Afegeix latència només en aquest cas.
- **3 escenaris**: (1) P18 → foto, sense invitació; (2) sense P18 però foto a Viquipèdia → foto + invitació a **enllaçar-la a Wikidata** (link a l'ítem QID); (3) sense foto enlloc → placeholder 👤 + invitació a **pujar-ne una a Commons** (UploadWizard).
- **Cas B unificat amb A**: si `onerror` de la <img>, es reemplaça per placeholder 👤 (abans quedava buit amb display:none). Es distingeix internament: B té imgSource='wikidata' → NO mostra invitació (error transitori).
- **CSS**: `.pinvite` (base + variants mòbil vertical i landscape).
- **Validat (xarxa MOCKED, sandbox sense internet)** amb `_pdtest.js`: S1/S2/S3/B en vertical 393×852 + S2/S3 landscape 844×390 = TOT OK (imatge/placeholder/invitació correctes, footer visible, pageScroll=0, 0 errors JS).
- Nota: si es recupera imatge de Viquipèdia, es guarda a la caché i l'àlbum (queda `img` omplert). El P18 continua sent la font preferent.

## Registre: fix emoji àlbum + Ordena resolt horitzontal (bugs mòbil/Windows)
- **Bug Windows (emoji àlbum trencat):** la línia `.palbum` tenia bytes UTF-8 INVÀLIDS (l'emoji 🗂 seguit de bytes corruptes → es veia `🗂<U+FFFD><U+FFFD>`). Corregit a nivell de byte substituint-lo per `📇` (F0 9F 93 87), verificant que el fitxer segueix sent UTF-8 vàlid.
- **Bug mòbil (Ordena resolt horitzontal, tallat sense scroll):** en horitzontal tàctil (`max-height:600px`), l'estat resolt fixava `.ordwrap{height:100%}` i delegava el scroll a `.ordlist` (contenidor imbricat dins el grid). iOS Safari sovint NO deixa scrollar un contenidor imbricat dins un grid; com que `body{overflow:hidden}`, l'últim ítem quedava tallat sense poder fer scroll. Només es reproduïa a alçades reals ≤300px (barra del Safari visible); en headless a 390px cap tot.
- **Fix:** en estat resolt s'afegeix la classe `.resolved` a `.ordwrap` (a `renderResolved`) i en el media query horitzontal: `.ordwrap.resolved{height:auto}` + `.ordwrap.resolved .ordlist{overflow:visible}`. Així el scroll el fa el `main` (contenidor exterior), que iOS gestiona sempre bé. L'estat jugable (playable) queda intacte.
- **Validació headless:** 844×390/340/320/300, 812×330, 667×300 → últim ítem visible després de scroll, botó Comparteix accessible, main scrollable quan cal, 0 errors.

## Registre: pop-up d'invitacio a contribuir (Personatge del dia)
- **Substitueix la invitacio inline** `.pinvite` (eliminada) per un **modal overlay** afegit al `body` (`#pinvov` > `.pinvmodal`), de manera que NO afecta el layout de la fitxa (nomes cal validar el modal, no re-validar totes les resolucions de la fitxa).
- **Punt 1 (timing):** el temporitzador de 1,5s arrenca a `renderPerson`, quan `imgSource` ja esta resolt. Si `imgSource` es desconegut o `'wikidata'` (te P18 / cas B) => MAI es mostra.
- **Punts 2:** nomes escenaris 2 (`imgSource='wikipedia'` => CTA enllacar a Wikidata) i 3 (`imgSource=null` => CTA pujar a Commons).
- **Punt 3 (clau per DATA):** `POPUP_KEY='hb_personatge_popup'` guarda `{date: todayStr()}`. Si ja s'ha mostrat/tancat AVUI, no reapareix; en canviar de dia es reactiva. (Per data, no per QID, perque l'estat de la imatge pot canviar amb el temps.)
- **Punt 4:** tancar amb ✕, clic al fons, Esc O clic al CTA => `markPopupSeen()` (compta com a vist del dia).
- **Punt 5:** enllac de suport al final del modal (`.pinvhelp`): Wikidata Help:Statements (escenari 2) / Commons First_steps Uploading_files (escenari 3). *Pendent verificar URLs live (sandbox sense internet).*
- **Punt 6:** nomes al joc Personatge del dia (dins joc.html), no a index.html.
- **Neteja:** `unmount()` cancel¡la el timer i tanca el popup obert; treu el listener de teclat.
- **Validacio headless (8 escenaris, 0 errors):** A wikipedia (apareix a 1.5s, mai abans, contingut+CTA Wikidata+help; ✕ tanca i marca), A2 revisita mateix dia (NO apareix), B null (CTA Commons+help), C wikidata (MAI apareix), D Esc, E clic fons, F clic CTA (tots tanquen i marquen), G horitzontal 844x390 (modal dins viewport, pageScroll=0).

## Opció A — P18 única font de retrat (17/08/2026)
- **Decisió de disseny:** la imatge principal de l'article de la Viquipèdia NO és fiable com a retrat (en artistes sol ser una obra seva, no un retrat d'ells). Eliminat el fallback `wikiImage()` i l'escenari 2 (Viquipèdia). Ara `build()` només usa **P18 de Wikidata**: `img=imgUrl(e)`, `imgSource = img ? 'wikidata' : null`.
- **Pop-up d'invitació:** ara només surt quan `imgSource===null` (sense P18). Missatge únic "Falta un retrat" 🖼️ amb tracte segons **P21** (`genderCode`): 'f'→"aquesta mossa", 'm'→"aquest nano", desconegut/altre→"aquesta persona" (neutre). Text: "Si tens una imatge d'{qui}, et convido a pujar-la. Entre tots farem del món un lloc millor 🌍". CTA → Commons Special:UploadWizard. Enllaç ajuda → Commons First_steps/Uploading_files. Cas B (té P18 però la imatge peta) segueix sense pop-up.
- **UI:** botó "Ara no" (`.pinvno`) ara té hover consistent amb el terracota (bg `--surface`, border `--border`, `translateY(-1px)`).
- **Validat (Chromium):** gènere f/m/desconegut OK, amb P18 mai apareix, ✕/Esc/backdrop tanquen+marquen vist (clau per data `{"date":"YYYY-MM-DD"}`), no reapareix, landscape 844×390 modal dins viewport. 0 errors.
- **PENDENT LIVE:** verificar URLs d'ajuda (existència/idioma /ca) i comportament al mòbil real.

---

## Registre 17/08/2026 (tarda-2) — Pendents d'Ordena tancats

- **Icona:** confirmada **🕰️** (rellotge) definitiva al catàleg i capcçalera. El `↕️` provisional queda descartat.
- **Scroll a mòbils petits (pantalla de resultats):** condensat el bàner. Al media `@media (orientation:portrait) and (max-height:770px)` s'amaga la línia redundant `.ordbanner .locknote` ("Ja has resolt el repte d'avui...") perquè el compte enrere ("Nou repte en HH:MM:SS") ja ho comunica. A pantalles normals (>770px) la nota segueix visible.
- **Validat (Chromium):** scroll 0 a 375×667 (iPhone SE) i 360×640, tant en ENCERT com en ERROR; nota amagada en baixes i visible a 390×844; botó Comparteix present; 0 errors JS.

---

## Registre 17/08/2026 (tarda-3) — Corrupció propagada + REGRESSIÓ per revert del sandbox

### ⚠️ Incident greu: el sandbox ha revertit a un estat antic
Els fitxers de treball del sandbox NO són fiables entre torns: ha tornat a aparèixer un snapshot vell (amb els shots antics) que havia perdut fixos ja tancats. La font de veritat és la ÚLTIMA descàrrega local del Bernat. Cal SEMPRE re-descarregar després de cada tanda i substituir la còpia local sencera.

### Bug: caràcters trencats (U+FFFD) propagats
La corrupció UTF-8 anterior s'havia "consolidat" com a caràcter de reemplaçament «U+FFFD (<U+FFFD>)» (que és UTF-8 vàlid, per això no el detecta un escaneig de bytes invàlids; cal buscar \uFFFD). Trobats i corregits al fitxer:
1. **Capcçalera «Abans o després?»** — la é de "després" → restaurada.
2. **Emoji del COMODÍ** (`.jk`) → restaurat a 🃏 (joker). PENDENT confirmar si es prefereix un altre.
3. **Placeholder sense imatge** (`.pimg.ph`, branca else) → 👤 (havia regressat).

### Regressió del copy del pop-up (recuperada)
El revert havia tornat el pop-up a "Falta un retrat" sense "a la wikipedia:". Restaurat: títol **"Falta la foto"** i text **"Si tens una imatge d'{qui}, et convido a pujar-la a la wikipedia: entre tots farem del món un lloc millor 🌍"**.

### Validat (Chromium)
placeholder 👤; pop-up títol/text correctes (gen. m/f/neutre); capcçalera amb é; COMODÍ 🃏; **0 caràcters U+FFFD a tot el fitxer**; 0 errors JS.

### 🔍 Aprenentatge / TODO preventiu
- Afegir a la validació estàndard un check: `grep`/scan de `\uFFFD` a joc.html abans de cada descàrrega (0 obligatori).
- Sospita d'origen: cicles de lectura/escriptura o pujada/baixada que reinterpreten bytes. Mantenir SEMPRE utf-8 explícit (errors='surrogateescape' en manipulacions byte-level).

---

## Registre 17/08/2026 (tarda-4) — Scroll fantasma al DESKTOP

- **Problema:** a desktop/laptop, les pantalles de resultats quedaven justes de milímetres i apareixia la barra de scroll («Abans o després?» quedava exactament al límit a 1366×768: 663=663, zero marge; Ordena resolt sobreeixia ~25px).
- **Fix 1 (global):** `main` padding `24px 18px 64px` → `20px 18px 28px` (el `padding-bottom:64px` era excessiu per a pantalles fixes). Això dona aire a totes les vistes sense afectar el mòbil (té els seus propis media a ≤600px) ni el cronograma.
- **Fix 2 (Ordena, més alt):** `.ordfoot` margin-top `20→14`, i nou media `@media (min-width:861px) and (max-height:820px)` que compacta Ordena resolt (padding targetes, gaps, amaga `.locknote`) per a finestres de desktop baixes (barra de pestanyes+marcadors).
- **Validat (Chromium):** overflow **0** — AD a 900/768/720/700/680; Ordena a 900/768/720/700/680; mòbil SE (375×667) Ordena resolt segueix a 0. 0 errors JS. 0 U+FFFD.
