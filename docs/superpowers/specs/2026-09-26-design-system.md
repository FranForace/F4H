# Sistema de diseño F4H (fase 1) — spec de diseño

> Brainstorming con Francesco, 2026-09-26. Cambio **acotado escalado a arquitectónico**: arrancó
> como "mejorar la Agenda" (muy oscura y comprimida) y se amplió a un pase de diseño sobre todo
> el sistema. Este documento cubre solo la **base común** (tokens y patrones) — la aplicación
> módulo por módulo es trabajo posterior, con su propio plan cada uno.

## 0. Qué se construye

Una base de diseño compartida (espaciado, tipografía, transición estándar, patrón imagen+info,
tratamiento de métricas) para reemplazar la densidad/planitud actual en **todos los módulos**
(Dashboard, Agenda, Tatuajes, Inventario, Activos, Sesiones, Egresos, Movimientos, Config), sin
tocar la identidad de marca (paleta dark + dorado `#c8a96e`) ni la arquitectura de datos.

**Motivación:** Francesco probó la Agenda recién construida y la sintió "muy oscura y muy
comprimida". Al preguntar si el problema era el dark mode en general o algo puntual, aclaró que
el dark mode le gusta — el problema es la **densidad** (celdas de calendario muy chicas con
mucho texto apretado) y, mirando el resto del sistema, varias cosas más: en Tatuajes la foto se
ve chica y hay que hacer click para verla bien; el Dashboard es funcional pero las métricas se
ven "aburridas/planas".

### Decisiones cerradas

| Tema | Decisión |
|---|---|
| Paleta de colores | **Se mantiene igual** — `--bg:#0f0f0f`, `--bg-card:#1a1a1a`, dorado `--accent:#c8a96e`, etc. No es parte de este pase |
| Alcance de "oscuro" | Específico de la Agenda (celdas de calendario), no un pedido de aclarar el dark mode general |
| Alcance de "comprimido" | Las celdas del calendario de la Agenda, específicamente — no el panel lateral |
| Alcance real del pedido | Se amplió de "arreglar Agenda" a "revisar y optimizar el diseño de todo el sistema, con transiciones" |
| Secuencia elegida | Sistema de diseño común primero (este doc); después, módulo por módulo, empezando por Agenda |
| Escala de espaciado | Ver sección 1 — probado con 3 densidades (Compacta/Cómoda/Espaciosa) sobre una card real de turno; **Cómoda** ganó sin dudar |
| Foto + info | Ver sección 2 — probado actual (miniatura chica + pestaña nueva) vs. propuesta (foto grande al lado); ganó la propuesta |
| Transición estándar | Ver sección 3 — probadas 6 variantes (sin transición, con movimiento+brillo, barra dorada, híbrido, y dos variantes quietas con más brillo); ganó la barra dorada quieta (sin movimiento) |
| Métricas del Dashboard | Ver sección 4 — probados plano/sparkline/anillo; el score global (tiene un "tope" implícito 1-10) usa anillo, las métricas que suben/bajan mes a mes (sesiones, break-even) usan sparkline+tendencia |

### Fuera de alcance (este documento)

- Cambiar la paleta de colores.
- Aplicar esto módulo por módulo (Agenda, Tatuajes, Dashboard, etc.) — cada uno es su propio
  plan de implementación posterior, que **consume** este spec como base.
- Cualquier cambio de arquitectura de datos, `S`, o funciones `db*()`.

---

## 1. Espaciado y tipografía — escala "Cómoda"

Probado con una card de turno idéntica en 3 densidades (ver capturas del proceso de
brainstorming — no versionadas). Cómoda ganó frente a Compacta (la actual, se siente apretada)
y Espaciosa (demasiado aire, entran pocos elementos en pantalla — importante para el calendario
de la Agenda, donde caben muchos días).

Valores concretos para cards de contenido (turnos, tatuajes, filas de listas, etc.):

| Propiedad | Valor |
|---|---|
| Padding de card | `16px 18px` |
| Separación entre cards en una lista | `12px` |
| Título / nombre principal | `15px`, `font-weight:700` |
| Texto secundario / meta | `12px` |
| Eyebrow (label chico arriba) | `10px`, uppercase, `letter-spacing:.06em`, sin cambios — ya estaba bien |
| Badge | tamaño actual está bien (`10px`, `padding:3px 9px`) — no cambia |

Esto **reemplaza** la densidad actual en toda la app. No es exclusivo de la Agenda: las cards de
Tatuajes, las filas de Sesiones, los stat-cards del Dashboard, etc. migran a esta escala cuando
se toque cada módulo.

## 2. Patrón imagen + info

**Antes:** el detalle de un tatuaje muestra una card de info (cliente, diseño, badges, stats) y,
debajo, una galería de miniaturas chicas (56×56px). Click en una miniatura abre la foto en una
pestaña nueva del navegador — hay que salir de la pantalla para ver bien la imagen.

**Ahora:** cuando un elemento tiene fotos, se muestra una **foto grande al lado de la info**
(layout de dos columnas, la imagen ocupa más ancho que la info), con miniaturas más chicas
(~36px) debajo del panel de info que, al clickearlas, cambian cuál foto se ve grande — sin
navegar a otro lado. Por defecto se muestra la foto más reciente de tipo "Resultado" (si no hay
ninguna, la más reciente de cualquier tipo, o un placeholder si no hay fotos todavía).

Este patrón se aplica primero en **Tatuajes** (donde ya existe la galería); es el candidato
natural para cualquier otro lugar del sistema que en el futuro tenga fotos (hoy, solo Tatuajes
las tiene).

## 3. Transición estándar para elementos clickeables

