# F4H Sistema Beta — Contexto para Claude Code

## Quién soy
Francesco Renzo Forace Spinelli. SQL Developer + tatuador en desarrollo.
Resido en Mar del Plata, Argentina. Contexto económico: Argentina con inflación,
costos en ARS y USD. Uso PowerShell en Windows.

## Archivo activo
**`F4H_Sistema_Beta_v6.html`** — archivo monolítico único (HTML + CSS + JS en un solo archivo).
Branch activo: `dev` en https://github.com/FranForace/F4H.git

> ⚠️ La estructura modular antigua (index.html + css/styles.css + js/) está
> ARCHIVADA y NO es válida. No modificar esos archivos. El sistema vive en v6.

## Stack
- HTML5 + CSS3 + JS vanilla (sin frameworks)
- **Supabase PostgreSQL** — fuente de datos principal (`https://minletiyftpmufqpmviv.supabase.co`)
- **CDN**: `@supabase/supabase-js@2` UMD vía jsdelivr + `js/db.js` como capa de datos
- localStorage como snapshot offline (`siget_f4h_v6`) — NUNCA cambiar esta key
- Monolítico: `F4H_Sistema_Beta_v6.html` + `js/db.js` — NO modularizar más allá de esto
- **Vercel**: deploy estático desde main (URL en Vercel dashboard)

## Arquitectura de datos (objeto S en JS)
S es **CACHE en memoria**. DB es la fuente de verdad.
`initDB()` hidrata S al cargar. `persist()` guarda snapshot offline.
Las mutations van a DB primero; S se actualiza vía adapters.

```js
S = {
  productos: [],    // cache desde DB (tabla productos)
  movimientos: [],  // cache desde DB (tabla movimientos, últimos 200)
  sesiones: [],     // cache desde DB (tabla sesiones)
  tatuajes: [],     // cache desde DB (tabla tatuajes)
  kit: [],          // legacy — no usar en mutations nuevas
  kits: [],         // cache desde DB (tabla kits + kit_items)
  tc: 1400,         // tipo de cambio USD/ARS (tabla config)
  spm: 8            // sesiones por mes (tabla config)
}
```

