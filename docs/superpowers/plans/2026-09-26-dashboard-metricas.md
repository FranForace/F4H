# Dashboard — Métricas Visuales (rollout 3/N del sistema de diseño) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar el patrón de métricas del sistema de diseño (spec sección 4) a la card "Sesiones totales" del Dashboard: score global como anillo de progreso, y un indicador real de tendencia mes a mes para las sesiones.

**Architecture:** Cambios dentro de `renderDash()` en `F4H_Sistema_Beta_v6.html` — 2 funciones helper nuevas (`sesionesPorMes`, `sparklinePts`) y la reestructuración de una sola card. Sin cambios de datos, sin `js/db.js`.

**Tech Stack:** HTML5 + CSS3 + JS vanilla (inline styles + SVG inline) — mismo stack que el resto del sistema.

**Spec:** `docs/superpowers/specs/2026-09-26-design-system.md` — sección 4 (tratamiento de métricas).

## Global Constraints

- El spec dice explícitamente que el patrón "no es una lista cerrada" y que hay que "mirar cada número puntual y decidir cuál encaja" — este plan documenta esa decisión caso por caso (ver abajo), no aplica anillo/sparkline a todo por sistema.
- **Restricción real de datos, no una elección de diseño:** "Ganancia acumulada" y el propio conteo de "Sesiones totales" son acumulados monótonos (solo suben) — un sparkline ahí no mostraría una tendencia real, solo una línea que siempre sube. El único número del Dashboard con una serie temporal genuina y ya disponible sin tocar la base de datos es **sesiones por mes** (se puede agrupar `S.sesiones[].fecha` por mes calendario). Por eso el sparkline+tendencia de este plan se aplica a "sesiones por mes", no a "sesiones totales" ni a "ganancia".
- **Break-even queda sin cambios.** No hay forma de calcular un break-even histórico real (depende de la configuración actual de Activos/Config, que no se guarda con fecha) — inventar una serie temporal sería mostrar datos falsos en un dashboard financiero, algo que no vamos a hacer. El spec mismo prevé este caso: "seleccionar barra de progreso lineal existente donde ya se use bien... en vez de duplicar con un anillo nuevo si no suma" — el `Break-even mensual` ya usa una barra lineal (`height:5px;...border-radius:99px`) apropiada para "cobertura actual sobre un objetivo", así que se deja tal cual.
- Paleta sin cambios — el anillo usa `--border` (pista) + el color de estado ya existente (`gColor`: verde/ámbar/rojo según el score), el sparkline usa `--accent`.
- No hay suite de tests automatizada — verificación por check de sintaxis (Node) + QA visual manual (requiere login de Supabase, igual que los rollouts anteriores).

## Review Focus

- **Cero sesiones registradas (tenant nuevo):** `n===0` → `avgGlobal` es el string `'--'`, no un número. El anillo y el sparkline tienen que manejar esto sin `NaN` ni dividir por cero (el anillo debe verse "vacío", el sparkline una línea plana en la base, no roto).
- **Todas las sesiones en el mismo mes:** `sesionesPorMes(6)` da 5 meses en cero y uno con todo — el sparkline no debe reventar con `Math.max` sobre un array de puros ceros salvo un valor.
- **Exactamente 1 sesión histórica, registrada hace más de 6 meses:** los 6 meses de la ventana dan todos cero — el sparkline debe verse como una línea plana, no un error.
- **Score global en el límite de un tramo de color** (ej. exactamente 7.0 o 4.0, los cortes de `gColor`): el color del anillo tiene que coincidir con el mismo corte que ya usa el pill de badges en el resto del sistema (`>=7` verde, `>=4` ámbar, si no rojo) — no inventar un corte nuevo.
- **La tendencia cuando el mes actual y el anterior tienen la misma cantidad de sesiones:** el delta es `0` — tiene que mostrarse como neutral (ni verde ni rojo, sin flecha engañosa), no forzado a "mejora" o "empeora".

---

### Task 1: Score global como anillo + tendencia real de sesiones por mes

**Files:**
- Modify: `F4H_Sistema_Beta_v6.html:1029-1073` (`renderDash`, más 2 funciones helper nuevas justo antes)

**Interfaces:**
- Consumes: `S.sesiones` (existente, sin cambios — usa `.fecha` y `globalScore(s)`, ambos ya existentes).
- Produces: `sesionesPorMes(nMeses)`, `sparklinePts(vals,w,h,pad)` — funciones nuevas, de uso exclusivo de esta card; ninguna otra parte del sistema las consume.

- [ ] **Step 1: Helpers nuevos — agregar justo antes de `function renderDash(){`**

