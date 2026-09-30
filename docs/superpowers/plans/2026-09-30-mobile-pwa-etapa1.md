# F4H Mobile + PWA — Etapa 1 (Base) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** F4H instalable en el iPhone como PWA y usable en pantalla chica: barra inferior, hojas "Nuevo"/"Más", todas las secciones en una columna sin cortes, campos de 16px, tocables de 44px, y `--text-3` más legible en todo el sistema.

**Architecture:** Una sola capa CSS al final del `<style>` de `F4H_Sistema_Beta_v6.html`, detrás de una media query única (vertical + horizontal), que pisa los inline styles de las render functions con selectores de atributo + `!important` acotados a `.app`. La navegación mobile es HTML estático (barra) + una función `mSheet()` que arma hojas con inline styles. La PWA suma `manifest.json`, `sw.js` (network-first, solo shell, solo mismo origen) e íconos generados con Playwright desde una plantilla HTML.

**Tech Stack:** HTML/CSS/JS vanilla (monolito), Supabase JS v2 (sin cambios), Vercel estático, `playwright-cli` 0.1.22 para verificación, detector de Impeccable 4.4.0.

**Spec:** `docs/superpowers/specs/2026-09-30-mobile-pwa-design.md` (leer entera, incluido el Anexo A).

## Global Constraints

- Breakpoint único, literal: `(max-width: 760px), (pointer: coarse) and (max-height: 500px)`.
- Por encima del breakpoint / con mouse: **el escritorio se ve exactamente igual** que hoy (única excepción: `--text-3`).
- `--text-3: #7a7a7a` en todo el sistema (era `#555`).
- Barra inferior, en este orden: **Inicio · Agenda · (+) Nuevo · Sesiones · Más**.
- Hoja "Más": Tatuajes, Inventario, Movimientos, Activos, Egresos, Config, Cerrar sesión.
- Campos `input/select/textarea` en mobile: `font-size:16px`. Tocables en mobile: ≥ 44px. Texto visible en mobile: ≥ 11px.
- Service worker: solo shell, **network-first**, **nunca** intercepta otros orígenes (Supabase, jsdelivr, Google Fonts). Caché `f4h-shell-v1`.
- Ícono: trazo de `logo-v2-trim.png` en **negro** sobre **`#c8a96e`**.
- Reglas de CLAUDE.md: no modularizar más allá de `F4H_Sistema_Beta_v6.html` + `js/db.js` (archivos estáticos de PWA y de tests son la excepción aprobada en la spec); inline styles en HTML generado por JS; concatenación de strings (no template literals) dentro de `.map()`; `localStorage` key `siget_f4h_v6` no se toca.
- No se escriben datos en el tenant real durante las pruebas (solo navegar, abrir formularios y cerrarlos sin guardar).
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` al final.

## Review Focus

1. **Girar el teléfono o redimensionar con una hoja abierta:** la hoja se cierra y el layout cambia sin quedar a medias. → Task 3 (test: `go()` y el cambio de media query cierran la hoja).
2. **Formularios abiertos** (Nueva sesión, tarjeta de edición de producto, alta de producto con Aguja): nada se sale del ancho de pantalla. → Task 4 (el test de desborde abre esos formularios).
3. **El contenido de abajo queda tapado por la barra inferior** (último botón de un formulario). → Task 4 (test: `padding-bottom` de `.app` ≥ alto de `.mnav`).
4. **Después de un deploy, la app instalada muestra la versión vieja.** → Task 6 (test: `sw.js` es network-first y Vercel lo sirve con `Cache-Control: no-cache`).
5. **El service worker cachea respuestas de Supabase** (datos viejos o de otra cuenta). → Task 6 (test: todas las entradas de la caché son del mismo origen).

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `F4H_Sistema_Beta_v6.html` | Modificar | Metas PWA en `<head>`; bloque CSS `/* ── Mobile ── */`; `--text-3`; HTML de `.mnav` y `#msheet`; `isMobile`, `mSheet*`, sync en `go()`; `data-turnos` en celdas del calendario; registro del SW |
| `manifest.json` | Crear | Manifest de la PWA |
| `sw.js` | Crear | Service worker network-first del shell |
| `icons/fuente.html` | Crear | Plantilla para generar los íconos (logo negro sobre dorado) |
| `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-512-maskable.png`, `icons/apple-touch-icon.png` | Crear (generados) | Íconos |
| `vercel.json` | Modificar | Headers de `sw.js` y `manifest.json` |
| `tests/mobile/serve.js` | Crear | Servidor estático local (puerto 8934) igual a Vercel: `/` → HTML |
| `tests/mobile/checks.js` | Crear | Chequeos que corren dentro de la página vía `playwright-cli eval`, agrupados |
| `tests/mobile/run.sh` | Crear | Corre grupos de chequeos en un viewport y sale ≠0 si falla alguno |
| `tests/mobile/landscape.sh` | Crear | Verifica el breakpoint con iPhone acostado (emulación de dispositivo) |
| `CLAUDE.md` | Modificar | Sección Mobile/PWA y cómo correr los tests |