## Backend: Supabase
- **Proyecto**: `https://minletiyftpmufqpmviv.supabase.co`
- **Publishable key** (en `js/db.js`, safe para frontend): `sb_publishable_8dl1Rolu23DUX35Gk8s24g_06GRANqH`
- **service_role key**: NUNCA en frontend. NUNCA en el repo.
- **Tablas**: `productos`, `tatuajes`, `kits`, `kit_items`, `sesiones`, `sesion_tatuajes`, `sesion_agujas`, `sesion_tecnicas`, `movimientos`, `config`, `turnos`, `disponibilidad_reglas` (`sesion_agujas_testeadas` es legacy, ya no se escribe)
- **Sesión N:M**: una sesión puede tener varios tatuajes (`sesion_tatuajes`, con puntaje propio por tatuaje). Puntaje de la sesión = promedio de sus tatuajes; puntaje de un tatuaje = promedio de sus sesiones. Costo de la sesión se reparte en partes iguales entre sus tatuajes. `sesion_agujas` (aguja + cantidad) es lo único de agujas que descuenta stock; `sesion_tecnicas` (técnica + aguja + voltaje) es bitácora. `sesiones.tatuaje_id`/`aguja_principal_id`/`voltaje` se completan con el primer elemento (compat V5)
- **Por tatuaje dentro de la sesión**: `sesion_agujas` y `sesion_tecnicas` tienen `tatuaje_id` (null = práctica). La UI de sesión es una tarjeta por tatuaje (agujas, técnicas, puntaje, fotos); la zona es la del tatuaje (editable desde la tarjeta, actualiza `tatuajes.zona`). Costo por tatuaje = sus agujas + parte igual del resto (`sesionCostoTat`)
- **Fotos**: tabla `tatuaje_fotos` + Storage bucket privado `fotos` (ruta `{uid}/{tatuaje_id}/…`, policies por carpeta). Se comprimen en el navegador (1600px JPEG) y se muestran con URLs firmadas (`fotoUrls`)
- **Vista `v_inversion`** (`security_invoker`): invertido (activos/insumos), consumido (práctica/cliente/histórico), en stock, recuperado y saldo a recuperar, en ARS con `tipo_cambio`
- **Trigger `fn_movimiento_aplicar`**: BEFORE INSERT en `movimientos`. Calcula WAC con `round(x, 4)`, actualiza `productos.stock`, bloquea fila FOR UPDATE. Fuente de verdad para stock y costo_unitario — NO calcular en JS.
- **Trigger `fn_touch_updated_at`**: BEFORE UPDATE en `productos`/`tatuajes`/`sesiones`/`config`/`turnos`.
- **Agenda** (`turnos`, `disponibilidad_reglas`, 2026-09): disponibilidad por reglas — todos los días arrancan cerrados, se abren/cierran con reglas (`abrir`/`cerrar`, `dias_semana` ISO 1=lun…7=dom o `null`=todos, `desde`/`hasta` opcionales, horario). `fn_agenda_dias(p_desde, p_hasta)` (`security invoker`, tope 400 días) resuelve el día ganador por precedencia: 1) rango cerrado > un lado > sin fechas, 2) rango más corto, 3) menos días de semana, 4) `created_at desc, id desc` — NO reimplementar esta lógica en JS, siempre llamar la función. `turnos.estado` (`Reservado|Confirmado|Realizado|Cancelado|No vino`) tiene el constraint `turnos_realizado_con_sesion`: `estado='Realizado' ⇔ sesion_id is not null` — solo `dbVincularSesionTurno`/`dbDesvincularSesionTurno` tocan esa pareja de columnas. `v_cupos_lanzamiento` (`security_invoker`) cuenta cupos de lanzamiento contra la fila `config` con `clave='cupos_lanzamiento'` (`valor` jsonb `{"total":25,"hasta":"2026-11-20"}`). Diseño completo en `docs/superpowers/specs/2026-09-26-agenda-design.md`.
- **Auth**: Supabase Auth con email+contraseña (`signInWithPassword`). `dbSignIn(email,password)`/`dbSignOut`/`initAuthUI` en `js/db.js` y `F4H_Sistema_Beta_v6.html`. Cuenta original / tenant #1: `franforace@gmail.com`. Altas de tenants nuevos se crean manualmente en el dashboard de Supabase Auth — no hay signup in-app todavía (ver roadmap de onboarding por invitación).
- **RLS**: multi-tenant. Todas las tablas de datos (`productos`, `tatuajes`, `kits`, `sesiones`, `movimientos`, `config`) tienen columna `tenant_id uuid not null references auth.users(id) default auth.uid()`; las policies `tenant_isolation` filtran por `tenant_id = auth.uid()`. `kit_items` y `sesion_agujas_testeadas` no tienen `tenant_id` propio — su policy `tenant_isolation` es un join a su tabla padre (`kits`/`sesiones`). Un trigger `trg_tenant_bootstrap` (`fn_tenant_bootstrap`, `SECURITY DEFINER`) en `auth.users` siembra el catálogo base (37 productos, 1 kit, 2 config) para cada usuario nuevo. Verificar el estado real (no asumir por este archivo):
  ```sql
  select tablename, policyname, qual from pg_policies where schemaname = 'public';
  ```
  **Multi-tenancy**: diseño completo en `docs/superpowers/specs/2026-08-18-multi-tenancy-design.md`.
  Esta fase solo cubrió aislamiento de datos por `tenant_id`; **onboarding por invitación** y
  **cobro/billing** son los próximos dos proyectos planeados y todavía NO están construidos.
- **Deploy**: Vercel construye desde `main` (config del proyecto en Vercel, no en este repo). Para confirmar qué commit está realmente en producción:
  ```bash
  curl -s https://f4-h.vercel.app/F4H_Sistema_Beta_v6.html | sha256sum
  git show origin/main:F4H_Sistema_Beta_v6.html | sha256sum   # comparar
  ```
- **Agujas estructuradas** (2026-09-30): `productos.aguja_tipo` (`RL|RS|M|CM`), `aguja_numero` (1–99), `aguja_calibre` (`08|10|12`), `aguja_sufijo` (opcional). Constraint `productos_aguja_campos`: obligatorios si `categoria='Aguja'`, null si no. El **nombre lo arma la DB** (trigger `trg_aguja_nombre`: `RL07 12 práctica`, y `subcategoria`=tipo) — en JS `agNombre()` es solo vista previa. Unicidad por `productos_aguja_combo_key` (tenant + tipo + número + calibre + sufijo sin mayúsculas). En S: `p.ag = {tipo,num,cal,suf}`; helpers `agInfo`/`agCmp`/`agDuplicada`/`agSel`. Vista `v_agujas_uso` (`security_invoker`): stock y consumo 30/90 días/total por tipo·número·calibre (consumo = salidas con sesión; ignora sufijo)
- **`productos.activo`** (default true): false = archivado. No aparece en selectores, Movimientos ni alertas; Inventario lo muestra con el filtro "Archivados". Nunca borrar productos con historial: archivar
- **IDs**: `bigint` en DB → `String(id)` en S → `Number(id)` al escribir en DB.
- **Adaptadores** (`js/db.js`): `adaptProducto`, `adaptMovimiento`, `adaptSesion`, `adaptTatuaje`, `adaptTurno`, `adaptRegla` — mapean columnas DB a campos cortos de S. No modificar render functions.
- **Error de stock**: `error.code === '23514'` (violación de CHECK constraint `stock >= 0`).

