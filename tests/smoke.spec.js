import { test, expect } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

// ⚠️ RegExp, NO el glob '**/wikidata.org/**': el glob exigeix la subcadena literal
// `/wikidata.org/`, que NO tenen ni `query.wikidata.org/sparql` ni `www.wikidata.org/w/api.php`
// (el caràcter previ és un punt, no una barra). Amb el glob la intercepció no s'activava mai i
// els tests anaven a la xarxa de debò → fallades intermitents quan la SPARQL trigava >5s.
const WIKIDATA = /wikidata\.org/;
const INDEX = '/index.html';
const JOC   = '/joc.html';

// Neteja l'estat desat per garantir una vista buida en cada test
async function freshIndex(page) {
  await page.goto(INDEX);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

// Escriu les dades de mode personatge i navega a ?person=
async function goPersonMode(page, qid = 'Q868') {
  await page.goto(INDEX);
  await page.evaluate((q) => {
    localStorage.setItem('hb_view_person', JSON.stringify({
      qid: q, name: 'Aristòtil', birth: -384, death: -322, img: null,
      desc: 'filòsof grec'
    }));
  }, qid);
  await page.goto(`/index.html?person=${qid}`);
}

// Mòbil o no: es pregunta el MATEIX que pregunta l'app (`pointer:coarse`), no l'amplada.
// El landscape del CI fa 851px, prou ample per confondre qualsevol llindar de píxels, però
// és tàctil i per tant no hi ha barra lateral.
async function isCoarse(page) {
  return page.evaluate(() => window.matchMedia('(pointer:coarse)').matches);
}

// ── Helpers de viewport estret ───────────────────────────────────────────────
// Els tres calen perquè al mòbil l'app arrenca en un estat DIFERENT del desktop. No són
// "workarounds": repliquen el que ha de fer un usuari real abans d'arribar al control.

// El popup «Gira el mòbil» (només portrait tàctil) se superposa al canvas i intercepta els
// clics. `checkPortrait()` corre de forma síncrona al boot, així que quan el `goto` ha
// resolt la classe `.on` ja hi és — o no hi serà mai: no cal esperar.
async function dismissRotateHint(page) {
  if (await page.locator('#portraitWall.on').count() === 0) return;
  await page.locator('#rotateDismiss').click();
  await expect(page.locator('#portraitWall.on')).toHaveCount(0);
}

// La sidebar arrenca PLEGADA per sota de 900px (canvi #47) — cosa que afecta portrait (393px)
// i landscape (851px) — i llavors amaga tot el seu contingut
// (`.body.collapsed .sidebar>*{display:none}`). Qualsevol test que hi cliqui a dins l'ha
// d'obrir primer. Tanca l'avís de girar abans, que si no tapa el tirador.
async function openSidebar(page) {
  await dismissRotateHint(page);
  if (await page.locator('.body.collapsed').count()) {
    await page.locator('#sidebarToggle').click();
    await page.waitForTimeout(300);   // animació de width (0.18s)
  }
  await expect(page.locator('.body')).not.toHaveClass(/collapsed/);
}

// Obre el popup de configuració del mòbil (el botó flotant de baix a la dreta). Cal treure
// abans l'avís de girar, que en portrait se superposa al canvas i intercepta el clic.
async function openCfgPopup(page) {
  await dismissRotateHint(page);
  await page.locator('#cfgBtn').click();
  await expect(page.locator('#cfgwrap')).toBeVisible();
}

// Deixa `#collections` a la vista, pel camí que toqui a cada entorn: al mòbil les seccions
// viuen dins del popup i cal triar-ne la pestanya; amb ratolí n'hi ha prou d'obrir la barra.
async function openCollectionsSection(page) {
  if (await isCoarse(page)) {
    await openCfgPopup(page);
    await page.locator('#cfgtabs .cfgtab').nth(1).click();   // 0 Marcs · 1 Col·leccions · 2 A la vista
  } else {
    await openSidebar(page);
  }
  await expect(page.locator('[data-col="filosofs"]')).toBeVisible();
}

// Per sota del llindar de plegat (tàctil ≤600px) el menú de seccions viu dins d'un
// desplegable que obre la marca; l'enllaç «Jocs» existeix al DOM però no és visible.
async function openSectionMenu(page) {
  if (await page.locator('.secnav.navcollapsed').count() === 0) return;
  await page.locator('.secnav > .brand').click();
  await expect(page.locator('.modeswitch')).toBeVisible();
}

// Afegeix el primer personatge de la BD local via cerca i retorna el seu nom
async function addFirstPerson(page) {
  const term = await page.evaluate(() => PEOPLE[0]?.name?.slice(0, 5) ?? 'Sòcra');
  await page.locator('#q').fill(term);
  await expect(page.locator('#results.open .row[data-add]')).toBeVisible({ timeout: 3000 });
  const name = await page.locator('#results .row[data-add]').first().textContent();
  await page.locator('#results .row[data-add]').first().click();
  return name.trim();
}

// ─── Càrrega bàsica ──────────────────────────────────────────────────────────

test.describe('Càrrega bàsica', () => {
  test('index.html carrega sense errors JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(INDEX);
    await page.waitForLoadState('load');
    expect(errors, `Errors inesperats: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('joc.html carrega sense errors JS', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(JOC);
    await page.waitForLoadState('load');
    expect(errors, `Errors inesperats: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('elements clau existeixen al DOM (index)', async ({ page }) => {
    await page.goto(INDEX);
    await expect(page.locator('#scroll')).toBeAttached();
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('#q')).toBeVisible();
    // Des del canvi #141 el control de marcs/colleccions/gent és diferent a cada entorn:
    // amb ratolí, la barra lateral i el seu tirador; en tàctil, el botó flotant i el popup.
    if (await isCoarse(page)) {
      await expect(page.locator('#cfgBtn')).toBeVisible();
      await expect(page.locator('.sidebar')).toBeHidden();
      await expect(page.locator('#cfgwrap')).toBeHidden();   // arrenca tancat
    } else {
      await expect(page.locator('.sidebar')).toBeVisible();
      await expect(page.locator('#sidebarToggle')).toBeVisible();
      await expect(page.locator('#cfgBtn')).toBeHidden();
    }
  });
});

// ─── Topbar / navegació ──────────────────────────────────────────────────────

test.describe('Topbar', () => {
  test('botó «Cronograma» marcat, «Jocs» disponible', async ({ page }) => {
    await page.goto(INDEX);
    const nav = page.locator('.modeswitch');
    await expect(nav.locator('[aria-current="page"]')).toContainText('Cronograma');
    await expect(nav.locator('a:not([aria-current])')).toContainText('Jocs');
  });

  test('clicar «Jocs» navega a joc.html', async ({ page }) => {
    await page.goto(INDEX);
    await openSectionMenu(page);   // en portrait el menú està plegat dins la marca
    await page.locator('.modeswitch a:not([aria-current])').click();
    await expect(page).toHaveURL(/joc\.html/);
  });

  test('joc.html: botó «Jocs» marcat, «Cronograma» disponible', async ({ page }) => {
    await page.goto(JOC);
    const nav = page.locator('.modeswitch');
    await expect(nav.locator('[aria-current="page"]')).toContainText('Jocs');
    await expect(nav.locator('a:not([aria-current])')).toContainText('Cronograma');
  });
});

// ─── Sidebar ────────────────────────────────────────────────────────────────

// La barra lateral ÉS del desktop des del canvi #141: en tàctil s'amaga i els seus controls
// passen al popup. Aquests tres tests es salten en tàctil en lloc d'exigir-hi una barra que
// ja no hi ha d'haver (és el que feia petar portrait i landscape).
test.describe('Sidebar (amb ratolí)', () => {
  test('arrenca oberta amb ratolí i plegada en pantalla estreta', async ({ page }) => {
    await freshIndex(page);
    test.skip(await isCoarse(page), 'En tàctil no hi ha barra lateral: veure «Configuració (tàctil)»');
    await expect(page.locator('.sidebar')).toBeVisible();
    if (page.viewportSize().width < 900) {
      await expect(page.locator('.body')).toHaveClass(/collapsed/);
    } else {
      await expect(page.locator('.body')).not.toHaveClass(/collapsed/);
    }
  });

  test('el tirador col·lapsa la sidebar i eixampla el canvas', async ({ page }) => {
    await freshIndex(page);
    test.skip(await isCoarse(page), 'En tàctil no hi ha barra lateral');
    await openSidebar(page);
    const wBefore = await page.locator('#scroll').evaluate(el => el.clientWidth);
    await page.locator('#sidebarToggle').click();
    await page.waitForTimeout(300); // animació CSS 0.18s
    const wAfter = await page.locator('#scroll').evaluate(el => el.clientWidth);
    await expect(page.locator('.body')).toHaveClass(/collapsed/);
    expect(wAfter).toBeGreaterThan(wBefore);
  });

  test('tornar a clicar obre la sidebar i encongeix el canvas', async ({ page }) => {
    await freshIndex(page);
    test.skip(await isCoarse(page), 'En tàctil no hi ha barra lateral');
    await openSidebar(page);
    await page.locator('#sidebarToggle').click();
    await page.waitForTimeout(300);
    const wCollapsed = await page.locator('#scroll').evaluate(el => el.clientWidth);
    await page.locator('#sidebarToggle').click();
    await page.waitForTimeout(300);
    const wOpen = await page.locator('#scroll').evaluate(el => el.clientWidth);
    await expect(page.locator('.body')).not.toHaveClass(/collapsed/);
    expect(wOpen).toBeLessThan(wCollapsed);
  });
});

// ─── Configuració (tàctil) ──────────────────────────────────────────────────
// El substitut de la barra lateral al mòbil: botó flotant + popup de tres pestanyes.

test.describe('Configuració (tàctil)', () => {
  test('arrenca tancada i el botó flotant l\'obre', async ({ page }) => {
    await freshIndex(page);
    test.skip(!(await isCoarse(page)), 'Amb ratolí hi ha la barra lateral');
    await expect(page.locator('#cfgwrap')).toBeHidden();
    await openCfgPopup(page);
    // les tres seccions han de ser DINS del popup, no a la barra
    const dins = await page.evaluate(() =>
      ['regions', 'collections', 'onview']
        .every(id => document.getElementById('cfgbody').contains(document.getElementById(id))));
    expect(dins).toBe(true);
  });

  test('les pestanyes canvien de secció, una a la vegada', async ({ page }) => {
    await freshIndex(page);
    test.skip(!(await isCoarse(page)), 'Amb ratolí hi ha la barra lateral');
    await openCfgPopup(page);
    const ids = ['regions', 'collections', 'onview'];
    for (let i = 0; i < 3; i++) {
      await page.locator('#cfgtabs .cfgtab').nth(i).click();
      await expect(page.locator('#' + ids[i])).toBeVisible();
      for (const altre of ids.filter((_, k) => k !== i)) {
        await expect(page.locator('#' + altre)).toBeHidden();
      }
    }
  });

  test('l\'alçada del popup no depèn de la pestanya', async ({ page }) => {
    await freshIndex(page);
    test.skip(!(await isCoarse(page)), 'Amb ratolí hi ha la barra lateral');
    await openCfgPopup(page);
    const altures = [];
    for (let i = 0; i < 3; i++) {
      await page.locator('#cfgtabs .cfgtab').nth(i).click();
      altures.push(await page.locator('.cfg').evaluate(el => Math.round(el.getBoundingClientRect().height)));
    }
    expect(new Set(altures).size, `alçades: ${altures.join(', ')}`).toBe(1);
  });

  test('la ✕ i el vel el tanquen', async ({ page }) => {
    await freshIndex(page);
    test.skip(!(await isCoarse(page)), 'Amb ratolí hi ha la barra lateral');
    await openCfgPopup(page);
    await page.locator('#cfgClose').click();
    await expect(page.locator('#cfgwrap')).toBeHidden();
    await openCfgPopup(page);
    await page.locator('#cfgscrim').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#cfgwrap')).toBeHidden();
  });

  test('el botó flotant no tapa els anys de l\'eix', async ({ page }) => {
    await freshIndex(page);
    test.skip(!(await isCoarse(page)), 'Amb ratolí hi ha la barra lateral');
    await dismissRotateHint(page);
    const fab = await page.locator('#cfgBtn').boundingBox();
    const eix = await page.locator('.axis').boundingBox();
    expect(fab.y + fab.height, 'el botó ha de quedar per damunt de l\'eix').toBeLessThanOrEqual(eix.y + 1);
  });
});

// ─── Cerca i personatges ─────────────────────────────────────────────────────

test.describe('Cerca', () => {
  test('el canvas arranca buit', async ({ page }) => {
    await freshIndex(page);
    await expect(page.locator('#barsLayer .bar')).toHaveCount(0);
  });

  test('cercar mostra resultats de la BD local', async ({ page }) => {
    await freshIndex(page);
    await page.locator('#q').fill('Sòcra');
    await expect(page.locator('#results.open .row[data-add]')).toBeVisible({ timeout: 3000 });
  });

  test('afegir un personatge local fa aparèixer una barra', async ({ page }) => {
    await freshIndex(page);
    await addFirstPerson(page);
    await expect(page.locator('#barsLayer .bar')).toHaveCount(1);
  });

  test('la × esborra la cerca i tanca el desplegable', async ({ page }) => {
    await freshIndex(page);
    await page.locator('#q').fill('Sòcra');
    await expect(page.locator('#results.open')).toBeVisible();
    await page.locator('#qclear').click();
    await expect(page.locator('#q')).toHaveValue('');
    await expect(page.locator('#results.open')).toHaveCount(0);
  });
});

// ─── Fitxa de detall ─────────────────────────────────────────────────────────

test.describe('Fitxa de detall', () => {
  test('clicar una barra obre la fitxa', async ({ page }) => {
    await freshIndex(page);
    await addFirstPerson(page);
    await page.locator('#barsLayer .bar').first().click();
    await expect(page.locator('#detail.open')).toBeVisible();
  });

  test('la ✕ de la fitxa la tanca', async ({ page }) => {
    await freshIndex(page);
    await dismissRotateHint(page);   // l'avís de girar tapa la ✕ del bottom-sheet
    await addFirstPerson(page);
    await page.locator('#barsLayer .bar').first().click();
    await expect(page.locator('#detail.open')).toBeVisible();
    await page.locator('#closeDetail').click();
    await expect(page.locator('#detail.open')).toHaveCount(0);
  });

  test('la fitxa conté nom i dates del personatge', async ({ page }) => {
    await freshIndex(page);
    await page.locator('#q').fill('Aristò');
    await expect(page.locator('#results.open .row[data-add]')).toBeVisible({ timeout: 3000 });
    await page.locator('#results .row[data-add]').first().click();
    await page.locator('#barsLayer .bar').first().click();
    const detail = page.locator('#detail.open');
    await expect(detail).toContainText('Aristòtil');
    await expect(detail).toContainText('384');
  });
});

// ─── Col·leccions ────────────────────────────────────────────────────────────

test.describe('Col·leccions', () => {
  test('activar una col·lecció afegeix barres al canvas', async ({ page }) => {
    await freshIndex(page);
    // Intercepta Wikidata per no dependre de xarxa
    await page.route(WIKIDATA, route => route.fulfill({ status: 200, body: '{"entities":{}}', contentType: 'application/json' }));
    await openCollectionsSection(page);   // sidebar + secció de l'acordió
    const btn = page.locator('[data-col="filosofs"]');
    await expect(btn).toBeVisible();
    await btn.click();
    // Membres locals (Sòcrates, Plató, Aristòtil, Diògenes) apareixen sense Wikidata
    await expect(page.locator('#barsLayer .bar').first()).toBeVisible({ timeout: 5000 });
    await expect(btn).toHaveClass(/on/);
  });

  test('desactivar la col·lecció buida el canvas', async ({ page }) => {
    await freshIndex(page);
    await page.route(WIKIDATA, route => route.fulfill({ status: 200, body: '{"entities":{}}', contentType: 'application/json' }));
    await openCollectionsSection(page);
    const btn = page.locator('[data-col="filosofs"]');
    await btn.click();
    await expect(page.locator('#barsLayer .bar').first()).toBeVisible({ timeout: 5000 });
    await btn.click();
    await expect(page.locator('#barsLayer .bar')).toHaveCount(0, { timeout: 3000 });
    await expect(btn).not.toHaveClass(/on/);
  });
});

// ─── Persistència d'estat ────────────────────────────────────────────────────

test.describe('Persistència', () => {
  test('un personatge afegit es recupera en recarregar', async ({ page }) => {
    await freshIndex(page);
    await addFirstPerson(page);
    await page.reload();
    await expect(page.locator('#barsLayer .bar')).toHaveCount(1);
  });
});

// ─── Mode ?person=QID ────────────────────────────────────────────────────────

test.describe('Mode personatge (?person=QID)', () => {
  test('la personbar apareix amb el nom i les dades', async ({ page }) => {
    await goPersonMode(page);
    await expect(page.locator('#personbar.on')).toBeVisible();
    await expect(page.locator('#personbar')).toContainText('Aristòtil');
  });

  test('la ✕ treu ?person= de la URL i amaga la personbar', async ({ page }) => {
    await goPersonMode(page);
    await page.locator('#personbar .pback').click();
    await expect(page).not.toHaveURL(/person=/);
    await expect(page.locator('#personbar.on')).toHaveCount(0);
  });

  test('la ✕ restaura les col·leccions actives prèvies', async ({ page }) => {
    // La col·lecció s'activa per la INTERFÍCIE, no injectant localStorage: en navegar,
    // el `beforeunload` fa `saveNow()` amb l'estat EN MEMÒRIA i sobreescriuria qualsevol
    // cosa que haguéssim escrit a mà a localStorage.
    await freshIndex(page);
    await page.route(WIKIDATA, route => route.fulfill({ status: 200, body: '{"entities":{}}', contentType: 'application/json' }));
    await openCollectionsSection(page);   // sota 900px: sidebar plegada + acordió tancat
    await page.locator('[data-col="filosofs"]').click();
    await expect(page.locator('[data-col="filosofs"].on')).toBeVisible();
    // Entra en mode personatge
    await page.evaluate((q) => {
      localStorage.setItem('hb_view_person', JSON.stringify({
        qid: q, name: 'Aristòtil', birth: -384, death: -322, img: null, desc: 'filòsof grec'
      }));
    }, 'Q868');
    await page.goto('/index.html?person=Q868');
    // Surt del mode
    await page.locator('#personbar .pback').click();
    // La col·lecció ha de quedar activada. S'afirma sobre la CLASSE i no sobre la
    // visibilitat: al mòbil l'acordió de la sidebar torna a «A la vista» en recarregar,
    // així que el botó és correctament `.on` però queda dins d'una secció tancada.
    await expect(page.locator('[data-col="filosofs"]')).toHaveClass(/on/, { timeout: 3000 });
  });

  test('QID invàlid no trenca la pàgina', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/index.html?person=invalid-qid');
    await expect(page.locator('#scroll')).toBeAttached();
    expect(errors).toHaveLength(0);
  });

  // Hauria d'haver atrapat el bug del TDZ (#49): si l'script peta durant el boot, no apareix
  // cap barra. La dada ve del localStorage (img:null), no de Wikidata, així que no cal mock.
  test('el personatge apareix com a barra al canvas', async ({ page }) => {
    await goPersonMode(page);
    await expect(page.locator('#barsLayer .bar').first()).toBeVisible({ timeout: 5000 });
  });

  // Hauria d'haver atrapat el bug del display:none (#51): en portrait (<=430px) la regla
  // @media amagava .personbar .pimg, que ara fa 26x26px en lloc de desaparèixer.
  // Corre als tres viewports: portrait és el cas crític, els altres passen igualment.
  test('la foto de la personbar no és oculta per cap media query', async ({ page }) => {
    await goPersonMode(page);
    await expect(page.locator('#personbar.on')).toBeVisible();
    const display = await page.locator('#personbar .pimg').evaluate(
      el => window.getComputedStyle(el).display
    );
    expect(display).not.toBe('none');
  });
});

// ─── Mòbil: portrait ─────────────────────────────────────────────────────────

test.describe('Mòbil portrait', () => {
  test('surt el popup de girar el telèfon', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-portrait', 'Només mobile-portrait');
    await freshIndex(page);
    await expect(page.locator('#portraitWall.on')).toBeVisible({ timeout: 2000 });
  });

  test('la ✕ del popup el tanca i no torna a sortir', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-portrait', 'Només mobile-portrait');
    await freshIndex(page);
    await expect(page.locator('#portraitWall.on')).toBeVisible();
    await page.locator('#rotateDismiss').click();
    await expect(page.locator('#portraitWall.on')).toHaveCount(0);
  });

  test('la topbar és compacta (≤50px)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-portrait', 'Només mobile-portrait');
    await page.goto(INDEX);
    const h = await page.locator('.topbar').evaluate(el => el.getBoundingClientRect().height);
    expect(h).toBeLessThanOrEqual(50);
  });
});

