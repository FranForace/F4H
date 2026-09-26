-- ═══════════════════════════════════════════════════════════════════════════
-- F4H Sistema — Schema Supabase (PostgreSQL)
-- Decisiones: IDs bigint identity en todas las tablas, FKs enteras,
-- sin columnas legacy. Stock vive en productos.stock, mantenido por trigger.
-- Multi-tenant: cada tabla de datos (excepto las tablas puente kit_items y
-- sesion_agujas_testeadas, que heredan el tenant de su padre) lleva
-- tenant_id = auth.uid() del dueño de la fila; ver sección RLS al final.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table productos (
  id                bigint generated always as identity primary key,
  tenant_id         uuid not null references auth.users(id) default auth.uid(),
  nombre            text not null,
  categoria         text not null check (categoria in ('Activo','Descartable','Consumible','Aguja')),
  subcategoria      text,
  tipo_consumo      text not null default 'UNIDAD'
                    check (tipo_consumo in ('UNIDAD','SESION','VARIABLE','LONGITUD')),
  unidad_medida     text not null default 'Unidad',
  stock             numeric not null default 0 check (stock >= 0),
  stock_minimo      numeric not null default 0,
  moneda            text not null default 'ARS' check (moneda in ('ARS','USD')),
  costo_unitario    numeric not null default 0,
  usos_por_unidad   numeric not null default 1 check (usos_por_unidad > 0),
  vida_util_meses   integer,
  practica          boolean not null default false,
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint productos_tenant_nombre_key unique (tenant_id, nombre)
);

