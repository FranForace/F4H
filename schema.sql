-- ═══════════════════════════════════════════════════════════════════════════
-- F4H Sistema — Schema Supabase (PostgreSQL)
-- Decisiones: IDs bigint identity en todas las tablas, FKs enteras,
-- sin columnas legacy. Stock vive en productos.stock, mantenido por trigger.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tablas ──────────────────────────────────────────────────────────────────

create table productos (
  id                bigint generated always as identity primary key,
  nombre            text not null unique,
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
  updated_at        timestamptz not null default now()
);

create table tatuajes (
  id           bigint generated always as identity primary key,
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
  nombre     text not null unique,
  created_at timestamptz not null default now()
);

create table kit_items (
  kit_id      bigint not null references kits(id) on delete cascade,
  producto_id bigint not null references productos(id),
  cantidad    numeric not null default 1 check (cantidad > 0),
  primary key (kit_id, producto_id)
);

create table sesiones (
  id                 bigint generated always as identity primary key,
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
  clave      text primary key,
  valor      jsonb not null,
  updated_at timestamptz not null default now()
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

-- ── RLS (MVP single-user: política permisiva; endurecer al sumar auth) ─────

alter table productos                enable row level security;
alter table tatuajes                 enable row level security;
alter table kits                     enable row level security;
alter table kit_items                enable row level security;
alter table sesiones                 enable row level security;
alter table sesion_agujas_testeadas  enable row level security;
alter table movimientos              enable row level security;
alter table config                   enable row level security;

create policy p_all_productos  on productos               for all using (true) with check (true);
create policy p_all_tatuajes   on tatuajes                for all using (true) with check (true);
create policy p_all_kits       on kits                    for all using (true) with check (true);
create policy p_all_kit_items  on kit_items               for all using (true) with check (true);
create policy p_all_sesiones   on sesiones                for all using (true) with check (true);
create policy p_all_sat        on sesion_agujas_testeadas for all using (true) with check (true);
create policy p_all_movs       on movimientos             for all using (true) with check (true);
create policy p_all_config     on config                  for all using (true) with check (true);
