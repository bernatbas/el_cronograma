// Escàner de la pseudotraducció (?lang=xx). S'injecta a la pàgina i torna els textos VISIBLES
// que no han passat pel diccionari: amb ?lang=xx, t() embolica el que torna entre ⟦ ⟧ i L()
// entre ⟪ ⟫, així que qualsevol lletra de la pantalla que quedi fora de les marques és un
// text escrit a pinyó al codi, que en canviar d'idioma es quedaria en català.
//
// - Recorre els nodes de text en ordre del document i porta el compte de marques obertes:
//   una traducció pot portar HTML (⟦Fes <b>clic</b>⟧) i llavors la marca obre en un node i
//   tanca en un altre.
// - També mira els atributs que es veuen o es llegeixen: placeholder, title, aria-label, alt.
// - Ignora el que no té cap paraula (números, anys, símbols, emojis).
// - Els NOMS de persona i les dades de Wikidata no passen pel diccionari a propòsit: el que
//   porti data-i18n-skip (o hi sigui a dins) no compta.
//
// Torna una llista de {text, on}. Buida = tot passa pel diccionari.
(() => {
  const OBRE = /[⟦⟪]/g, TANCA = /[⟧⟫]/g;
  const PARAULA = /\p{L}{2,}/u;
  const fora = [];
  const on = el => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 3; e = e.parentElement) {
      parts.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
        (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''));
    }
    return parts.join(' > ');
  };
  const visible = el => {
    if (!el || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0;
  };
  const salta = el => !!(el && el.closest('script,style,noscript,[data-i18n-skip]'));

  // Text fora de marques. La profunditat es porta d'un node al següent.
  let fondaria = 0;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const el = n.parentElement;
    if (salta(el)) continue;
    let lliure = '';
    for (const ch of n.nodeValue) {
      if (OBRE.test(ch)) { fondaria++; OBRE.lastIndex = 0; continue; }
      if (TANCA.test(ch)) { fondaria = Math.max(0, fondaria - 1); TANCA.lastIndex = 0; continue; }
      if (fondaria === 0) lliure += ch;
    }
    lliure = lliure.replace(/\s+/g, ' ').trim();
    if (lliure && PARAULA.test(lliure) && visible(el)) fora.push({ text: lliure.slice(0, 80), on: on(el) });
  }

  // Atributs.
  for (const el of document.body.querySelectorAll('[placeholder],[title],[aria-label],img[alt]')) {
    if (salta(el)) continue;
    for (const a of ['placeholder', 'title', 'aria-label', 'alt']) {
      const v = el.getAttribute(a);
      if (!v || !PARAULA.test(v.replace(/⟦[^⟧]*⟧|⟪[^⟫]*⟫/g, ''))) continue;
      fora.push({ text: '[' + a + '] ' + v.slice(0, 70), on: on(el) });
    }
  }

  // Títol de la pestanya.
  if (PARAULA.test(document.title.replace(/⟦[^⟧]*⟧|⟪[^⟫]*⟫/g, '')))
    fora.push({ text: '[title] ' + document.title, on: 'head > title' });

  return fora;
})();
