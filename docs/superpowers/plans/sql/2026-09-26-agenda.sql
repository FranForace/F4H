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
