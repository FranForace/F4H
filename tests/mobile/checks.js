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
    // lista → detalle: en escritorio los dos paneles lado a lado y sin "Volver"
    go('agenda'); AG.dia = today; AG.panel = 'dia'; await renderAgenda(); await sleep(150);
    const sp = document.querySelector('#t-agenda [data-msplit]');
    if (sp && (css(sp.children[0],'display') === 'none' || css(sp.children[1],'display') === 'none')) f.push('Agenda: un panel oculto en escritorio');
    const vb = document.querySelector('#t-agenda [data-monly]');
    if (vb && css(vb,'display') !== 'none') f.push('Agenda: "Volver" visible en escritorio');
    AG.dia = null; AG.panel = null;
    tattooView = 'lista'; selectedTattooId = (S.tatuajes[0] || {}).id || null; go('tattoos'); await sleep(150);
    const st = document.querySelector('#t-tattoos [data-msplit]');
    if (st && selectedTattooId && (css(st.children[0],'display') === 'none' || css(st.children[1],'display') === 'none')) f.push('Tatuajes: un panel oculto en escritorio');
    const tv = document.querySelector('#t-tattoos [data-monly]');
    if (tv && css(tv,'display') !== 'none') f.push('Tatuajes: "Volver" visible en escritorio');
    tattooView = 'lista'; selectedTattooId = null;
    fCat = []; fSt = ''; editingId = null; go('inv'); await sleep(120);
    const it = document.querySelector('#t-inv table');
    if (css(it.tHead,'display') === 'none' || css(it.tBodies[0].rows[0],'display') !== 'table-row') f.push('Inventario: dejó de ser tabla en escritorio');
    const th0 = document.querySelector('#t-inv thead th');
    if (!th0.dataset.sorted && css(th0,'color') !== 'rgb(136, 136, 136)') f.push('Inventario: encabezados no son #888 (' + css(th0,'color') + ')');
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

  G.pwa = async () => {
    const f = [];
    const link = document.querySelector('link[rel=manifest]');
    if (!link) return ['falta <link rel=manifest>'];
    const man = await fetch(link.href, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    if (!man) return ['manifest.json no carga o no es JSON'];
    if (man.name !== 'F4H' || man.display !== 'standalone' || man.start_url !== '/') f.push('manifest: name/display/start_url incorrectos');
    if (man.background_color !== '#0f0f0f' || man.theme_color !== '#0f0f0f') f.push('manifest: colores incorrectos');
    const dims = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i.naturalWidth + 'x' + i.naturalHeight); i.onerror = () => ok('ERROR'); i.src = src + '?t=' + Date.now(); });
    for (const ic of man.icons || []) { const d = await dims(ic.src); if (d !== ic.sizes) f.push('ícono ' + ic.src + ' mide ' + d + ', declara ' + ic.sizes); }
    if (!(man.icons || []).some(i => i.purpose === 'maskable')) f.push('sin ícono maskable');
    const ati = document.querySelector('link[rel=apple-touch-icon]');
    if (!ati || await dims(ati.href) !== '180x180') f.push('apple-touch-icon falta o no es 180x180');
    const vp = document.querySelector('meta[name=viewport]').content;
    if (!vp.includes('viewport-fit=cover')) f.push('viewport sin viewport-fit=cover');
    ['apple-mobile-web-app-capable','apple-mobile-web-app-status-bar-style','theme-color'].forEach(n => { if (!document.querySelector('meta[name="' + n + '"]')) f.push('falta meta ' + n); });
    const swText = await fetch('/sw.js', { cache: 'no-store' }).then(r => r.ok ? r.text() : '').catch(() => '');
    if (!swText.includes('estrategia: network-first')) f.push('sw.js no existe o no es network-first');
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.active) f.push('service worker no registrado/activo');
    if (!navigator.serviceWorker.controller) f.push('la página no está controlada por el SW (recargar una vez)');
    // Review Focus 5: la caché solo tiene cosas del mismo origen (nunca Supabase)
    if (await caches.has('f4h-shell-v2')) {
      const keys = await (await caches.open('f4h-shell-v2')).keys();
      const ajenas = keys.filter(k => new URL(k.url).origin !== location.origin);
      if (ajenas.length) f.push('la caché tiene ' + ajenas.length + ' respuestas de otros orígenes (ej. ' + ajenas[0].url + ')');
      if (!keys.some(k => new URL(k.url).pathname === '/js/db.js')) f.push('la caché no tiene /js/db.js');
      if (!keys.some(k => new URL(k.url).pathname.startsWith('/vendor/supabase-'))) f.push('la caché no tiene supabase-js (sin señal la app no abre)');
    } else f.push('no existe la caché f4h-shell-v2');
    return f;
  };

  // Hallazgos de la revisión final (Important #1–#6)
  const reglaMobile = (sel, txt) => [...document.styleSheets].some(s => { try { return [...s.cssRules].some(r => r.media && [...r.cssRules].some(x => x.selectorText && x.selectorText.includes(sel) && x.cssText.includes(txt))); } catch (e) { return false; } });
  G.fixes = async () => {
    const f = [];
    // #1 tocar un día del calendario (iOS dispara mouseover antes del click) no debe agrandar la celda
    go('agenda'); await sleep(300);
    const cell = document.querySelector('#t-agenda [onclick^="AG.dia"]');
    if (!cell) f.push('#1 no encontré celdas del calendario');
    else {
      const h0 = cell.getBoundingClientRect().height;
      cell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      const h1 = cell.getBoundingClientRect().height;
      if (h1 > h0 + 2) f.push('#1 mouseover agranda la celda del calendario (' + Math.round(h0) + '→' + Math.round(h1) + 'px)');
      cell.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    }
    // #2 el cambio de media query no re-renderiza (no borra formularios sin guardar)
    if (typeof onMqMobileChange !== 'function') f.push('#2 falta onMqMobileChange');
    else {
      go('ses'); setSesView('nueva'); await sleep(200);
      const hrs = document.getElementById('sf-hrs'); if (hrs) hrs.value = '7.5';
      mOpenMas(); onMqMobileChange();
      if (document.getElementById('sf-hrs') && document.getElementById('sf-hrs').value !== '7.5') f.push('#2 el cambio de media query borró lo escrito en Nueva sesión');
      if (css(document.getElementById('msheet'),'display') !== 'none') f.push('#2 el cambio de media query no cerró la hoja');
    }
    // #3 la hoja nunca es más alta que la pantalla y se puede deslizar
    mOpenMas(); await sleep(50);
    const dlg = document.querySelector('#msheet [role=dialog]');
    if (!dlg || css(dlg,'maxHeight') === 'none' || css(dlg,'overflowY') !== 'auto') f.push('#3 la hoja no tiene max-height/overflow-y:auto');
    mSheetClose();
    // #4 márgenes laterales respetan el notch acostado
    if (!reglaMobile('.app', 'safe-area-inset-left') || !reglaMobile('.mnav', 'safe-area-inset-left')) f.push('#4 .app/.mnav sin safe-area-inset-left/right');
    // #5 avisos de error/sin conexión debajo de la barra de estado
    if (!reglaMobile('#db-error-bar', 'safe-area-inset-top')) f.push('#5 avisos sin safe-area-inset-top');
    // #6 supabase-js servido desde el mismo origen (cacheable por el SW)
    const sb = [...document.scripts].find(s => /supabase/.test(s.src));
    if (!sb || new URL(sb.src).origin !== location.origin) f.push('#6 supabase-js no se sirve desde el mismo origen (' + (sb && sb.src) + ')');
    go('dash');
    return f;
  };

  G.sesion = async () => {
    const f = [];
    go('ses'); setSesView('nueva'); await sleep(250);
    const root = document.getElementById('t-ses');
    // .fgrid (Cliente | Zona) en una columna
    const g = root.querySelector('.fgrid');
    if (g && g.children.length > 1 && Math.round(g.children[0].getBoundingClientRect().top) === Math.round(g.children[1].getBoundingClientRect().top)) f.push('.fgrid sigue en 2 columnas');
    // el select de Zona tiene ancho usable
    const z = root.querySelector('select[id^="sf-"][id$="z"], select[id="sf-pz"]');
    if (!z || z.getBoundingClientRect().width < 150) f.push('select de Zona < 150px (' + (z ? Math.round(z.getBoundingClientRect().width) : 'no está') + ')');
    // fila de aguja: el select ocupa todo el ancho y cantidad/✕ bajan
    sfAddAguja(''); await sleep(80);
    const row = [...root.querySelectorAll('select')].find(s => (s.getAttribute('onchange') || '').startsWith('SF.agujas'));
    if (!row) f.push('no encontré la fila de aguja');
    else {
      const card = row.parentElement.getBoundingClientRect().width;
      if (row.getBoundingClientRect().width < card - 2) f.push('select de aguja no ocupa el ancho de la fila');
    }
    sfAddTec(''); await sleep(80);
    const tec = [...root.querySelectorAll('select')].find(s => (s.getAttribute('onchange') || '').startsWith('SF.tecnicas') && (s.getAttribute('onchange') || '').includes('.tec='));
    if (tec && tec.getBoundingClientRect().width < tec.parentElement.getBoundingClientRect().width - 2) f.push('select de técnica no ocupa el ancho de la fila');
    go('dash');
    return f;
  };

  G.agenda = async () => {
    const f = [];
    const split = () => document.querySelector('#t-agenda [data-msplit]');
    const shown = el => el && css(el,'display') !== 'none' && el.getBoundingClientRect().height > 0;
    go('agenda'); AG.dia = null; AG.panel = null; await renderAgenda(); await sleep(150);
    if (!split()) return ['falta data-msplit en la Agenda'];
    if (!shown(split().children[0])) f.push('calendario oculto sin día elegido');
    if (shown(split().children[1])) f.push('panel vacío ("Seleccioná un día") visible en mobile');
    scrollTo(0, 400);
    document.querySelector('#t-agenda [data-cal]').click(); await sleep(250);
    if (shown(split().children[0])) f.push('al abrir un día el calendario sigue visible');
    if (!shown(split().children[1])) f.push('al abrir un día no se ve el panel');
    if (scrollY > 5) f.push('al abrir un día no vuelve arriba (scrollY=' + scrollY + ')');
    const volver = document.querySelector('#t-agenda [data-monly]');
    if (!shown(volver)) f.push('no se ve "‹ Volver"');
    // Review Focus 1: desde un panel anidado, Volver va al día
    AG.panel = 'reglas'; await renderAgenda(); await sleep(150);
    document.querySelector('#t-agenda [data-monly]').click(); await sleep(250);
    if (!(AG.dia && AG.panel === 'dia')) f.push('Volver desde Reglas no vuelve al día (dia=' + AG.dia + ', panel=' + AG.panel + ')');
    document.querySelector('#t-agenda [data-monly]').click(); await sleep(250);
    if (AG.dia || AG.panel) f.push('Volver desde el día no vuelve al calendario');
    if (!shown(split().children[0])) f.push('después de Volver no se ve el calendario');
    go('dash');
    return f;
  };

  G.tatuajes = async () => {
    const f = [];
    const split = () => document.querySelector('#t-tattoos [data-msplit]');
    const shown = el => el && css(el,'display') !== 'none' && el.getBoundingClientRect().height > 0;
    tattooView = 'lista'; selectedTattooId = null; go('tattoos'); await sleep(150);
    if (!split()) return ['falta data-msplit en Tatuajes'];
    if (!shown(split().children[0])) f.push('lista oculta');
    if (shown(split().children[1])) f.push('placeholder "Seleccioná un proyecto" visible en mobile');
    const item = document.querySelector('#t-tattoos [onclick^="selectedTattooId="]');
    if (!item) return f.concat(['no hay tatuajes para probar']);
    scrollTo(0, 300); item.click(); await sleep(250);
    if (shown(split().children[0])) f.push('al abrir un tatuaje la lista sigue visible');
    if (!shown(split().children[1])) f.push('no se ve el detalle');
    if (scrollY > 5) f.push('al abrir un tatuaje no vuelve arriba (scrollY=' + scrollY + ')');
    const v = document.querySelector('#t-tattoos [data-monly]');
    if (!shown(v)) f.push('no se ve "‹ Volver"');
    else { v.click(); await sleep(200); if (selectedTattooId || !shown(split().children[0])) f.push('Volver no regresa a la lista'); }
    go('dash');
    return f;
  };

  G.inventario = async () => {
    const f = [];
    const check = async (nombre) => {
      await sleep(150);
      const t = document.querySelector('#t-inv table');
      if (css(t.tHead,'display') !== 'none') f.push(nombre + ': encabezado de tabla visible (no son tarjetas)');
      const rows = [...t.tBodies[0].rows].filter(vis);
      if (!rows.length) return;
      if (css(rows[0],'display') !== 'grid') f.push(nombre + ': las filas no son tarjetas (display ' + css(rows[0],'display') + ')');
      const sc = t.parentElement;
      if (sc.scrollWidth > sc.clientWidth + 1) f.push(nombre + ': las tarjetas desbordan a lo ancho (' + sc.scrollWidth + ' > ' + sc.clientWidth + ')');
      const lab = rows[0].querySelector('td[data-l]');
      if (!lab || getComputedStyle(lab, '::before').content.indexOf(lab.dataset.l) < 0) f.push(nombre + ': celdas sin etiqueta visible');
      if (lab && parseFloat(css(lab,'borderBottomWidth')) > 0) f.push(nombre + ': las celdas de la tarjeta conservan el borde de tabla');
      const lapiz = rows[0].querySelector('button');
      if (!lapiz || lapiz.getBoundingClientRect().height < 44 || lapiz.getBoundingClientRect().right > vw) f.push(nombre + ': lápiz de editar no tocable');
    };
    fCat = []; fSt = ''; editingId = null; go('inv'); await check('todos');
    // filtros en una sola fila con scroll horizontal
    const pills = [...document.querySelectorAll('#t-inv button')].filter(b => /^(Todos|Activos|Descartables|Consumibles|Agujas|OK|Bajo|Crítico)$/.test(b.innerText.trim()));
    if (new Set(pills.map(b => Math.round(b.getBoundingClientRect().top))).size > 1) f.push('los filtros ocupan más de una fila');
    toggleFCat('Aguja'); await check('agujas');
    const ag = S.productos.find(p => p.cat === 'Aguja' && p.activo !== false); editingId = ag ? ag.id : null; renderInv(); await check('edición');
    editingId = null; fCat = []; renderInv();
    go('dash');
    return f;
  };

  G.retoques = async () => {
    const f = [];
    // celdas con texto largo envuelven (Review Focus 5). Fila de prueba solo en DOM (no toca la base).
    for (const t of ['mov','egresos']) {
      go(t); await sleep(150);
      const tb = document.querySelector('#t-' + t + ' table tbody');
      if (tb && tb.rows[0]) { const r = tb.rows[0].cloneNode(true); r.cells[r.cells.length - 1].textContent = 'Referencia de prueba muy larga '.repeat(8); tb.prepend(r); await sleep(50); }
      const anchas = [...document.querySelectorAll('#t-' + t + ' td')].filter(vis).filter(td => td.getBoundingClientRect().width > vw * 0.8);
      if (anchas.length) f.push(t + ': ' + anchas.length + ' celdas más anchas que el 80% de la pantalla (ej. ' + label(anchas[0]) + ')');
    }
    // franja bajo la barra de estado (contenido no se ve detrás del reloj al scrollear)
    if (!reglaMobile('body::before', 'safe-area-inset-top')) f.push('falta la franja de la barra de estado');
    go('dash');
    return f;
  };

  // Hallazgos de la revisión final de etapas 2-3
  G.fixes23 = async () => {
    const f = [];
    // relleno alto fuera de los paneles: el scroll no puede quedar en 0 por recorte del navegador
    const pad = document.createElement('div'); pad.style.height = '4000px'; pad.id = 'test-pad';
    document.querySelector('.app').appendChild(pad);
    // #1 abrir un tatuaje con la lista scrolleada lleva el detalle arriba
    tattooView = 'lista'; selectedTattooId = null; go('tattoos'); await sleep(150);
    scrollTo(0, 600); document.querySelector('#t-tattoos [onclick^="selectedTattooId="]').click(); await sleep(250);
    if (scrollY > 5) f.push('#1 tatuaje: el detalle no vuelve arriba (scrollY=' + scrollY + ')');
    scrollTo(0, 600); document.querySelector('#t-tattoos [data-monly]').click(); await sleep(250);
    if (scrollY > 5) f.push('#1 tatuaje: Volver no vuelve arriba (scrollY=' + scrollY + ')');
    // #1 abrir un día con el calendario scrolleado
    go('agenda'); AG.dia = null; AG.panel = null; await renderAgenda(); await sleep(150);
    scrollTo(0, 600); document.querySelector('#t-agenda [data-cal]').click(); await sleep(300);
    if (scrollY > 5) f.push('#1 agenda: el día no vuelve arriba (scrollY=' + scrollY + ')');
    AG.dia = null; AG.panel = null;
    pad.remove();
    // #2 celdas sin salto de línea (bitácora) no se montan sobre la columna siguiente
    go('ses'); setSesView('bit'); await sleep(250);
    const td = [...document.querySelectorAll('#t-ses td[style*="nowrap"]')].find(x => !/max-width/.test(x.getAttribute('style')));
    if (!td) f.push('#2 no encontré celdas nowrap en la bitácora');
    else {
      td.textContent = 'Línea RL07 12 práctica 8.5V, Sombra M13 12 7V, Relleno CM15 12 9V';
      if (td.scrollWidth > td.clientWidth + 1) f.push('#2 celda nowrap desborda su columna (' + td.scrollWidth + ' > ' + td.clientWidth + ')');
    }
    go('dash');
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
