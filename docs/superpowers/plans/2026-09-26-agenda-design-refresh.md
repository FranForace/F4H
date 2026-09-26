# Agenda Design Refresh (rollout 1/N del sistema de diseño) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar la escala de espaciado "Cómoda" y la transición estándar del sistema de diseño F4H a las celdas del calendario de la Agenda — el punto de mayor densidad de toda la app y el motivo original del pedido de Francesco.

**Architecture:** Cambios de valores en los `style` inline de `buildAgendaCalendario()` (celdas del calendario) dentro de `F4H_Sistema_Beta_v6.html`. Sin cambios de estructura de datos, sin funciones nuevas, sin tocar `js/db.js`. El hover se implementa con `onmouseover`/`onmouseout` seteando `style` directamente (mismo patrón ya usado en el botón "Cerrar sesión" del sidebar), no con clases CSS nuevas.

**Tech Stack:** HTML5 + CSS3 + JS vanilla (inline styles, sin frameworks) — mismo stack que el resto del sistema.

**Spec:** `docs/superpowers/specs/2026-09-26-design-system.md` — secciones 1 (espaciado/tipografía) y 3 (transición estándar). La sección 2 (imagen+info) y 4 (métricas) no aplican a la Agenda (no tiene fotos ni métricas tipo Dashboard) — quedan para los rollouts de Tatuajes y Dashboard respectivamente.

## Global Constraints

- Paleta de colores sin cambios: `--bg:#0f0f0f`, `--bg-card:#1a1a1a`, `--accent:#c8a96e`, `--border:#2e2e2e`, `--text:#f0f0ee`, `--text-2:#888`, `--text-3:#555`, `--green:#4a9a3a`, `--amber:#d4872a`, `--red:#e24b4a`.
- Render: inline styles, concatenación de strings dentro de `.map()` (no template literals anidados) — seguir el estilo exacto ya usado en `buildAgendaCalendario`.
- No modificar `js/db.js`, la estructura de `S`, ni ninguna función `AG*`/`db*` existente — solo los valores de `style` dentro del HTML generado por `buildAgendaCalendario`.
- No tocar Dashboard, Tatuajes, ni ningún otro módulo — ese es trabajo de rollouts posteriores, cada uno con su propio plan.
- No hay suite de tests automatizada en este repo (sin `package.json`, sin test runner) — la verificación es: check de sintaxis con Node (`new Function(...)` sobre el contenido del `<script>`) + QA manual en el navegador, mismo patrón usado en el plan de la Agenda original.
- Transición estándar del spec (sección 3): **sin movimiento** (nada de `transform`), **sin glow/box-shadow** — solo cambio de `background` y, donde no compita con un borde de estado ya existente, `border-left-color`.

## Review Focus

- **Mes de 6 semanas (ej. octubre 2026, que empieza miércoles):** con celdas más altas, la grilla de 6 filas no debería requerir mucho más scroll del que ya requería — verificar visualmente que sigue entrando razonablemente en una pantalla de escritorio estándar.
- **Nombres de cliente largos en los chips de turno:** el chip ya usa `text-overflow:ellipsis` — confirmar que sigue truncando en una sola línea a la tipografía nueva, sin desbordar el ancho de la celda ni pasar a dos líneas.
- **Día con 3 turnos + 2 sesiones sin turno (los topes actuales, `slice(0,3)`/`slice(0,2)`):** son hasta 5 líneas de texto en una celda — confirmar que la nueva altura mínima las contiene sin cortar contenido ni verse apretado otra vez.
- **El círculo dorado de "hoy" y el punto rojo de aviso (arriba a la derecha):** con la celda más grande y el tinte de hover nuevo, confirmar que ninguno de los dos pierde contraste o se superpone raro con el contenido.
- **Tinte de hover sobre celda abierta (fondo `--bg-card`) vs. cerrada (fondo `--bg`):** el mismo color de tinte tiene que leerse como "esto es interactivo" sobre los dos fondos base, no solo sobre uno.

