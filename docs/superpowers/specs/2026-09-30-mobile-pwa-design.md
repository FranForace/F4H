# F4H — Versión mobile + PWA instalable · Diseño

> Diseño cerrado con Francesco el 2026-09-30 (retoma el brainstorming pausado del 2026-08-21).
> Leé `CLAUDE.md` antes de empezar: todas sus reglas siguen vigentes.

---

## 0. Qué se construye

Que F4H se pueda **instalar en el iPhone 13 de Francesco** (ícono en la pantalla de inicio,
pantalla completa) y que **todas** las secciones sean cómodas de usar desde el celular:
agenda y turnos, registrar sesiones, stock y compras, y consultar números.

Es para uso propio. **No** es para publicar en App Store / Play Store.

### Decisiones cerradas

| Tema | Decisión |
|---|---|
| Tipo de app | **PWA** instalable desde Safari. Sin App Store, sin build, sin wrapper nativo |
| Código | **El mismo archivo** `F4H_Sistema_Beta_v6.html` + capa responsive. Sin `F4H_Mobile.html` aparte (regla "no modularizar" de CLAUDE.md) |
| Alcance | **Todas** las secciones usables en mobile (no solo lectura) |
| Offline | **Sin escritura offline.** Se mantiene el modo solo lectura actual (banner + snapshot `siget_f4h_v6`) |
| Navegación mobile | **Barra inferior fija**: Inicio · Agenda · (+) Nuevo · Sesiones · Más |
| Ícono | Trazo F4H **negro sobre dorado** `#c8a96e` |
| Entrega | **3 etapas**, cada una probada en el iPhone real (preview de Vercel) antes de mergear a producción |
| Escritorio | **No cambia nada** por encima del breakpoint |

### Fuera de alcance

App Store / Play Store, notificaciones push, escritura offline / sincronización, modo tablet
específico, cambios de datos o de base.

---

## 1. Arquitectura

### 1.1 Breakpoint único

`@media (max-width: 760px)` — todo lo mobile vive detrás de esta media query. Por encima,
el sistema se ve exactamente igual que hoy.

### 1.2 Capa responsive sobre estilos inline

El layout de las render functions usa **inline styles** (regla de CLAUDE.md). Una media query
no puede ganarle a un inline style salvo con `!important`, así que la capa mobile usa
**selectores de atributo + `!important`**, acotados al contenedor de contenido `.app`:

```css
@media (max-width: 760px) {
  .app [style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
  .app .g4, .app [style*="repeat(4,1fr)"] { grid-template-columns: 1fr 1fr !important; }
  /* ... */
}
```

Criterio: **la capa CSS resuelve tamaños y columnas**. Las render functions se tocan solo
cuando cambia el *comportamiento* (lista → detalle, tabla → tarjetas), nunca para ajustar
tamaños. Cualquier cambio a una render function mantiene las reglas de CLAUDE.md (inline
styles, concatenación en `.map()`).

Estado de UI mobile en JS: `isMobile()` = `matchMedia('(max-width: 760px)').matches`, con un
listener de `change` que llama a `renderAll()` al rotar o redimensionar.

### 1.3 Archivos nuevos (chicos, estáticos)

| Archivo | Qué es |
|---|---|
| `manifest.json` | `name: "F4H"`, `display: standalone`, `start_url: "/"`, `background_color`/`theme_color: #0f0f0f`, íconos |
| `sw.js` | Service worker mínimo (ver 1.4) |
| `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-512-maskable.png`, `icons/apple-touch-icon.png` (180×180) | Trazo de `logo-v2-trim.png` en negro, centrado con margen, sobre `#c8a96e` |

En el `<head>`: `<link rel="manifest">`, `<link rel="apple-touch-icon">`,
`<meta name="apple-mobile-web-app-capable" content="yes">`,
`<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`,
`<meta name="theme-color" content="#0f0f0f">` y `viewport-fit=cover` en el viewport (para
las safe areas del iPhone).

`vercel.json`: verificar que `/manifest.json`, `/sw.js` e `/icons/*` se sirvan tal cual (el
rewrite actual es solo `/` → `F4H_Sistema_Beta_v6.html`). `sw.js` con
`Cache-Control: no-cache` para que las actualizaciones lleguen.

### 1.4 Service worker

- Cachea **solo el shell**: el HTML, `js/db.js`, los íconos y `logo-v2-trim.png`.
- Estrategia **network-first** para el shell (con señal siempre baja la versión nueva; sin
  señal usa la cacheada). Nombre de caché versionado; `activate` borra las viejas.
- **Nunca** intercepta requests a Supabase ni a otros orígenes (jsdelivr, Google Fonts): solo
  mismo origen. Los datos siempre vienen de la DB.
- Actualización: cada deploy de Vercel cambia el HTML; network-first lo trae en el próximo
  arranque. Sin prompts de "nueva versión".

---

## 2. Navegación mobile

- La `.sidebar` (220px fija) se oculta; `.app` pierde su `margin-left:220px`.
- **Barra inferior fija** (`position:fixed; bottom:0`), 5 lugares, altura 56px +
  `env(safe-area-inset-bottom)`:

  | Lugar | Acción |
  |---|---|
  | Inicio | `go('dash')` |
  | Agenda | `go('agenda')` |
  | **(+)** | Abre hoja "Nuevo": Tatuaje · Sesión · Producto · Egreso (mismas acciones que el tab Nuevo) |
  | Sesiones | `go('ses')` |
  | Más | Abre hoja con: Tatuajes, Inventario, Movimientos, Activos, Egresos, Config, Cerrar sesión |

