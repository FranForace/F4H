# Estado del proyecto F4H — 2026-09-26

Informe de versión para actualizar el contexto del proyecto (memoria de Claude, CLAUDE.md u
otros chats). Es una foto del momento — verificar contra `git log` / la DB antes de confiar en
esto pasado un tiempo.

## 1. Resumen ejecutivo

- **Producción al día:** `main` = `dev` = `6d7558c`, deployado en https://f4-h.vercel.app.
- **Sesiones rediseñadas:** una sesión puede tener varios tatuajes; cada tatuaje tiene sus
  propias agujas, técnicas con voltaje, puntaje y fotos.
- **Fotos de tatuajes:** Supabase Storage (bucket privado) con galería por tatuaje.
- **Finanzas:** vista `v_inversion` con invertido / consumido / en stock / recuperado.
- **Zona del cuerpo estandarizada** (lista cerrada + lado) para poder analizar por zona.
- **Menú lateral agrupado** en Trabajo / Insumos / Finanzas.
- **Carga de datos reales:** primer tatuaje en piel real (fantasma, Mili, 04/08/2026).

## 2. Commits desde la versión anterior (`74a499f`)

```
6d7558c feat: agujas y técnicas por tatuaje dentro de la sesión + fotos
5a338cf feat: sesión con varios tatuajes, agujas usadas y técnicas con voltaje
98457ed feat: zona del cuerpo estandarizada, menú agrupado y vista v_inversion
60e8cc7 docs: plan de implementación para onboarding por invitación
0cb0f1f docs: spec de diseño para onboarding por invitación
```

## 3. Cambios funcionales (lo que ve el usuario)

### Sesiones
- **Arriba (toda la sesión):** fecha, horas totales, máquina, stroke. **Abajo:** kit de
  insumos, insumos adicionales, notas.
- **Una tarjeta por tatuaje vinculado** (o una tarjeta "Práctica / sin proyecto" si no hay
  ninguno). Cada tarjeta tiene:
  - **Zona** — sale del tatuaje; con ✎ se cambia y actualiza el tatuaje. La práctica tiene
    cliente y zona propios.
  - **Agujas usadas** (aguja + cantidad) — lo único de agujas que descuenta stock.
  - **Técnicas y voltajes** (técnica + aguja + voltaje) — bitácora, no toca stock; admite la
    misma aguja con varios voltajes. Técnicas: Línea, Línea fina, Línea de agua, Puntillismo,
    Sombreado (whip), Sombreado suave, Relleno sólido, Color, Blanco / realces, Textura.
  - **Puntaje** (5 dimensiones, 1–10) propio de ese tatuaje.
  - **Fotos** (Resultado / Proceso / Referencia), se suben al guardar la sesión.
- Selector de agujas agrupado por tipo (RL / RS / RM / M) y ordenado por medida. Reemplazó
  los chips de "agujas testeadas".
- Al vincular el primer tatuaje, lo cargado en la tarjeta de práctica pasa a ese tatuaje.

### Tatuajes
- Detalle con **galería de fotos** agrupada por tipo, subida múltiple, borrado, click para
  ver en grande. Las miniaturas se sirven con URLs firmadas (bucket privado).
- Tabla de sesiones del tatuaje muestra solo **sus** agujas y **su** puntaje.
- **Costo por tatuaje** = sus agujas + parte igual del resto de la sesión (kit, extras,
  amortización). Si la sesión es compartida se indica "sesión compartida (N tatuajes)".
- **Puntaje del tatuaje** = promedio de sus sesiones.

### Zona del cuerpo
- Dos desplegables (zona + lado Izq/Der/Centro) en tatuaje nuevo/editar y en la tarjeta de
  práctica. Se guarda como `"Tobillo · Izq"`; para análisis: `split_part(zona, ' · ', 1)`.
- Zonas: Brazo (Hombro, Brazo, Codo, Antebrazo, Muñeca, Mano, Dedos), Torso (Pecho,
  Esternón, Costillas, Abdomen, Espalda alta/baja/completa, Cadera), Cabeza y cuello (Cuello,
  Nuca, Detrás de la oreja, Cara), Pierna (Glúteo, Muslo, Rodilla, Pantorrilla, Canilla,
  Tobillo, Pie), Práctica (Piel sintética). Valores viejos fuera de la lista se muestran como
  "(anterior)" y no se pierden.

