# Logo Unificado (rollout 0/N del sistema de diseño) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el logo (`logo-v2.png`) funcione como parte del título de la app — más presente en el sidebar y en el header del Dashboard — sacando la marca de agua gigante y casi invisible del Dashboard, sin tocar ningún otro módulo todavía.

**Architecture:** Cambios de tamaño/posición en 2 lugares de `F4H_Sistema_Beta_v6.html`: el bloque `.sb-logo` del sidebar (agrandarlo un poco) y el header de `renderDash()` (reemplazar el watermark de 380px con filtro raro por un logo chico y nítido junto al título, con el mismo filtro `invert(1)` que ya usa el sidebar). Sin cambios de datos, sin funciones nuevas.

**Tech Stack:** HTML5 + CSS3 + JS vanilla (inline styles) — mismo stack que el resto del sistema.

**Spec:** `docs/superpowers/specs/2026-09-26-design-system.md` — sección 5 (Logo / marca).

## Global Constraints

- El archivo real (`logo-v2.png`) es una firma caligráfica "F4H" en tinta oscura sobre fondo transparente — **no** un ícono simple. `filter:invert(1)` es lo que la vuelve blanca y legible sobre el fondo oscuro del sistema; es necesario, no decorativo, y se mantiene en los dos lugares que toca este plan.
- No agregar texto "F4H" al lado de la imagen — la firma ya dice "F4H", duplicarlo en texto sería redundante. La presencia se gana con tamaño y ubicación, no con texto extra.
- Paleta/diseño sin cambios de lo ya acordado (ver spec, secciones 1 y 3) — este plan es específico de logo, no toca densidad ni transiciones.
- Alcance: **solo sidebar y Dashboard**. Extender el mismo tratamiento al header de cada módulo (Agenda, Tatuajes, etc.) es un rollout posterior — no se toca acá ningún otro `render*()`.
- No hay suite de tests automatizada — verificación por check de sintaxis (Node) + QA visual manual (mismo patrón que el resto de los planes de este proyecto). Nota: como en el rollout anterior, la verificación visual en navegador requiere loguearse con la cuenta de Supabase de Francesco — quien ejecute este plan sin esas credenciales debe decirlo explícitamente en vez de omitir el paso en silencio.

## Review Focus

- **Contraste del logo sobre `--bg-elevated`** (el Dashboard usa `--bg-elevated:#222` en sus stat-cards, no `--bg-card`) — confirmar que el logo blanco (invertido) se sigue viendo nítido ahí si termina cerca de esas cards, no solo sobre `--bg:#0f0f0f`.
- **Proporción del PNG:** el archivo no es cuadrado (es más ancho que alto, una firma horizontal) — si se fija solo `height` sin revisar el `width` resultante, en el sidebar (ancho fijo ~220px con padding) una versión más grande podría desbordar el contenedor o verse recortada.
- **El header del Dashboard ya tiene contenido real al lado** (kicker + título + subtítulo con conteo de tatuajes/sesiones) — el logo nuevo, más chico que el watermark viejo, no debería solaparse ni robarle legibilidad a ese texto.
- **Sidebar con la barra angosta:** el `.sb-logo` tiene `padding:18px 16px 14px` fijo — si el logo crece, confirmar que no choca contra el borde inferior (`border-bottom`) del bloque ni se ve apretado contra los bordes laterales.
- **Removed watermark no debe dejar hueco visual:** el header del Dashboard usaba `min-height:200px` pensado para lucir el watermark de 380px de alto — con el logo chico nuevo, ese alto mínimo probablemente ya no hace falta (o hace falta mucho menos); si se deja igual, puede quedar un espacio vacío raro arriba del Dashboard.

---

### Task 1: Logo más presente en el sidebar

**Files:**
- Modify: `F4H_Sistema_Beta_v6.html:244-246` (`.sb-logo` en `<aside class="sidebar">`)

**Interfaces:**
- Consumes: nada — es markup estático, no depende de `S` ni de ninguna función JS.
- Produces: nada que otra tarea consuma — Task 2 es un lugar completamente distinto del archivo.

- [ ] **Step 1: Agrandar el logo del sidebar**

Anchor — Old:
```html
<aside class="sidebar">
  <div class="sb-logo">
    <img src="logo-v2.png" style="height:38px;filter:invert(1);opacity:.9" alt="F4H">
  </div>
```

