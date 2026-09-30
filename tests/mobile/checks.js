async (groups) => {
  // Chequeos de la spec mobile. Corren DENTRO de la página (playwright-cli eval).
  // Cada grupo devuelve una lista de fallas (strings). Vacía = pasa.
  const TABS = ['dash','agenda','tattoos','ses','inv','mov','egresos','act','cfg','new'];
  const vw = innerWidth;
  const css = (el, p) => getComputedStyle(el)[p];
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && css(el,'visibility') !== 'hidden'; };
  const label = el => ((el.innerText || el.value || el.getAttribute('onclick') || el.tagName) + '').trim().replace(/\s+/g,' ').slice(0, 30);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const G = {};

  G.desktop = async () => {
    const f = [];
    if (css(document.querySelector('.sidebar'),'display') === 'none') f.push('sidebar oculto en escritorio');
    if (css(document.querySelector('.app'),'marginLeft') !== '220px') f.push('.app sin margin-left 220px');
    const mnav = document.querySelector('.mnav');
    if (mnav && css(mnav,'display') !== 'none') f.push('.mnav visible en escritorio');
    return f;
  };

  const fails = [];
  for (const g of groups) {
    if (!G[g]) { fails.push('grupo desconocido: ' + g); continue; }
    try { (await G[g]()).forEach(x => fails.push(g + ': ' + x)); }
    catch (e) { fails.push(g + ': EXCEPCIÓN ' + e.message); }
  }
  go('dash');
  return { ok: fails.length === 0, vw, fails: fails.slice(0, 60), total: fails.length };
}