---

### Task 1: Arnés de pruebas mobile

**Files:**
- Create: `tests/mobile/serve.js`, `tests/mobile/checks.js`, `tests/mobile/run.sh`

**Interfaces:**
- Produces: `node tests/mobile/serve.js` (sirve el repo en `http://localhost:8934`); `sh tests/mobile/run.sh <mobile|desktop> <grupo...>` imprime JSON `{ok, fails:[...]}` y sale 1 si `ok` es false; `tests/mobile/checks.js` es **una sola expresión** `async (groups) => {...}` con un registro `G` de grupos. Cada task siguiente agrega su grupo a `G`.

- [ ] **Step 1: Crear el servidor local**

`tests/mobile/serve.js`:

```js
// Servidor estático para probar F4H en local igual que Vercel (/ → F4H_Sistema_Beta_v6.html).
// Uso: node tests/mobile/serve.js   → http://localhost:8934
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/') u = '/F4H_Sistema_Beta_v6.html';
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const type = u === '/manifest.json' ? 'application/manifest+json' : (TYPES[path.extname(f)] || 'application/octet-stream');
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(d);
  });
}).listen(8934, () => console.log('F4H local en http://localhost:8934'));
```

- [ ] **Step 2: Crear `checks.js` con el grupo `desktop` y los helpers**

`tests/mobile/checks.js` (una sola expresión; `run.sh` la envuelve):

```js
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
```

- [ ] **Step 3: Crear `run.sh`**

`tests/mobile/run.sh`:

```sh
#!/bin/sh
# Uso: sh tests/mobile/run.sh <mobile|desktop> <grupo> [grupo...]
# Requiere: `node tests/mobile/serve.js` corriendo y la sesión playwright `f4h`
# abierta en http://localhost:8934 con login hecho (ver CLAUDE.md → Mobile).
set -e
VP=$1; shift
case "$VP" in
  mobile)  W=390;  H=844 ;;
  desktop) W=1440; H=900 ;;
  *) echo "viewport: mobile | desktop"; exit 2 ;;
esac
DIR=$(dirname "$0")
GRUPOS=$(node -e 'console.log(JSON.stringify(process.argv.slice(1)))' "$@")
FN=$(cat "$DIR/checks.js")
playwright-cli -s=f4h resize $W $H >/dev/null 2>&1
playwright-cli -s=f4h reload >/dev/null 2>&1
sleep 5
OUT=$(playwright-cli -s=f4h eval "async () => (${FN})(${GRUPOS})" --raw 2>/dev/null)
echo "$OUT"
echo "$OUT" | grep -q '"ok": *true'
```

- [ ] **Step 4: Levantar el servidor y la sesión (paso humano: login)**

```bash
node tests/mobile/serve.js &        # o en otra terminal / en background
playwright-cli -s=f4h open http://localhost:8934 --browser chrome --headed --persistent
```

**Francesco inicia sesión una vez en esa ventana** (la sesión de Supabase es por origen: la de `f4-h.vercel.app` no sirve para `localhost`). El agente nunca escribe la contraseña. Verificar:

```bash
playwright-cli -s=f4h eval "() => S.productos.length" --raw
```
Expected: un número > 0 (hoy 49).

- [ ] **Step 5: Correr el grupo `desktop` (debe pasar: es la línea base)**

Run: `sh tests/mobile/run.sh desktop desktop`
Expected: `"ok": true`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add tests/mobile/serve.js tests/mobile/checks.js tests/mobile/run.sh
git commit -m "test(mobile): arnés de verificación con playwright-cli

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Breakpoint, barra inferior y sincronización con `go()`

**Files:**
- Modify: `F4H_Sistema_Beta_v6.html` — `<style>` (antes de `</style>`, hoy línea ~219), HTML después de `</aside>` (hoy ~292), `function go(t)` (hoy ~610), bloque de helpers globales
- Modify: `tests/mobile/checks.js` (grupo `shell`)
- Create: `tests/mobile/landscape.sh`

**Interfaces:**
- Produces: `MQ_MOBILE` (MediaQueryList), `isMobile(): boolean`; HTML `.mnav` con 5 `button.mnav-item` que tienen `data-tabs="<tab>[,<tab>...]"`; `go(t)` marca `.mnav-item.on` cuando `data-tabs` incluye `t`. Los botones (+) y Más llaman `mOpenNuevo()` / `mOpenMas()` (definidas en Task 3; hasta entonces no existen y el click falla — por eso Task 3 va inmediatamente después).

- [ ] **Step 1: Escribir el grupo `shell` (falla)**

Agregar en `checks.js`, después de `G.desktop`:

```js
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
```

- [ ] **Step 2: Correr y ver que falla**

Run: `sh tests/mobile/run.sh mobile shell`
Expected: `"ok": false` con `sidebar visible en mobile`, `.mnav no visible`, `isMobile() no existe...`.

