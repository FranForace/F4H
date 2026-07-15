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
- localStorage para persistencia (`siget_f4h_v6`)
- Sin dependencias externas
- Un solo archivo monolítico — NO modularizar por ahora

## Arquitectura de datos (objeto S en JS)
```js
S = {
  productos: [],    // inventario completo
  movimientos: [],  // log transaccional (entradas/salidas)
  sesiones: [],     // bitácora técnica de cada sesión
  tatuajes: [],     // proyectos con costo acumulado y margen
  kit: [],          // insumos base que se descuentan por sesión
  kits: [],         // kits nombrados configurables
  tc: 1400,         // tipo de cambio USD/ARS
  spm: 8            // sesiones por mes (divisor de amortización)
}
```

## Módulos del sistema (tabs en la UI)
1. **Dashboard** — métricas, break-even, mapa de desarrollo técnico, logo watermark
2. **Tatuajes** — split master-detail: lista 300px + panel detalle 1fr
3. **Inventario** — pills de filtro por categoría/estado, table-card border-radius:14px
4. **Activos** — equipos con amortización lineal
5. **Sesiones** — registro técnico + bitácora con scoring 1-10
6. **Egresos** — panel de gastos acumulados con historial
7. **Movimientos** — log transaccional con costo promedio ponderado (WAC)
8. **Config** — TC, sesiones/mes, kit base, backup JSON

## Lógica de costos clave
- `cxu(p)` = costo por uso = `p.cu / p.upu`
- `amortSesion(p)` = `cuARS(p) / p.vum / S.spm`
- WAC en entradas: `nuevo_cu = (stock × cu_actual + qty × precio_compra) / (stock + qty)`
- Score global = promedio de 5 dimensiones (sL, sR, sT, sD, sC) del 1 al 10

## Scoring — 5 dimensiones
- **sL** Calidad de línea
- **sR** Solidez del relleno
- **sT** Técnica
- **sD** Diseño
- **sC** Conformidad
- Colores: rojo 1-3, naranja 4-6, verde 7-10

## Convenciones de código
- IDs de productos: P01–P28 (seed), P+timestamp (nuevos)
- IDs de sesiones: S+timestamp
- IDs de tatuajes: T+timestamp
- Sesiones seed: SES_FANTASMA_20260421, SES_BOTELLA_20260421
- Tatuajes seed: TAT_FANTASMA_001, TAT_BOTELLA_002
- `persist()` = `localStorage.setItem('siget_f4h_v6', JSON.stringify(S))`
- localStorage key: `siget_f4h_v6` — NUNCA cambiar

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
- costoAlMomento: guardado en cada movimiento para el panel de egresos
- `globalScore(s)` — NO modificar esta función

## Próximas features pendientes
- Migración a Supabase + PostgreSQL (esquema ya diseñado)
- Layout responsive para móvil
- Modo carga rápida de sesión
- Análisis de agujas por zona del cuerpo
- Timer de sesión integrado
- Sesiones / Activos / Egresos / Movimientos: aplicar mismo design language
  que Inventario y Tatuajes (no hay mockups específicos para estos módulos)

## Cómo trabajar con este proyecto
- Tratar a Francesco como par técnico (SQL Developer). No subestimar.
- Desktop-first. No mobile-first.
- Mantener compatibilidad con datos localStorage existentes.
- Si se cambia estructura de S, agregar migración en `load()`.
- No romper el seed de productos y sesiones iniciales.
- Argentina: dualidad ARS/USD en todos los cálculos de costo.
- V5 (`F4H_Sistema_Beta_v5.html`) es el fallback de emergencia — no tocar.