---

### Task 1: Densidad "Cómoda" + hover en las celdas del calendario

**Files:**
- Modify: `F4H_Sistema_Beta_v6.html:698-753` (`buildAgendaCalendario`)

**Interfaces:**
- Consumes: `AG`, `AGgridRange`, `AGymd`, `AGaddMonths`, `AGcambiarMes`, `AGabrirReglas`, `S.turnos`, `S.sesiones`, `today`, `MESES`, `DIAS_SEM` — todo existente, sin cambios de firma.
- Produces: nada nuevo — la función sigue devolviendo el mismo string HTML, solo con valores de estilo distintos. Ningún otro archivo/función depende de los valores puntuales que cambian acá.

- [ ] **Step 1: Editar los valores de la celda del calendario**

Anchor — Old (líneas 698-736 de `buildAgendaCalendario`, el `while` que arma `cells`):
```js
function buildAgendaCalendario(){
  const mesKey=AG.mes;
  const [y,m]=mesKey.split('-').map(Number);
  const dias=AG.dias[mesKey]||{};
  const {start,end}=AGgridRange(mesKey);
  let cells='';
  const d=new Date(start);
  while(d<=end){
    const fecha=AGymd(d);
    const info=dias[fecha];
    const inMes=(d.getMonth()+1===m);
    const esHoy=fecha===today;
    const abierto=!!(info&&info.abierto);
    const turnosDia=S.turnos.filter(t=>t.fecha===fecha);
    const turnosActivos=(info&&info.turnos_activos)||0;
    const avisoRojo=!abierto&&turnosActivos>0;
    const sesionesSinTurno=fecha<today?S.sesiones.filter(s=>s.fecha===fecha&&!S.turnos.some(t=>t.sid===s.id)):[];
    const titleTxt=abierto?('Abierto por: '+(info.regla_motivo||'—')):((info&&info.regla_id)?('Cerrado por: '+(info.regla_motivo||'—')):'Cerrado (sin reglas)');
    const bg=abierto?'var(--bg-card)':'var(--bg)';
    const border=abierto?'1.5px solid var(--accent)':'1px solid var(--border)';
    const numColor=abierto?'var(--text)':'var(--text-3)';
    const numHtml=esHoy
      ?'<span style="font-size:11px;font-weight:700;color:#111;background:var(--accent);border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center">'+d.getDate()+'</span>'
      :'<span style="font-size:12px;font-weight:700;color:'+numColor+'">'+d.getDate()+'</span>';
    cells+='<div title="'+titleTxt.replace(/"/g,'&quot;')+'" onclick="AG.dia=\''+fecha+'\';AG.panel=\'dia\';AGturnoForm=null;renderAgenda()" style="min-height:86px;padding:6px 8px;border-radius:8px;background:'+bg+';border:'+border+';cursor:pointer;opacity:'+(inMes?'1':'.45')+';position:relative">'
      +(avisoRojo?'<span style="position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:var(--red)"></span>':'')
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+numHtml
      +(abierto&&info.hora_desde?'<span style="font-size:9px;color:var(--text-3)">'+info.hora_desde.slice(0,5)+'–'+(info.hora_hasta?info.hora_hasta.slice(0,5):'')+'</span>':'')
      +'</div>'
      +'<div style="display:flex;flex-direction:column;gap:2px">'
      +turnosDia.slice(0,3).map(t=>{
        const tachado=['Cancelado','No vino'].includes(t.estado);
        const color=t.estado==='Confirmado'?'var(--green)':t.estado==='Realizado'?'var(--text-3)':tachado?'var(--red)':'var(--amber)';
        return '<div style="font-size:9px;color:'+color+(tachado?';text-decoration:line-through':'')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(t.hora||'--:--')+' '+t.cli+'</div>';
      }).join('')
      +sesionesSinTurno.slice(0,2).map(s=>'<div style="font-size:9px;color:var(--text-3)">✓ '+(s.cliente||'—')+'</div>').join('')
      +'</div></div>';
    d.setDate(d.getDate()+1);
  }
```

