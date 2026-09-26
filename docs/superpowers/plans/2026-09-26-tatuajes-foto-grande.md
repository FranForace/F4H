# Tatuajes — Foto Grande al Lado (rollout 2/N del sistema de diseño) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el detalle de un tatuaje, mostrar la foto principal grande al lado de la info (en vez de miniaturas chicas + pestaña nueva del navegador), con las miniaturas de la galería existente actuando como selector de cuál foto se ve grande.

**Architecture:** Cambios en `F4H_Sistema_Beta_v6.html` únicamente: un nuevo panel de "foto grande" en `buildDetalleTattoo`, un helper `fotoPrincipal(t)` que decide qué foto mostrar, y un ajuste a `sfHydrateThumbs`/`fotoThumb` para que las miniaturas de la galería de Tatuajes seleccionen la foto grande en vez de abrir una pestaña nueva (las miniaturas del formulario de Sesión, que comparten esas mismas funciones, no cambian de comportamiento). Sin cambios de datos, sin funciones de `js/db.js` nuevas.

**Tech Stack:** HTML5 + CSS3 + JS vanilla (inline styles) — mismo stack que el resto del sistema.

**Spec:** `docs/superpowers/specs/2026-09-26-design-system.md` — sección 2 (patrón imagen + info).

## Global Constraints

- No tocar `js/db.js`, `dbUploadFoto`, `dbDeleteFoto`, ni la estructura de `S.tatuajes[].fotos` — esta tarea es puramente de presentación sobre datos que ya existen.
- No tocar el formulario de fotos de Sesión (`sfCard`, línea ~1668) — usa las mismas funciones compartidas (`fotoThumb`, `sfHydrateThumbs`) pero **debe seguir abriendo la foto en una pestaña nueva al clickear**, no seleccionar nada (no tiene "foto grande" en su UI). Cualquier cambio a esas funciones compartidas tiene que ser opt-in (un atributo/parámetro nuevo), nunca cambiar el comportamiento por defecto.
- Paleta y densidad: usar `--bg-card`/`--border`/`--accent`/`--text-3` y el padding "Cómoda" (16-18px) donde corresponda — igual que el resto del sistema (spec, sección 1).
- Por defecto se muestra la foto más reciente de tipo "Resultado"; si no hay ninguna, la más reciente de cualquier tipo; si no hay fotos, un placeholder — así lo definió la sección 2 del spec.
- No hay suite de tests automatizada — verificación por check de sintaxis (Node) + QA visual manual. La verificación visual requiere loguearse con la cuenta de Supabase de Francesco — si quien ejecuta este plan no tiene esas credenciales, debe decirlo explícitamente en el reporte de la tarea en vez de omitir el paso en silencio.

## Review Focus

- **Tatuaje sin fotos:** el placeholder tiene que aparecer sin romper el layout de 2 columnas (no un hueco vacío ni una columna colapsada a 0).
- **Borrar la foto que está seleccionada como grande:** `fotoPrincipal` debe caer de vuelta al default (última "Resultado", o la última de cualquier tipo) en vez de mostrar una imagen rota o quedar pegado a un id que ya no existe.
- **Miniaturas del formulario de Sesión (`sfCard`) no deben cambiar de comportamiento** — siguen abriendo en pestaña nueva al clickear, no seleccionan nada. Esto se prueba clickeando una miniatura ahí, no solo revisando el código.
- **Cambiar de tatuaje en la lista (panel izquierdo) sin recargar la página:** la foto grande tiene que volver a mostrar el default de ESE tatuaje, no arrastrar la selección del tatuaje anterior.
- **Subir una foto nueva tipo "Resultado" mientras se está viendo otra foto seleccionada a mano:** no debería "robarle" la selección al usuario — sigue viendo lo que eligió, no salta sola a la recién subida (a menos que el usuario nunca haya elegido nada a mano, en cuyo caso el default sí se actualiza solo, porque el default siempre es "la última Resultado").

---

### Task 1: Foto grande + selección por miniatura en el detalle de Tatuajes

