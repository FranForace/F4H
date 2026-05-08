# F4H Sistema Beta — Contexto para Claude Code

## Quién soy
Francesco Renzo Forace Spinelli. SQL Developer + tatuador en desarrollo.
Resido en Mar del Plata, Argentina. Contexto económico: Argentina con inflación, 
costos en ARS y USD. Uso PowerShell en Windows.

## Qué es este proyecto
Sistema de gestión integral para tatuadores construido en HTML/CSS/JS vanilla.
Corre en el browser sin servidor. Datos persistidos en localStorage.
Archivo principal: `F4H_Sistema_Beta_v3.html`

## Stack actual
- HTML5 + CSS3 + JS vanilla (sin frameworks)
- localStorage para persistencia
- Sin dependencias externas
- Un solo archivo monolítico (objetivo: modularizar)

## Arquitectura de datos (objeto S en JS)
```js
S = {
  productos: [],    // inventario completo
  movimientos: [],  // log transaccional (entradas/salidas)
  sesiones: [],     // bitácora técnica de cada sesión
  tatuajes: [],     // proyectos con costo acumulado y margen
  kit: [],          // insumos base que se descuentan por sesión
  tc: 1400,         // tipo de cambio USD/ARS
  spm: 8            // sesiones por mes (divisor de amortización)
}
```

## Módulos del sistema (tabs en la UI)
1. **Dashboard** — métricas, break-even, mapa de desarrollo técnico
2. **Tatuajes** — proyectos, sesiones vinculadas, margen precio/costo
3. **Inventario** — stock, costos, alertas (Activos excluidos de alertas)
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
- Sesiones seed con IDs fijos: SES_FANTASMA_20260421, SES_BOTELLA_20260421
- Tatuajes seed: TAT_FANTASMA_001, TAT_BOTELLA_002
- `persist()` = `localStorage.setItem('siget_f4h_v6', JSON.stringify(S))`
- La clave de localStorage es `siget_f4h_v6` (mantener para no perder datos)

## Design system (dark mode)
```css
--bg: #0f0f0f
--bg-card: #1a1a1a
--bg-elevated: #222
--border: #2e2e2e
--text: #f0f0ee
--text-2: #888
--accent: #c8a96e   /* dorado F4H */
--red: #e24b4a
--amber: #d4872a
--green: #4a9a3a
```

## Productos pre-cargados (seed)
### Activos (no tienen alertas de stock)
- Pen Garage, Fuente Critical, Pedal, Ambition Soldier (USD), iPad A16 (USD), Inkless Printer, Tornito

### Descartables
- Cups, Papel Stencil, Grip, Guantes Nitrilo, Compresas, Guantes Latex, Papel Cocina, Film Pen

### Consumibles
- Tinta Dynamic Black, Piel Sintética, Stencil Stuff, Vaselina, Green Soap, Diluyente, Levanta Lengua

### Agujas
- RS 7, Magnum 7, RL 3, RL 5, RL 7, RL 11

## Reglas de negocio importantes
- Activos excluidos de alertas: `if(p.cat==='Activo') return 'ok'`
- Alertas: stock ESTRICTO < mínimo (no <=)
- Agujas marcadas como `practica:true` no descuentan stock al usarse
- Salidas en "usos": `qtyFinal = qty / p.upu` (descuento fraccionario)
- Kit base: se descuenta automáticamente en cada sesión si checkbox activo
- costoAlMomento: se guarda en cada movimiento para el panel de egresos

## Próximas features pendientes
- Migración a Supabase + PostgreSQL (esquema ya diseñado)
- Layout responsive para móvil (uso principal con guantes durante sesión)
- Modo carga rápida de sesión (mínimo de clicks)
- Análisis de agujas por zona del cuerpo
- Timer de sesión integrado

## Cómo trabajar con este proyecto
- Tratar a Francesco como par técnico (SQL Developer). No subestimar conocimiento.
- Priorizar eficiencia operativa: el sistema se usa mientras se tatúa.
- Cualquier cambio debe mantener compatibilidad con datos localStorage existentes.
- Si hay que cambiar la estructura de S, agregar migración en `load()`.
- Nombrar archivos HTML como `F4H_Sistema_Beta_vN.html` (incrementar N).
- No romper el seed de productos y sesiones iniciales.
- Argentina: considerar dualidad ARS/USD en todos los cálculos de costo.