New:
```html
<aside class="sidebar">
  <div class="sb-logo">
    <img src="logo-v2.png" style="height:48px;width:auto;max-width:100%;filter:invert(1);opacity:.95" alt="F4H">
  </div>
```

`width:auto;max-width:100%` evita que la proporción horizontal del archivo real (más ancho que alto) desborde el `.sb-logo` (`padding:18px 16px 14px`, dentro de un sidebar de 220px) al agrandar la altura. Subir `opacity` de `.9` a `.95` le da un poco más de presencia sin llegar a opacidad plena (que se vería demasiado "cartel" al lado de los ítems de navegación, que son bastante más discretos).

- [ ] **Step 2: Verificar sintaxis**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('F4H_Sistema_Beta_v6.html','utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let ok = true;
scripts.forEach((s,i) => { try { new Function(s); } catch(e) { ok = false; console.log('Script block', i, 'ERROR:', e.message); } });
console.log(ok ? 'HTML script blocks: all valid' : 'HTML: FAILED');
"
```
Esperado: `HTML script blocks: all valid`. (Esta tarea no toca ningún `<script>`, así que este check debería pasar trivialmente — se corre igual por consistencia con el resto de los planes.)

- [ ] **Step 3: QA visual — Review Focus ítems 2 y 4**

Abrir la app, mirar el sidebar:
1. El logo se ve más grande pero no desborda el contenedor ni toca los bordes.
2. No queda apretado contra el `border-bottom` de `.sb-logo` ni contra los ítems de navegación de abajo.

Si no hay forma de loguearse (sin las credenciales de Francesco), decirlo explícitamente en el reporte de la tarea en vez de omitir este paso en silencio.

- [ ] **Step 4: Commit**

```bash
git add F4H_Sistema_Beta_v6.html
git commit -m "$(cat <<'EOF'
feat(ui): logo mas presente en el sidebar

Rollout de logo/marca de docs/superpowers/specs/2026-09-26-design-system.md
seccion 5: 38px -> 48px, manteniendo el filtro invert(1) (necesario, la
firma real es tinta oscura) y agregando width:auto;max-width:100% para
no desbordar el contenedor con la proporcion horizontal del archivo real.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Reemplazar el watermark del Dashboard por un logo chico junto al título

**Files:**
- Modify: `F4H_Sistema_Beta_v6.html:1049-1057` (header de `renderDash()`)

**Interfaces:**
- Consumes: `tatCurso`, `n` (ya calculados antes en `renderDash()`, sin cambios).
- Produces: nada que otra tarea consuma.

- [ ] **Step 1: Sacar el watermark grande, agregar el logo chico junto al título**

Anchor — Old:
```js
  document.getElementById('t-dash').innerHTML=`
    <div style="position:relative;padding:28px 0 24px;margin-bottom:24px;min-height:200px;display:flex;align-items:center">
      <img src="logo-v2.png" alt="F4H" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);height:380px;width:auto;filter:invert(1) sepia(0.4) saturate(1.8) hue-rotate(350deg) brightness(0.9);opacity:.7;pointer-events:none;z-index:0">
      <div style="position:relative;z-index:1">
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;margin-bottom:6px">Resumen general</div>
        <div style="font-size:38px;font-weight:800;color:var(--text);line-height:1.1;letter-spacing:-.02em;margin-bottom:6px">Dashboard</div>
        <div style="font-size:14px;color:var(--text-2)">${tatCurso.length} tatuaje${tatCurso.length!==1?'s':''} activo${tatCurso.length!==1?'s':''} \xB7 ${n} sesi\xF3n${n!==1?'es':''} registrada${n!==1?'s':''}</div>
      </div>
    </div>
```

New:
```js
  document.getElementById('t-dash').innerHTML=`
    <div style="padding:28px 0 24px;margin-bottom:24px;display:flex;align-items:center;gap:16px">
      <img src="logo-v2.png" alt="F4H" style="height:40px;width:auto;filter:invert(1);opacity:.85;flex-shrink:0">
      <div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.14em;color:var(--accent);text-transform:uppercase;margin-bottom:6px">Resumen general</div>
        <div style="font-size:38px;font-weight:800;color:var(--text);line-height:1.1;letter-spacing:-.02em;margin-bottom:6px">Dashboard</div>
        <div style="font-size:14px;color:var(--text-2)">${tatCurso.length} tatuaje${tatCurso.length!==1?'s':''} activo${tatCurso.length!==1?'s':''} \xB7 ${n} sesi\xF3n${n!==1?'es':''} registrada${n!==1?'s':''}</div>
      </div>
    </div>
```