**Files:**
- Modify: `F4H_Sistema_Beta_v6.html:485` (declaración de estado global)
- Modify: `F4H_Sistema_Beta_v6.html:1144,1356,1397` (los 3 lugares donde se asigna `selectedTattooId` a un tatuaje puntual)
- Modify: `F4H_Sistema_Beta_v6.html:1188-1233` (`buildDetalleTattoo`)
- Modify: `F4H_Sistema_Beta_v6.html:1236-1250` (`buildFotosTattoo`)
- Modify: `F4H_Sistema_Beta_v6.html:1680-1691` (`fotoThumb`, `sfHydrateThumbs`)

**Interfaces:**
- Consumes: `S.tatuajes[].fotos` (ya existe, sin cambios — `{id,path,tipo,sesionId,fecha}` por foto, ordenadas ascendente por id), `fotoUrls` (existente, sin cambios), `selectedTattooId` (existente).
- Produces: `selectedFotoId` (nuevo estado global, `string|null`), `fotoPrincipal(t)` (nueva función, recibe un tatuaje adaptado de `S.tatuajes`, devuelve el objeto foto a mostrar grande o `null`). Nada más depende de estos fuera de esta tarea.

- [ ] **Step 1: Nuevo estado global `selectedFotoId`**

Anchor — Old:
```js
let curTab='dash',sesView='nueva',tattooView='lista',fCat=[],fSt='',editingId=null,selectedTattooId=null;
```

New:
```js
let curTab='dash',sesView='nueva',tattooView='lista',fCat=[],fSt='',editingId=null,selectedTattooId=null,selectedFotoId=null;
```

- [ ] **Step 2: Resetear `selectedFotoId` cada vez que se entra a un tatuaje distinto**

Hay 3 lugares donde el código asigna `selectedTattooId` a un id puntual (no a `null`) — agregar `selectedFotoId=null;` en los tres, en el mismo statement/línea:

Anchor 1 — Old (dentro de `buildListaTattoos`, el click de una card de la lista):
```js
return '<div onclick="selectedTattooId=\''+t.id+'\';tattooView=\'detalle\';renderTattoos()" style="background:var(--bg-card);border:1px solid '+(isAct?'var(--accent)':'var(--border)')+';border-radius:12px;padding:14px 16px;cursor:pointer;transition:border-color .15s'+(isAct?';background:rgba(200,169,110,.06)':'')+'">'
```
New:
```js
return '<div onclick="selectedTattooId=\''+t.id+'\';selectedFotoId=null;tattooView=\'detalle\';renderTattoos()" style="background:var(--bg-card);border:1px solid '+(isAct?'var(--accent)':'var(--border)')+';border-radius:12px;padding:14px 16px;cursor:pointer;transition:border-color .15s'+(isAct?';background:rgba(200,169,110,.06)':'')+'">'
```

Anchor 2 — Old (dentro de `addTattoo`, después de crear uno nuevo):
```js
  selectedTattooId=newId;tattooView='detalle';renderTattoos();
```
New:
```js
  selectedTattooId=newId;selectedFotoId=null;tattooView='detalle';renderTattoos();
```

Anchor 3 — Old (después de guardar una edición de tatuaje):
```js
  tattooView='detalle';selectedTattooId=tid;renderTattoos();
```
New:
```js
  tattooView='detalle';selectedTattooId=tid;selectedFotoId=null;renderTattoos();
```

(Nota: hay otro `tattooView='detalle';selectedTattooId='${tid}';renderTattoos()` dentro de un botón "← Cancelar" en `editTattoo` — ESE no se toca, porque vuelve al mismo tatuaje que ya se estaba viendo antes de entrar a editar, no corresponde resetear la foto seleccionada ahí.)

- [ ] **Step 3: Helper `fotoPrincipal(t)`**

Agregar esta función nueva, cerca de `fotoThumb` (antes de `buildDetalleTattoo` para que esté definida cuando se usa — en JS con `function` declarations el orden no importa por hoisting, así que puede ir junto a las otras funciones de fotos, por ejemplo justo antes de `buildFotosTattoo`):

