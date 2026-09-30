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

  G.shell = async () => {
    const f = [];
    if (!matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 500px)').matches) f.push('la media query mobile no matchea en este viewport');
    if (typeof isMobile !== 'function' || !isMobile()) f.push('isMobile() no existe o da false');
    if (css(document.querySelector('.sidebar'),'display') !== 'none') f.push('sidebar visible en mobile');
    if (css(document.querySelector('.app'),'marginLeft') !== '0px') f.push('.app conserva margin-left');
    const nav = document.querySelector('.mnav');
    if (!nav || css(nav,'display') !== 'flex') { f.push('.mnav no visible'); return f; }
    const items = [...nav.querySelectorAll('.mnav-item')].map(b => b.innerText.trim().replace(/\s+/g,' '));
    const want = ['Inicio','Agenda','Nuevo','Sesiones','Más'];
    want.forEach((w, i) => { if (!(items[i] || '').endsWith(w)) f.push('ítem ' + i + ' es "' + items[i] + '", esperaba ' + w); });
    for (const [t, idx] of [['dash',0],['agenda',1],['ses',3],['inv',4],['cfg',4],['new',2]]) {
      go(t);
      const on = [...nav.querySelectorAll('.mnav-item')].findIndex(b => b.classList.contains('on'));
      if (on !== idx) f.push('go("' + t + '") marca el ítem ' + on + ', esperaba ' + idx);
    }
    [...nav.querySelectorAll('.mnav-item')].forEach(b => { if (b.getBoundingClientRect().height < 44) f.push('ítem de barra < 44px'); });
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