```js
function sesionesPorMes(nMeses){
  const hoy=new Date();
  const out=[];
  for(let i=nMeses-1;i>=0;i--){
    const d=new Date(hoy.getFullYear(),hoy.getMonth()-i,1);
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    out.push(S.sesiones.filter(s=>(s.fecha||'').slice(0,7)===key).length);
  }
  return out;
}
function sparklinePts(vals,w,h,pad){
  const max=Math.max(1,...vals);
  const step=vals.length>1?(w-2*pad)/(vals.length-1):0;
  return vals.map((v,i)=>(pad+i*step).toFixed(1)+','+((h-pad)-(v/max)*(h-2*pad)).toFixed(1)).join(' ');
}
```

`Math.max(1,...vals)` evita dividir por cero cuando todos los meses están en cero (Review Focus, ítems 1-3) — la línea queda plana en la base del gráfico en vez de romper.

- [ ] **Step 2: Calcular los valores nuevos dentro de `renderDash()`**

Anchor — Old:
```js
function renderDash(){
  const n=S.sesiones.length;
  const avgGlobal=n?(S.sesiones.reduce((a,s)=>a+globalScore(s),0)/n).toFixed(1):'--';
  const avgDim=k=>{const vals=S.sesiones.map(s=>s[k]).filter(v=>v>0);return vals.length?(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(1):0;};
```

New:
```js
function renderDash(){
  const n=S.sesiones.length;
  const avgGlobalNum=n?S.sesiones.reduce((a,s)=>a+globalScore(s),0)/n:0;
  const avgGlobal=n?avgGlobalNum.toFixed(1):'--';
  const avgDim=k=>{const vals=S.sesiones.map(s=>s[k]).filter(v=>v>0);return vals.length?(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(1):0;};
```

(Se agrega `avgGlobalNum`, el valor numérico crudo que necesita el anillo — `avgGlobal` sigue siendo el string ya usado en el resto de la función, sin cambiar su cálculo.)

Anchor — Old (después de `const gBg=...`, antes de `document.getElementById('t-dash').innerHTML`):
```js
  const gColor=avgGlobal>=7?'var(--green)':avgGlobal>=4?'var(--amber)':'var(--red)';
  const gBg=avgGlobal>=7?'rgba(74,154,58,.15)':avgGlobal>=4?'rgba(212,135,42,.15)':'rgba(226,75,74,.15)';
  document.getElementById('t-dash').innerHTML=`
```

New:
```js
  const gColor=avgGlobal>=7?'var(--green)':avgGlobal>=4?'var(--amber)':'var(--red)';
  const gBg=avgGlobal>=7?'rgba(74,154,58,.15)':avgGlobal>=4?'rgba(212,135,42,.15)':'rgba(226,75,74,.15)';
  const ringR=22,ringC=Math.round(2*Math.PI*ringR);
  const ringOffset=n?Math.round(ringC*(1-Math.min(1,avgGlobalNum/10))):ringC;
  const sesMeses=sesionesPorMes(6);
  const sesDelta=sesMeses[5]-sesMeses[4];
  const sesTrendColor=sesDelta>0?'var(--green)':sesDelta<0?'var(--red)':'var(--text-3)';
  const sesTrendArrow=sesDelta>0?'↑':sesDelta<0?'↓':'→';
  const sesTrendTxt=sesDelta===0?'sin cambios':(sesDelta>0?'+':'')+sesDelta+' sesi\xF3n'+(Math.abs(sesDelta)!==1?'es':'')+' vs mes anterior';
  document.getElementById('t-dash').innerHTML=`
```

`gColor`/`avgGlobal` siguen siendo el mismo corte de color que ya usan los badges del resto del sistema (`>=7` verde, `>=4` \xE1mbar, si no rojo) — no se inventa un corte nuevo (Review Focus, \xEDtem 4). `ringOffset=ringC` cuando `n===0` deja el anillo completamente vac\xEDo (sin relleno de color), coherente con "sin datos todav\xEDa".

- [ ] **Step 3: Reestructurar la card "Sesiones totales"**

Anchor — Old:
```js
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;padding:26px 26px 22px;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent);opacity:.7"></div>
        <div style="font-size:11px;font-weight:700;letter-spacing:.13em;color:var(--text-3);text-transform:uppercase;margin-bottom:12px">Sesiones totales</div>
        <div style="font-size:52px;font-weight:800;color:var(--accent);line-height:1;letter-spacing:-.02em">${n}</div>
        <div style="margin-top:9px;font-size:14px;color:var(--text-2)">Score global promedio</div>
        <div style="display:inline-flex;align-items:center;margin-top:10px;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;background:${gBg};color:${gColor}">${avgGlobal} / 10</div>
      </div>
```