create table tatuajes (
  id           bigint generated always as identity primary key,
  tenant_id    uuid not null references auth.users(id) default auth.uid(),
  numero       integer,
  cliente      text,
  diseno       text not null,
  estilo       text,
  zona         text,
  tamano       text,
  estado       text not null default 'Pendiente'
               check (estado in ('Pendiente','En curso','Finalizado')),
  precio       numeric not null default 0,
  url_referencia text,
  notas        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table kits (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references auth.users(id) default auth.uid(),
  nombre     text not null,
  created_at timestamptz not null default now(),
  constraint kits_tenant_nombre_key unique (tenant_id, nombre)
);

create table kit_items (
  kit_id      bigint not null references kits(id) on delete cascade,
  producto_id bigint not null references productos(id),
  cantidad    numeric not null default 1 check (cantidad > 0),
  primary key (kit_id, producto_id)
);

create table sesiones (
  id                 bigint generated always as identity primary key,
  tenant_id          uuid not null references auth.users(id) default auth.uid(),
  fecha              date not null default current_date,
  cliente            text,
  zona               text,
  horas              numeric,
  maquina            text,
  aguja_principal_id bigint references productos(id),
  voltaje            numeric,
  stroke             text,
  tatuaje_id         bigint references tatuajes(id) on delete set null,
  kit_id             bigint references kits(id) on delete set null,
  score_linea        smallint not null default 0 check (score_linea between 0 and 10),
  score_relleno      smallint not null default 0 check (score_relleno between 0 and 10),
  score_tecnica      smallint not null default 0 check (score_tecnica between 0 and 10),
  score_diseno       smallint not null default 0 check (score_diseno between 0 and 10),
  score_conformidad  smallint not null default 0 check (score_conformidad between 0 and 10),
  practica           boolean not null default false,
  notas              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- agujas testeadas: tabla puente (no descuentan stock, solo bitácora)
create table sesion_agujas_testeadas (
  sesion_id   bigint not null references sesiones(id) on delete cascade,
  producto_id bigint not null references productos(id),
  primary key (sesion_id, producto_id)
);

create table movimientos (
  id               bigint generated always as identity primary key,
  tenant_id        uuid not null references auth.users(id) default auth.uid(),
  fecha            date not null default current_date,
  producto_id      bigint not null references productos(id),
  tipo             text not null check (tipo in ('entrada','salida')),
  cantidad         numeric not null check (cantidad > 0),
  costo_al_momento numeric,
  sesion_id        bigint references sesiones(id) on delete set null,
  referencia       text,
  created_at       timestamptz not null default now()
);

create table config (
  tenant_id  uuid not null references auth.users(id) default auth.uid(),
  clave      text not null,
  valor      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, clave)
);

-- ── Índices ─────────────────────────────────────────────────────────────────

create index idx_movimientos_producto on movimientos(producto_id);
create index idx_movimientos_fecha    on movimientos(fecha);
create index idx_movimientos_sesion   on movimientos(sesion_id);
create index idx_sesiones_tatuaje     on sesiones(tatuaje_id);
create index idx_sesiones_fecha       on sesiones(fecha);
create index idx_productos_categoria  on productos(categoria);

-- ── Trigger: updated_at automático ─────────────────────────────────────────

create or replace function fn_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_touch_productos before update on productos
  for each row execute function fn_touch_updated_at();
create trigger trg_touch_tatuajes  before update on tatuajes
  for each row execute function fn_touch_updated_at();
create trigger trg_touch_sesiones  before update on sesiones
  for each row execute function fn_touch_updated_at();
create trigger trg_touch_config    before update on config
  for each row execute function fn_touch_updated_at();

-- ── Trigger: WAC (costo promedio ponderado) + stock en movimientos ─────────
-- Regla de negocio: en una ENTRADA con costo_al_momento informado, el costo
-- unitario del producto se recalcula como promedio ponderado ANTES de sumar
-- el stock nuevo. En cualquier movimiento, el stock se ajusta.
-- El CHECK stock >= 0 de productos aborta salidas sin stock suficiente.

create or replace function fn_movimiento_aplicar() returns trigger as $$
declare
  v_stock numeric;
  v_costo numeric;
begin
  select stock, costo_unitario into v_stock, v_costo
  from productos where id = new.producto_id
  for update;

  if new.tipo = 'entrada' then
    if new.costo_al_momento is not null and new.costo_al_momento > 0 then
      if v_stock <= 0 then
        update productos set costo_unitario = new.costo_al_momento
        where id = new.producto_id;
      else
        update productos
        set costo_unitario = round(
          (v_stock * v_costo + new.cantidad * new.costo_al_momento)
          / (v_stock + new.cantidad),
          2
        )
        where id = new.producto_id;
      end if;
    end if;
    update productos set stock = stock + new.cantidad where id = new.producto_id;
  else
    update productos set stock = stock - new.cantidad where id = new.producto_id;
  end if;

  -- si no se informó costo, sellar el movimiento con el costo vigente
  if new.costo_al_momento is null then
    new.costo_al_momento := v_costo;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_movimiento_aplicar before insert on movimientos
  for each row execute function fn_movimiento_aplicar();

-- ── RLS (multi-tenant: aislamiento por tenant_id = auth.uid()) ─────────────

alter table productos                enable row level security;
alter table tatuajes                 enable row level security;
alter table kits                     enable row level security;
alter table kit_items                enable row level security;
alter table sesiones                 enable row level security;
alter table sesion_agujas_testeadas  enable row level security;
alter table movimientos              enable row level security;
alter table config                   enable row level security;

-- Tenant-scoped policies en las 6 tablas que llevan tenant_id propio.
create policy tenant_isolation on productos   for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy tenant_isolation on tatuajes    for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy tenant_isolation on kits        for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy tenant_isolation on sesiones    for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy tenant_isolation on movimientos for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy tenant_isolation on config      for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- Policies basadas en join para las dos tablas puente (no tienen tenant_id
-- propio — el aislamiento viene de su tabla padre).
create policy tenant_isolation on kit_items for all
  using (exists (select 1 from kits where kits.id = kit_items.kit_id and kits.tenant_id = auth.uid()))
  with check (exists (select 1 from kits where kits.id = kit_items.kit_id and kits.tenant_id = auth.uid()));

create policy tenant_isolation on sesion_agujas_testeadas for all
  using (exists (select 1 from sesiones where sesiones.id = sesion_agujas_testeadas.sesion_id and sesiones.tenant_id = auth.uid()))
  with check (exists (select 1 from sesiones where sesiones.id = sesion_agujas_testeadas.sesion_id and sesiones.tenant_id = auth.uid()));

-- ── Trigger: bootstrap de tenant nuevo ──────────────────────────────────────
-- Al crearse un usuario en auth.users (signup), este trigger le siembra el
-- mismo catálogo base que seed.sql (37 productos, 1 kit, 2 config). Corre
-- como SECURITY DEFINER porque en el momento del signup no existe todavía
-- una sesión autenticada, así que auth.uid() sería NULL y las policies de
-- arriba bloquearían todos los inserts.

create or replace function fn_tenant_bootstrap() returns trigger as $$
declare
  v_kit_id bigint;
begin
  insert into config (tenant_id, clave, valor) values
    (new.id, 'tipo_cambio', '1500'::jsonb),
    (new.id, 'sesiones_por_mes', '8'::jsonb);

  insert into productos
    (tenant_id, nombre, categoria, subcategoria, tipo_consumo, unidad_medida,
     stock, stock_minimo, moneda, costo_unitario, usos_por_unidad,
     vida_util_meses, practica)
  values
    (new.id, 'Pen Garage', 'Activo', 'Maquina', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 25000, 1, 24, false),
    (new.id, 'Ambition Soldier', 'Activo', 'Maquina', 'UNIDAD', 'Unidad', 1, 0, 'USD', 147.36, 1, 36, false),
    (new.id, 'Fuente Critical', 'Activo', 'Fuente', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 205000, 1, 36, false),
    (new.id, 'Pedal', 'Activo', 'Otros', 'UNIDAD', 'Unidad', 0, 0, 'ARS', 0, 1, 60, false),
    (new.id, 'iPad A16 + Apple Pen', 'Activo', 'Tecnologia', 'UNIDAD', 'Unidad', 1, 0, 'USD', 505, 1, 24, false),
    (new.id, 'Inkless Printer', 'Activo', 'Impresora', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 150000, 1, 36, false),
    (new.id, 'Tornito Bate Pintura', 'Activo', 'Otros', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 15000, 1, 60, false),
    (new.id, 'Mesita', 'Activo', 'Mobiliario', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 55000, 1, 60, false),
    (new.id, 'Apoyabrazos plegable', 'Activo', 'Mobiliario', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 82700, 1, 60, false),
    (new.id, 'Trípode Genki', 'Activo', 'Mobiliario', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 39600, 1, 60, false),
    (new.id, 'Cups Medianos (100u)', 'Descartable', 'Cups', 'UNIDAD', 'Caja', 2, 1, 'ARS', 2000, 100, null, false),
    (new.id, 'Papel Stencil', 'Descartable', 'Papel', 'UNIDAD', 'Unidad', 15, 4, 'ARS', 2000, 1, null, false),
    (new.id, 'Grip p/ Pen', 'Descartable', 'Otros', 'UNIDAD', 'Unidad', 9, 5, 'ARS', 1700, 3, null, false),
    (new.id, 'Cinta para Grip (pack)', 'Descartable', 'Otros', 'UNIDAD', 'Pack', 3, 1, 'ARS', 5000, 3, null, false),
    (new.id, 'Guantes Nitrilo Ref (100u)', 'Descartable', 'Guantes', 'UNIDAD', 'Caja', 4, 1, 'ARS', 7400, 100, null, false),
    (new.id, 'Compresas Negras (50u)', 'Descartable', 'Compresas', 'UNIDAD', 'Caja', 4, 1, 'ARS', 7400, 50, null, false),
    (new.id, 'Guantes Latex Negros (100u)', 'Descartable', 'Guantes', 'UNIDAD', 'Caja', 4, 1, 'ARS', 3400, 100, null, false),
    (new.id, 'Papel de Cocina', 'Descartable', 'Papel cocina', 'UNIDAD', 'Unidad', 2, 1, 'ARS', 2600, 200, null, false),
    (new.id, 'Film para Pen (100u)', 'Descartable', 'Film', 'UNIDAD', 'Caja', 1, 1, 'ARS', 2500, 100, null, false),
    (new.id, 'Tinta Dynamic Triple Black', 'Consumible', 'Tinta', 'VARIABLE', 'Onza', 1, 1, 'ARS', 27000, 30, null, false),
    (new.id, 'Piel Sintética Gruesa', 'Consumible', 'Piel sint.', 'UNIDAD', 'Unidad', 2, 6, 'ARS', 6000, 1, null, false),
    (new.id, 'Stencil Stuff', 'Consumible', 'Stencil', 'SESION', 'Frasco', 1, 1, 'ARS', 9000, 40, null, false),
    (new.id, 'Vaselina Grande', 'Consumible', 'Vaselina', 'SESION', 'Frasco', 1, 1, 'ARS', 12000, 60, null, false),
    (new.id, 'Green Soap', 'Consumible', 'Green Soap', 'SESION', 'Frasco', 1, 1, 'ARS', 9000, 50, null, false),
    (new.id, 'Diluyente', 'Consumible', 'Diluyente', 'SESION', 'Frasco', 1, 1, 'ARS', 8000, 50, null, false),
    (new.id, 'Levanta Lengua (100u)', 'Consumible', 'Otros', 'SESION', 'Caja', 1, 1, 'ARS', 6000, 100, null, false),
    (new.id, 'Remove Stencil', 'Consumible', 'Limpieza', 'SESION', 'Frasco', 1, 1, 'ARS', 9000, 20, null, false),
    (new.id, 'RS 7', 'Aguja', 'RS', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
    (new.id, 'Magnum 7', 'Aguja', 'MG', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
    (new.id, 'Magnum 13', 'Aguja', 'MG', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
    (new.id, 'RL 3', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 4, 2, 'ARS', 1500, 1, null, false),
    (new.id, 'RL 5', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
    (new.id, 'RL 7', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 3, 2, 'ARS', 1500, 1, null, false),
    (new.id, 'RL 9', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
    (new.id, 'RL 11', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
    (new.id, 'RL 14', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
    (new.id, 'RL 15', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false);

  insert into kits (tenant_id, nombre) values (new.id, 'Kit base')
    returning id into v_kit_id;

  insert into kit_items (kit_id, producto_id, cantidad) values
    (v_kit_id, (select id from productos where tenant_id = new.id and nombre = 'Papel Stencil'), 1),
    (v_kit_id, (select id from productos where tenant_id = new.id and nombre = 'Stencil Stuff'), 1),
    (v_kit_id, (select id from productos where tenant_id = new.id and nombre = 'Vaselina Grande'), 1),
    (v_kit_id, (select id from productos where tenant_id = new.id and nombre = 'Green Soap'), 1),
    (v_kit_id, (select id from productos where tenant_id = new.id and nombre = 'Diluyente'), 1),
    (v_kit_id, (select id from productos where tenant_id = new.id and nombre = 'Levanta Lengua (100u)'), 2);

  return new;
end;
$$ language plpgsql set search_path = public, pg_temp security definer;

drop trigger if exists trg_tenant_bootstrap on auth.users;
create trigger trg_tenant_bootstrap after insert on auth.users
  for each row execute function fn_tenant_bootstrap();

-- fn_tenant_bootstrap es una trigger function (returns trigger) — Postgres
-- rechaza ejecutarla fuera de un contexto de trigger real, pero el linter de
-- seguridad de Supabase igual la marca como alcanzable vía PostgREST RPC
-- (/rest/v1/rpc/fn_tenant_bootstrap) para anon/authenticated. Postgres otorga
-- EXECUTE al pseudo-rol PUBLIC por defecto al crear una función, así que
-- revocar de los roles anon/authenticated individualmente NO elimina ese
-- grant heredado — ambos roles igual ejecutan la función vía PUBLIC. Revocar
-- de PUBLIC directamente cierra esa vía; no afecta al trigger en sí, que se
-- dispara por el trigger manager, no por un grant de EXECUTE de un rol.
revoke execute on function public.fn_tenant_bootstrap() from public;

-- ── Vista v_inversion ───────────────────────────────────────────────────────
-- Inversión vs. consumo vs. recupero, una fila por tenant, en ARS.
-- security_invoker: respeta RLS (cada usuario ve solo su fila).
-- consumido_historico = salidas sin sesión (carga inicial, ajustes manuales).
create or replace view public.v_inversion with (security_invoker = true) as
with tc as (
  select tenant_id, (valor #>> '{}')::numeric as tc from config where clave = 'tipo_cambio'
),
mov as (
  select m.tenant_id,
         p.categoria,
         m.tipo,
         m.cantidad * coalesce(m.costo_al_momento, 0)
           * case when p.moneda = 'USD' then coalesce(tc.tc, 1) else 1 end as monto_ars,
         case when m.tipo = 'salida' then
           case when m.sesion_id is null then 'historico'
                when s.practica then 'practica'
                else 'cliente' end
         end as destino
  from movimientos m
  join productos p on p.id = m.producto_id
  left join sesiones s on s.id = m.sesion_id
  left join tc on tc.tenant_id = m.tenant_id
),
agg as (
  select tenant_id,
    sum(monto_ars) filter (where tipo = 'entrada' and categoria =  'Activo') as invertido_activos,
    sum(monto_ars) filter (where tipo = 'entrada' and categoria <> 'Activo') as invertido_insumos,
    sum(monto_ars) filter (where destino = 'practica')  as consumido_practica,
    sum(monto_ars) filter (where destino = 'cliente')   as consumido_cliente,
    sum(monto_ars) filter (where destino = 'historico') as consumido_historico
  from mov group by tenant_id
),
stk as (
  select p.tenant_id,
         sum(p.stock * p.costo_unitario * case when p.moneda = 'USD' then coalesce(tc.tc, 1) else 1 end) as en_stock
  from productos p left join tc on tc.tenant_id = p.tenant_id
  where p.categoria <> 'Activo'
  group by p.tenant_id
),
rec as (
  select tenant_id, sum(precio) as recuperado from tatuajes group by tenant_id
)
select a.tenant_id,
  round(coalesce(a.invertido_activos, 0), 0)                                   as invertido_activos_ars,
  round(coalesce(a.invertido_insumos, 0), 0)                                   as invertido_insumos_ars,
  round(coalesce(a.invertido_activos, 0) + coalesce(a.invertido_insumos, 0), 0) as invertido_total_ars,
  round(coalesce(a.consumido_practica, 0), 0)                                  as consumido_practica_ars,
  round(coalesce(a.consumido_cliente, 0), 0)                                   as consumido_cliente_ars,
  round(coalesce(a.consumido_historico, 0), 0)                                 as consumido_historico_ars,
  round(coalesce(a.consumido_practica, 0) + coalesce(a.consumido_cliente, 0) + coalesce(a.consumido_historico, 0), 0) as consumido_total_ars,
  round(coalesce(s.en_stock, 0), 0)                                            as en_stock_ars,
  round(coalesce(r.recuperado, 0), 0)                                          as recuperado_ars,
  round(coalesce(a.invertido_activos, 0) + coalesce(a.invertido_insumos, 0) - coalesce(r.recuperado, 0), 0) as saldo_a_recuperar_ars,
  t.tc                                                                         as tipo_cambio
from agg a
left join stk s on s.tenant_id = a.tenant_id
left join rec r on r.tenant_id = a.tenant_id
left join tc  t on t.tenant_id = a.tenant_id;

revoke all on public.v_inversion from anon;
grant select on public.v_inversion to authenticated;

-- ── Sesión: varios tatuajes, agujas usadas y técnicas (2026-09) ─────────────
-- Reemplazan a sesiones.tatuaje_id / aguja_principal_id / voltaje y a
-- sesion_agujas_testeadas. Las columnas viejas se siguen completando con el
-- primer elemento de cada lista (compat V5), pero la fuente de verdad son estas.

-- Sesión ↔ varios tatuajes, con puntaje por tatuaje
create table public.sesion_tatuajes (
  sesion_id         bigint not null references sesiones(id) on delete cascade,
  tatuaje_id        bigint not null references tatuajes(id) on delete cascade,
  score_linea       smallint not null default 0 check (score_linea between 0 and 10),
  score_relleno     smallint not null default 0 check (score_relleno between 0 and 10),
  score_tecnica     smallint not null default 0 check (score_tecnica between 0 and 10),
  score_diseno      smallint not null default 0 check (score_diseno between 0 and 10),
  score_conformidad smallint not null default 0 check (score_conformidad between 0 and 10),
  primary key (sesion_id, tatuaje_id)
);
create index idx_sesion_tatuajes_tatuaje on public.sesion_tatuajes(tatuaje_id);

-- Agujas usadas en la sesión (esto es lo que descuenta stock)
create table public.sesion_agujas (
  sesion_id   bigint not null references sesiones(id) on delete cascade,
  producto_id bigint not null references productos(id),
  cantidad    numeric not null default 1 check (cantidad > 0),
  primary key (sesion_id, producto_id)
);

-- Técnicas de la sesión: técnica + aguja + voltaje (bitácora, no toca stock)
create table public.sesion_tecnicas (
  id          bigint generated always as identity primary key,
  sesion_id   bigint not null references sesiones(id) on delete cascade,
  orden       smallint not null default 0,
  tecnica     text not null,
  producto_id bigint references productos(id),
  voltaje     numeric
);
create index idx_sesion_tecnicas_sesion on public.sesion_tecnicas(sesion_id);

alter table public.sesion_tatuajes enable row level security;
alter table public.sesion_agujas   enable row level security;
alter table public.sesion_tecnicas enable row level security;
create policy tenant_isolation on public.sesion_tatuajes for all
  using (exists (select 1 from sesiones where sesiones.id = sesion_tatuajes.sesion_id and sesiones.tenant_id = auth.uid()))
  with check (exists (select 1 from sesiones where sesiones.id = sesion_tatuajes.sesion_id and sesiones.tenant_id = auth.uid())
          and exists (select 1 from tatuajes where tatuajes.id = sesion_tatuajes.tatuaje_id and tatuajes.tenant_id = auth.uid()));
create policy tenant_isolation on public.sesion_agujas for all
  using (exists (select 1 from sesiones where sesiones.id = sesion_agujas.sesion_id and sesiones.tenant_id = auth.uid()))
  with check (exists (select 1 from sesiones where sesiones.id = sesion_agujas.sesion_id and sesiones.tenant_id = auth.uid()));
create policy tenant_isolation on public.sesion_tecnicas for all
  using (exists (select 1 from sesiones where sesiones.id = sesion_tecnicas.sesion_id and sesiones.tenant_id = auth.uid()))
  with check (exists (select 1 from sesiones where sesiones.id = sesion_tecnicas.sesion_id and sesiones.tenant_id = auth.uid()));
revoke all on public.sesion_tatuajes, public.sesion_agujas, public.sesion_tecnicas from anon;

-- ── Agujas/técnicas por tatuaje + fotos (2026-09) ───────────────────────────
-- sesion_agujas y sesion_tecnicas llevan tatuaje_id (null = práctica / sin tatuaje)
alter table public.sesion_agujas drop constraint sesion_agujas_pkey;
alter table public.sesion_agujas add column id bigint generated always as identity primary key;
alter table public.sesion_agujas add column tatuaje_id bigint references tatuajes(id) on delete set null;
create unique index uq_sesion_agujas on public.sesion_agujas (sesion_id, coalesce(tatuaje_id, 0), producto_id);
alter table public.sesion_tecnicas add column tatuaje_id bigint references tatuajes(id) on delete set null;

-- Fotos: archivo en Storage (bucket privado 'fotos', ruta {uid}/{tatuaje_id}/{archivo})
create table public.tatuaje_fotos (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references auth.users(id) default auth.uid(),
  tatuaje_id bigint not null references tatuajes(id) on delete cascade,
  sesion_id  bigint references sesiones(id) on delete set null,
  tipo       text not null default 'Resultado' check (tipo in ('Resultado','Proceso','Referencia')),
  path       text not null unique,
  created_at timestamptz not null default now()
);
create index idx_tatuaje_fotos_tatuaje on public.tatuaje_fotos(tatuaje_id);
alter table public.tatuaje_fotos enable row level security;
create policy tenant_isolation on public.tatuaje_fotos for all
  using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
revoke all on public.tatuaje_fotos from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg','image/png','image/webp']);
create policy fotos_select on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fotos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy fotos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Agenda: turnos, disponibilidad, cupos (2026-09-26) ──────────────────────
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