Cambios puntuales y por qué:
- Se saca `position:relative` + `min-height:200px` del contenedor y `position:absolute`/`z-index` del logo — ya no hace falta superponer nada, el logo pasa a ser un elemento normal del layout (`display:flex;gap:16px`), como un ícono al lado del título en vez de un fondo.
- El filtro pasa de `invert(1) sepia(0.4) saturate(1.8) hue-rotate(350deg) brightness(0.9)` a simplemente `invert(1)` — el mismo tratamiento ya probado y legible del sidebar, sin el intento de teñido dorado que lo dejaba apagado.
- Tamaño: `height:40px` (más chico que el nuevo sidebar de 48px, para que no compita con el título de 38px al lado — quedan visualmente emparejados) en vez de 380px.
- `opacity:.85` en vez de `.7` — al ser mucho más chico y ya no competir con el texto del título (antes tenía que ser tenue para no tapar los stat-cards de abajo), puede verse más nítido.
- `flex-shrink:0` evita que el logo se achique si el texto del subtítulo es largo en una pantalla angosta.

- [ ] **Step 2: Verificar sintaxis**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('F4H_Sistema_Beta_v6.html','utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let ok = true;
scripts.forEach((s,i) => { try { new Function(s); } catch(e) { ok = false; console.log('Script block', i, 'ERROR:', e.message); } });
console.log(ok ? 'HTML script blocks: all valid' : 'HTML: FAILED');
"
```
Esperado: `HTML script blocks: all valid`.

- [ ] **Step 3: QA visual — Review Focus ítems 1, 3 y 5**

Abrir la app, ir al Dashboard:
1. El logo se ve blanco y nítido junto al título "Dashboard", sin el tinte apagado de antes.
2. No tapa ni se solapa con el kicker/título/subtítulo — quedan uno al lado del otro con aire.
3. No queda un hueco vacío raro arriba del Dashboard donde antes estaba centrado el watermark grande — el header debería verse compacto y natural, no como si le faltara algo.
4. Bajar la vista a los stat-cards (fondo `--bg-elevated`) y confirmar que el logo, aunque está arriba y no se superpone con ellas, sigue leyéndose bien en su propio contexto (fondo `--bg` del body).

Si no hay forma de loguearse (sin las credenciales de Francesco), decirlo explícitamente en el reporte de la tarea en vez de omitir este paso en silencio.

- [ ] **Step 4: Commit**

```bash
git add F4H_Sistema_Beta_v6.html
git commit -m "$(cat <<'EOF'
feat(ui): logo del Dashboard como parte del titulo, no watermark de fondo

Rollout de logo/marca de docs/superpowers/specs/2026-09-26-design-system.md
seccion 5: saca el watermark de 380px con filtro sepia/hue-rotate (quedaba
casi invisible) y pone un logo de 40px junto al titulo, con el mismo
invert(1) simple que ya usa el sidebar.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (hecho al escribir este plan)

- **Cobertura del spec:** sección 5 completa (sidebar + Dashboard) — el login (56px) queda explícitamente fuera, como dice el spec.
- **Placeholder scan:** sin TBD/TODO — cada valor (48px, 40px, opacities) tiene su razón escrita en el propio paso.
- **Consistencia de tipos:** no hay funciones ni interfaces nuevas entre tareas — son dos ediciones de markup/valores independientes entre sí, en partes distintas del archivo. Ninguna depende de la otra.
- **Review Focus:** las 5 líneas de arriba están cubiertas por los Steps de QA visual de cada tarea (ítems 2 y 4 en la Tarea 1; ítems 1, 3 y 5 en la Tarea 2). Sin suite automatizada en este repo, quedan como verificación manual explícita — mismo patrón que el resto de los planes del proyecto.
- **Nota de alcance:** este plan deliberadamente NO extiende el logo a los headers de Agenda/Tatuajes/etc. — el spec lo menciona como ideal a futuro (sección 5), pero solo el sidebar y el Dashboard fueron los que se mockearon y aprobaron en el brainstorming. Extenderlo a los demás módulos es un rollout aparte, a decidir con Francesco.