```js
function fotoPrincipal(t){
  const fotos=t.fotos||[];
  if(!fotos.length)return null;
  if(selectedFotoId){const f=fotos.find(x=>x.id===selectedFotoId);if(f)return f;}
  const resultado=fotos.filter(f=>f.tipo==='Resultado');
  return resultado.length?resultado[resultado.length-1]:fotos[fotos.length-1];
}
```

`fotos` ya viene ordenada ascendente por id (`adaptTatuaje` en `js/db.js` las ordena así) — el último elemento de cada filtro es el más reciente. Si `selectedFotoId` apunta a una foto que ya no existe (por ejemplo, se borró), el `find` no la encuentra y cae al default automáticamente — no hace falta limpiar `selectedFotoId` al borrar.

- [ ] **Step 4: Panel de foto grande en `buildDetalleTattoo`**

Anchor — Old (el `return` completo de la función):
```js
  return '<div>'
    +'<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:12px"><div style="padding:22px 24px 16px">'
      +'<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px"><div>'
          +'<div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">#'+t.num+' \xB7 '+t.cliente+'</div>'
          +'<div style="font-size:20px;font-weight:800;color:var(--text);letter-spacing:-.02em;margin-bottom:4px">'+t.diseno+'</div>'
          +(t.zona?'<div style="font-size:13px;color:var(--text-2)">'+t.zona+(t.tamano?' \xB7 '+t.tamano:'')+'</div>':'')
        +'</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">'
          +estadoBadge(t.estado)
          +'<div style="display:flex;gap:6px">'
            +'<button class="btn btn-xs" onclick="editTattoo(\''+tid+'\')">Editar</button>'
            +'<button class="btn btn-xs btn-danger" onclick="deleteTattoo(\''+tid+'\')">Eliminar</button>'
          +'</div></div></div>'
      +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">'
        +'<div style="background:var(--bg-elevated);border-radius:10px;padding:12px 14px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">Precio</div><div style="font-size:20px;font-weight:800;color:var(--text)">'+(t.precio?ars(t.precio):'--')+'</div></div>'
        +'<div style="background:var(--bg-elevated);border-radius:10px;padding:12px 14px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">Costo</div><div style="font-size:20px;font-weight:800;color:var(--text)">'+ars(costo)+'</div></div>'
        +'<div style="background:var(--bg-elevated);border-radius:10px;padding:12px 14px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">Margen</div><div style="font-size:20px;font-weight:800;color:'+(margen!=null?(margen>=0?'var(--green)':'var(--red)'):'var(--text-3)')+'">'+( margen!=null?(margen>=0?'+':'')+ars(margen):'--')+'</div></div>'
        +'<div style="background:var(--bg-elevated);border-radius:10px;padding:12px 14px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">Sesiones</div><div style="font-size:20px;font-weight:800;color:var(--text)">'+sess.length+'</div></div>'
      +'</div>'
      +(pct!=null?'<div style="margin-bottom:14px"><div style="font-size:11px;color:var(--text-3);margin-bottom:6px">Costo vs precio: '+pct+'%</div><div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(pct<=80?'var(--green)':pct<=100?'var(--amber)':'var(--red)')+'"></div></div></div>':'')
      +(t.estilo?'<div style="font-size:12px;color:var(--text-3);margin-bottom:10px">Estilo: <span style="color:var(--text-2);font-weight:600">'+t.estilo+'</span></div>':'')
      +(t.notas?'<div style="padding:10px 12px;background:var(--bg-elevated);border-left:2px solid var(--accent);border-radius:0 8px 8px 0;font-size:13px;color:var(--text-2);line-height:1.5;margin-bottom:10px">'+t.notas+'</div>':'')
      +(t.fotoUrl?'<a href="'+t.fotoUrl+'" target="_blank" style="font-size:12px;color:var(--accent);display:block;margin-top:8px">Ver referencia →</a>':'')
    +'</div></div>'
    +'<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)"><div style="font-size:13px;font-weight:700;color:var(--text)">Sesiones vinculadas</div>'
        +'<button class="btn btn-sm" onclick="go(\'ses\')">+ Nueva sesi\xF3n</button></div>'
      +sesTbl
    +'</div>'
    +buildFotosTattoo(t)
    +'</div>';
}
```