- [ ] **Step 3: Agregar el bloque CSS mobile (esqueleto + barra)**

Justo antes de `</style>`:

```css
/* ── Mobile (spec docs/superpowers/specs/2026-09-30-mobile-pwa-design.md) ─────
   Todo lo mobile vive en este bloque. Las render functions usan inline styles,
   por eso la capa pisa con selectores de atributo + !important acotados a .app.
   La media query debe ser idéntica a MQ_MOBILE en JS. */
.mnav{display:none}
@media (max-width: 760px), (pointer: coarse) and (max-height: 500px){
  .sidebar{display:none}
  .app{margin-left:0;padding:calc(10px + env(safe-area-inset-top)) 12px calc(84px + env(safe-area-inset-bottom))}
  .mnav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:200;background:#0a0908;border-top:1px solid #1e1e1e;padding:4px 4px env(safe-area-inset-bottom)}
  .mnav-item{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:56px;background:none;border:none;color:var(--text-2);font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .mnav-item .mnav-ic{font-size:18px;line-height:1}
  .mnav-item.on{color:var(--accent)}
  .mnav-plus .mnav-ic{width:40px;height:40px;border-radius:50%;background:var(--accent);color:#1a1200;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:300}
  .mnav-plus.on .mnav-ic{box-shadow:0 0 0 2px var(--bg),0 0 0 3px var(--accent)}
}
```

- [ ] **Step 4: Agregar el HTML de la barra**

Inmediatamente después de `</aside>` (antes de `<div class="app">`):

```html
<nav class="mnav" aria-label="Navegación">
  <button class="mnav-item" data-tabs="dash" onclick="go('dash')"><span class="mnav-ic">&#x25AA;</span>Inicio</button>
  <button class="mnav-item" data-tabs="agenda" onclick="go('agenda')"><span class="mnav-ic">&#x25A6;</span>Agenda</button>
  <button class="mnav-item mnav-plus" data-tabs="new" onclick="mOpenNuevo()" aria-label="Nuevo"><span class="mnav-ic">+</span>Nuevo</button>
  <button class="mnav-item" data-tabs="ses" onclick="go('ses')"><span class="mnav-ic">&#x25CE;</span>Sesiones</button>
  <button class="mnav-item" data-tabs="tattoos,inv,mov,act,egresos,cfg" onclick="mOpenMas()"><span class="mnav-ic">&#x22EF;</span>M&#xE1;s</button>
</nav>
<div id="msheet" style="display:none"></div>
```

- [ ] **Step 5: `isMobile` y sincronización en `go()`**

Arriba de `function go(t){` (sección `// ─── Navigation`):

```js
// Mobile: misma media query que el bloque CSS "Mobile". Ver spec mobile-pwa 1.1.
const MQ_MOBILE=matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 500px)');
function isMobile(){return MQ_MOBILE.matches;}
```

Dentro de `go(t)`, después de la línea que hace `document.querySelectorAll('.sidebar-item').forEach(...)`:

```js
  document.querySelectorAll('.mnav-item').forEach(function(b){b.classList.toggle('on',(b.dataset.tabs||'').split(',').includes(t));});
```

- [ ] **Step 6: Correr `shell` en mobile y `desktop` en escritorio**

Run: `sh tests/mobile/run.sh mobile shell && sh tests/mobile/run.sh desktop desktop`
Expected: ambos `"ok": true`.

- [ ] **Step 7: Verificación con iPhone acostado**

`tests/mobile/landscape.sh`:

```sh
#!/bin/sh
# iPhone 13 acostado (844x390, touch): la segunda condición del breakpoint debe activar mobile.
# No requiere login: el CSS aplica igual detrás de la pantalla de ingreso.
set -e
playwright-cli -s=f4hland open http://localhost:8934 --device "iphone 13 landscape" >/dev/null 2>&1 || true
sleep 3
OUT=$(playwright-cli -s=f4hland eval "() => ({ vw: innerWidth, vh: innerHeight, coarse: matchMedia('(pointer: coarse)').matches, sidebar: getComputedStyle(document.querySelector('.sidebar')).display, mnav: getComputedStyle(document.querySelector('.mnav')).display })" --raw 2>/dev/null)
playwright-cli -s=f4hland close >/dev/null 2>&1 || true
echo "$OUT"
echo "$OUT" | grep -q '"coarse": *false' && { echo "AVISO: la emulación no aplicó pointer:coarse; verificar acostado en el iPhone real"; exit 0; }
echo "$OUT" | grep -q '"sidebar": *"none"' && echo "$OUT" | grep -q '"mnav": *"flex"'
```

Run: `sh tests/mobile/landscape.sh`
Expected: `vw` 844 aprox., `sidebar: "none"`, `mnav: "flex"`, exit 0. Si imprime el AVISO, anotarlo para la prueba en el iPhone real (Task 7) y seguir.

- [ ] **Step 8: Commit**

