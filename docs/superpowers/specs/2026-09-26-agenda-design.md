# F4H — Agenda (fase 1) · Handoff para Claude Code

> Documento autocontenido. Diseño cerrado y validado con Francesco el 2026-09-26.
> El SQL de la sección 3 ya fue probado en un Postgres 16 local (casos de precedencia
> + aislamiento RLS entre tenants). **No está aplicado en Supabase todavía.**
> Leé `CLAUDE.md` antes de empezar: todas sus reglas siguen vigentes.

---

## 0. Qué se construye

Una sección **Agenda** dentro de `F4H_Sistema_Beta_v6.html` para organizar el negocio:

- **Disponibilidad por reglas:** todos los días arrancan **cerrados**. Se abren/cierran con
  reglas (día puntual, "todos los lunes", "lunes del X al Y", "ese día no", etc.).
- **Turnos:** a quién tengo que tatuar (lo que viene).
- **Pasado:** a quién tatué = `sesiones` existentes (no se duplica nada).
- **Cupos de lanzamiento:** contador X/25 hasta el 20/11/2026.
- **Puente turno → sesión:** desde un turno se registra la sesión real y el turno queda Realizado.

Uso personal (solo el tenant logueado). Todo dentro del sistema: **sin** exportar a
calendarios externos, **sin** página pública.

### Decisiones cerradas

| Tema | Decisión |
|---|---|
| Estado base | Todo cerrado. Sin reglas → cerrado |
| Choque entre reglas | **Gana la más específica** (ver 2.2). No "la última cargada gana" |
| "Realizado" | Solo con sesión vinculada — constraint en DB (`Realizado ⇔ sesion_id not null`) |
| Turno en día cerrado | Se permite con **aviso**, no se bloquea |
| Cerrar día con turnos | Se permite con **aviso** |
| Horario de un día abierto | Sale de la regla que lo abre; si la regla no tiene horario, queda vacío (sin default global) |
| Seña (`sena_ars`) | Solo se guarda en el turno. No genera movimiento en Finanzas (fase futura) |
| Pipeline de contenido | Fuera de esta fase. Vive en carpetas; la fase 2 solo agrega fecha de publicación |

### Fuera de alcance (no construir)

Página pública · tabla `clientes` · capacidad máx. por día · recordatorios · export .ics ·
contenido/métricas (fases 2 y 3) · tarjeta en Dashboard.

---

## 1. Reglas de trabajo (de Francesco + CLAUDE.md)

- Branch nuevo `feature/agenda` desde `dev`. **Nada directo a `main`** (Vercel deploya `main`).
- **Mostrar el plan y pedir OK antes de aplicar SQL en producción.** Nada destructivo sin confirmación.
- Antes de aplicar, **verificar el schema vivo** (hay antecedentes de drift repo ↔ Supabase).
- DB es fuente de verdad: mutations por funciones `db*()` en `js/db.js`, `S` se refresca vía adapters.
- Render: **inline styles**, **concatenación de strings** dentro de `.map()` (no template literals anidados),
  escapes `\xED \xE1 \xFA \xF3 \xE9 \xF1` para acentos dentro de template literals.
- No tocar `globalScore`, `siget_f4h_v6`, V5, ni la estructura modular archivada (`index.html`, `js/views/*`).
- IDs: `String(id)` en S, `Number(id)` al escribir.
- Design system dark de CLAUDE.md (`--accent #c8a96e`, cards `--bg-card` radius 14px, badges uppercase).
- Paso a paso: un commit por tarea, mostrando el diff relevante.

---

## 2. Modelo

### 2.1 Tablas

- `turnos` — fecha, hora_inicio, duracion_min, cliente, contacto, tatuaje_id, sesion_id (unique),
  estado (`Reservado|Confirmado|Realizado|Cancelado|No vino`), cupo_lanzamiento, sena_ars, notas.
- `disponibilidad_reglas` — efecto (`abrir|cerrar`), dias_semana `smallint[]` ISO 1=lun…7=dom
  (`null` = todos), desde/hasta (cada punta puede ser `null`), hora_desde/hora_hasta, motivo.
- `config.cupos_lanzamiento` = `{"total":25,"hasta":"2026-11-20"}`.

Ejemplos de reglas:

