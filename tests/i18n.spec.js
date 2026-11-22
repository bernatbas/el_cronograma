import { test, expect } from '@playwright/test';
import fs from 'fs';

// ─── Tot el text de la pantalla passa pel diccionari ────────────────────────
// Amb ?lang=xx (pseudotraducció) t() embolica el que torna entre ⟦ ⟧ i L() entre ⟪ ⟫. Aquí es
// recorren les pantalles principals de les dues pàgines i tests/i18n-scan.js torna qualsevol
// lletra visible que hagi quedat fora de les marques: un text escrit a pinyó al codi, que en
// canviar d'idioma es quedaria en català. També peta si t() ha avisat per consola d'una clau
// que no existeix. El check de claus del CI (ci.yml) mira el diccionari; aquest, la pantalla.
//
// Peta en VERMELL: un text fora del diccionari és un error, igual que una clau que falta.

const SCAN = fs.readFileSync('tests/i18n-scan.js', 'utf8');
const WIKIDATA = /wikidata\.org|wikimedia\.org|wikipedia\.org/;

// El que es veu igual a totes les llengües: marca, noms propis de les fonts i símbols.
const PROPIS = /^(\[aria-label\] )?(BABIL|NIA|Babilinia|© 2026 Babilinia|Wikidata|CC0|VS|Wikipedia ↗|🔗 Wikipedia)$/;

// ⚠️ FASE 3 (contingut): els noms i descripcions de db.js (persones, events, col·leccions del
// catàleg) i els que venen de Wikidata encara no passen per L(). Quan ho facin, aquesta llista
// s'ha d'anar BUIDANT: el que hi quedi han de ser només dades de Wikidata, que ja arriben en
// l'idioma actiu.
const CONTINGUT = [
  '.cname', 'h2.collh2', '.colldesc',                  // col·leccions (cronograma)
  '.onm', '.nm', '.adnm', '.concrono',                 // noms als jocs
  'img.mem-img', '.pname', '.pdesc', '.pchip', 'img.pimg',
];
// Es mira l'element que conté el text (l'últim tram de `on`, «tag#id.classe1.classe2»).
const esContingut = on => {
  const ultim = on.split(' > ').pop(), classes = ultim.split('.').slice(1), tag = ultim.split(/[.#]/)[0];
  return CONTINGUT.some(sel => { const [t, c] = sel.split('.'); return (!t || t === tag) && classes.includes(c); });
};

async function escaneja(page, etapa, trobats) {
  const fora = await page.evaluate(SCAN);
  for (const x of fora) {
    if (PROPIS.test(x.text) || esContingut(x.on)) continue;
    trobats.add(`${etapa} | «${x.text}» @ ${x.on}`);
  }
}

function vigilaConsola(page, avisos) {
  page.on('console', m => { if (m.text().startsWith('[i18n]')) avisos.add(m.text()); });
}

test.beforeEach(async ({ page }) => {
  // Cap crida a fora: el que depengui de Wikidata mostrarà el seu estat d'error, que també
  // és text d'interfície i també s'ha d'escanejar.
  await page.route(WIKIDATA, route => route.abort());
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('historiabasica.guia')) localStorage.setItem('historiabasica.guia', 'vista'); } catch (e) {}
  });
});