```bash
git add F4H_Sistema_Beta_v6.html tests/mobile/checks.js tests/mobile/landscape.sh
git commit -m "feat(mobile): breakpoint único y barra inferior

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hojas inferiores "Nuevo" y "Más"

**Files:**
- Modify: `F4H_Sistema_Beta_v6.html` (helpers junto a `isMobile`; `go()`)
- Modify: `tests/mobile/checks.js` (grupo `sheets`)

**Interfaces:**
- Consumes: `#msheet`, `.mnav`, `MQ_MOBILE` (Task 2).
- Produces: `mSheet(title: string, items: {ic:string,label:string,act:string}[]): void` — `act` es código JS para `onclick`; `mSheetClose(): void`; `mOpenNuevo(): void`; `mOpenMas(): void`.

- [ ] **Step 1: Escribir el grupo `sheets` (falla)**

```js
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
```

- [ ] **Step 2: Correr y ver que falla**

Run: `sh tests/mobile/run.sh mobile sheets`
Expected: `"ok": false`, `mOpenNuevo/mOpenMas no existen`.

- [ ] **Step 3: Implementar las hojas**

Debajo de `function isMobile(){...}`:

```js
// Hojas inferiores (mobile). HTML generado → inline styles (regla de CLAUDE.md).
function mSheet(title,items){
  const el=document.getElementById('msheet');if(!el)return;
  el.innerHTML='<div onclick="if(event.target===this)mSheetClose()" style="position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.55);display:flex;align-items:flex-end">'
    +'<div role="dialog" aria-label="'+title+'" style="width:100%;background:var(--bg-card);border-top:1px solid var(--border);border-radius:16px 16px 0 0;padding:8px 10px calc(12px + env(safe-area-inset-bottom))">'
      +'<div style="width:36px;height:4px;border-radius:99px;background:var(--border-hover);margin:4px auto 10px"></div>'
      +'<div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3);padding:0 8px 6px">'+title+'</div>'
      +items.map(function(it){return '<button data-sheet-item onclick="mSheetClose();'+it.act+'" style="display:flex;align-items:center;gap:14px;width:100%;min-height:52px;padding:0 10px;background:none;border:none;border-radius:10px;color:var(--text);font-size:16px;font-family:inherit;text-align:left;cursor:pointer"><span style="width:26px;text-align:center;font-size:18px;color:var(--accent)">'+it.ic+'</span>'+it.label+'</button>';}).join('')
    +'</div></div>';
  el.style.display='block';
}
function mSheetClose(){const el=document.getElementById('msheet');if(el){el.style.display='none';el.innerHTML='';}}
function mOpenNuevo(){mSheet('Nuevo',[
  {ic:'&#x1F58B;',label:'Tatuaje',act:"tattooView='nuevo';go('tattoos')"},
  {ic:'&#x25CE;',label:'Sesi\xF3n',act:"go('ses');setSesView('nueva')"},
  {ic:'&#x1F4E6;',label:'Producto',act:"go('new')"},
  {ic:'&#x21C5;',label:'Movimiento (compra o salida)',act:"go('mov')"},
  {ic:'&#x2193;',label:'Egreso',act:"go('egresos')"}
]);}
function mOpenMas(){mSheet('M\xE1s',[
  {ic:'&#x2726;',label:'Tatuajes',act:"go('tattoos')"},
  {ic:'&#x2261;',label:'Inventario',act:"go('inv')"},
  {ic:'&#x21C5;',label:'Movimientos',act:"go('mov')"},
  {ic:'&#x25FB;',label:'Activos',act:"go('act')"},
  {ic:'&#x2193;',label:'Egresos',act:"go('egresos')"},
  {ic:'&#x2699;',label:'Config',act:"go('cfg')"},
  {ic:'&#x21AA;',label:'Cerrar sesi\xF3n',act:'doSignOut()'}
]);}
MQ_MOBILE.addEventListener('change',function(){mSheetClose();renderAll();});
```

Nota de alcance: la spec lista Tatuaje · Sesión · Producto · Egreso en "Nuevo"; se suma **Movimiento** porque "cargar una compra" es uno de los usos móviles confirmados (stock y compras) y hoy solo se llega por Movimientos.

En `go(t)`, primera línea del cuerpo:

```js
  mSheetClose();
```

- [ ] **Step 4: Correr `sheets` y `shell`**

Run: `sh tests/mobile/run.sh mobile shell sheets`
Expected: `"ok": true`.

- [ ] **Step 5: Commit**

