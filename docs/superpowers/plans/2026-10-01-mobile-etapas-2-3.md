# F4H Mobile — Etapas 2 y 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que las pantallas que la etapa 1 dejó "usables" queden cómodas en el celu: tarjeta de sesión, Agenda con el día a pantalla completa, Tatuajes lista → detalle, Inventario en tarjetas, y retoques generales.

**Architecture:** Igual que la etapa 1: todo lo de tamaño vive en el bloque CSS `/* ── Mobile ── */`. Lo nuevo es un patrón chico de **lista → detalle** por atributos: el contenedor de dos paneles lleva `data-msplit="lista|detalle"` y el botón "‹ Volver" lleva `data-monly` (oculto en escritorio). Las render functions solo agregan esos atributos y `data-l` (etiquetas de las tarjetas de Inventario); no cambian tamaños.

**Tech Stack:** HTML/CSS/JS vanilla (monolito), `playwright-cli` + `tests/mobile/` (arnés de la etapa 1).

**Spec:** `docs/superpowers/specs/2026-09-30-mobile-pwa-design.md` (secciones 3.2, 3.3, 3.4 y 4).

## Global Constraints

- Breakpoint: `(max-width: 760px), (pointer: coarse) and (max-height: 500px)` — sin cambios.
- **Escritorio igual que hoy.** Única corrección de escritorio permitida: los encabezados de la tabla de Inventario vuelven a `#888` (`--text-2`), como estaban antes de la etapa 1 (minor diferido de la revisión).
- Nada de escribir `el.style.*` desde JS sobre elementos con layout inline (CLAUDE.md, regla de etapa 1). Los estados se marcan con atributos `data-*`.
- HTML generado por JS: inline styles y concatenación de strings dentro de `.map()`.
- Las pruebas no guardan datos en el tenant real.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Rama `feature/mobile-etapas-2-3` desde `dev`. Preview → iPhone → "mergeá" de Francesco.

## Review Focus

1. **Volver de un panel anidado de la Agenda** (turno o reglas abiertos desde un día): "‹ Volver" lleva al panel del día, no al calendario ni a un bucle. → Task 2 (test).
2. **Abrir un tatuaje con la lista larga scrolleada**: el detalle aparece arriba, no fuera de pantalla. → Task 3 (test: `scrollY` 0 después de abrir).
3. **Escritorio**: los dos paneles (lista + detalle, calendario + panel) siguen lado a lado y "‹ Volver" no aparece. → Tasks 2 y 3 (grupo `desktop`).
4. **Tarjetas de Inventario con la tarjeta de edición abierta / filtros activos**: nada se sale y el lápiz sigue tocable. → Task 4 (test con `editingId` y con filtro Agujas).
5. **Referencias largas en Movimientos/Egresos**: las celdas envuelven y la tabla no se vuelve kilométrica. → Task 5 (test de ancho de celda).

---

## File Structure

| Archivo | Acción | Qué |
|---|---|---|
| `F4H_Sistema_Beta_v6.html` | Modificar | Reglas nuevas en el bloque Mobile; `data-msplit`/`data-monly` en Agenda y Tatuajes; `AGvolverMobile()`; `data-l` en celdas de Inventario; reglas globales chicas (`[data-monly]`, color de encabezados de Inventario) |
| `tests/mobile/checks.js` | Modificar | Grupos `sesion`, `agenda`, `tatuajes`, `inventario`, `retoques`; ampliar `desktop` |
| `CLAUDE.md` | Modificar | Patrón lista → detalle |

Requisitos para correr las pruebas: `node tests/mobile/serve.js` y la sesión `playwright-cli -s=f4h` abierta en `http://localhost:8934` (ya logueada desde la etapa 1).

---

### Task 1: Tarjeta de sesión cómoda (etapa 2)

**Files:** Modify `F4H_Sistema_Beta_v6.html` (bloque Mobile), `tests/mobile/checks.js` (grupo `sesion`)

- [ ] **Step 1: Grupo `sesion` (falla)**

```js
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
```