// ─── Mòbil: cap ⋮ a les barres ──────────────────────────────────────────────

test.describe('Mòbil: botó ⋮', () => {
  test('el ⋮ no és visible en cap barra en tàctil', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'Només mòbil');
    await freshIndex(page);
    await addFirstPerson(page);
    // En tàctil el ⋮ ha de tenir display:none (regla CSS amb !important)
    const visible = await page.locator('#barsLayer .bar .menu').evaluate(
      el => window.getComputedStyle(el).display
    );
    expect(visible).toBe('none');
  });
});

// ─── Mòbil: fitxa com a bottom-sheet ────────────────────────────────────────

test.describe('Mòbil: bottom-sheet', () => {
  test('la fitxa puja des de baix en obrir-se', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'Només mòbil');
    await freshIndex(page);
    await addFirstPerson(page);
    await page.locator('#barsLayer .bar').first().click();
    const detail = page.locator('#detail.open');
    await expect(detail).toBeVisible();
    const box = await detail.boundingBox();
    const viewport = page.viewportSize();
    // La fitxa ha de tenir el seu costat inferior prop del final de la pantalla
    expect(box.y + box.height).toBeGreaterThan(viewport.height * 0.7);
  });
});

// ─── Integració joc → index ──────────────────────────────────────────────────