```bash
git add F4H_Sistema_Beta_v6.html tests/mobile/checks.js
git commit -m "feat(mobile): hojas Nuevo y Más desde la barra inferior

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Capa responsive del contenido

**Files:**
- Modify: `F4H_Sistema_Beta_v6.html` — bloque CSS Mobile (dentro de la media query de Task 2); render del calendario (función que arma `cells`, hoy ~804)
- Modify: `tests/mobile/checks.js` (grupo `content`)

**Interfaces:**
- Consumes: bloque `@media` de Task 2.
- Produces: celdas del calendario con `data-turnos="N"` cuando el día tiene N>0 turnos (lo usa la etapa 2).

- [ ] **Step 1: Escribir el grupo `content` (falla)**

```js
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
    // Review Focus 3: la barra no tapa el final del contenido
    const pb = parseFloat(css(document.querySelector('.app'),'paddingBottom')), nh = document.querySelector('.mnav').getBoundingClientRect().height;
    if (pb < nh) f.push('padding-bottom de .app (' + pb + ') menor que la barra (' + nh + ')');
    // puntajes en filas de 5
    go('ses'); setSesView('nueva'); await sleep(200);
    const sc = [...document.querySelectorAll('#t-ses .sc-btn')].slice(0, 10).map(b => Math.round(b.getBoundingClientRect().top));
    if (sc.length === 10 && new Set(sc).size !== 2) f.push('puntajes 1–10 no quedan en 2 filas (filas: ' + new Set(sc).size + ')');
    return f;
  };