> **Git, producción y RLS se verifican con comandos, no se declaran en este archivo.** Este documento
> describe arquitectura y decisiones estables — no el estado del momento. Para saber qué está pusheado,
> deployado o qué policies corren de verdad, ejecutar los comandos de arriba / `git log`, no confiar en
> una afirmación escrita acá con fecha.

## Módulos del sistema (tabs en la UI)
1. **Dashboard** — métricas, break-even, mapa de desarrollo técnico, logo junto al título
2. **Agenda** — disponibilidad por reglas, calendario mensual + panel lateral (día/turno/reglas), cupos de lanzamiento (primer ítem del grupo "Trabajo")
3. **Tatuajes** — split master-detail: lista 300px + panel detalle 1fr
4. **Inventario** — pills de filtro por categoría/estado, table-card border-radius:14px
5. **Activos** — equipos con amortización lineal
6. **Sesiones** — registro técnico + bitácora con scoring 1-10
7. **Egresos** — panel de gastos acumulados con historial
8. **Movimientos** — log transaccional con costo promedio ponderado (WAC)
9. **Config** — TC, sesiones/mes, kits de insumos, backup JSON

## Lógica de costos clave
- **Stock se mide en usos, no en envases** (migrado 2026-08-24). `productos.stock`,
  `stock_minimo` y `costo_unitario` están en usos/costo-por-uso en DB. `p.upu`
  (`usos_por_unidad`) sigue siendo el factor de conversión envase↔uso.
- `cxu(p)` = costo por uso = `cuARS(p)` (ya no divide por `upu`; `costo_unitario` ya viene
  expresado por uso desde la migración)
- `cEnv(p)` = costo por envase = `cuARS(p) * p.upu` (derivado, para mostrar en UI)
- `amortSesion(p)` = `cuARS(p) / p.vum / S.spm`
- WAC en entradas: trigger PostgreSQL `round((stock × cu + qty × costo) / (stock + qty), 4)`
- Movimientos: el form carga en **envases** (cantidad y precio por envase); `addMov()`
  convierte a usos (`cantidad*upu`) y costo por uso (`precio/upu`) antes del INSERT.
  Ya no existe el selector "unidad de salida" (usos vs. unidad) — todo es uniforme.
- Score global = promedio de 5 dimensiones (sL, sR, sT, sD, sC) del 1 al 10

## Scoring — 5 dimensiones
- **sL** Calidad de línea
- **sR** Solidez del relleno
- **sT** Técnica
- **sD** Diseño
- **sC** Conformidad
- Colores: rojo 1-3, naranja 4-6, verde 7-10

## Convenciones de código
- IDs: bigint en DB, seed desde 1 en orden. Nuevos: identity auto.
- IDs en S: siempre `String(id)`. Al escribir en DB: `Number(id)`.
- Sesiones seed: SES_FANTASMA_20260421, SES_BOTELLA_20260421 (IDs numéricos en DB)
- Tatuajes seed: TAT_FANTASMA_001, TAT_BOTELLA_002
- `persist()` = snapshot offline → `localStorage.setItem('siget_f4h_v6', JSON.stringify(S))`
- localStorage key: `siget_f4h_v6` — NUNCA cambiar. DB es fuente de verdad; localStorage es fallback offline.

## Design system (dark mode)
```css
--bg: #0f0f0f
--bg-card: #1a1a1a
--bg-elevated: #222
--border: #2e2e2e
--text: #f0f0ee
--text-2: #888
--text-3: #555
--accent: #c8a96e   /* dorado F4H */
--red: #e24b4a
--amber: #d4872a
--green: #4a9a3a
```

## Decisiones de diseño implementadas (basadas en mockups)
- **Mockups de referencia**: `mockups/dashboard-v3.html`, `mockups/tatuajes-v1.html`,
  `mockups/inventario-v1.html`, `mockups/formulario-v1.html`
- **Badges**: inline-flex, border-radius:5px, text-transform:uppercase, font-weight:700,
  fondos rgba light (no dark bg)