New:
```js
function buildAgendaCalendario(){
  const mesKey=AG.mes;
  const [y,m]=mesKey.split('-').map(Number);
  const dias=AG.dias[mesKey]||{};
  const {start,end}=AGgridRange(mesKey);
  let cells='';
  const d=new Date(start);
  while(d<=end){
    const fecha=AGymd(d);
    const info=dias[fecha];
    const inMes=(d.getMonth()+1===m);
    const esHoy=fecha===today;
    const abierto=!!(info&&info.abierto);
    const turnosDia=S.turnos.filter(t=>t.fecha===fecha);
    const turnosActivos=(info&&info.turnos_activos)||0;
    const avisoRojo=!abierto&&turnosActivos>0;
    const sesionesSinTurno=fecha<today?S.sesiones.filter(s=>s.fecha===fecha&&!S.turnos.some(t=>t.sid===s.id)):[];
    const titleTxt=abierto?('Abierto por: '+(info.regla_motivo||'—')):((info&&info.regla_id)?('Cerrado por: '+(info.regla_motivo||'—')):'Cerrado (sin reglas)');
    const bg=abierto?'var(--bg-card)':'var(--bg)';
    const bgHover=abierto?'#22201a':'#1a1712';
    const border=abierto?'1.5px solid var(--accent)':'1px solid var(--border)';
    const numColor=abierto?'var(--text)':'var(--text-3)';
    const numHtml=esHoy
      ?'<span style="font-size:12px;font-weight:700;color:#111;background:var(--accent);border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center">'+d.getDate()+'</span>'
      :'<span style="font-size:13px;font-weight:700;color:'+numColor+'">'+d.getDate()+'</span>';
    cells+='<div title="'+titleTxt.replace(/"/g,'&quot;')+'" onclick="AG.dia=\''+fecha+'\';AG.panel=\'dia\';AGturnoForm=null;renderAgenda()" onmouseover="this.style.background=\''+bgHover+'\'" onmouseout="this.style.background=\''+bg+'\'" style="min-height:108px;padding:9px 10px;border-radius:8px;background:'+bg+';border:'+border+';cursor:pointer;opacity:'+(inMes?'1':'.45')+';position:relative;transition:background .15s ease">'
      +(avisoRojo?'<span style="position:absolute;top:8px;right:8px;width:6px;height:6px;border-radius:50%;background:var(--red)"></span>':'')
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+numHtml
      +(abierto&&info.hora_desde?'<span style="font-size:10px;color:var(--text-3)">'+info.hora_desde.slice(0,5)+'–'+(info.hora_hasta?info.hora_hasta.slice(0,5):'')+'</span>':'')
      +'</div>'
      +'<div style="display:flex;flex-direction:column;gap:3px">'
      +turnosDia.slice(0,3).map(t=>{
        const tachado=['Cancelado','No vino'].includes(t.estado);
        const color=t.estado==='Confirmado'?'var(--green)':t.estado==='Realizado'?'var(--text-3)':tachado?'var(--red)':'var(--amber)';
        return '<div style="font-size:10px;color:'+color+(tachado?';text-decoration:line-through':'')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(t.hora||'--:--')+' '+t.cli+'</div>';
      }).join('')
      +sesionesSinTurno.slice(0,2).map(s=>'<div style="font-size:10px;color:var(--text-3)">✓ '+(s.cliente||'—')+'</div>').join('')
      +'</div></div>';
    d.setDate(d.getDate()+1);
  }
```