```

- [ ] **Step 2: Correr y ver que falla**

Run: `sh tests/mobile/run.sh mobile content`
Expected: `"ok": false` con desbordes en casi todas las secciones, campos < 16px y tocables < 44px.

- [ ] **Step 3: Agregar la capa de contenido**

Dentro de la media query de Task 2, después de las reglas de `.mnav`:

```css
  /* Grillas: 1 columna; métricas y auto-fit a 2; calendario 7 columnas que se achican */
  .app [style*="grid-template-columns"]{grid-template-columns:1fr!important}
  .app .g4,.app [style*="repeat(4,1fr)"],.app [style*="1fr 1fr 1fr 1fr"],.app [style*="auto-fit"]{grid-template-columns:1fr 1fr!important}
  .app [style*="repeat(7,1fr)"]{grid-template-columns:repeat(7,minmax(0,1fr))!important;gap:3px!important}
  .app [style*="grid-template-columns"]>*{min-width:0}
  /* Encabezados de módulo y tarjetas más compactos */
  .app [style*="font-size:38px"]{font-size:26px!important}
  .app [style*="padding:28px 0 24px"]{padding:6px 0 10px!important;margin-bottom:12px!important}
  .app [style*="padding:24px 28px"]{padding:16px!important}
  /* Tablas: scroll horizontal dentro de su tarjeta, primera columna fija */
  .app :has(> table){overflow-x:auto!important;-webkit-overflow-scrolling:touch}
  .app table{min-width:100%;width:max-content}
  .app th:first-child,.app td:first-child{position:sticky;left:0;z-index:1;background:var(--bg-card)}
  /* Campos a 16px (iOS no hace zoom) y tocables de 44px */
  .app input:not([type=checkbox]):not([type=radio]):not([type=file]),.app select,.app textarea,#auth-screen input{font-size:16px!important;min-height:44px}
  .app button,.app .btn{min-height:44px}
  .app .btn-xs{min-width:44px}
  /* Puntajes 1–10 en dos filas de 5 */
  .app div:has(> .sc-btn){display:grid!important;grid-template-columns:repeat(5,44px);gap:6px}
  .app .sc-btn{width:44px;height:44px}
  /* Texto mínimo 11px */
  .app [style*="font-size:9px"],.app [style*="font-size:10px"]{font-size:11px!important}
  /* Calendario (arreglo mínimo; el rediseño es la etapa 2): celdas bajas, sin chips, contador de turnos */
  .app [style*="min-height:108px"]{min-height:52px!important;padding:5px!important}
  .app [style*="min-height:108px"] [style*="text-overflow:ellipsis"],.app [style*="min-height:108px"] [style*="font-size:10px"]{display:none}
  .app [data-turnos]::after{content:attr(data-turnos);position:absolute;bottom:4px;right:4px;min-width:16px;height:16px;padding:0 4px;border-radius:99px;background:var(--accent);color:#1a1200;font-size:11px;font-weight:700;line-height:16px;text-align:center}
```

- [ ] **Step 4: `data-turnos` en la celda del calendario**

En la función que arma `cells` (línea que empieza `cells+='<div title="'+titleTxt...`), agregar el atributo al abrir el `<div>` de la celda. Reemplazar:

```js
    cells+='<div title="'+titleTxt.replace(/"/g,'&quot;')+'" onclick=
```

por:

```js
    cells+='<div title="'+titleTxt.replace(/"/g,'&quot;')+'"'+(turnosDia.length?' data-turnos="'+turnosDia.length+'"':'')+' onclick=
```

(La celda ya tiene `position:relative` porque el punto rojo `avisoRojo` usa `position:absolute`; verificar en el `style` de la celda y, si no está, agregar `position:relative;` al inicio de ese `style`.)

- [ ] **Step 5: Correr `content`; corregir lo que quede puntualmente**

Run: `sh tests/mobile/run.sh mobile content`
Expected: `"ok": true`. Si quedan fallas, son casos puntuales que la capa genérica no cubre: corregirlos **con otra regla dentro del mismo bloque** (selector de atributo sobre el `style` exacto que muestra el test), nunca tocando tamaños en las render functions. Repetir hasta `ok`. Excepciones permitidas, que el test no debería marcar pero si lo hace se documentan en el commit: checkboxes (quedan fuera del chequeo) y elementos dentro de tablas con scroll (ya excluidos).

- [ ] **Step 6: Correr todo mobile + escritorio**

Run: `sh tests/mobile/run.sh mobile shell sheets content && sh tests/mobile/run.sh desktop desktop`
Expected: ambos `"ok": true`.

- [ ] **Step 7: Capturas antes/después de escritorio (sin regresiones)**

```bash
mkdir -p .playwright-cli/desk-despues
for t in dash agenda tattoos ses inv mov egresos act cfg new; do
  playwright-cli -s=f4h eval "() => { go('$t'); scrollTo(0,0); }" >/dev/null 2>&1; sleep 1
  playwright-cli -s=f4h screenshot --filename .playwright-cli/desk-despues/$t.png >/dev/null 2>&1
done
```
(con el viewport en 1440×900: `playwright-cli -s=f4h resize 1440 900`). Comparar a ojo contra la misma captura hecha con `git stash` del HTML (o contra `f4-h.vercel.app`): deben ser idénticas salvo el gris de `--text-3` (Task 5).

- [ ] **Step 8: Commit**

```bash
git add F4H_Sistema_Beta_v6.html tests/mobile/checks.js
git commit -m "feat(mobile): capa responsive — una columna, tablas con scroll, 16px y 44px

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `--text-3` más legible en todo el sistema

**Files:**
- Modify: `F4H_Sistema_Beta_v6.html` — `:root` (línea ~17) y los 3 `#555` literales (pantalla de ingreso y botón "Cerrar sesión")
- Modify: `tests/mobile/checks.js` (grupo `tokens`)

- [ ] **Step 1: Escribir el grupo `tokens` (falla)**

```js
  G.tokens = async () => {
    const f = [];
    const v = getComputedStyle(document.documentElement).getPropertyValue('--text-3').trim().toLowerCase();
    if (v !== '#7a7a7a') f.push('--text-3 es ' + v + ', esperaba #7a7a7a');
    const lit = [...document.querySelectorAll('[style*="#555"]')].length;
    if (lit) f.push(lit + ' elementos con #555 literal');
    return f;
  };
```

- [ ] **Step 2: Correr y ver que falla**

Run: `sh tests/mobile/run.sh desktop tokens`
Expected: `"ok": false`, `--text-3 es #555`.

- [ ] **Step 3: Cambiar el token y los literales**

En `:root`: `--text-3:#555;` → `--text-3:#7a7a7a;`

Reemplazar cada `#555` literal del archivo por `var(--text-3)` (hoy son 3: `#auth-loading` y los dos del botón `#nav-signout`, en `style` y en `onmouseout`). Verificar:

```bash
grep -n "#555" F4H_Sistema_Beta_v6.html
```
Expected: sin resultados.

- [ ] **Step 4: Correr `tokens` en los dos viewports**

Run: `sh tests/mobile/run.sh desktop desktop tokens && sh tests/mobile/run.sh mobile tokens`
Expected: ambos `"ok": true`.

- [ ] **Step 5: Commit**

```bash
git add F4H_Sistema_Beta_v6.html tests/mobile/checks.js
git commit -m "style: --text-3 pasa a #7a7a7a en todo el sistema (contraste 2,6→4,5:1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: PWA — manifest, íconos, service worker

**Files:**
- Create: `manifest.json`, `sw.js`, `icons/fuente.html`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-512-maskable.png`, `icons/apple-touch-icon.png`
- Modify: `F4H_Sistema_Beta_v6.html` (`<head>`; registro del SW al final del `<script>` principal, junto a `initAuthUI();`), `vercel.json`
- Modify: `tests/mobile/checks.js` (grupo `pwa`)

**Interfaces:**
- Produces: caché `f4h-shell-v1`; `sw.js` con marcador de estrategia en un comentario `// estrategia: network-first` (lo lee el test).

- [ ] **Step 1: Escribir el grupo `pwa` (falla)**

```js
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
    if (await caches.has('f4h-shell-v1')) {
      const keys = await (await caches.open('f4h-shell-v1')).keys();
      const ajenas = keys.filter(k => new URL(k.url).origin !== location.origin);
      if (ajenas.length) f.push('la caché tiene ' + ajenas.length + ' respuestas de otros orígenes (ej. ' + ajenas[0].url + ')');
      if (!keys.some(k => new URL(k.url).pathname === '/js/db.js')) f.push('la caché no tiene /js/db.js');
    } else f.push('no existe la caché f4h-shell-v1');
    return f;
  };
```

- [ ] **Step 2: Correr y ver que falla**

Run: `sh tests/mobile/run.sh mobile pwa`
Expected: `"ok": false`, `falta <link rel=manifest>`.

- [ ] **Step 3: Plantilla y generación de íconos**

Revisar el logo: `logo-v2-trim.png` es trazo oscuro sobre transparente (en la barra lateral se usa con `filter:invert(1)`). Para que quede **negro puro** sobre dorado se usa `filter:brightness(0)`.

`icons/fuente.html`:

```html
<!doctype html>
<!-- Plantilla para generar los íconos de la PWA (ver Task 6 del plan mobile etapa 1).
     ?m=1 → versión maskable: el logo ocupa menos para quedar dentro de la zona segura (80%). -->
<html><head><meta charset="utf-8"><style>
html,body{margin:0;width:100vw;height:100vh;background:#c8a96e;display:flex;align-items:center;justify-content:center;overflow:hidden}
img{width:74vw;height:auto;filter:brightness(0)}
body.m img{width:56vw}
</style></head>
<body><img src="../logo-v2-trim.png" alt="">
<script>if(location.search.includes('m=1'))document.body.className='m';</script>
</body></html>
```

Generar (con `node tests/mobile/serve.js` corriendo):

```bash
playwright-cli -s=icon open "http://localhost:8934/icons/fuente.html" --browser chrome >/dev/null 2>&1
for s in 512 192 180; do
  playwright-cli -s=icon resize $s $s >/dev/null 2>&1; sleep 1
  case $s in 512) n=icon-512;; 192) n=icon-192;; 180) n=apple-touch-icon;; esac
  playwright-cli -s=icon screenshot --filename icons/$n.png --type png >/dev/null 2>&1
done
playwright-cli -s=icon goto "http://localhost:8934/icons/fuente.html?m=1" >/dev/null 2>&1
playwright-cli -s=icon resize 512 512 >/dev/null 2>&1; sleep 1
playwright-cli -s=icon screenshot --filename icons/icon-512-maskable.png --type png >/dev/null 2>&1
playwright-cli -s=icon close >/dev/null 2>&1
node -e "for(const f of ['icon-192','icon-512','icon-512-maskable','apple-touch-icon']){const b=require('fs').readFileSync('icons/'+f+'.png');console.log(f,b.readUInt32BE(16)+'x'+b.readUInt32BE(20))}"
```
Expected: `icon-192 192x192`, `icon-512 512x512`, `icon-512-maskable 512x512`, `apple-touch-icon 180x180`. Abrir `icons/icon-512.png` y confirmar a ojo: trazo F4H negro, centrado, sobre dorado, sin bordes blancos.

- [ ] **Step 4: `manifest.json`**

```json
{
  "name": "F4H",
  "short_name": "F4H",
  "description": "Sistema de gestión del estudio F4H",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0f0f0f",
  "theme_color": "#0f0f0f",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 5: `sw.js`**

```js
// Service worker de F4H (spec mobile-pwa 1.4).
// estrategia: network-first — con señal siempre baja la versión nueva; sin señal usa la cacheada.
// Solo cachea el shell y SOLO del mismo origen: nunca toca Supabase, jsdelivr ni Google Fonts.
const CACHE = 'f4h-shell-v1';
const SHELL = ['/', '/F4H_Sistema_Beta_v6.html', '/js/db.js', '/logo-v2-trim.png',
  '/manifest.json', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('/')))
  );
});
```

- [ ] **Step 6: `<head>`, registro y `vercel.json`**

En `<head>`, reemplazar la línea del viewport y agregar debajo:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0f0f0f">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="F4H">
<link rel="manifest" href="/manifest.json">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">
```

