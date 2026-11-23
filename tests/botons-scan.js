// Botons amb el text desbordat (23/11/2026). S'injecta a la pàgina i torna els controls VISIBLES
// (botons, enllaços amb pinta de botó, desplegables) on el text no hi cap: scrollWidth més gran que
// clientWidth. Va néixer de «Mostrar contexto», que en castellà sortia tallat a la fitxa.
//
// No compten els que retallen a posta amb «…» (text-overflow:ellipsis): els noms d'«A la vista» o de
// les col·leccions ja estan pensats per tallar-se. Si el que desborda és un fill amb ellipsis, tampoc.
//
// Torna una llista de {text, on, sobra}. Buida = tot hi cap.
(() => {
  const SEL = 'button, a.btn, a.mode, .dbtn, .btn, select, .chip';
  const fora = [];
  const visible = el => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  };
  const retallaAPosta = el => {
    if (getComputedStyle(el).textOverflow === 'ellipsis') return true;
    return [...el.querySelectorAll('*')].some(c => getComputedStyle(c).textOverflow === 'ellipsis');
  };
  const on = el => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 3; e = e.parentElement)
      parts.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''));
    return parts.join(' > ');
  };
  // Les insígnies posades a posta per fora (el comptador del comodí, position:absolute a right:-8px)
  // també fan créixer el scrollWidth: s'amaguen un moment per mesurar només el text.
  const mesura = el => {
    const abs = [...el.querySelectorAll('*')].filter(c => /absolute|fixed/.test(getComputedStyle(c).position));
    const abans = abs.map(c => c.style.display);
    abs.forEach(c => { c.style.display = 'none'; });
    const sobra = el.scrollWidth - el.clientWidth;
    abs.forEach((c, i) => { c.style.display = abans[i]; });
    return sobra;
  };
  for (const el of document.querySelectorAll(SEL)) {
    if (!visible(el) || retallaAPosta(el)) continue;
    const sobra = mesura(el);
    if (sobra > 1) fora.push({ text: (el.textContent || '').trim().slice(0, 40), on: on(el), sobra });
  }
  return fora;
})();