**Nota de diseño (por qué estos valores y no los literales del spec):** la sección 1 del spec da valores calibrados sobre una card de contenido genérica (padding 16-18px, título 15px) — aplicados literalmente a una celda de un grid de 7 columnas, rompen el calendario (no entrarían más de 3-4 días por fila en una pantalla normal). Esta tarea traduce la *intención* del spec (más aire, tipografía menos diminuta) a lo que una celda de calendario puede soportar: `min-height` 86px→108px, padding 6px→9-10px, tipografía de 9px→10px y 12px→13px, gaps de 2px→3px. La transición usa solo `background` (sin `border-left-color`) porque la celda ya usa el borde completo como indicador de estado (abierta=dorado, cerrada=default) — agregar un borde izquierdo distinto competiría con esa señal en vez de sumar una de hover. `bgHover` es un tinte tenue sobre cada fondo base (dorado apagado sobre `--bg-card`, y una variante más oscura pero con el mismo tinte sobre `--bg`) para que el hover se note sobre los dos.

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

- [ ] **Step 3: QA manual en el navegador — cada ítem de Review Focus**

Abrir `F4H_Sistema_Beta_v6.html`, ir a la Agenda, y confirmar:
1. Navegar a un mes de 6 semanas (ej. octubre 2026) — la grilla se ve más aireada pero sigue entrando en una pantalla de escritorio sin scroll excesivo.
2. Un turno con nombre de cliente largo (ej. "Bartolomé Etchegoyen Villanueva") — el chip trunca con "…" en una sola línea, no desborda ni pasa a dos líneas.
3. Un día con 3 turnos activos + 2 sesiones sin turno cargadas a mano (o el más cercano posible con los datos de prueba existentes) — las 5 líneas entran en la celda sin cortarse.
4. El día de hoy (círculo dorado) y, si hay alguno, un día cerrado con un turno activo (punto rojo) — ambos siguen siendo legibles con la celda más grande.
5. Pasar el mouse sobre un día abierto y sobre uno cerrado — el tinte de hover se nota en los dos, sin movimiento ni brillo.

Si algo no se ve bien, ajustar el valor puntual (no la lógica) y repetir este paso antes de commitear.

- [ ] **Step 4: Commit**

```bash
git add F4H_Sistema_Beta_v6.html
git commit -m "$(cat <<'EOF'
feat(agenda): aplicar densidad Comoda y hover del sistema de diseño al calendario

Primer rollout de docs/superpowers/specs/2026-09-26-design-system.md:
celdas del calendario con mas aire (min-height 86->108px, tipografia
9/12px -> 10/13px) y transicion de hover sin movimiento (tinte de fondo),
adaptando la escala generica del spec a las restricciones de un grid de
7 columnas.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (hecho al escribir este plan)

- **Cobertura del spec:** sección 1 (espaciado/tipografía) y sección 3 (transición) del spec, aplicadas al único componente de la Agenda que el propio Francesco señaló como comprimido (las celdas del calendario). Secciones 2 y 4 del spec no aplican a la Agenda (no tiene fotos ni métricas) — quedan correctamente fuera de este plan, para los rollouts de Tatuajes y Dashboard.
- **Por qué no se tocan `buildPanelDia`/`buildTurnoRow`/`buildListaReglas`:** ya usan el padding "Cómoda" (16-18px) desde que se construyeron originalmente. Sus filas internas (turnos, reglas) no tienen `onclick` a nivel de fila — son informativas con botones de acción propios, no "cards clickeables" según la definición del spec (sección 3) — así que no les corresponde la transición estándar. Aplicarla ahí sería sugerir visualmente que se puede clickear la fila entera cuando no se puede.
- **Placeholder scan:** sin TBD/TODO. El único código nuevo es la variable `bgHover` y los `onmouseover`/`onmouseout` — completos, no descriptos en abstracto.
- **Consistencia de tipos:** no se agregan funciones ni cambian firmas — es edición de valores dentro de una función existente. No hay superficie de interfaz nueva que revisar contra otras tareas (es la única tarea del plan).
- **Review Focus:** las 5 líneas de la sección de arriba están todas cubiertas por el Step 3 de la Tarea 1 (QA manual), ítem por ítem — no hay suite automatizada en este repo para "pinnear" cada una con un test, así que quedan como pasos de verificación manual explícitos en vez de tests, siguiendo el mismo patrón que el resto de los planes de este proyecto.