- Ítem activo en dorado (`var(--accent)`), sincronizado con `curTab` (igual que `.sidebar-item.on`).
- **Hojas inferiores** ("bottom sheets"): overlay oscuro + panel que sube desde abajo; se
  cierran tocando afuera o eligiendo una opción. Una sola función `mSheet(items)`.
- **Cabecera mobile** compacta arriba (título de la sección); los encabezados de módulo de
  escritorio (38px) se achican a ~24px con la capa CSS.
- El contenido deja espacio abajo para no quedar tapado por la barra.

---

## 3. Contenido

### 3.1 Grillas y métricas
- Grillas de 2–4 columnas → **1 columna**. Métricas (`.g4`, `repeat(4,1fr)`) → **2 columnas**.
- "+ Nuevo": el layout `1fr 300px` pasa a 1 columna; el panel de acciones queda debajo del formulario.
- Paddings de tarjetas reducidos (28px → 16px).

### 3.2 Tablas
- **Genérico:** cada tabla de los tabs se desplaza en horizontal dentro de su tarjeta
  (`overflow-x:auto`), con la **primera columna fija** (`position:sticky; left:0`).
  El orden por columna (`TSORT`) sigue funcionando sin cambios.
- **Inventario → tarjetas** en mobile: nombre (+ badge práctica), stock (usos y envases),
  estado, costo y lápiz de editar. La tarjeta de edición ocupa el ancho completo. Los filtros
  (pills) se desplazan en horizontal en una sola fila.

### 3.3 Pantallas lista + detalle
- **Tatuajes** (`300px 1fr`): en mobile se ve la lista; al tocar un tatuaje, el detalle
  ocupa la pantalla con "‹ Volver" arriba.
- **Agenda:** calendario mensual con celdas compactas (número del día + color abierto/cerrado
  + un punto por turno, sin chips de texto). Tocar un día abre su panel (día / turno / reglas)
  a pantalla completa con "‹ Volver".

### 3.4 Formularios (sesión, turno, producto, movimiento)
- `input`, `select`, `textarea` con **`font-size:16px`** (evita el zoom automático de iOS).
- Objetivos táctiles de **≥ 44px** de alto (botones, selects, botones de puntaje).
- Puntajes 1–10: dos filas de 5.
- Fila de aguja en la tarjeta de sesión: select a ancho completo, cantidad y ✕ debajo.
- Fotos: se mantiene el `<input type="file" accept="image/*">` actual (en iOS ofrece cámara o galería).

---

## 4. Etapas de entrega

Cada etapa: rama propia desde `dev` → preview de Vercel → prueba en el iPhone real de
Francesco → merge a `dev` y `main`.

| Etapa | Contenido | Resultado |
|---|---|---|
| **1 — Base** | PWA (manifest, `sw.js`, íconos, metas), barra inferior + hojas, capa responsive genérica (3.1, 3.2 genérico, 3.4) | Instalable y todo se ve y usa en una columna; tablas con scroll |
| **2 — Trabajo** | Sesiones (tarjeta de tatuaje, agujas, puntajes, fotos) y Agenda (calendario compacto + panel a pantalla completa) | Registrar una sesión y manejar turnos cómodo desde el celu |
| **3 — Insumos y finanzas** | Inventario en tarjetas, Tatuajes lista → detalle, retoques de Movimientos, Egresos, Activos y Config | Todas las secciones pulidas |

---

## 5. Pruebas

- **Escritorio sin regresiones:** a 1440px cada tab se ve igual que antes (comparar capturas
  antes/después de cada etapa).
- **Simulación:** Chrome con viewport 390×844 (iPhone 13): recorrer cada tab, abrir cada
  formulario, verificar que no haya scroll horizontal de página (solo dentro de las tablas).
- **iPhone real** (en cada preview): instalar desde Safari → "Agregar a inicio", verificar
  ícono, pantalla completa, safe areas (notch y barra de gesto), que los inputs no hagan zoom
  y el flujo de la etapa (etapa 2: registrar una sesión de práctica real con foto).
- **Service worker:** después de un deploy, la app instalada muestra la versión nueva al
  reabrirla; sin señal abre en modo solo lectura (banner actual).
- Ningún test escribe datos de prueba en el tenant real sin avisar; si una prueba necesita
  guardar, se usa una sesión de práctica real o se limpia después (ver aprendizaje PASO 4:
  borrar una sesión no revierte el stock).

---

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| Selectores de atributo agarran algo que no debían | Acotados a `.app`; revisión de cada tab en 390px y 1440px |
| `!important` complica cambios futuros | Toda la capa en un solo bloque `/* ── Mobile ── */` documentado en CLAUDE.md |
| El SW sirve una versión vieja | Network-first + caché versionada + `sw.js` sin caché HTTP |
| iOS standalone y el login de Supabase | La sesión de Supabase vive en `localStorage` del contexto instalado: al instalar hay que loguearse una vez dentro de la app (esperado, documentarlo) |