test('cronograma: cap text fora del diccionari', async ({ page }) => {
  const trobats = new Set(), avisos = new Set();
  vigilaConsola(page, avisos);
  await page.goto('/index.html?lang=xx');
  await page.waitForFunction(() => document.title.startsWith('⟦'));
  await page.waitForTimeout(500);
  await escaneja(page, 'inici', trobats);

  // Cada pas crida l'app pel seu nom. Si una funció es renombra, el pas peta i ho diu:
  // millor això que un test que deixa de mirar sense avisar.
  const passos = [
    ['context',      () => { const p = PEOPLE.find(p => p.wd === 'Q692') || PEOPLE[5]; showContext(p.id); }],
    ['fitxa',        () => openDetail(PEOPLE.find(p => p.wd === 'Q692') || PEOPLE[5])],
    ['fitxa approx', () => openDetail(PEOPLE.find(p => p.approx))],
    ['fitxa viu',    () => openDetail(PEOPLE.find(p => p.death == null))],
    ['event',        () => openEvent(EVENTS[3])],
    ['marcs',        () => { state.marcs = new Set(MARCS.map(m => m.id)); render(); }],
    ['col·lecció',   () => drawCatalogCard(COLLECTIONS[0])],
    ['col. pròpia',  () => { openNewColl(); const i = document.querySelector('#newcolin'); i.value = 'Prova'; creaDesDeLaCaixa(); }],
  ];
  for (const [nom, fn] of passos) {
    const err = await page.evaluate(`(()=>{ try{ (${fn})(); return ''; }catch(e){ return e.message; } })()`);
    if (err) trobats.add(`${nom} | el pas ha petat: ${err}`);
    await page.waitForTimeout(400);
    await escaneja(page, nom, trobats);
  }

  expect([...avisos], 'avisos de consola').toEqual([]);
  expect([...trobats], 'text fora del diccionari').toEqual([]);
});

test('guia: cap text fora del diccionari', async ({ page }) => {
  const trobats = new Set(), avisos = new Set();
  vigilaConsola(page, avisos);
  await page.goto('/index.html?lang=xx&guia');
  await page.waitForTimeout(800);
  // En vertical la guia espera que es tanqui l'avís de girar el mòbil.
  if (await page.locator('#portraitWall.on').count()) await page.locator('#rotateDismiss').click();
  for (let pas = 0; pas < 6; pas++) {
    await page.waitForTimeout(600);
    await escaneja(page, 'guia ' + (pas + 1), trobats);
    const seg = page.locator('.gnext');
    if (!(await seg.count())) break;
    await page.evaluate(() => document.querySelector('.gnext').click());
  }
  expect([...avisos], 'avisos de consola').toEqual([]);
  expect([...trobats], 'text fora del diccionari').toEqual([]);
});

test('jocs: cap text fora del diccionari', async ({ page }) => {
  const trobats = new Set(), avisos = new Set();
  vigilaConsola(page, avisos);
  await page.goto('/joc.html?lang=xx');
  await page.waitForFunction(() => document.title.startsWith('⟦'));
  await page.waitForTimeout(500);
  await escaneja(page, 'hub', trobats);

  for (const g of ['ordena', 'abansdespres', 'memory', 'contemporanis', 'personatgedia']) {
    await page.evaluate(h => { location.hash = h; }, '#/' + g);
    await page.waitForTimeout(1500);
    await escaneja(page, g, trobats);
  }

  // Pantalles de resultat: l'Ordena s'envia tal com surt; l'«Abans o després?» es juga fins
  // a perdre; el «Contemporanis?» es respon sí a tot.
  await page.evaluate(() => { location.hash = '#/ordena'; });
  await page.waitForSelector('#ordsubmit');
  await page.evaluate(() => document.querySelector('#ordsubmit').click());
  await page.waitForTimeout(1200);
  await escaneja(page, 'ordena · resultat', trobats);

  await page.evaluate(() => { location.hash = '#/abansdespres'; });
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(700);
    const seguir = await page.evaluate(() => {
      if (document.querySelector('.gameover, .adrows')) return false;
      const b = document.querySelector('button.choice:not([disabled])');
      if (b) b.click();
      return true;
    });
    if (!seguir) break;
  }
  await page.waitForTimeout(800);
  await escaneja(page, 'abans o després · resultat', trobats);

  await page.evaluate(() => { location.hash = '#/contemporanis'; });
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(700);
    const seguir = await page.evaluate(() => {
      if (document.querySelector('.gameover')) return false;
      const b = document.querySelector('button.conyes:not([disabled])');
      if (b) b.click();
      return true;
    });
    if (!seguir) break;
  }
  await page.waitForTimeout(800);
  await escaneja(page, 'contemporanis · resultat', trobats);

  expect([...avisos], 'avisos de consola').toEqual([]);
  expect([...trobats], 'text fora del diccionari').toEqual([]);
});