test.describe('Integració joc → index', () => {
  test('hb_view_person escrit des del joc es llegeix a l\'index', async ({ page }) => {
    await page.goto(JOC);
    await page.evaluate(() => {
      localStorage.setItem('hb_view_person', JSON.stringify({
        qid: 'Q868', name: 'Aristòtil', birth: -384, death: -322,
        img: null, desc: 'filòsof grec'
      }));
    });
    await page.goto('/index.html?person=Q868');
    await expect(page.locator('#personbar.on')).toBeVisible();
    await expect(page.locator('#personbar')).toContainText('Aristòtil');
  });

  test('l\'estat de l\'index sobreviu el viatge joc → index → ✕', async ({ page }) => {
    // Prepara un estat a l'index activant la col·lecció per la interfície (vegeu la nota
    // del test anterior: injectar localStorage no serveix, el `beforeunload` el sobreescriu).
    await freshIndex(page);
    await page.route(WIKIDATA, route => route.fulfill({ status: 200, body: '{"entities":{}}', contentType: 'application/json' }));
    await openCollectionsSection(page);   // sota 900px: sidebar plegada + acordió tancat
    await page.locator('[data-col="filosofs"]').click();
    await expect(page.locator('[data-col="filosofs"].on')).toBeVisible();
    // El joc escriu el personatge del dia i navega
    await page.goto(JOC);
    await page.evaluate(() => {
      localStorage.setItem('hb_view_person', JSON.stringify({
        qid: 'Q868', name: 'Aristòtil', birth: -384, death: -322, img: null, desc: ''
      }));
    });
    await page.goto('/index.html?person=Q868');
    // Surt del mode personatge
    await page.locator('#personbar .pback').click();
    // La col·lecció ha de seguir activa (classe, no visibilitat: vegeu el test de dalt)
    await expect(page.locator('[data-col="filosofs"]')).toHaveClass(/on/, { timeout: 3000 });
  });
});