Al final del `<script>` principal, después de `initAuthUI();`:

```js
if('serviceWorker' in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(e){console.warn('SW:',e);});});
```

`vercel.json` completo:

```json
{
  "rewrites": [
    { "source": "/", "destination": "/F4H_Sistema_Beta_v6.html" }
  ],
  "headers": [
    { "source": "/sw.js", "headers": [
      { "key": "Cache-Control", "value": "no-cache" },
      { "key": "Service-Worker-Allowed", "value": "/" }
    ] },
    { "source": "/manifest.json", "headers": [
      { "key": "Content-Type", "value": "application/manifest+json" }
    ] }
  ]
}
```

- [ ] **Step 7: Correr `pwa` (dos veces: la primera registra el SW, la segunda queda controlada)**

Run: `sh tests/mobile/run.sh mobile pwa; sh tests/mobile/run.sh mobile pwa`
Expected: la segunda corrida `"ok": true`.

- [ ] **Step 8: Todo junto, los dos viewports**

Run: `sh tests/mobile/run.sh mobile shell sheets content tokens pwa && sh tests/mobile/run.sh desktop desktop tokens pwa`
Expected: ambos `"ok": true`.

- [ ] **Step 9: Commit**

```bash
git add manifest.json sw.js icons/ vercel.json F4H_Sistema_Beta_v6.html tests/mobile/checks.js
git commit -m "feat(pwa): instalable — manifest, íconos negro sobre dorado y service worker network-first

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verificación final, documentación y preview para el iPhone

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Suite completa + iPhone acostado**

Run:
```bash
sh tests/mobile/run.sh mobile shell sheets content tokens pwa \
 && sh tests/mobile/run.sh desktop desktop tokens pwa \
 && sh tests/mobile/landscape.sh
