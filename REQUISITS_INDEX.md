# Requisits per a l'`index.html` — integració amb «Personatge del dia»

_Document de context i especificació tècnica. Data: 2026-08-13._

## 1. Context

El joc **«Personatge del dia»** (a `joc.html`) mostra cada dia una persona real agafada de Wikidata. Una de les accions de la fitxa és **«Veure al cronograma»**: ha d'obrir l'`index.html` (el cronograma «Història Bàsica») mostrant **només aquell personatge**.

El problema: el personatge és random de Wikidata, per tant **NO existeix a `HB_DATA`** (el snapshot local de `data.js`). El cronograma, doncs, ha de saber rebre un personatge «extern» i pintar-lo, independentment de `HB_DATA`.

Aquest document especifica què ha d'implementar l'`index.html` per suportar-ho. **El joc ja està fet i ja envia les dades tal com s'especifica aquí.**

## 2. Què envia el joc (contracte)

Quan l'usuari clica «📅 Veure al cronograma», el joc fa DUES coses abans de navegar:

### 2.1. Escriu una caché a `localStorage`

- **Clau:** `hb_view_person`
- **Valor:** objecte JSON amb aquesta forma:

```json
{
  "qid": "Q7259",
  "name": "Ada Lovelace",
  "birth": 1815,
  "death": 1852,
  "img": "https://commons.wikimedia.org/wiki/Special:FilePath/Ada_Lovelace.jpg?width=500",
  "desc": "matemàtica britànica"
}
```

- `qid` (string): identificador de Wikidata. Sempre present.
- `name` (string): nom ja resolt (ca/es/en, per aquest ordre).
- `birth` (number): any de naixement. **Enters; negatiu = aC** (p. ex. `-69` = 69 aC). Sempre present (el joc garanteix que tot personatge té data de naixement).
- `death` (number|null): any de mort, o `null` si viu / desconegut.
- `img` (string|null): URL directa de la imatge (Commons), o `null`.
- `desc` (string): descripció curta, pot ser `""`.

### 2.2. Navega a l'index amb el QID a la URL

```
index.html?person=Q7259
```

> La URL només porta el `qid` (curta i **compartible**). Les dades riques van per la caché. Això permet que un enllaç comàrtit funcioni també per a un amic (v. §3.3).

## 3. Què ha de fer l'`index.html`

### 3.1. Detectar el paràmetre

En carregar, llegir `?person=` de la URL:

```js
const params = new URLSearchParams(location.search);
const personQid = params.get('person'); // 'Q7259' o null
```

Si no hi ha `person`, comportament normal de sempre (cronograma complet amb `HB_DATA`).

### 3.2. Resoldre les dades del personatge

Ordre de resolució (fallback en cascada):

1. **Caché primer:** llegir `hb_view_person` de `localStorage`. Si existeix i el seu `qid` coincideix amb `personQid` → usar aquestes dades directament (ràpid, sense xarxa).
2. **Si no hi ha caché o el `qid` no coincideix** (cas típic: un amic obre l'enllaç compartit al seu dispositiu, on no té la caché) → **re-consultar Wikidata pel QID** (1 sola crida, barata).

### 3.3. Re-consulta a Wikidata (fallback)

Mateixa API que fa servir el joc:

```
https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q7259&props=labels|descriptions|claims|sitelinks/urls&languages=ca|es|en&format=json&origin=*
```

Parsers necessaris (idèntics als del joc, es poden reaprofitar):
- **nom:** `entity.labels.ca||es||en .value`
- **descripció:** `entity.descriptions.ca||es||en .value`
- **naixement:** `entity.claims.P569[0].mainsnak.datavalue.value.time` → regex `^([+-])0*(\d+)-` → any (negatiu si signe `-`)
- **mort:** `entity.claims.P570` (mateix parseig, opcional)
- **imatge:** `entity.claims.P18[0].mainsnak.datavalue.value` (nom de fitxer) → `https://commons.wikimedia.org/wiki/Special:FilePath/<fitxer amb espais→_ i encodeURIComponent>?width=500`

> Nota: la web sencera dependrà d'internet, per tant la re-consulta no és cap limitació nova.

### 3.4. Pintar en «mode personatge únic»

Quan hi ha `?person=`, el cronograma ha de mostrar **només aquest personatge** (no tot `HB_DATA`):
- Situar-lo a la línia de temps segons `birth` (– `death` si n'hi ha).
- Mostrar nom, i idealment imatge/descripció.
- Convindria un indicador visual que estàs en mode «personatge únic» i una manera de tornar al cronograma complet (p. ex. treure el paràmetre / botó «Veure tot el cronograma»).

### 3.5. Casos límit
- `person` present però QID invàlid / entitat inexistent → missatge d'error suau i oferir el cronograma complet.
- Sense internet i sense caché → no es pot resoldre; missatge clar.
- `death` = `null` → pintar com a rang obert / punt únic segons convingui.
- Anys aC (`birth` negatiu) → respectar el mateix format que ja fa servir el cronograma.

## 4. Notes de seguretat

Les dades venen de Wikidata (contingut no curat). En pintar-les a l'`index`, usar `textContent` / creació de nodes DOM (no `innerHTML` amb dades crues) per evitar injecció.

## 5. Resum del que ha de tocar l'`index`

1. Llegir `?person=Q<ID>`.
2. Resoldre dades: caché `hb_view_person` → si no, Wikidata pel QID.
3. Renderitzar el cronograma en mode «personatge únic».
4. Oferir tornada al cronograma complet.
5. Gestionar errors i pintar amb `textContent`.

## 6. Claus de `localStorage` compartides (referència)

| Clau | Qui l'escriu | Contingut |
|------|--------------|-----------|
| `hb_view_person` | joc (Personatge del dia) | `{qid,name,birth,death,img,desc}` — traspàs puntual cap a l'index |
| `hb_favorits` | joc (stub) | `[{qid,name,birth,death,img,desc}]` — futurs Favorits |
| `hb_personatge_album` | joc | `[{qid,name,birth,death,img,desc,date}]` |
| `hb_personatge_cache` | joc | `{date, person}` — caché del personatge del dia |