| Quiero… | efecto | dias_semana | desde | hasta |
|---|---|---|---|---|
| Abrir el 14/10 | abrir | null | 2026-10-14 | 2026-10-14 |
| Todos los lunes | abrir | {1} | null | null |
| Lunes del 1/10 al 15/12 | abrir | {1} | 2026-10-01 | 2026-12-15 |
| …pero el 12/10 no | cerrar | null | 2026-10-12 | 2026-10-12 |
| Vacaciones noviembre | cerrar | null | 2026-11-01 | 2026-11-30 |
| …salvo el 16/11 | abrir | null | 2026-11-16 | 2026-11-16 |

### 2.2 Precedencia (implementada en `fn_agenda_dias`, NO reimplementar en JS)

Entre las reglas que tocan un día, gana la primera según:
1. rango cerrado (desde y hasta) → una punta abierta → sin fechas
2. rango más corto (`hasta - desde`)
3. menos días de la semana (`{1}` antes que `null`=7)
4. `created_at desc`, `id desc`

Resultado verificado: lunes abiertos; 12/10 cerrado; noviembre cerrado salvo 16/11;
sábados solo en octubre; empate 20/10 → la más nueva; otro tenant ve 0 días abiertos.

### 2.3 `fn_agenda_dias(p_desde date, p_hasta date)`

Devuelve por día: `fecha, abierto, hora_desde, hora_hasta, regla_id, regla_efecto,
regla_motivo, turnos_activos`. `security invoker` (respeta RLS). Tope 400 días.
Llamar con `_db.rpc('fn_agenda_dias', { p_desde, p_hasta })`.

---

## 3. SQL (Tarea 1 — aplicar tal cual, después de la verificación previa)

```sql
-- ── 1. Turnos ──────────────────────────────────────────────────────────────
create table public.turnos (
  id               bigint generated always as identity primary key,
  tenant_id        uuid not null references auth.users(id) default auth.uid(),
  fecha            date not null,
  hora_inicio      time,
  duracion_min     integer check (duracion_min is null or duracion_min > 0),
  cliente          text not null,
  contacto         text,
  tatuaje_id       bigint references public.tatuajes(id) on delete set null,
  sesion_id        bigint unique references public.sesiones(id) on delete set null,
  estado           text not null default 'Reservado'
                   check (estado in ('Reservado','Confirmado','Realizado','Cancelado','No vino')),
  cupo_lanzamiento boolean not null default false,
  sena_ars         numeric not null default 0 check (sena_ars >= 0),
  notas            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint turnos_realizado_con_sesion
    check ((estado = 'Realizado') = (sesion_id is not null))
);
create index idx_turnos_tenant_fecha on public.turnos(tenant_id, fecha);
create trigger trg_touch_turnos before update on public.turnos
  for each row execute function fn_touch_updated_at();
alter table public.turnos enable row level security;
create policy tenant_isolation on public.turnos for all
  using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- ── 2. Reglas de disponibilidad ────────────────────────────────────────────
create table public.disponibilidad_reglas (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references auth.users(id) default auth.uid(),
  efecto       text not null check (efecto in ('abrir','cerrar')),
  dias_semana  smallint[] check (
                 dias_semana is null
                 or (cardinality(dias_semana) between 1 and 7
                     and dias_semana <@ array[1,2,3,4,5,6,7]::smallint[])),
  desde        date,
  hasta        date,
  hora_desde   time,
  hora_hasta   time,
  motivo       text,
  created_at   timestamptz not null default now(),
  check (desde is null or hasta is null or hasta >= desde),
  check (hora_desde is null or hora_hasta is null or hora_hasta > hora_desde)
);
create index idx_disp_reglas_tenant on public.disponibilidad_reglas(tenant_id);
alter table public.disponibilidad_reglas enable row level security;
create policy tenant_isolation on public.disponibilidad_reglas for all
  using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- ── 3. Resolución por día ──────────────────────────────────────────────────
create or replace function public.fn_agenda_dias(p_desde date, p_hasta date)
returns table (
  fecha date, abierto boolean, hora_desde time, hora_hasta time,
  regla_id bigint, regla_efecto text, regla_motivo text, turnos_activos integer
)
language sql stable security invoker set search_path = public
as $$
  select d::date,
         coalesce(r.efecto = 'abrir', false),
         case when r.efecto = 'abrir' then r.hora_desde end,
         case when r.efecto = 'abrir' then r.hora_hasta end,
         r.id, r.efecto, r.motivo,
         (select count(*)::int from turnos t
           where t.fecha = d::date
             and t.estado in ('Reservado','Confirmado','Realizado'))
  from generate_series(p_desde, least(p_hasta, p_desde + 400), interval '1 day') d
  left join lateral (
    select x.* from disponibilidad_reglas x
    where (x.desde is null or d::date >= x.desde)
      and (x.hasta is null or d::date <= x.hasta)
      and (x.dias_semana is null or extract(isodow from d)::smallint = any (x.dias_semana))
    order by case when x.desde is not null and x.hasta is not null then 0
                  when x.desde is not null or  x.hasta is not null then 1
                  else 2 end,
             (x.hasta - x.desde) asc nulls last,
             coalesce(cardinality(x.dias_semana), 7) asc,
             x.created_at desc, x.id desc
    limit 1
  ) r on true
  order by 1;
$$;
revoke execute on function public.fn_agenda_dias(date, date) from public;
grant  execute on function public.fn_agenda_dias(date, date) to authenticated;

-- ── 4. Cupos de lanzamiento ────────────────────────────────────────────────
insert into public.config (tenant_id, clave, valor)
select id, 'cupos_lanzamiento', '{"total": 25, "hasta": "2026-11-20"}'::jsonb
from auth.users where email = 'franforace@gmail.com'
on conflict (tenant_id, clave) do nothing;

create or replace view public.v_cupos_lanzamiento with (security_invoker = true) as
select c.tenant_id,
       (c.valor ->> 'total')::int                   as total,
       (c.valor ->> 'hasta')::date                  as hasta,
       count(t.id)                                  as usados,
       (c.valor ->> 'total')::int - count(t.id)     as disponibles,
       (c.valor ->> 'hasta')::date - current_date   as dias_restantes
from public.config c
left join public.turnos t
       on t.tenant_id = c.tenant_id and t.cupo_lanzamiento
      and t.estado in ('Reservado','Confirmado','Realizado')
where c.clave = 'cupos_lanzamiento'
group by c.tenant_id, c.valor;
grant select on public.v_cupos_lanzamiento to authenticated;
```