```
Expected: todo `ok` / exit 0 (si `landscape.sh` avisa que no aplicó la emulación, queda para el iPhone real).

- [ ] **Step 2: Detector de Impeccable**

Run: `sh ~/.claude/skills/impeccable/scripts/impeccable detect --json F4H_Sistema_Beta_v6.html > .playwright-cli/detect-despues.json`
Expected: ningún hallazgo `low-contrast` sobre `#555`. Los `undersized-ui-text` de 10px pueden seguir apareciendo (el detector lee los inline styles; en mobile los corrige la capa CSS, en escritorio quedan como estaban por la regla de "escritorio igual"): anotarlos en el reporte, no corregirlos.

- [ ] **Step 3: Capturas mobile "después"**

```bash
playwright-cli -s=f4h resize 390 844 >/dev/null 2>&1
mkdir -p .playwright-cli/mobile-despues
for t in dash agenda tattoos ses inv mov egresos act cfg new; do
  playwright-cli -s=f4h eval "() => { go('$t'); scrollTo(0,0); }" >/dev/null 2>&1; sleep 1
  playwright-cli -s=f4h screenshot --filename .playwright-cli/mobile-despues/$t.png >/dev/null 2>&1
done
```
Revisar las 10 contra `.playwright-cli/mobile-antes/` y mostrárselas a Francesco (Dashboard, Agenda, Sesiones, Inventario como mínimo).

- [ ] **Step 4: Documentar en `CLAUDE.md`**

Agregar al final de "## Reglas de renderizado JS":

```markdown
- **Mobile / PWA** (2026-09-30, spec `docs/superpowers/specs/2026-09-30-mobile-pwa-design.md`):
  todo lo mobile vive en el bloque CSS `/* ── Mobile ── */` detrás de
  `(max-width: 760px), (pointer: coarse) and (max-height: 500px)` (la misma media query está en
  `MQ_MOBILE` / `isMobile()` en JS). La capa pisa inline styles con selectores de atributo +
  `!important` acotados a `.app`: **una render function nueva no necesita nada para verse bien
  en mobile** mientras use grillas/tablas comunes; si algo se sale, se agrega una regla al
  bloque, no se cambian tamaños en la render function. Barra inferior `.mnav` (HTML estático) y
  hojas `mSheet(title, items)` / `mOpenNuevo()` / `mOpenMas()`. En escritorio no cambia nada.
- **PWA:** `manifest.json`, `sw.js` (network-first, solo shell y solo mismo origen, caché
  `f4h-shell-v1` — subir la versión si se cambia la lista `SHELL`), íconos en `icons/`
  (regenerar desde `icons/fuente.html`, ver plan mobile etapa 1, Task 6).
- **Tests mobile:** `node tests/mobile/serve.js` + sesión `playwright-cli -s=f4h open
  http://localhost:8934 --browser chrome --headed --persistent` (login manual una vez) y
  `sh tests/mobile/run.sh <mobile|desktop> <grupos>`; grupos: `desktop shell sheets content
  tokens pwa`.
```

- [ ] **Step 5: Commit y push de la rama (preview de Vercel)**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md — capa mobile, PWA y tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin feature/mobile-pwa
```
Preview: `https://f4-h-git-feature-mobile-pwa-f4-h.vercel.app`. Verificar headers en el preview:

```bash
curl -sI https://f4-h-git-feature-mobile-pwa-f4-h.vercel.app/sw.js | grep -i cache-control
```
Expected: `cache-control: no-cache` (si el preview pide login de Vercel, verificarlo en producción después del merge).

- [ ] **Step 6: Prueba en el iPhone real (Francesco) — checklist**

Pasarle a Francesco esta lista para hacer en su iPhone 13 con el preview:

1. Abrir el link en **Safari** → Compartir → **Agregar a inicio**. El ícono es el F4H negro sobre dorado.
2. Abrir desde el ícono: pantalla completa, sin barra de Safari. **Iniciar sesión una vez** (la app instalada no comparte la sesión de Safari).
3. La barra de abajo no queda pegada a la barra de gestos; arriba, nada queda bajo el notch.
4. Tocar un campo (por ejemplo, en Nuevo → Producto): **no hace zoom**.
5. (+) y Más abren sus hojas; tocar afuera las cierra.
6. Recorrer las 10 secciones: nada cortado a la derecha; las tablas se deslizan de costado.
7. **Girar el teléfono**: sigue la barra de abajo (no aparece la barra lateral).
8. Modo avión: la app abre y muestra el aviso de solo lectura.

Lo que falle vuelve como hallazgo y se corrige en esta rama antes del merge. **El merge a `dev`/`main` lo pide Francesco** ("mergeá"), como en las ramas anteriores.
