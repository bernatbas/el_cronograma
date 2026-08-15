import { test, expect } from '@playwright/test';

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('#q')).toBeVisible();
    await expect(page.locator('#sidebarToggle')).toBeVisible();
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

test.describe('Sidebar', () => {
  test('és visible i no col·lapsada inicialment', async ({ page }) => {
    await freshIndex(page);
    await expect(page.locator('.body')).not.toHaveClass(/collapsed/);
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('el tirador col·lapsa la sidebar i eixampla el canvas', async ({ page }) => {
    await freshIndex(page);
    const wBefore = await page.locator('#scroll').evaluate(el => el.clientWidth);
    await page.locator('#sidebarToggle').click();
    await page.waitForTimeout(300); // animació CSS 0.18s
    const wAfter = await page.locator('#scroll').evaluate(el => el.clientWidth);
    await expect(page.locator('.body')).toHaveClass(/collapsed/);
    expect(wAfter).toBeGreaterThan(wBefore);
  });

  test('tornar a clicar obre la sidebar i encongeix el canvas', async ({ page }) => {
    await freshIndex(page);
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
    await page.route('**/wikidata.org/**', route => route.fulfill({ status: 200, body: '{"entities":{}}', contentType: 'application/json' }));
    const btn = page.locator('[data-col="filosofs"]');
    await expect(btn).toBeVisible();
    await btn.click();
    // Membres locals (Sòcrates, Plató, Aristòtil, Diògenes) apareixen sense Wikidata
    await expect(page.locator('#barsLayer .bar')).toHaveCount({ minimum: 1 }, { timeout: 5000 });
    await expect(btn).toHaveClass(/on/);
  });

  test('desactivar la col·lecció buida el canvas', async ({ page }) => {
    await freshIndex(page);
    await page.route('**/wikidata.org/**', route => route.fulfill({ status: 200, body: '{"entities":{}}', contentType: 'application/json' }));
    const btn = page.locator('[data-col="filosofs"]');
    await btn.click();
    await expect(page.locator('#barsLayer .bar')).toHaveCount({ minimum: 1 }, { timeout: 5000 });
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
    // Prepara un estat desat amb la col·lecció de filòsofs activa
    await page.goto(INDEX);
    await page.evaluate(() => {
      const saved = {
        v: 1, pinned: [], collections: ['filosofs'], marcs: [],
        showEvents: true, focus: null, extraPeople: [],
        view: { px: 2, left: 0 }
      };
      localStorage.setItem('historiabasica.state.v1', JSON.stringify(saved));
    });
    // Entra en mode personatge
    await page.evaluate((q) => {
      localStorage.setItem('hb_view_person', JSON.stringify({
        qid: q, name: 'Aristòtil', birth: -384, death: -322, img: null, desc: 'filòsof grec'
      }));
    }, 'Q868');
    await page.goto('/index.html?person=Q868');
    // Surt del mode
    await page.locator('#personbar .pback').click();
    // La col·lecció ha de quedar activada
    await expect(page.locator('[data-col="filosofs"].on')).toBeVisible({ timeout: 3000 });
  });

  test('QID invàlid no trenca la pàgina', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/index.html?person=invalid-qid');
    await expect(page.locator('#scroll')).toBeAttached();
    expect(errors).toHaveLength(0);
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
    // Prepara un estat a l'index (col·lecció activa)
    await page.goto(INDEX);
    await page.evaluate(() => {
      localStorage.setItem('historiabasica.state.v1', JSON.stringify({
        v: 1, pinned: [], collections: ['filosofs'], marcs: [],
        showEvents: true, focus: null, extraPeople: [], view: { px: 2, left: 0 }
      }));
    });
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
    // La col·lecció ha de seguir activa
    await expect(page.locator('[data-col="filosofs"].on')).toBeVisible({ timeout: 3000 });
  });
});
