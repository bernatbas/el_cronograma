# El dashboard — `_tools/`

Eina **local** per mantenir la base de dades i els calendaris dels jocs sense editar fitxers a
mà. No es publica mai: el desplegament esborra `_tools/` sencer abans de pujar el web.

```bash
python3 _tools/dash.py        # → http://127.0.0.1:7777
```

Només la biblioteca estàndard de Python. Ni dependències, ni entorn virtual, ni build.

| Fitxer | Què és |
|---|---|
| `dash.py` | El servidor: llegeix i escriu els fitxers del repo, parla amb Wikidata i fa `git commit` |
| `dashboard.html` | Tota la interfície en un fitxer, com la resta del projecte |
| `DASHBOARD.md` | Això |

## Què toca, i només què toca

Cada acció **committeja el seu fitxer i prou** (`git commit -- <fitxer>`). És a propòsit: si
tens alguna altra cosa a mig editar, un commit ampli se l'enduria pel mig.

| Acció | Escriu a |
|---|---|
| Afegir una persona | `db.js` |
| Actualitzar les descripcions des de Wikidata | `db.js` |
| Clavar un dia del «Personatge del dia» (`PD_PINNED`) | `joc.html` |
| Clavar un dia del «Contemporanis» (`CON_PINNED`) | `joc.html` |
| Afegir, tancar, anotar o esborrar una entrada del backlog | `BACKLOG.md` |

⚠️ **La BD és `db.js`** (constant `DB_FILE`). Fins al 14 de novembre de 2026 vivia dins de
l'`index.html` i es copiava a `data.js`; `gen_data_js()` i `/api/db/regen` ja no existeixen.
Les línies que dona la diagnosi són línies de **`db.js`**.

## Les tres proteccions

Totes tres hi són perquè això escriu al repo i fa commits.

1. **Mateix origen.** `_same_origin()` rebutja qualsevol POST que no vingui de
   `127.0.0.1:7777` o `localhost:7777`. Sense això, qualsevol pàgina oberta al navegador
   podria fer-li fer coses mentre el tens engegat. Si no hi ha ni `Origin` ni `Referer`, es
   deixa passar: no ve d'un navegador (curl, un script).
2. **Només des de `main`.** Els POST que escriuen (`POST_QUE_ESCRIUEN`) es rebutgen amb un 409
   si no ets a la branca `BRANCA_BD`. El selector de branca de la interfície ho ensenya i
   bloqueja els botons. La BD i els calendaris no s'editen des d'una branca de feina.
3. **Els errors arriben a la pantalla.** `do_POST` embolcalla el despatxador i torna
   `{ok:false, msg:"El servidor ha petat: <Error>: <missatge>"}`. El traceback segueix anant al
   log, però el que importa és que el missatge es vegi: el dia que `_wd_year()` tornava tres
   valors en comptes de quatre, el dashboard només deia «error del servidor» i semblava que
   Wikidata hagués caigut.

`/api/push` i `/api/shutdown` no són a la llista: empènyer la branca on ets és legítim, i
aturar el servidor no escriu res.

## Afegir una persona

Dos passos: **resoldre** i **afegir**.

`resolve_person(q)` accepta un enllaç de la Viquipèdia, un QID o un nom. Amb un nom, resol pel
**títol de l'article**, que és exacte — cercar per nom a Wikidata dona sorpreses (veure el
`CLAUDE.md`). Torna els camps per al formulari **i una llista d'avisos**.

Dues coses les calcula el servidor i no el formulari, a posta:

- **La categoria**, del `P106` (ocupació) de Wikidata via `CAT_BY_P106`.
  ⚠️ Hi ha **dos categoritzadors** al projecte i no es parlen: aquest, i `guessCats()` de
  l'`index.html`, que mira la **descripció** quan cerques algú des del cronograma. Una
  categoria nova vol **cinc llocs** — veure el `CLAUDE.md`.
- **El camp `approx`** (data aproximada / disputada), dels mateixos fets que ja alimenten els
  avisos. Es genera sol perquè si depengués de recordar-se'n quedaria a mitges, i el guard dels
  jocs cronològics (`APX_GAP`) seria fals.

`db_add_person()` torna a validar-ho tot pel seu compte (QID, id, anys, categories) i, després
d'escriure, comprova que l'array segueixi quadrant. No es refia del cos de la petició.

### Actualitzar les descripcions