New:
```js
  const fp=fotoPrincipal(t);
  return '<div>'
    +'<div style="display:grid;grid-template-columns:1.1fr 1fr;gap:12px;margin-bottom:12px;align-items:stretch">'
      +'<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden"><div style="padding:22px 24px 16px">'
        +'<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px"><div>'
            +'<div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">#'+t.num+' \xB7 '+t.cliente+'</div>'
            +'<div style="font-size:20px;font-weight:800;color:var(--text);letter-spacing:-.02em;margin-bottom:4px">'+t.diseno+'</div>'
            +(t.zona?'<div style="font-size:13px;color:var(--text-2)">'+t.zona+(t.tamano?' \xB7 '+t.tamano:'')+'</div>':'')
          +'</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">'
            +estadoBadge(t.estado)
            +'<div style="display:flex;gap:6px">'
              +'<button class="btn btn-xs" onclick="editTattoo(\''+tid+'\')">Editar</button>'
              +'<button class="btn btn-xs btn-danger" onclick="deleteTattoo(\''+tid+'\')">Eliminar</button>'
            +'</div></div></div>'
        +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">'
          +'<div style="background:var(--bg-elevated);border-radius:10px;padding:12px 14px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">Precio</div><div style="font-size:20px;font-weight:800;color:var(--text)">'+(t.precio?ars(t.precio):'--')+'</div></div>'
          +'<div style="background:var(--bg-elevated);border-radius:10px;padding:12px 14px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">Costo</div><div style="font-size:20px;font-weight:800;color:var(--text)">'+ars(costo)+'</div></div>'
          +'<div style="background:var(--bg-elevated);border-radius:10px;padding:12px 14px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">Margen</div><div style="font-size:20px;font-weight:800;color:'+(margen!=null?(margen>=0?'var(--green)':'var(--red)'):'var(--text-3)')+'">'+( margen!=null?(margen>=0?'+':'')+ars(margen):'--')+'</div></div>'
          +'<div style="background:var(--bg-elevated);border-radius:10px;padding:12px 14px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:6px">Sesiones</div><div style="font-size:20px;font-weight:800;color:var(--text)">'+sess.length+'</div></div>'
        +'</div>'
        +(pct!=null?'<div style="margin-bottom:14px"><div style="font-size:11px;color:var(--text-3);margin-bottom:6px">Costo vs precio: '+pct+'%</div><div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(pct<=80?'var(--green)':pct<=100?'var(--amber)':'var(--red)')+'"></div></div></div>':'')
        +(t.estilo?'<div style="font-size:12px;color:var(--text-3);margin-bottom:10px">Estilo: <span style="color:var(--text-2);font-weight:600">'+t.estilo+'</span></div>':'')
        +(t.notas?'<div style="padding:10px 12px;background:var(--bg-elevated);border-left:2px solid var(--accent);border-radius:0 8px 8px 0;font-size:13px;color:var(--text-2);line-height:1.5;margin-bottom:10px">'+t.notas+'</div>':'')
        +(t.fotoUrl?'<a href="'+t.fotoUrl+'" target="_blank" style="font-size:12px;color:var(--accent);display:block;margin-top:8px">Ver referencia →</a>':'')
      +'</div></div>'
      +'<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;min-height:260px;display:flex;align-items:center;justify-content:center">'
        +(fp?'<img data-path="'+fp.path+'" style="width:100%;height:100%;min-height:260px;object-fit:cover">':'<div style="padding:40px 20px;text-align:center;color:var(--text-3);font-size:13px">Sin fotos todav\xEDa \xB7 subilas desde la galer\xEDa de abajo</div>')
      +'</div>'
    +'</div>'
    +'<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--border)"><div style="font-size:13px;font-weight:700;color:var(--text)">Sesiones vinculadas</div>'
        +'<button class="btn btn-sm" onclick="go(\'ses\')">+ Nueva sesi\xF3n</button></div>'
      +sesTbl
    +'</div>'
    +buildFotosTattoo(t)
    +'</div>';
}
```

