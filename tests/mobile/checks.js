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
    // orden por columna: sigue funcionando y se ve igual (dorado + cursor de mano)
    go('inv'); await sleep(120);
    const th = document.querySelector('#t-inv thead th');
    if (th) {
      if (css(th,'cursor') !== 'pointer') f.push('encabezado ordenable sin cursor pointer');
      th.click(); await sleep(50);
      const th2 = document.querySelector('#t-inv thead th');
      if (!th2.dataset.sorted || css(th2,'color') !== 'rgb(200, 169, 110)') f.push('encabezado ordenado no queda en dorado');
      th2.click(); await sleep(50); document.querySelector('#t-inv thead th').click(); await sleep(50);
    }
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

  G.sheets = async () => {
    const f = [];
    const sh = () => document.getElementById('msheet');
    const open = () => sh() && css(sh(),'display') !== 'none';
    const items = () => [...sh().querySelectorAll('[data-sheet-item]')].map(b => b.innerText.trim().replace(/\s+/g,' '));
    if (typeof mOpenNuevo !== 'function' || typeof mOpenMas !== 'function') return ['mOpenNuevo/mOpenMas no existen'];
    mOpenNuevo(); await sleep(50);
    if (!open()) f.push('Nuevo no abre la hoja');
    const n = items(); ['Tatuaje','Sesión','Producto','Movimiento','Egreso'].forEach(w => { if (!n.some(x => x.includes(w))) f.push('Nuevo sin "' + w + '"'); });
    [...sh().querySelectorAll('[data-sheet-item]')].forEach(b => { if (b.getBoundingClientRect().height < 44) f.push('ítem de hoja < 44px'); });
    sh().firstElementChild.click(); await sleep(50);          // tocar el fondo oscuro
    if (open()) f.push('tocar afuera no cierra la hoja');
    mOpenMas(); await sleep(50);
    const m = items(); ['Tatuajes','Inventario','Movimientos','Activos','Egresos','Config','Cerrar sesión'].forEach(w => { if (!m.some(x => x.includes(w))) f.push('Más sin "' + w + '"'); });
    [...sh().querySelectorAll('[data-sheet-item]')].find(b => b.innerText.includes('Inventario')).click(); await sleep(50);
    if (curTab !== 'inv') f.push('Más → Inventario no navega (curTab=' + curTab + ')');
    if (open()) f.push('elegir una opción no cierra la hoja');
    mOpenNuevo(); await sleep(50); go('dash'); await sleep(50);
    if (open()) f.push('go() no cierra la hoja abierta');
    mOpenNuevo(); await sleep(50);
    [...sh().querySelectorAll('[data-sheet-item]')].find(b => b.innerText.includes('Sesión')).click(); await sleep(200);
    if (curTab !== 'ses' || sesView !== 'nueva') f.push('Nuevo → Sesión no abre el formulario (curTab=' + curTab + ', sesView=' + sesView + ')');
    go('dash');
    return f;
  };

  G.content = async () => {
    const f = [];
    const scrollerAncestor = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = css(p,'overflowX'); if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
    const scan = (nombre, root) => {
      // 1) nada se sale del ancho (salvo dentro de un contenedor con scroll propio)
      const out = [...root.querySelectorAll('*')].filter(el => vis(el) && el.getBoundingClientRect().right > vw + 1 && !scrollerAncestor(el));
      if (out.length) f.push(nombre + ': ' + out.length + ' elementos se salen (ej. ' + out.slice(0,2).map(label).join(' | ') + ')');
      // 2) campos a 16px
      const inp = [...root.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]),select,textarea')].filter(vis).filter(el => parseFloat(css(el,'fontSize')) < 16);
      if (inp.length) f.push(nombre + ': ' + inp.length + ' campos < 16px (ej. ' + label(inp[0]) + ')');
      // 3) tocables de 44px de alto
      const tap = [...root.querySelectorAll('button,select,.btn,input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden])')].filter(vis).filter(el => el.getBoundingClientRect().height < 44);
      if (tap.length) f.push(nombre + ': ' + tap.length + ' tocables < 44px (ej. ' + tap.slice(0,2).map(el => label(el) + ' ' + Math.round(el.getBoundingClientRect().height) + 'px').join(' | ') + ')');
      // 4) texto de al menos 11px
      const chico = [...root.querySelectorAll('*')].filter(el => vis(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(css(el,'fontSize')) < 11);
      if (chico.length) f.push(nombre + ': ' + chico.length + ' textos < 11px (ej. ' + label(chico[0]) + ')');
    };
    for (const t of TABS) { go(t); await sleep(120); scan(t, document.getElementById('t-' + t)); }
    // formularios abiertos (Review Focus 2)
    go('ses'); setSesView('nueva'); await sleep(200); scan('ses/nueva', document.getElementById('t-ses'));
    go('inv'); const ag = S.productos.find(p => p.cat === 'Aguja' && p.activo !== false); editingId = ag ? ag.id : null; renderInv(); await sleep(120); scan('inv/edición', document.getElementById('t-inv')); editingId = null;
    go('new'); const c = document.getElementById('np-cat'); c.value = 'Aguja'; toggleNewFields(); await sleep(80); scan('new/aguja', document.getElementById('t-new')); c.value = 'Activo'; toggleNewFields();
    // El orden por columna no debe reescribir el style de los <th> (rompe los selectores [style*=...])
    go('inv'); await sleep(120);
    const thMut = document.querySelectorAll('.app thead th[style*="cursor"]').length;
    if (thMut) f.push(thMut + ' <th> con style modificado por el orden de columnas');
    // Review Focus 3: la barra no tapa el final del contenido
    const pb = parseFloat(css(document.querySelector('.app'),'paddingBottom')), nh = document.querySelector('.mnav').getBoundingClientRect().height;
    if (pb < nh) f.push('padding-bottom de .app (' + pb + ') menor que la barra (' + nh + ')');
    // puntajes en filas de 5
    go('ses'); setSesView('nueva'); await sleep(200);
    const sc = [...document.querySelectorAll('#t-ses .sc-btn')].slice(0, 10).map(b => Math.round(b.getBoundingClientRect().top));
    if (sc.length === 10 && new Set(sc).size !== 2) f.push('puntajes 1–10 no quedan en 2 filas (filas: ' + new Set(sc).size + ')');
    return f;
  };

  G.tokens = async () => {
    const f = [];
    const v = getComputedStyle(document.documentElement).getPropertyValue('--text-3').trim().toLowerCase();
    if (v !== '#7a7a7a') f.push('--text-3 es ' + v + ', esperaba #7a7a7a');
    const lit = [...document.querySelectorAll('[style*="#555"]')].length;
    if (lit) f.push(lit + ' elementos con #555 literal');
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