Les descripcions de `PEOPLE` **venen totes de Wikidata** (en català), netejades amb les mateixes
normes que en afegir algú: `_clean_desc()` (fora el parèntesi final amb anys, majúscula inicial) i
`_js_str()` (apòstrof tipogràfic). Decisió del 16/11/2026: una sola font, més fàcil de mantenir i de
traduir, tot i ser més curtes que les que hi havia escrites a mà.

`db.js` en guarda una **còpia**: si Wikidata canvia, la nostra no canvia sola. Per posar-les al dia hi
ha el botó **«Actualitza les descripcions»** a la capçalera de l'editor (`/api/db/sync-desc`,
`db_sync_descs()`): les torna a demanar totes, canvia només les diferents, desa la data a
`DESC_SYNC` (a `db.js`, just abans de `PEOPLE`) i committeja `db.js` tot sol. Si no hi ha res a
canviar i la data ja és la d'avui, no escriu ni committeja.

⚠️ Les que **Wikidata no té en català** es queden com estan i el botó les llista. La solució de fons és
escriure-les a Wikidata mateix.

## Els calendaris dels jocs

Dues pestanyes, un calendari cada una, i **el mateix patró**: clica un dia, cerca qui vols,
clava'l. Els dies passats no es toquen ni es poden desclavar.

| | Personatge del dia | Contemporanis |
|---|---|---|
| Bloc al `joc.html` | `PD_PINNED` | `CON_PINNED` |
| El valor és | un QID | un objecte `{qid,name,by,dy}` |
| D'on surt la gent | Wikidata | la nostra BD |

La diferència ve del joc, no del dashboard: «Contemporanis» arrenca de manera síncrona i no
parla amb Wikidata, així que el pin s'ha de portar els anys a sobre. El detall, a
`ESTRATEGIA_JOC.md`.

⚠️ `CON_PINNED` desa **text** dins de cometes simples, i per això `name` i `desc` passen per
`_js_str()`. El `PD_PINNED` només guarda un QID i mai va tenir aquest problema: una «Joana
d'Arc» amb apòstrof recte deixaria el joc en blanc.

⚠️ Al Contemporanis es rebutja qui no tingui any de naixement, perquè el joc no en pot
preguntar res. Es talla al navegador i **també** al servidor, perquè la comprovació no depengui
del formulari.

### Aniversaris rodons

Llista qui de la BD fa un múltiple de **25 anys** (`ANNIV_ROUND`) de naixement o de mort durant
els propers **365 dies** (`ANNIV_WINDOW`). Clicar-ne un obre aquell dia amb la persona ja
carregada.

⚠️ **Són suggeriments, no res més.** `anniv_state()` no escriu enlloc, i clicar un aniversari
només deixa la feina feta: res queda clavat fins que prems el botó. Si aquell dia ja té algú
clavat, el suggeriment **no el trepitja**.

## Mode demo

Si el servidor no respon, la interfície es pinta igual amb les dades de `DEMO` i un avís a
dalt. Serveix per poder obrir `dashboard.html` sol i veure com queda sense arrencar res.

⚠️ Si afegeixes una secció nova que llegeixi una ruta nova, posa-li la seva clau a `DEMO` o el
mode demo petarà.

## Paranys

- **`[hidden]{display:none!important}`.** L'atribut `hidden` és una regla de baixa
  especificitat i qualsevol `display:` d'una classe li passa per davant. Va passar aquí i a
  l'`index.html`: caixes que no s'amagaven mai. Ja hi és als dos fitxers; si en comences un de
  nou, posa-l'hi de sortida.
- **El calendari sempre al dia 1.** `calCursor.setDate(1)`: amb el dia real, `setMonth()`
  desborda als mesos curts i des del 31 d'agost «mes següent» se salta el setembre. Va passar
  de debò, amb un homenatge clavat un mes més tard.
- **Hi ha dos calendaris i són codi duplicat** (~120 línies). No s'han unificat a posta: quan
  es va fer el segon, refactoritzar el primer —que ja es feia servir cada dia— dins del mateix
  canvi hauria estat escalar sense validar. **Quan n'hi hagi un tercer, toca extreure'n un
  component compartit.** Mentrestant: si toques el calendari d'un, mira l'altre.
- **El CI no toca `dash.py`.** Cap test ni cap check hi entra, així que un error aquí no
  l'atrapa ningú fins que el fas servir. És el que va deixar passar mesos el `_wd_year()` que
  petava amb qualsevol persona viva.