### Menú lateral
Dashboard · **Trabajo** (Tatuajes, Sesiones) · **Insumos** (Inventario, Movimientos) ·
**Finanzas** (Activos, Egresos) · Config.

### Reglas de negocio que cambiaron
- **Las agujas de práctica ahora descuentan stock** (antes no). El flag `practica` es solo
  etiqueta; el costo de practicar se ve en `v_inversion.consumido_practica_ars`.
- Bug corregido: los puntajes de una sesión nueva se guardaban siempre en 0
  (`nScores.sL` vs `nScores.L`).
- Bug corregido: el selector de tatuaje vinculado ocultaba los tatuajes Finalizados.

## 4. Base de datos (Supabase `minletiyftpmufqpmviv`)

Todo aplicado en producción y replicado en `schema.sql`.

| Objeto | Qué es |
|---|---|
| `v_inversion` (vista, `security_invoker`) | Por tenant, en ARS: invertido (activos / insumos), consumido (práctica / cliente / histórico), en stock, recuperado (suma de precios de tatuajes), saldo a recuperar, tipo de cambio |
| `sesion_tatuajes` | Sesión ↔ tatuaje (N:M) con los 5 puntajes por tatuaje |
| `sesion_agujas` | `id`, `sesion_id`, `tatuaje_id` (null = práctica), `producto_id`, `cantidad`. Único por (sesión, tatuaje, aguja) |
| `sesion_tecnicas` | `sesion_id`, `tatuaje_id`, `orden`, `tecnica`, `producto_id`, `voltaje` |
| `tatuaje_fotos` | `tatuaje_id`, `sesion_id`, `tipo` (Resultado/Proceso/Referencia), `path`, `tenant_id` |
| Storage bucket `fotos` | Privado, 5 MB por archivo, jpg/png/webp. Ruta `{uid}/{tatuaje_id}/{archivo}`. Policies select/insert/delete por carpeta = `auth.uid()` |

- RLS: las tablas hijas de sesión usan policy join-based contra `sesiones.tenant_id`
  (mismo patrón que `kit_items`); `tatuaje_fotos` filtra por `tenant_id` directo.
- **Legacy (compat V5):** `sesiones.tatuaje_id`, `aguja_principal_id` y `voltaje` se siguen
  completando con el primer elemento de cada lista. `sesion_agujas_testeadas` ya no se escribe.
- Datos migrados: sesiones existentes pasaron a las tablas nuevas; agujas/técnicas de
  sesiones con varios tatuajes quedaron asignadas al primer tatuaje.

## 5. Estado de los datos (tenant Francesco)

| | |
|---|---|
| Tatuajes | 3 |
| Sesiones | 2 |
| Productos | 44 |
| Movimientos | 92 |
| Fotos | 3 |

**Inversión (`v_inversion`, TC 1500):**

| Concepto | ARS |
|---|---|
| Invertido en activos | 1.936.800 |
| Invertido en insumos | 381.600 |
| Consumido — histórico (carga inicial) | 121.039 |
| Consumido — sesiones con cliente | 11.946 |
| Consumido — práctica | 0 |
| En stock | 248.615 |
| Recuperado (cobros) | 30.000 |
| **Saldo a recuperar** | **2.288.400** |

Chequeo: insumos invertidos = consumido + en stock (381.600 = 132.985 + 248.615).

## 6. Pendientes

- **Sesión #4 (10/09):** reasignar agujas/técnicas a cada tatuaje (la migración las puso
  todas en el primero).
- **Agujas usadas en prácticas previas:** cargarlas como salidas para que descuenten stock y
  sumen al consumo.
- **Grilla de contenido** para redes (en diseño).
- Mostrar `v_inversion` en el Dashboard.
- Análisis por zona del cuerpo y por técnica/voltaje vs. puntaje.
- Del roadmap anterior: onboarding por invitación (spec + plan listos en `docs/`), cobro,
  bot de Telegram, layout mobile, timer de sesión.
- Opcional: mover el guardado de sesión a una función RPC en la DB (atomicidad).
