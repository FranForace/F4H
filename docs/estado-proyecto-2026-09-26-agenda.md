# Estado del proyecto F4H — Agenda (fase 1) — 2026-09-26

Informe de versión para actualizar el contexto del proyecto (memoria de Claude, CLAUDE.md u
otros chats). Es una foto del momento — verificar contra `git log` / la DB antes de confiar en
esto pasado un tiempo.

## 1. Resumen ejecutivo

- **Branch `feature/agenda`** listo para PR a `dev`, 12 commits sobre `dev`. **No mergeado a
  `main` todavía** — `main`/`dev` en producción siguen en `6d7558c` hasta que Francesco apruebe
  el merge.
- **SQL ya aplicado en producción** (`minletiyftpmufqpmviv`): tablas `turnos` y
  `disponibilidad_reglas`, función `fn_agenda_dias`, vista `v_cupos_lanzamiento`. Se aplicó
  manualmente desde el SQL editor de Supabase (el classifier de esta sesión en background
  bloqueaba `apply_migration`/`execute_sql` con DDL como "Production Deploy") — verificado
  post-apply sin drift ni alertas nuevas de seguridad.
- **Módulo Agenda completo:** disponibilidad por reglas (con precedencia), turnos con estado
  (Reservado/Confirmado/Realizado/Cancelado/No vino), cupos de lanzamiento (25 hasta
  20/11/2026), puente turno → sesión real.
- **QA manual:** confirmado funcional por Francesco contra Supabase real. Feedback de UX
  pendiente para un pase posterior (ver sección 6).
- **Proceso:** implementado con superpowers subagent-driven-development — 8 tareas de código,
  cada una con implementación + revisión independiente, más una revisión final de rama completa
  que encontró y corrigió 4 bugs de integración cruzada antes de este informe (ver sección 4).

## 2. Commits desde la versión anterior (`1c1e724`)

```
25a7fe8 fix(agenda): cupos refresh, invalidación de caché, día vecino y sesión vinculada
92a03e2 feat(ui): puente turno → sesión
14ef3dc feat(ui): panel de reglas de disponibilidad en la Agenda
eba2b07 feat(ui): alta y edición de turnos en la Agenda
34ba6d3 feat(ui): panel del día en la Agenda
39d7037 feat(ui): calendario mensual de la Agenda
00c02a0 feat(ui): navegación del tab Agenda
7d612a3 feat(db): capa de datos para turnos, reglas de disponibilidad y cupos
22c160c feat(db): agenda — turnos, reglas de disponibilidad y cupos
d6aab7b docs: preflight fixes to Agenda plan (pendingTurnoId lifecycle, desvincular UI)
a2cbd80 docs: actualizar CLAUDE.md y guardar spec de Agenda
```

## 3. Cambios funcionales (lo que ve el usuario)

### Agenda (tab nuevo, primer ítem del grupo "Trabajo")
- **Calendario mensual**, lunes primero. Día cerrado: fondo oscuro. Día abierto: borde dorado +
  horario si la regla lo define. Hoy: número en círculo dorado. Chips de turnos del día con
  color por estado; turnos Cancelado/No vino se ven tachados en rojo. Días pasados sin turno
  muestran un check por cada sesión suelta de ese día. Punto rojo si el día está cerrado y
  tiene turnos activos.
- **Barra de cupos de lanzamiento** arriba del calendario: X/25 y días restantes hasta
  20/11/2026, en rojo si quedan ≤3 cupos o ≤7 días.
- **Panel del día** (click en una celda): badge Abierto/Cerrado + motivo, botón para
  abrir/cerrar ese día puntual (con aviso si hay turnos activos, no bloquea), lista de turnos
  con acciones según estado, sesiones sueltas de ese día.
- **Panel de turno**: alta/edición con fecha, hora, duración, cliente, contacto, tatuaje
  vinculado, cupo de lanzamiento, seña, notas. Avisa si el día está cerrado o el cupo está
  agotado, no bloquea el guardado. Permite vincular una sesión ya existente de esa fecha.
- **Panel de reglas**: crear reglas (abrir/cerrar, días de semana o todos, rango de fechas,
  horario, motivo) con vista previa de los próximos 90 días que toca. Lista de reglas vigentes
  y un bloque colapsado de vencidas.