- [ ] **Step 2: Correr** — `sh tests/mobile/run.sh mobile sesion` → Expected: `"ok": false` (`.fgrid sigue en 2 columnas`, Zona < 150px, selects que no ocupan el ancho).

- [ ] **Step 3: Reglas** (dentro del bloque Mobile, al final):

```css
  /* Etapa 2 — tarjeta de sesión: formularios a 1 columna y filas de aguja/técnica en dos renglones */
  .app .fgrid{grid-template-columns:1fr!important}
  #t-ses [style*="display:flex;gap:6px;margin-bottom:6px;align-items:center"]{flex-wrap:wrap}
  #t-ses [style*="display:flex;gap:6px;margin-bottom:6px;align-items:center"]>select:first-child{flex:1 1 100%!important}
  #t-ses [style*="display:flex;gap:6px;margin-bottom:6px;align-items:center"]>select:first-child+select{flex:1 1 100%!important}
```

(En técnicas, la fila es `select técnica · select aguja · voltaje · V · ✕`: ambos selects a ancho completo, voltaje y ✕ en el renglón de abajo.)

- [ ] **Step 4: Correr** — `sh tests/mobile/run.sh mobile sesion content && sh tests/mobile/run.sh desktop desktop` → Expected: ambos `"ok": true`.

- [ ] **Step 5: Commit** — `feat(mobile): tarjeta de sesión cómoda — 1 columna y filas de aguja/técnica en dos renglones`

---

### Task 2: Agenda — el día a pantalla completa (etapa 2)

**Files:** Modify `F4H_Sistema_Beta_v6.html` (`renderAgenda`, onclick de la celda, CSS global y Mobile), `tests/mobile/checks.js` (grupos `agenda` y `desktop`)

**Interfaces:**
- Produces: atributos `data-msplit="lista|detalle"` (contenedor de 2 paneles) y `data-monly` (solo visible en mobile) — los usa Task 3. `AGvolverMobile(): void`.

- [ ] **Step 1: Grupo `agenda` (falla) y ampliación de `desktop`**

```js
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
```

En `G.desktop`, antes de `return f;`:

```js
    // lista → detalle: en escritorio los dos paneles lado a lado y sin "Volver"
    go('agenda'); AG.dia = today; AG.panel = 'dia'; await renderAgenda(); await sleep(150);
    const sp = document.querySelector('#t-agenda [data-msplit]');
    if (sp && (css(sp.children[0],'display') === 'none' || css(sp.children[1],'display') === 'none')) f.push('Agenda: un panel oculto en escritorio');
    const vb = document.querySelector('#t-agenda [data-monly]');
    if (vb && css(vb,'display') !== 'none') f.push('Agenda: "Volver" visible en escritorio');
    AG.dia = null; AG.panel = null;
```

- [ ] **Step 2: Correr** — `sh tests/mobile/run.sh mobile agenda` → Expected: `"ok": false`, `falta data-msplit en la Agenda`.

- [ ] **Step 3: Implementar**

`renderAgenda()` — reemplazar el armado del grid:

```js
  const det=!!(AG.dia||AG.panel==='reglas'||AG.panel==='turno');
  el.innerHTML=buildAgendaHeader()+buildAgendaCupos()
    +'<div data-msplit="'+(det?'detalle':'lista')+'" style="display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start">'
    +buildAgendaCalendario()
    +'<div><button data-monly class="btn btn-sm" onclick="AGvolverMobile()" style="margin-bottom:12px">&#x2039; Volver</button>'+buildAgendaPanel()+'</div>'
    +'</div>';
```

Debajo de `renderAgenda`:

```js
// Mobile: "‹ Volver" del panel. Desde turno/reglas de un día vuelve al día; si no, al calendario.
function AGvolverMobile(){
  if((AG.panel==='turno'||AG.panel==='reglas')&&AG.dia){AG.panel='dia';AGturnoForm=null;}
  else{AG.dia=null;AG.panel=null;AGturnoForm=null;}
  renderAgenda();scrollTo(0,0);
}
```

En la celda del calendario, al final del `onclick` (`...AGturnoForm=null;renderAgenda()`), agregar `;if(isMobile())scrollTo(0,0)`.