### Verificación previa (antes de aplicar)

```sql
-- no deben existir
select to_regclass('public.turnos'), to_regclass('public.disponibilidad_reglas');
-- deben existir
select proname from pg_proc where proname = 'fn_touch_updated_at';
select conname from pg_constraint where conrelid = 'public.config'::regclass;  -- PK/unique (tenant_id, clave)
select data_type from information_schema.columns
 where table_name = 'config' and column_name = 'valor';                           -- jsonb
```

### Verificación posterior

```sql
select tablename, policyname from pg_policies
 where tablename in ('turnos','disponibilidad_reglas');
select * from v_cupos_lanzamiento;                           -- 25 / 0 usados
select count(*) filter (where abierto) from fn_agenda_dias(current_date, current_date + 60);  -- 0
```

Si tenés el MCP de Supabase, correr `get_advisors` (security) y confirmar que no aparezcan alertas nuevas.

Después: agregar el bloque al final de `schema.sql` y guardar el SQL en
`docs/superpowers/plans/sql/2026-09-26-agenda.sql`. Commit: `feat(db): agenda — turnos, reglas de disponibilidad y cupos`.

---

## 4. Capa de datos — `js/db.js` (Tarea 2)

Agregar, siguiendo el estilo existente (`dbError` en errores, devolver `null/false`):

```
adaptTurno(t)  → { id:String, fecha, hora:t.hora_inicio?.slice(0,5)||'', dur, cli, contacto,
                   tid:String|null, sid:String|null, estado, cupo, sena, notas }
adaptRegla(r)  → { id:String, efecto, dias:(array|null), desde, hasta, hDesde, hHasta, motivo, created }

getTurnos()            select * from turnos order by fecha, hora_inicio
getReglas()            select * from disponibilidad_reglas order by created_at desc
getCupos()             select * from v_cupos_lanzamiento  (maybeSingle; null si no hay config)
dbAgendaDias(d, h)     rpc('fn_agenda_dias', {p_desde:d, p_hasta:h}) → array tal cual
dbSaveTurno(t)         insert/update (sin tocar estado 'Realizado' ni sesion_id desde acá)
dbSetEstadoTurno(id, estado)      solo Reservado/Confirmado/Cancelado/No vino
dbVincularSesionTurno(turnoId, sesionId)
                       update turnos set sesion_id=?, estado='Realizado' where id=?  (una sola sentencia)
dbDesvincularSesionTurno(turnoId) update set sesion_id=null, estado='Confirmado'
dbDeleteTurno(id)      delete (solo si no tiene sesion_id; si tiene, error amigable)
dbSaveRegla(r)         insert
dbDeleteRegla(id)      delete
```