Después de varias vueltas probando en vivo (hover real, no capturas), la que quedó:

```css
.clickable-card {
  border-left: 3px solid transparent;
  transition: background .15s ease, border-left-color .15s ease;
}
.clickable-card:hover {
  background: #1f1c15;        /* leve tinte dorado sobre --bg-card */
  border-left-color: #c8a96e; /* --accent */
}
```

**Decisiones explícitas del proceso** (para que quien implemente no las reintente):
- **Sin movimiento** (`transform`/`translateY`) — se probó con "se levanta" y expresamente no
  gustó. Nada de la card se mueve al pasar el mouse.
- **Sin glow/box-shadow adicional** — se probaron dos variantes con resplandor dorado más
  marcado (`box-shadow` con blur grande) sin movimiento, y tampoco fue lo elegido. La versión
  final es la más simple de las probadas: solo `background` + `border-left-color`.
- Se aplica a: cards de turnos/tatuajes, filas de tablas/listas clickeables, y cualquier
  elemento con `onclick` que navegue o abra un panel. No se aplica a botones (`.btn`) — esos
  mantienen su propio estilo actual, no se tocó en este pase.

## 4. Tratamiento de métricas (patrón, ejemplo: Dashboard)

Dos tratamientos, según el tipo de métrica:

- **Con "tope" natural o meta clara** (ej: score global 1-10, cupos de lanzamiento X/25) → anillo
  de progreso (SVG, `stroke-dasharray`/`stroke-dashoffset`, color `--accent` o el color de
  estado que corresponda).
- **Sin tope, que sube/baja en el tiempo** (ej: sesiones del mes, break-even) → sparkline
  (polyline SVG simple) + indicador de tendencia (`↑`/`↓` + delta, verde `--green` si mejora,
  rojo `--red` si empeora).

Este es un **patrón**, no una lista cerrada de qué métrica va con cuál — al aplicarlo en cada
módulo (Dashboard primero) hay que mirar cada número puntual y decidir cuál de los dos encaja,
seleccionar barra de progreso lineal existente (`.progress-bar`) donde ya se use bien (ej:
cupos de lanzamiento de la Agenda, que ya la usa) en vez de duplicar con un anillo nuevo si no
suma.

## 5. Logo / marca — unificar el tratamiento

**Hoy:** el logo (`logo-v2.png`) aparece 3 veces con tratamientos distintos y sin relación entre
sí: 56px en la pantalla de login, 38px chico e invertido a gris/blanco arriba del sidebar, y una
marca de agua de 380px centrada de fondo en el Dashboard (con un filtro de color raro —
`invert(1) sepia(.4) saturate(1.8) hue-rotate(350deg) brightness(.9)` — al 70% de opacidad,
que lo deja casi invisible detrás del contenido).

**Decisión:** el logo funciona como parte del **título**, no como decoración de fondo:
- **El archivo real importa:** `logo-v2.png` es un lienzo de 896×1195 con el glifo "F4H" ocupando
  solo una caja chica en el medio (mucho margen transparente alrededor) — escalar la imagen
  entera por `height` deja el trazo casi invisible. Se usa un recorte al glifo,
  `logo-v2-trim.png` (~561×342, misma tinta), para que el tamaño en pantalla sea el tamaño real
  del logo.
- **El filtro `invert(1)` se mantiene** en sidebar y headers — la tinta es oscura, sin eso no se
  lee sobre el fondo oscuro del sistema. No es el "filtro que lo pone gris/blanco" que se quiere
  sacar; es lo que lo hace legible. No se agrega texto con el nombre del sistema al lado — el
  logo ya es la palabra "F4H" caligrafiada, duplicarla en texto sería redundante.
- **Sidebar:** el logo recortado se agranda un poco (38px→48px) para tener más presencia,
  reemplazando la idea original de "logo + texto" por simplemente "logo más grande y nítido".
- **Headers de módulo:** el mismo logo recortado, más chico que en el sidebar (40px), aparece
  junto al título de cada módulo — **implementado por ahora solo en el Dashboard** (2026-09-26);
  extenderlo a Agenda/Tatuajes/etc. es un rollout posterior, no bloqueante.
- **Se elimina la marca de agua gigante del Dashboard** — con el logo ya presente en el sidebar
  y en el header, la marca de agua de 380px no suma presencia de marca, solo ocupa espacio sin
  que casi se note.
- Login (56px) queda afuera de este pase — es una pantalla aparte, sin jerarquía que unificar
  con el resto.

## 6. Próximos pasos

Cada módulo aplica esta base con su propio plan de implementación (`writing-plans`), en este
orden sugerido (a confirmar con Francesco antes de cada uno):

1. **Logo/marca** (sección 5) — sidebar + header compartido de módulos. Toca la estructura que
   usan todos los módulos (el bloque de header que ya se repite en cada uno), así que conviene
   resolverlo antes de tocar headers puntuales en los rollouts siguientes.
2. **Agenda** — motivo original del pedido: aplicar espaciado Cómoda a las celdas del
   calendario (probablemente el cambio de mayor impacto — hoy son las más comprimidas del
   sistema) y la transición estándar a los chips/turnos clickeables.
3. **Tatuajes** — patrón imagen + info (sección 2) en el detalle de tatuaje.
4. **Dashboard** — tratamiento de métricas (sección 4) en los stat-cards existentes, y remover
   la marca de agua vieja (sección 5) si el rollout 1 todavía no la sacó.
5. Resto de módulos (Inventario, Activos, Sesiones, Egresos, Movimientos, Config) — aplicar
   espaciado + transición estándar; evaluar caso a caso si algo se beneficia del patrón
   imagen+info o de métricas visuales.