- **Headers de módulos**: sin border-bottom, margin-bottom:24px
- **Arte lateral**: fuego izq. opacity:0.75, hannya der. opacity:0.55 + filter:invert(1)
- **Logo**: `logo-v2-trim.png` (recorte del glifo real de `logo-v2.png`, que tiene mucho margen
  transparente) con `filter:invert(1)` — necesario, la tinta es oscura. Sidebar height:48px,
  junto al título de cada header de módulo height:40px (por ahora solo implementado en el
  Dashboard — 2026-09-26, ver `docs/superpowers/specs/2026-09-26-design-system.md` sección 5).
- **Tatuajes**: split grid 300px + 1fr (lista + detalle), project-cards con margen
- **Inventario**: pills circulares (border-radius:99px), active states de color,
  separador entre grupos, edit panel border:1.5px solid var(--accent), grid 4 cols
- **+ Nuevo**: type-selector 4 cards + form-card 1fr + sidebar 300px
- **Config**: 3-col params grid, inputs embebidos en bg-elevated

## Reglas de renderizado JS
- Usar **inline styles** en funciones de render (innerHTML), NO clases CSS nuevas
- Usar **string concatenation** (no template literals) dentro de .map() callbacks
  para evitar problemas de backticks anidados
- `\xED` `\xE1` `\xFA` `\xF3` `\xE9` `\xB7` para acentos en template literals JS

## Productos pre-cargados (seed)
### Activos (excluidos de alertas de stock)
- Pen Garage, Fuente Critical, Pedal, Ambition Soldier (USD), iPad A16 (USD),
  Inkless Printer, Tornito

### Descartables
- Cups, Papel Stencil, Grip, Guantes Nitrilo, Compresas, Guantes Latex,
  Papel Cocina, Film Pen

### Consumibles
- Tinta Dynamic Black, Piel Sintética, Stencil Stuff, Vaselina, Green Soap,
  Diluyente, Levanta Lengua

### Agujas (bootstrap de tenants nuevos, calibre 12)
- RS07, M07, M13, RL03, RL05, RL07, RL09, RL11, RL14, RL15

## Reglas de negocio importantes
- Activos excluidos de alertas: `if(p.cat==='Activo') return 'ok'`
- Alertas: stock ESTRICTO < mínimo (no <=)
- Agujas `practica:true` descuentan stock igual (desde 2026-09): el flag es solo etiqueta. El costo de práctica se ve en `v_inversion.consumido_practica_ars`
- Zona del cuerpo: lista cerrada `ZONAS` + lado, guardada como `"Tobillo · Izq"` (`zonaField`/`readZona`/`setZona`). Para análisis: `split_part(zona, ' · ', 1)`
- Kit base: se descuenta automáticamente en cada sesión si checkbox activo
- costoAlMomento: trigger sella el valor vigente si no se informa en el INSERT
- `globalScore(s)` — NO modificar esta función
- Mutations de kits: `dbSaveKitItems`, `dbRenameKit`, `dbAddKit`, `dbDeleteKit` en `js/db.js`
- Agenda: "Realizado" ⇔ sesión vinculada (constraint en DB). Turno en día cerrado o cerrar un día con turnos activos: se permite con aviso, no se bloquea. Horario de un día abierto sale de la regla que lo abre — sin default global. Seña (`sena_ars`) solo se guarda en el turno, no genera movimiento en Finanzas. Borrar una sesión vinculada a un turno pide desvincular desde la Agenda primero (mismo constraint).

## Próximas features pendientes
- **Onboarding por invitación**: siguiente proyecto planeado sobre multi-tenancy — ver `docs/superpowers/specs/2026-08-18-multi-tenancy-design.md`. Todavía no está construido.
- **Cobro / billing**: proyecto planeado después de onboarding — ver mismo doc. Todavía no está construido.
- **FASE 5**: Bot Telegram con Supabase Edge Function (Deno) — `/stock`, `/dash`, `/entrada`, `/salida`
- Layout responsive para móvil
- Modo carga rápida de sesión
- Análisis de agujas por zona del cuerpo
- Timer de sesión integrado
- Sesiones / Activos / Egresos / Movimientos: aplicar mismo design language que Inventario/Tatuajes

## Cómo trabajar con este proyecto
- Tratar a Francesco como par técnico (SQL Developer). No subestimar.
- Desktop-first. No mobile-first.
- DB es fuente de verdad. Mutations van a funciones `db*()` primero; S se actualiza vía adapters.
- No pushear directo a `S.productos` / `S.movimientos` / etc. sin pasar por DB.
- Si se cambia estructura de S, actualizar adapters en `js/db.js` y `initDB()`.
- No romper el seed de productos y sesiones iniciales.
- Argentina: dualidad ARS/USD en todos los cálculos de costo.
- V5 (`F4H_Sistema_Beta_v5.html`) es el fallback de emergencia — no tocar.
