import { test } from '@playwright/test';
import fs from 'fs';

// ─── Sense scroll: AVÍS, no error ────────────────────────────────────────────
// La màxima dels jocs és que tot hi càpiga sense scroll. Això ho comprova a una colla de mides
// reals (amb l'alçada que deixa la barra del navegador, que és la que compta) i, si alguna
// pantalla en fa, NO peta: escriu una línia a `noscroll-warnings.txt`, i el CI la converteix en
// un avís groc a la pàgina de l'execució. Per això aquí no hi ha cap `expect`.
//
// Només corre al projecte `desktop`: les mides les posa ell mateix, i fer-ho tres cops no
// aportaria res més que tres vegades el temps.
//
// ⚠️ «Personatge del dia» i «Memory» van a Wikidata. Si la xarxa del CI va lenta, es mesura la
// pantalla de càrrega, que és petita: com a molt l'avís calla, no en surt cap de fals.

const AVISOS = 'noscroll-warnings.txt';

const MIDES = [
  // vertical tàctil (alçada útil amb la barra del navegador)
  { nom: 'iPhone SE 1a gen', w: 320, h: 460, mobil: true },
  { nom: 'Android petit',    w: 360, h: 560, mobil: true },
  { nom: 'iPhone SE',        w: 375, h: 553, mobil: true },
  { nom: 'iPhone 14',        w: 390, h: 664, mobil: true },
  { nom: 'Android gran',     w: 412, h: 780, mobil: true },
  // horitzontal tàctil
  { nom: 'iPhone SE horitzontal', w: 568, h: 320, mobil: true },
  { nom: 'iPhone 8 horitzontal',  w: 667, h: 375, mobil: true },
  { nom: 'Android horitzontal',   w: 740, h: 340, mobil: true },
  { nom: 'iPhone 14 horitzontal', w: 844, h: 390, mobil: true },
  // escriptori (amb pestanyes i marcadors)
  { nom: 'Portàtil 1366', w: 1366, h: 657, mobil: false },
  { nom: 'Portàtil 1280', w: 1280, h: 680, mobil: false },
  { nom: 'Escriptori 1440', w: 1440, h: 780, mobil: false },
];

// Cada pantalla: com s'hi arriba (estat desat abans d'entrar) i on es mira. El hub NO hi és a
// posta: és una llista i als mòbils petits pot fer scroll. L'iPhone 13 (390×664) sí que hi cap.
const PANTALLES = [
  { nom: 'Abans o després? · joc',   hash: '#/abansdespres' },
  { nom: 'Abans o després? · resultat', hash: '#/abansdespres', desa: 'ad' },
  { nom: 'Ordena la línia · joc',    hash: '#/ordena' },
  { nom: 'Contemporanis · joc',      hash: '#/contemporanis' },
  { nom: 'Contemporanis · resultat', hash: '#/contemporanis', desa: 'con' },
  { nom: 'Memory · joc',             hash: '#/memory', xarxa: true },
  { nom: 'Personatge del dia',       hash: '#/personatgedia', xarxa: true },
];

// L'estat «ja jugat avui» de cada joc, amb el pitjor cas: amb errors, que és quan surten més
// botons i més files.
function desaEstat(tipus) {
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

test.describe('Sense scroll (només avisa)', () => {
  for (const m of MIDES) {
    test(`${m.nom} ${m.w}×${m.h}`, async ({ browser }) => {
      // ⚠️ Dins del test, no amb test.skip(fn) al describe: aquella funció només rep fixtures, no el
      // testInfo, i petava amb «Cannot read properties of undefined (reading 'project')».
      test.skip(test.info().project.name !== 'desktop', 'les mides les posa el test');
      test.setTimeout(90_000);
      const ctx = await browser.newContext({
        viewport: { width: m.w, height: m.h },
        isMobile: m.mobil, hasTouch: m.mobil, deviceScaleFactor: m.mobil ? 2 : 1,
      });
      const page = await ctx.newPage();
      const avisos = [];
      for (const s of PANTALLES) {
        await page.goto('/joc.html#/');
        await page.evaluate(() => localStorage.clear());
        if (s.desa) {
          await page.goto('/joc.html' + s.hash);   // __AD viu dins del mòdul: cal haver-lo carregat
          await page.evaluate(desaEstat, s.desa);
        }
        await page.goto('/joc.html?m=' + Date.now() + s.hash);
        if (s.xarxa) await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
        await page.waitForTimeout(900);   // que acabin les entrades animades (la carta puja 26px)
        const r = await page.evaluate(() => {
          const main = document.querySelector('main');
          const de = document.documentElement;
          return {
            vertical: main ? main.scrollHeight - main.clientHeight : 0,
            pagina: de.scrollHeight - innerHeight,
            horitzontal: de.scrollWidth - innerWidth,
          };
        });
        const sobra = [];
        if (r.vertical > 1)    sobra.push(`${r.vertical}px de scroll vertical`);
        if (r.pagina > 1)      sobra.push(`${r.pagina}px de scroll de pàgina`);
        if (r.horitzontal > 1) sobra.push(`${r.horitzontal}px de scroll horitzontal`);
        if (sobra.length) avisos.push(`${s.nom} a ${m.nom} (${m.w}×${m.h}): ${sobra.join(', ')}`);
      }
      await ctx.close();
      for (const a of avisos) {
        fs.appendFileSync(AVISOS, a + '\n');
        test.info().annotations.push({ type: 'warning', description: a });
      }
    });
  }
});