(Único cambio real acá: se agregó `const fp=fotoPrincipal(t);` antes del `return`, se envolvió la card de info existente + un panel nuevo en un grid de 2 columnas, y el panel nuevo muestra `fp` grande o el placeholder. El resto del contenido de la card de info es idéntico, solo re-indentado.)

- [ ] **Step 5: Miniaturas de la galería seleccionan la foto grande (no abren pestaña nueva)**

Anchor — Old (`buildFotosTattoo`, la línea de los thumbnails):
```js
        +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'+l.map(f=>fotoThumb('<img data-path="'+f.path+'">',fdate((f.fecha||'').slice(0,10))+ses(f.sesionId),'deleteFotoTattoo(\''+t.id+'\',\''+f.id+'\')')).join('')+'</div>').join('')
```

New:
```js
        +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">'+l.map(f=>fotoThumb('<img data-path="'+f.path+'" data-select-foto="'+f.id+'">',fdate((f.fecha||'').slice(0,10))+ses(f.sesionId),'deleteFotoTattoo(\''+t.id+'\',\''+f.id+'\')',fp&&fp.id===f.id)).join('')+'</div>').join('')
```

Justo antes de esa línea, dentro de `buildFotosTattoo(t)`, agregar `const fp=fotoPrincipal(t);` (mismo cálculo que en `buildDetalleTattoo` — `buildFotosTattoo` recibe `t` como único parámetro, así que puede recalcularlo sin necesidad de pasarlo como argumento extra).

Anchor — Old (`fotoThumb`, la función completa):
```js
function fotoThumb(img,label,onDel){
  return '<div style="position:relative;width:96px">'
    +'<div style="width:96px;height:96px;border-radius:8px;overflow:hidden;background:var(--bg-elevated)">'+img.replace('<img','<img style="width:100%;height:100%;object-fit:cover"')+'</div>'
    +'<div class="hint" style="font-size:10px;margin-top:2px">'+label+'</div>'
    +(onDel?'<button type="button" class="btn btn-xs" style="position:absolute;top:4px;right:4px;padding:0 5px" onclick="'+onDel+'">✕</button>':'')+'</div>';
}
```

New:
```js
function fotoThumb(img,label,onDel,active){
  return '<div style="position:relative;width:96px">'
    +'<div style="width:96px;height:96px;border-radius:8px;overflow:hidden;background:var(--bg-elevated);border:2px solid '+(active?'var(--accent)':'transparent')+'">'+img.replace('<img','<img style="width:100%;height:100%;object-fit:cover"')+'</div>'
    +'<div class="hint" style="font-size:10px;margin-top:2px">'+label+'</div>'
    +(onDel?'<button type="button" class="btn btn-xs" style="position:absolute;top:4px;right:4px;padding:0 5px" onclick="'+onDel+'">✕</button>':'')+'</div>';
}
```

`fotoThumb` se llama en un segundo lugar (`sfCard`, formulario de fotos de Sesión, línea ~1668) sin un 4to argumento — `active` queda `undefined` ahí, que es falsy, así que ese llamado sigue exactamente igual que antes (borde transparente). Ese call site **no se toca**.

Anchor — Old (`sfHydrateThumbs`, la función completa):
```js
async function sfHydrateThumbs(root){
  const imgs=[...(root||document).querySelectorAll('img[data-path]')];if(!imgs.length)return;
  const urls=await fotoUrls(imgs.map(i=>i.dataset.path));
  imgs.forEach(i=>{const u=urls[i.dataset.path];if(u){i.src=u;i.style.cursor='zoom-in';i.onclick=()=>window.open(u,'_blank');}});
}
```

New:
```js
async function sfHydrateThumbs(root){
  const imgs=[...(root||document).querySelectorAll('img[data-path]')];if(!imgs.length)return;
  const urls=await fotoUrls(imgs.map(i=>i.dataset.path));
  imgs.forEach(i=>{
    const u=urls[i.dataset.path];if(!u)return;
    i.src=u;
    if(i.dataset.selectFoto){
      i.style.cursor='pointer';
      i.onclick=()=>{selectedFotoId=i.dataset.selectFoto;renderTattoos();};
    }else{
      i.style.cursor='zoom-in';
      i.onclick=()=>window.open(u,'_blank');
    }
  });
}
```