CSS **global** (junto a las reglas de TSORT, fuera de la media query):

```css
/* Lista → detalle (mobile): "Volver" solo existe en mobile */
[data-monly]{display:none!important}
```

CSS dentro del bloque Mobile:

```css
  /* Etapa 2 — lista → detalle: un panel a la vez */
  .app [data-monly]{display:inline-flex!important;align-items:center}
  .app [data-msplit="detalle"]>:first-child{display:none!important}
  .app [data-msplit="lista"]>:nth-child(2){display:none!important}
```

- [ ] **Step 4: Correr** — `sh tests/mobile/run.sh mobile agenda content fixes && sh tests/mobile/run.sh desktop desktop` → Expected: ambos `"ok": true`.

- [ ] **Step 5: Commit** — `feat(mobile): Agenda con el día a pantalla completa y Volver`

---

### Task 3: Tatuajes lista → detalle (etapa 3)

**Files:** Modify `F4H_Sistema_Beta_v6.html` (`renderTattoos`, onclick del ítem de `buildListaTattoos`), `tests/mobile/checks.js` (grupo `tatuajes` y `desktop`)

**Interfaces:** Consumes `data-msplit` / `data-monly` y sus reglas CSS (Task 2).

- [ ] **Step 1: Grupo `tatuajes` (falla) y ampliación de `desktop`**

```js
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
```

En `G.desktop`, antes de `return f;`:

```js
    tattooView = 'lista'; selectedTattooId = (S.tatuajes[0] || {}).id || null; go('tattoos'); await sleep(150);
    const st = document.querySelector('#t-tattoos [data-msplit]');
    if (st && selectedTattooId && (css(st.children[0],'display') === 'none' || css(st.children[1],'display') === 'none')) f.push('Tatuajes: un panel oculto en escritorio');
    const tv = document.querySelector('#t-tattoos [data-monly]');
    if (tv && css(tv,'display') !== 'none') f.push('Tatuajes: "Volver" visible en escritorio');
    tattooView = 'lista'; selectedTattooId = null;
```

- [ ] **Step 2: Correr** — `sh tests/mobile/run.sh mobile tatuajes` → Expected: `"ok": false`, `falta data-msplit en Tatuajes`.

- [ ] **Step 3: Implementar**

En `renderTattoos()`, reemplazar `'<div style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start">'` por:

```js
'<div data-msplit="'+(selectedTattooId?'detalle':'lista')+'" style="display:grid;grid-template-columns:300px 1fr;gap:16px;align-items:start">'
```

y `buildDetalleTattoo(selectedTattooId)` (dentro de esa misma expresión) por:

```js
'<div><button data-monly class="btn btn-sm" onclick="tattooView=\'lista\';selectedTattooId=null;renderTattoos();scrollTo(0,0)" style="margin-bottom:12px">&#x2039; Volver a la lista</button>'+buildDetalleTattoo(selectedTattooId)+'</div>'
```

En `buildListaTattoos()`, al final del `onclick` del ítem (`...tattooView=\'detalle\';renderTattoos()`), agregar `;if(isMobile())scrollTo(0,0)`.

- [ ] **Step 4: Correr** — `sh tests/mobile/run.sh mobile tatuajes content && sh tests/mobile/run.sh desktop desktop` → Expected: ambos `"ok": true`.

- [ ] **Step 5: Commit** — `feat(mobile): Tatuajes lista → detalle con Volver`

---

### Task 4: Inventario en tarjetas (etapa 3)

**Files:** Modify `F4H_Sistema_Beta_v6.html` (`renderInv`: `data-l` en las celdas; bloque Mobile), `tests/mobile/checks.js` (grupo `inventario`, `desktop`)

- [ ] **Step 1: Grupo `inventario` (falla) y ampliación de `desktop`**

```js
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
```

En `G.desktop`, antes de `return f;`:

```js
    fCat = []; fSt = ''; editingId = null; go('inv'); await sleep(120);
    const it = document.querySelector('#t-inv table');
    if (css(it.tHead,'display') === 'none' || css(it.tBodies[0].rows[0],'display') !== 'table-row') f.push('Inventario: dejó de ser tabla en escritorio');
    const th0 = document.querySelector('#t-inv thead th');
    if (!th0.dataset.sorted && css(th0,'color') !== 'rgb(136, 136, 136)') f.push('Inventario: encabezados no son #888 (' + css(th0,'color') + ')');
```

- [ ] **Step 2: Correr** — `sh tests/mobile/run.sh mobile inventario && sh tests/mobile/run.sh desktop desktop` → Expected: mobile `"ok": false` (encabezado visible, filas no son tarjetas, filtros en varias filas); desktop `"ok": false` (encabezados `rgb(122, 122, 122)`).

- [ ] **Step 3: `data-l` en las celdas de `renderInv`**

En la fila (`return '<tr style="border-bottom:1px solid var(--border);'+rowBg+'">'`), agregar el atributo a las celdas 2 a 6 (la 1 es el nombre, la 7 el lápiz):

```js
      +'<td data-l="Stock" style="padding:14px 18px;vertical-align:middle">'+stockCell+'</td>'
      +'<td data-l="M\xEDn." style="padding:14px 18px;vertical-align:middle;color:var(--text-2);font-size:14px">'+p.sm+'</td>'
      +'<td data-l="Estado" style="padding:14px 18px;vertical-align:middle">'+badge(st)+'</td>'
      +'<td data-l="Costo" style="padding:14px 18px;vertical-align:middle">'+cxuVal+'</td>'
      +'<td data-l="Usos / un." style="padding:14px 18px;vertical-align:middle;color:var(--text-3);font-size:14px">'+p.upu+'</td>'
```

- [ ] **Step 4: CSS**

Global (junto a TSORT), para devolver el `#888` en escritorio sin perder el dorado del ordenado:

```css
#t-inv thead th{color:var(--text-2)!important}
#t-inv thead th[data-sorted]{color:var(--accent)!important}
```

Dentro del bloque Mobile:

```css
  /* Etapa 3 — Inventario en tarjetas */
  #t-inv table{width:100%!important;min-width:0!important}
  #t-inv thead{display:none}
  #t-inv tbody tr{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 12px;padding:14px 16px}
  #t-inv tbody td{padding:0!important;position:static!important;background:none!important;min-width:0}
  #t-inv tbody td:first-child{grid-column:1 / 3}
  #t-inv tbody td:last-child{grid-column:3;grid-row:1;text-align:right}
  #t-inv tbody td[data-l]::before{content:attr(data-l);display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--text-3);margin-bottom:3px}
  /* Filtros en una sola fila que se desliza */
  #t-inv [style*="display:flex;gap:8px;align-items:center;flex-wrap:wrap"]{flex-wrap:nowrap!important;overflow-x:auto;width:100%;padding-bottom:4px;-webkit-overflow-scrolling:touch}
  #t-inv [style*="display:flex;gap:8px;align-items:center;flex-wrap:wrap"] [style*="display:flex;gap:4px"]{flex-wrap:nowrap!important}
  #t-inv [style*="display:flex;gap:8px;align-items:center;flex-wrap:wrap"] button{flex-shrink:0;white-space:nowrap}
```

- [ ] **Step 5: Correr** — `sh tests/mobile/run.sh mobile inventario content && sh tests/mobile/run.sh desktop desktop` → Expected: ambos `"ok": true`. Si el chequeo de filtros en una fila falla porque el contenedor de filtros no es exactamente ese `style`, ajustar el selector al `style` real que muestre el test (dentro del bloque Mobile).

- [ ] **Step 6: Commit** — `feat(mobile): Inventario en tarjetas y filtros en una fila`

---

### Task 5: Retoques (etapa 3)

**Files:** Modify `F4H_Sistema_Beta_v6.html` (bloque Mobile), `tests/mobile/checks.js` (grupo `retoques`)

- [ ] **Step 1: Grupo `retoques` (falla)**