En `initDB()`: sumar `getTurnos()`, `getReglas()`, `getCupos()` al `Promise.all`;
`S.turnos`, `S.reglas`, `S.cupos`. Inicializar esas keys en el objeto `S`.
Tras cada mutation, refrescar `S.turnos`/`S.reglas`/`S.cupos` según corresponda y re-render.

**No** calcular abierto/cerrado en JS: siempre `dbAgendaDias`. Cachear por mes en
un objeto `AG.dias[yyyy-mm]` e invalidarlo tras cualquier mutation de reglas o turnos.

---

## 5. Interfaz (Tareas 3–6)

### Tarea 3 — Navegación
- Sidebar, grupo **Trabajo**, primer ítem: `data-tab="agenda"` · icono `&#x25A6;` · "Agenda".
- `<div id="t-agenda" style="display:none"></div>` junto a los demás.
- Sumar `'agenda'` al array de `go()` y a `renderAll()`; `if(t==='agenda')renderAgenda();`.

### Tarea 4 — `renderAgenda()` · calendario mensual
Estado local: `let AG={mes:'YYYY-MM', dia:null, panel:'dia'|'reglas'|'turno', dias:{}}`.

- **Header** igual a los otros módulos (kicker dorado "Trabajo", título "Agenda",
  subtítulo "Disponibilidad, turnos y cupos").
- **Barra de cupos** (si `S.cupos`): `Cupos de lanzamiento  X/25  ·  N días` + barra de progreso
  (`progress-bar` existente). Rojo si quedan ≤3 cupos o ≤7 días.
- **Navegación de mes:** ‹ Mes Año › + botón "Hoy" + botón "Reglas de disponibilidad".
- **Grilla 7 columnas, lunes primero** (L M X J V S D). Celdas del mes anterior/siguiente atenuadas.
  - Cerrado: fondo `--bg`, número `--text-3`.
  - Abierto: fondo `--bg-card`, borde `1.5px solid var(--accent)`, horario chico si hay.
  - Hoy: número en círculo dorado.
  - Chips de turnos del día (desde `S.turnos`): `HH:MM Cliente`, color por estado
    (Reservado ámbar, Confirmado verde, Realizado gris, Cancelado/No vino tachado rojo).
  - Días pasados: chip `✓ Cliente` por cada `S.sesiones` de esa fecha que **no** esté vinculada a un turno.
  - Aviso visual (punto rojo) si el día está cerrado y tiene turnos activos.
  - `title` del día: `Abierto por: <motivo>` / `Cerrado por: <motivo>` / `Cerrado (sin reglas)`.
- Layout: grilla `1fr` + panel lateral `340px` (mismo patrón split que Tatuajes).
- Click en día → `AG.dia=fecha; AG.panel='dia'`.

### Tarea 5 — Panel del día
- Fecha larga + badge ABIERTO/CERRADO + "por: <motivo de la regla>".
- **Botón toggle** (lógica exacta, evita apilar reglas):
  ```
  r = regla que decide el día (S.reglas.find(id == dia.regla_id))
  si r existe y r.desde == r.hasta == fecha y r.dias == null:
      dbDeleteRegla(r.id)                    // vuelve a lo que digan las reglas generales
  si no:
      dbSaveRegla({efecto: abierto ? 'cerrar' : 'abrir', desde: fecha, hasta: fecha, motivo: 'Manual'})
  ```
  Si se va a **cerrar** y `turnos_activos > 0` → aviso inline con "Cerrar igual" / "Cancelar".
- Lista de turnos del día con acciones: Confirmar · Cancelar · No vino · Editar ·
  **Registrar sesión** (si no está Realizado) · "Ver sesión" (si está Realizado).
- Sesiones registradas ese día sin turno (lectura, link a `editSesFromTattoo`-style).
- Botón **+ Turno** → panel turno con fecha precargada.

### Tarea 6 — Panel de turno (alta/edición)
Campos: fecha, hora, duración (min), cliente*, contacto, tatuaje vinculado (select de
`S.tatuajes` no Finalizados + opción "— ninguno —"), **usa cupo de lanzamiento** (checkbox,
default ON mientras `S.cupos.disponibles > 0` y fecha ≤ `S.cupos.hasta`), seña ARS, notas.
- Si la fecha está cerrada → aviso inline "Este día está cerrado" + "Guardar igual".
- Si el cupo está agotado y se marca cupo → aviso (no bloqueo).