`i.dataset.selectFoto` lee el atributo `data-select-foto` (el navegador convierte `data-select-foto` a `dataset.selectFoto`, camelCase). Solo las miniaturas de la galería de Tatuajes lo tienen — la foto grande (`data-path` sin `data-select-foto`) y las miniaturas de `sfCard` (formulario de Sesión, tampoco lo tienen) siguen cayendo en el `else` y abriendo en pestaña nueva exactamente como antes.

- [ ] **Step 6: Verificar sintaxis**

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

- [ ] **Step 7: QA manual — cada ítem de Review Focus**

Abrir Tatuajes:
1. Un tatuaje sin fotos → placeholder en el panel derecho, layout de 2 columnas intacto (no colapsada).
2. Un tatuaje con varias fotos → se ve la más reciente "Resultado" grande por defecto; clickear una miniatura de otro tipo/fecha → la foto grande cambia a esa, y la miniatura clickeada queda con borde dorado.
3. Borrar la foto que está mostrada grande → la foto grande cae a la nueva "última Resultado" (o la que corresponda), sin romperse.
4. Ir a la lista, entrar a OTRO tatuaje → la foto grande de este segundo tatuaje es su propio default, no la que habías elegido en el primero.
5. Con una foto elegida a mano, subir una foto nueva tipo "Resultado" → la foto grande sigue siendo la que elegiste (no salta sola a la nueva) — a menos que no hubieras elegido ninguna, en cuyo caso sí puede saltar a la nueva (es el comportamiento esperado del default).
6. Ir a Sesiones → nueva sesión → agregar fotos ahí (`sfCard`) → clickear una miniatura ahí tiene que seguir abriendo en pestaña nueva, no seleccionar nada raro.

Si no hay forma de loguearse (sin las credenciales de Francesco), decirlo explícitamente en el reporte de la tarea en vez de omitir este paso en silencio.

- [ ] **Step 8: Commit**

```bash
git add F4H_Sistema_Beta_v6.html
git commit -m "$(cat <<'EOF'
feat(tatuajes): mostrar la foto principal grande al lado de la info

Rollout de docs/superpowers/specs/2026-09-26-design-system.md seccion 2:
agrega fotoPrincipal(t) (default: ultima foto Resultado, o placeholder si
no hay fotos) y un panel de foto grande junto a la card de info en el
detalle de un tatuaje. Las miniaturas de la galeria ahora seleccionan
cual foto se ve grande (con borde dorado en la activa) en vez de abrir
una pestana nueva del navegador; las miniaturas del formulario de Sesion
(misma funcion compartida, sfCard) no cambian de comportamiento.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review (hecho al escribir este plan)

- **Cobertura del spec:** sección 2 completa — foto grande al lado, miniaturas como selector, default a la última "Resultado", placeholder si no hay fotos.
- **Placeholder scan:** sin TBD/TODO.
- **Consistencia de tipos:** `selectedFotoId` es `string|null`, comparado contra `f.id` que ya es `String(r.id)` desde `adaptTatuaje` — sin conversiones de tipo necesarias. `fotoThumb`'s nuevo 4to parámetro (`active`) es opcional y no rompe su único otro call site.
- **Review Focus:** las 5 líneas de arriba están cubiertas ítem por ítem por el Step 7 (QA manual) — sin suite automatizada en este repo, quedan como verificación manual explícita, mismo patrón que los dos rollouts anteriores.
- **Riesgo verificado:** `sfHydrateThumbs` es compartida entre Tatuajes y el formulario de Sesión — el cambio es estrictamente opt-in vía `data-select-foto`, así que el comportamiento del formulario de Sesión (que no pasa ese atributo) queda bit-a-bit igual. Verificado leyendo ambos call sites antes de escribir el plan, no asumido.