New:
```js
      <div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;padding:26px 26px 22px;position:relative;overflow:hidden">
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent);opacity:.7"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:.13em;color:var(--text-3);text-transform:uppercase;margin-bottom:12px">Sesiones totales</div>
            <div style="font-size:52px;font-weight:800;color:var(--accent);line-height:1;letter-spacing:-.02em">${n}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0">
            <svg width="52" height="52" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="${ringR}" fill="none" stroke="var(--border)" stroke-width="5"/>
              <circle cx="26" cy="26" r="${ringR}" fill="none" stroke="${gColor}" stroke-width="5" stroke-dasharray="${ringC}" stroke-dashoffset="${ringOffset}" stroke-linecap="round" transform="rotate(-90 26 26)"/>
            </svg>
            <div style="font-size:12px;font-weight:700;color:${gColor};margin-top:4px">${avgGlobal}/10</div>
            <div style="font-size:10px;color:var(--text-3)">Score global</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
          <svg width="100" height="26" viewBox="0 0 100 26" style="flex-shrink:0"><polyline points="${sparklinePts(sesMeses,100,26,3)}" fill="none" stroke="var(--accent)" stroke-width="2"/></svg>
          <div>
            <div style="font-size:11px;color:var(--text-2)">\xDAltimos 6 meses</div>
            <div style="font-size:12px;font-weight:700;color:${sesTrendColor}">${sesTrendArrow} ${sesTrendTxt}</div>
          </div>
        </div>
      </div>
```

El resto de `renderDash()` (card "Ganancia acumulada", "Break-even mensual", "Mapa de desarrollo técnico", "Alertas de stock", "Últimas sesiones") **no se toca** — decisión explícita, ver Global Constraints.

- [ ] **Step 4: Verificar sintaxis**

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

- [ ] **Step 5: QA manual — cada ítem de Review Focus**

Abrir el Dashboard:
1. Con datos reales (n>0) → el anillo se ve parcialmente relleno según el score, con el mismo color que tendría el badge de ese score en cualquier otro lado del sistema.
2. El sparkline de abajo muestra una línea con la forma de los últimos 6 meses de sesiones — no una línea rota ni un `NaN` en el SVG.
3. La flecha y el texto de tendencia tienen sentido: si este mes tuvo más sesiones que el anterior, flecha verde hacia arriba; si menos, roja hacia abajo; si igual, gris neutral sin flecha direccional falsa.
4. (Si es posible probarlo) con muy pocas sesiones o todas en un solo mes, confirmar que ni el anillo ni el sparkline rompen el layout.
5. Confirmar que "Ganancia acumulada" y "Break-even mensual" se ven exactamente igual que antes de este cambio — no deberían haberse tocado.

Si no hay forma de loguearse (sin las credenciales de Francesco), decirlo explícitamente en el reporte de la tarea en vez de omitir este paso en silencio.

- [ ] **Step 6: Commit**

```bash
git add F4H_Sistema_Beta_v6.html
git commit -m "$(cat <<'EOF'
feat(dashboard): score global como anillo + tendencia real de sesiones

Rollout de docs/superpowers/specs/2026-09-26-design-system.md seccion 4:
la card "Sesiones totales" ahora muestra el score global como anillo de
progreso (tiene tope natural 1-10) y un sparkline+tendencia de sesiones
por mes de los ultimos 6 meses (dato real agrupado de S.sesiones, no
inventado). Ganancia acumulada y Sesiones totales en si son acumulados
monotonos (siempre suben) asi que no llevan sparkline -- no hay una
tendencia real que mostrar ahi. Break-even no tiene datos historicos
reales disponibles (depende de la config actual de Activos, sin
snapshots por fecha) asi que se deja con su barra lineal existente, tal
como preve el spec para este caso.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (hecho al escribir este plan)

- **Cobertura del spec:** sección 4 aplicada donde hay datos reales para respaldarla (score global, tendencia de sesiones); explícitamente NO aplicada donde el spec mismo lo permite (fallback a lo que ya funciona) o donde haría falta inventar datos (break-even histórico, que no existe).
- **Placeholder scan:** sin TBD/TODO — cada decisión de "no tocar X" tiene su razón de datos escrita en Global Constraints, no es una omisión.
- **Consistencia de tipos:** `sesionesPorMes` devuelve `number[]` de longitud fija `nMeses`; `sparklinePts` recibe ese mismo array — sin conversiones de tipo entre las dos. `avgGlobalNum` es el único consumidor nuevo de un valor numérico crudo del score; `avgGlobal` (string, ya existente) no cambia su uso en el resto de la función.
- **Review Focus:** las 5 líneas de arriba están cubiertas por el Step 5 (QA manual) y por las decisiones defensivas del propio código (`Math.max(1,...)`, `n?...:ringC`, corte de color reutilizado) — sin suite automatizada en este repo, quedan como verificación manual explícita, mismo patrón que los tres rollouts anteriores de esta rama.
