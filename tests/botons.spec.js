import { test, expect } from '@playwright/test';
import fs from 'fs';

// ─── Cap text de botó desborda el seu botó ──────────────────────────────────
// Recorre les pantalles principals de les dues pàgines, EN CADA IDIOMA, i tests/botons-scan.js torna
// els botons visibles on el text no hi cap. Va néixer el 23/11/2026: a la fitxa, en castellà,
// «Mostrar contexto» sortia tallat («Mostrar contex»). Un idioma nou o un text més llarg al
// diccionari ho pot tornar a fer, i a simple vista només es veu a la mida i l'idioma exactes.
//
// Peta en VERMELL: un botó amb el text tallat és un error.

const SCAN = fs.readFileSync('tests/botons-scan.js', 'utf8');
const WIKIDATA = /wikidata\.org|wikimedia\.org|wikipedia\.org/;
const IDIOMES = ['ca', 'es'];

async function escaneja(page, etapa, trobats) {
  for (const x of await page.evaluate(SCAN)) trobats.add(`${etapa} | «${x.text}» sobren ${x.sobra}px @ ${x.on}`);
}

test.beforeEach(async ({ page }) => {
  await page.route(WIKIDATA, route => route.abort());
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('historiabasica.guia')) localStorage.setItem('historiabasica.guia', 'vista'); } catch (e) {}
  });
});

for (const lang of IDIOMES) {
  test(`cronograma (${lang}): cap botó desbordat`, async ({ page }) => {
    const trobats = new Set();
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForTimeout(800);
    if (await page.locator('#portraitWall.on').count()) await page.locator('#rotateDismiss').click();
    await escaneja(page, 'inici', trobats);

    // Cada pas crida l'app pel seu nom: si una funció es renombra, el pas peta i ho diu.
    const passos = [
      ['context',      () => { const p = PEOPLE.find(p => p.wd === 'Q692') || PEOPLE[5]; showContext(p.id); }],
      ['fitxa',        () => openDetail(PEOPLE.find(p => p.wd === 'Q692') || PEOPLE[5])],
      ['fitxa approx', () => openDetail(PEOPLE.find(p => p.approx))],
      ['fitxa viu',    () => openDetail(PEOPLE.find(p => p.death == null))],
      ['report',       () => obreReport((PEOPLE.find(p => p.wd === 'Q692') || PEOPLE[5]).id)],
      ['event',        () => { tancaReport(); openEvent(EVENTS[3]); }],
      ['col·lecció',   () => drawCatalogCard(COLLECTIONS[0])],
      ['col. pròpia',  () => { openNewColl(); const i = document.querySelector('#newcolin'); i.value = 'Prova'; creaDesDeLaCaixa(); }],
    ];
    for (const [nom, fn] of passos) {
      const err = await page.evaluate(`(()=>{ try{ (${fn})(); return ''; }catch(e){ return e.message; } })()`);
      if (err) trobats.add(`${nom} | el pas ha petat: ${err}`);
      await page.waitForTimeout(500);
      await escaneja(page, nom, trobats);
    }
    expect([...trobats], 'botons amb el text desbordat').toEqual([]);
  });

  test(`jocs (${lang}): cap botó desbordat`, async ({ page }) => {
    test.setTimeout(40_000);
    const trobats = new Set();
    await page.goto(`/joc.html?lang=${lang}`);
    await page.waitForTimeout(800);
    await escaneja(page, 'hub', trobats);
    for (const g of ['ordena', 'abansdespres', 'memory', 'contemporanis', 'personatgedia']) {
      await page.evaluate(h => { location.hash = h; }, '#/' + g);
      await page.waitForTimeout(1500);
      await escaneja(page, g, trobats);
    }
    await page.evaluate(() => { location.hash = '#/ordena'; });
    await page.waitForSelector('#ordsubmit');
    await page.evaluate(() => document.querySelector('#ordsubmit').click());
    await page.waitForTimeout(1200);
    await escaneja(page, 'ordena · resultat', trobats);
    expect([...trobats], 'botons amb el text desbordat').toEqual([]);
  });
}
