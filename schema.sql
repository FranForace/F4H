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
-- (/rest/v1/rpc/fn_tenant_bootstrap) para anon/authenticated. Revocar EXECUTE
-- cierra esa vía; no afecta al trigger en sí, que se dispara por el trigger
-- manager, no por un grant de EXECUTE de un rol.
revoke execute on function public.fn_tenant_bootstrap() from anon, authenticated;