```js
  G.retoques = async () => {
    const f = [];
    // celdas con texto largo envuelven (Review Focus 5)
    for (const t of ['mov','egresos']) {
      go(t); await sleep(150);
      const anchas = [...document.querySelectorAll('#t-' + t + ' td')].filter(vis).filter(td => td.getBoundingClientRect().width > vw * 0.8);
      if (anchas.length) f.push(t + ': ' + anchas.length + ' celdas más anchas que el 80% de la pantalla (ej. ' + label(anchas[0]) + ')');
    }
    // franja bajo la barra de estado (contenido no se ve detrás del reloj al scrollear)
    if (!reglaMobile('body::before', 'safe-area-inset-top')) f.push('falta la franja de la barra de estado');
    go('dash');
    return f;
  };
```

- [ ] **Step 2: Correr** — `sh tests/mobile/run.sh mobile retoques` → Expected: `"ok": false` (falta la franja; y celdas anchas si hay referencias largas — si no hay ninguna larga hoy, anotar en el ledger que ese caso se verifica con la regla y una referencia larga de prueba en DOM: ver Step 2b).

- [ ] **Step 2b: Si no hay celdas largas reales**, agregar dentro del grupo, antes del loop, una fila de prueba solo en DOM (no toca la base):

```js
    go('mov'); await sleep(150);
    const tb = document.querySelector('#t-mov tbody');
    if (tb && tb.rows[0]) { const r = tb.rows[0].cloneNode(true); r.cells[r.cells.length - 1].textContent = 'Referencia de prueba muy larga '.repeat(8); tb.prepend(r); }
```

(y no llamar `go('mov')` de nuevo antes de medir `mov`: medir `#t-mov` directamente en esa primera vuelta.)

- [ ] **Step 3: Reglas** (bloque Mobile):

```css
  /* Etapa 3 — retoques */
  .app td{max-width:70vw;white-space:normal;overflow-wrap:anywhere}
  body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top);background:var(--bg);z-index:250;pointer-events:none}
```

- [ ] **Step 4: Correr todo** — `sh tests/mobile/run.sh mobile shell sheets content tokens pwa fixes sesion agenda tatuajes inventario retoques && sh tests/mobile/run.sh desktop desktop tokens pwa && sh tests/mobile/landscape.sh` → Expected: todo `ok`.

- [ ] **Step 5: Commit** — `fix(mobile): celdas largas envuelven y franja bajo la barra de estado`

---

### Task 6: Verificación, documentación y preview

- [ ] **Step 1: Capturas mobile** de `ses` (nueva sesión con una aguja y una técnica agregadas, sin guardar), `agenda` (calendario y un día abierto), `tattoos` (lista y detalle), `inv` (tarjetas y filtros) en `.playwright-cli/etapa23/`; mostrarlas a Francesco.
- [ ] **Step 2: Escritorio sin regresiones**: capturas a 1440 de `agenda` (con un día abierto), `tattoos` (con detalle), `inv` y `ses`; comparar contra `f4-h.vercel.app`. Diferencia permitida: encabezados de Inventario en `#888`.
- [ ] **Step 3: Detector de Impeccable** sobre el HTML: sin hallazgos nuevos respecto de la etapa 1.
- [ ] **Step 4: CLAUDE.md** — agregar a la sección Mobile/PWA:

```markdown
  **Lista → detalle (etapas 2-3):** un contenedor de dos paneles lleva
  `data-msplit="lista|detalle"`; en mobile se ve un solo panel. El botón "‹ Volver" lleva
  `data-monly` (oculto en escritorio por una regla global). Usado en Agenda (`AGvolverMobile()`)
  y Tatuajes. Inventario en mobile son tarjetas: las celdas llevan `data-l="Etiqueta"` y la
  etiqueta sale por CSS (`td[data-l]::before`). Grupos de tests nuevos: `sesion agenda tatuajes
  inventario retoques`.
```

- [ ] **Step 5: Commit + push** de `feature/mobile-etapas-2-3`; preview `https://f4-h-git-feature-mobile-etapas-2-3-f4-h.vercel.app` para el iPhone. El merge lo pide Francesco.