- **Puente a Sesiones**: "Registrar sesión" desde un turno abre Sesiones con la fecha y el
  tatuaje precargados; al guardar, el turno pasa a Realizado automáticamente.

### Cambios en Sesiones (módulo existente)
- Borrar una sesión vinculada a un turno ahora avisa ("desvinculala desde la Agenda primero")
  en vez de fallar con un error de constraint de base de datos.

## 4. Base de datos (Supabase `minletiyftpmufqpmviv`)

Todo aplicado en producción y replicado en `schema.sql` /
`docs/superpowers/plans/sql/2026-09-26-agenda.sql`.

| Objeto | Qué es |
|---|---|
| `turnos` | `fecha`, `hora_inicio`, `duracion_min`, `cliente`, `contacto`, `tatuaje_id`, `sesion_id` (unique), `estado`, `cupo_lanzamiento`, `sena_ars`, `notas`. Constraint `turnos_realizado_con_sesion`: `estado='Realizado' ⇔ sesion_id is not null` |
| `disponibilidad_reglas` | `efecto` (abrir/cerrar), `dias_semana` (smallint[] o null=todos), `desde`/`hasta`, `hora_desde`/`hora_hasta`, `motivo` |
| `fn_agenda_dias(p_desde, p_hasta)` (función, `security invoker`, tope 400 días) | Resuelve el día ganador por precedencia: rango cerrado > un lado > sin fechas; luego rango más corto; luego menos días de semana; luego más nueva. Devuelve `turnos_activos` por día |
| `v_cupos_lanzamiento` (vista, `security_invoker`) | Por tenant: total, hasta, usados, disponibles, días restantes, contra `config` con `clave='cupos_lanzamiento'` |

- RLS: `tenant_isolation` en ambas tablas nuevas, mismo patrón que el resto de las tablas de
  datos (`tenant_id = auth.uid()`).
- **Revisión final de seguridad (get_advisors):** 5 alertas preexistentes, ninguna nueva
  atribuible a esta migración.
- **Pendiente, no aplicado (bajo riesgo, requiere otro apply a producción):** `revoke all ...
  from anon` en `turnos`/`disponibilidad_reglas`/`v_cupos_lanzamiento`/`fn_agenda_dias`, para
  igualar el patrón de las tablas más nuevas (`tatuaje_fotos`, etc.). Sin riesgo real hoy — RLS
  ya bloquea `anon` — es solo consistencia de estilo.

## 5. Cosas que la revisión final encontró y ya están corregidas

La revisión de rama completa (después de que las 8 tareas de código pasaran su revisión
individual) encontró 4 bugs que solo eran visibles mirando el conjunto, ya arreglados en
`25a7fe8`:

1. El contador de cupos no se refrescaba después de crear/cancelar/borrar un turno.
2. Confirmar/cancelar/marcar no vino/desvincular un turno no invalidaba la caché de días — el
   punto rojo y el aviso de "día con turnos activos" podían quedar desactualizados.
3. Los días grises del mes anterior/siguiente en el calendario leían la caché con la key
   equivocada y podían mostrar abierto/cerrado al revés.
4. Borrar una sesión vinculada a un turno fallaba contra el constraint de base de datos (ver
   sección 3).

## 6. Pendientes

- **UX de la Agenda** (pedido explícito de Francesco, para después de este merge): la pantalla
  se ve muy oscura y comprimida. Repasar agrupación por categorías, espaciado, y qué
  transiciones/animaciones sumarían a la experiencia sin romper el patrón visual del resto del
  sistema.
- **Decisión pendiente de Francesco:** un edge case del toggle de día cuando hay una regla
  semanal y una manual superpuestas sobre el mismo día puede hacer que "Cerrar este día" no
  visiblemente cambie nada (ver ledger de la sesión de implementación para el detalle exacto).
- `revoke ... from anon` en los objetos nuevos (sección 4) — cosmético, sin urgencia.
- Riesgo de referencia cross-tenant vía FK (patrón preexistente, no explotable con la UI
  actual) — a tener en cuenta cuando se construya onboarding por invitación.
- Del roadmap anterior sin cambios: onboarding por invitación, cobro/billing, bot de Telegram,
  layout mobile, timer de sesión, Fase 2 (contenido en el calendario) y Fase 3 (métricas) de la
  propia Agenda — ver `docs/superpowers/specs/2026-09-26-agenda-design.md` sección 8.
