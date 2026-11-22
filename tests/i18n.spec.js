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
  '.cname', 'h2.collh2', '.colldesc',                  // col·leccions: NO es tradueixen MAI (són com playlists)
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

// L'estat «ja jugat avui» (amb errors, que és quan surten més files), com a noscroll.spec.js.
function desaJugat(tipus) {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const avui = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  if (tipus === 'ad') {
    const keys = window.__AD.pool(avui).slice(0, 3).map(it => it.key);
    localStorage.setItem('hb_ad_daily', JSON.stringify({ date: avui, score: 7, perfect: false, failKeys: keys }));
    localStorage.setItem('hb_ad_streak', JSON.stringify({ last: avui, days: 12 }));
  }
  if (tipus === 'con') {
    localStorage.setItem('hb_con_daily', JSON.stringify({ date: avui, score: 2, marks: [true, false, true, false, false] }));
    localStorage.setItem('hb_con_streak', JSON.stringify({ last: avui, days: 12 }));
  }
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
  test.setTimeout(60_000);
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

  // Pantalles de resultat. L'Ordena s'envia tal com surt (és instantani). L'«Abans o després?» i
  // el «Contemporanis?» NO es juguen: cada encert allarga la partida i, amb les animacions, no
  // acabava dins del temps del test (22/11/2026, vermell als tres dispositius). Es desa l'estat
  // de «ja jugat avui», com fa noscroll.spec.js, i es recarrega.
  await page.evaluate(() => { location.hash = '#/ordena'; });
  await page.waitForSelector('#ordsubmit');
  await page.evaluate(() => document.querySelector('#ordsubmit').click());
  await page.waitForTimeout(1200);
  await escaneja(page, 'ordena · resultat', trobats);

  for (const [joc, hash] of [['ad', '#/abansdespres'], ['con', '#/contemporanis']]) {
    await page.goto('/joc.html?lang=xx' + hash);   // __AD viu dins del mòdul: cal haver-lo carregat
    await page.waitForTimeout(500);
    await page.evaluate(desaJugat, joc);
    await page.goto('/joc.html?lang=xx&m=' + Date.now() + hash);
    await page.waitForTimeout(1000);
    await escaneja(page, joc + ' · resultat', trobats);
  }

  expect([...avisos], 'avisos de consola').toEqual([]);
  expect([...trobats], 'text fora del diccionari').toEqual([]);
});