### Tarea 7 — Panel de reglas
- Formulario:
  - Efecto: toggle **Abrir / Cerrar**.
  - Qué días: chips L M X J V S D (multi) + opción "Todos los días" (→ `dias_semana=null`).
  - Desde / Hasta: dos `date` opcionales (vacío = sin límite). Atajo "Solo un día" que iguala ambos.
  - Horario: desde/hasta opcional (solo visible si Abrir).
  - Motivo (texto).
  - **Vista previa** antes de guardar: "Esta regla toca N días en los próximos 90: 5/10, 12/10, 19/10…"
    (cálculo simple en JS de *qué días coinciden* — no del resultado final; el resultado
    final se ve en el calendario después de guardar).
  - Validaciones: al menos un día de semana si no es "Todos"; hasta ≥ desde.
- Lista de reglas vigentes: descripción legible
  ("Abrir · lunes · desde 1/10 hasta 15/12 · 10:00–19:00 · 'temporada'"), botón ✕.
  Reglas vencidas (`hasta < hoy`) en un bloque colapsado.

### Tarea 8 — Puente turno → sesión
- "Registrar sesión" desde un turno: `go('ses')`, `setSesView('nueva')`, y precargar
  `sf-fecha` = fecha del turno y, si hay `tatuaje_id`, agregarlo como tatuaje vinculado de la
  sesión (misma vía que usa hoy la UI al vincular un tatuaje). Guardar `pendingTurnoId` global.
- En `saveSes()`, después de obtener `sesId` OK y **solo si** `pendingTurnoId`:
  `await dbVincularSesionTurno(pendingTurnoId, sesId)`; limpiar `pendingTurnoId`.
  Si falla, `msg` de error: "Sesión guardada, pero no se pudo vincular al turno — vinculala desde la Agenda".
- En el panel del turno, además: **"Vincular sesión existente"** (select con las sesiones de esa
  fecha sin turno). Sirve para turnos pasados y como recuperación del caso anterior.
- Si `go()` sale de sesiones sin guardar, limpiar `pendingTurnoId`.
- No modificar `dbSaveSesion`.

---

## 6. QA manual (Tarea 9) — probar en local contra Supabase

1. Sin reglas: todo el mes cerrado; tooltip "Cerrado (sin reglas)".
2. Regla "abrir lunes 10–19" → todos los lunes con borde dorado y horario.
3. Click en un lunes → Cerrar → queda cerrado "por: Manual". Click de nuevo → vuelve a abierto
   "por: todos los lunes" y la regla puntual **desaparece** de la lista (no se apila).
4. "Cerrar 1/11–30/11" + "abrir 16/11" → noviembre cerrado salvo el 16.
5. Turno en día cerrado → aviso, se guarda con "Guardar igual"; punto rojo en el día.
6. Turno con cupo → contador baja; cancelarlo → vuelve a subir.
7. Intentar forzar Realizado sin sesión (desde consola) → la DB lo rechaza (constraint).
8. Registrar sesión desde turno → sesión creada con fecha/tatuaje; turno Realizado; chip gris.
9. Vincular sesión existente a un turno pasado.
10. Borrar turno Realizado → error amigable.
11. Offline (cortar red) → banner offline, Agenda muestra lo cacheado sin romper.
12. Consola sin errores; resto de módulos (Sesiones, Tatuajes, Inventario) intactos.

---

## 7. Cierre (Tarea 10)

- Actualizar `CLAUDE.md`: tablas nuevas, `fn_agenda_dias` y su precedencia, `v_cupos_lanzamiento`,
  módulo Agenda en la lista de tabs, regla "Realizado ⇔ sesión".
- Guardar este documento como `docs/superpowers/specs/2026-09-26-agenda-design.md`.
- Informe corto de estado en `docs/estado-proyecto-<fecha>.md` (mismo formato que los anteriores).
- PR / merge `feature/agenda` → `dev`. **Merge a `main` solo con OK explícito de Francesco.**
  Verificar deploy con el `sha256sum` de CLAUDE.md.

## 8. Próximas fases (no hacer ahora, solo contexto)

- **Fase 2 — Contenido en el calendario:** tabla `contenidos` (fecha programada, plataforma,
  formato de los 6, pilar P1–P5, esfuerzo, familia de gancho, texto del gancho, tatuaje_id,
  url, duración, publicado). Chips en el mismo calendario. El pipeline sigue en carpetas.
- **Fase 3 — Métricas:** `contenido_metricas` (mediciones fechadas: views, retención, % completo,
  % For You, shares, saves, comentarios) + vistas: rendimiento por formato vs línea base 22%,
  candidatos a serie fija (2 veces seguidas sobre el promedio), mix semanal 1 alto/2 medios/2 bajos.
