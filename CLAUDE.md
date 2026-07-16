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
- **Tablas**: `productos`, `tatuajes`, `kits`, `kit_items`, `sesiones`, `sesion_agujas_testeadas`, `movimientos`, `config`
- **Trigger `fn_movimiento_aplicar`**: BEFORE INSERT en `movimientos`. Calcula WAC con `round(x, 2)`, actualiza `productos.stock`, bloquea fila FOR UPDATE. Fuente de verdad para stock y costo_unitario — NO calcular en JS.
- **Trigger `fn_touch_updated_at`**: BEFORE UPDATE en `productos`/`tatuajes`/`sesiones`/`config`.
- **RLS**: permisiva MVP (`USING (true)`). Pendiente: endurecer con `auth.uid() IS NOT NULL` al agregar Supabase Auth (magic link).
- **IDs**: `bigint` en DB → `String(id)` en S → `Number(id)` al escribir en DB.
- **Adaptadores** (`js/db.js`): `adaptProducto`, `adaptMovimiento`, `adaptSesion`, `adaptTatuaje` — mapean columnas DB a campos cortos de S. No modificar render functions.
- **Error de stock**: `error.code === '23514'` (violación de CHECK constraint `stock >= 0`).

## Módulos del sistema (tabs en la UI)
1. **Dashboard** — métricas, break-even, mapa de desarrollo técnico, logo watermark
2. **Tatuajes** — split master-detail: lista 300px + panel detalle 1fr
3. **Inventario** — pills de filtro por categoría/estado, table-card border-radius:14px
4. **Activos** — equipos con amortización lineal
5. **Sesiones** — registro técnico + bitácora con scoring 1-10
6. **Egresos** — panel de gastos acumulados con historial
7. **Movimientos** — log transaccional con costo promedio ponderado (WAC)
8. **Config** — TC, sesiones/mes, kits de insumos, backup JSON

## Lógica de costos clave
- `cxu(p)` = costo por uso = `p.cu / p.upu`
- `amortSesion(p)` = `cuARS(p) / p.vum / S.spm`
- WAC en entradas: trigger PostgreSQL `round((stock × cu + qty × costo) / (stock + qty), 2)`
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
- **Logo nav**: logo-v2.png, height:44px
- **Dashboard header**: logo-v2.png watermark centrado absoluto (380px, filtro dorado)
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

### Agujas
- RS 7, Magnum 7, RL 3, RL 5, RL 7, RL 11

## Reglas de negocio importantes
- Activos excluidos de alertas: `if(p.cat==='Activo') return 'ok'`
- Alertas: stock ESTRICTO < mínimo (no <=)
- Agujas `practica:true` no descuentan stock
- Salidas en "usos": `qtyFinal = qty / p.upu`
- Kit base: se descuenta automáticamente en cada sesión si checkbox activo
- costoAlMomento: trigger sella el valor vigente si no se informa en el INSERT
- `globalScore(s)` — NO modificar esta función
- Mutations de kits: `dbSaveKitItems`, `dbRenameKit`, `dbAddKit`, `dbDeleteKit` en `js/db.js`

## Próximas features pendientes
- **Auth**: Supabase magic link — endurecer RLS antes de compartir URL ampliamente
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
