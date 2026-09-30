-- 2026-09-30 — Agujas estructuradas (tipo · número · calibre · sufijo)
-- Migración registrada: se aplica con apply_migration (nombre: agujas_estructuradas).
-- Idempotencia: NO. Correr una sola vez. Todo en una transacción (apply_migration la envuelve).

-- ── 1. Columnas ─────────────────────────────────────────────────────────────
alter table public.productos
  add column aguja_tipo    text     check (aguja_tipo in ('RL','RS','M','CM')),
  add column aguja_numero  smallint check (aguja_numero between 1 and 99),
  add column aguja_calibre text     check (aguja_calibre in ('08','10','12')),
  add column aguja_sufijo  text     check (aguja_sufijo is null or btrim(aguja_sufijo) <> ''),
  -- activo=false: producto archivado (no aparece en selectores ni en Inventario por defecto).
  -- Se usa para la aguja 39 unificada con la 347. No se borra nada.
  add column activo        boolean  not null default true;

-- ── 2. Nombre derivado: la DB arma el nombre de las agujas ─────────────────
-- nombre = <tipo><número 2 dígitos> <calibre>[ <sufijo>]; subcategoria = tipo.
-- Corre antes que trg_touch_productos (orden alfabético), no interfiere.
create or replace function public.fn_aguja_nombre() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if new.categoria = 'Aguja' then
    new.aguja_sufijo := nullif(regexp_replace(btrim(coalesce(new.aguja_sufijo, '')), '\s+', ' ', 'g'), '');
    if new.aguja_tipo is not null and new.aguja_numero is not null and new.aguja_calibre is not null then
      new.nombre := new.aguja_tipo || lpad(new.aguja_numero::text, 2, '0') || ' '
                    || new.aguja_calibre || coalesce(' ' || new.aguja_sufijo, '');
      new.subcategoria := new.aguja_tipo;
    end if;
  end if;
  return new;
end $$;

create trigger trg_aguja_nombre before insert or update on public.productos
  for each row execute function public.fn_aguja_nombre();

-- ── 3. Backfill ─────────────────────────────────────────────────────────────
-- a) Formato nuevo: "RL07 12", "RL09 12 práctica"
-- b) Legado (catálogo semilla): "RL 7", "Magnum 13", "RS 7" → calibre 12 por defecto
--    (Magnum/MG → M, RM → CM). El trigger del paso 2 normaliza el nombre.
with x as (
  select id,
    regexp_match(nombre, '^(RL|RS|M|CM)(\d{2}) (08|10|12)(?: (.+))?$') n,
    regexp_match(nombre, '^(RL|RS|RM|CM|MG|M|Magnum)\s*(\d{1,2})$', 'i') l
  from public.productos where categoria = 'Aguja'
)
update public.productos p set
  aguja_tipo    = coalesce(x.n[1], case upper(x.l[1]) when 'MAGNUM' then 'M' when 'MG' then 'M'
                                                        when 'RM' then 'CM' else upper(x.l[1]) end),
  aguja_numero  = coalesce(x.n[2], x.l[2])::smallint,
  aguja_calibre = coalesce(x.n[3], '12'),
  aguja_sufijo  = x.n[4]
from x
where x.id = p.id and (x.n is not null or x.l is not null);

-- Lo que no parseó queda sin tipo/número → la constraint del paso 4 hace fallar
-- toda la migración (rollback). Verificado en seco el 30/09: 24/24 parsean.

-- ── 4. Constraint (después del backfill) ────────────────────────────────────
alter table public.productos add constraint productos_aguja_campos check (
  case when categoria = 'Aguja'
    then aguja_tipo is not null and aguja_numero is not null and aguja_calibre is not null
    else aguja_tipo is null and aguja_numero is null and aguja_calibre is null and aguja_sufijo is null
  end);

-- ── 5. Índice: búsqueda por combinación + unicidad dentro del tenant ────────
-- El sufijo se compara sin mayúsculas ("Práctica" = "práctica").
create unique index productos_aguja_combo_key on public.productos
  (tenant_id, aguja_tipo, aguja_numero, aguja_calibre, lower(coalesce(aguja_sufijo, '')))
  where categoria = 'Aguja';

-- ── 6. Bootstrap de tenants nuevos: agujas con los campos estructurados ─────
-- Mismo cuerpo que el vivo (30/09) salvo las 10 filas de agujas. create or replace
-- conserva owner y grants (el revoke execute from public sigue vigente).
create or replace function public.fn_tenant_bootstrap()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
    (new.id, 'Remove Stencil', 'Consumible', 'Limpieza', 'SESION', 'Frasco', 1, 1, 'ARS', 9000, 20, null, false);

  -- Agujas: el nombre lo arma trg_aguja_nombre
  insert into productos
    (tenant_id, nombre, categoria, aguja_tipo, aguja_numero, aguja_calibre,
     tipo_consumo, unidad_medida, stock, stock_minimo, moneda, costo_unitario, usos_por_unidad)
  select new.id, '', 'Aguja', t, n, '12', 'UNIDAD', 'Unidad', s, 2, 'ARS', 1500, 1
  from (values ('RS',7,2), ('M',7,2), ('M',13,2), ('RL',3,4), ('RL',5,2),
               ('RL',7,3), ('RL',9,2), ('RL',11,2), ('RL',14,2), ('RL',15,2)) v(t, n, s);

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
$function$;

-- ── 7. Vista de análisis (Tarea 5) ──────────────────────────────────────────
-- Consumo = salidas con sesión (práctica + cliente); las salidas sin sesión son ajustes/histórico.
-- Agrupa por tipo/número/calibre ignorando el sufijo (la "práctica" suma con la normal).
create view public.v_agujas_uso with (security_invoker = true) as
select p.tenant_id, p.aguja_tipo, p.aguja_numero, p.aguja_calibre,
  sum(p.stock) filter (where p.activo)                                             as stock_actual,
  coalesce(sum(m.u30), 0)                                                          as usadas_30d,
  coalesce(sum(m.u90), 0)                                                          as usadas_90d,
  coalesce(sum(m.u_total), 0)                                                      as usadas_total
from public.productos p
left join lateral (
  select sum(mv.cantidad) filter (where mv.fecha > current_date - 30) u30,
         sum(mv.cantidad) filter (where mv.fecha > current_date - 90) u90,
         sum(mv.cantidad)                                            u_total
  from public.movimientos mv
  where mv.producto_id = p.id and mv.tipo = 'salida' and mv.sesion_id is not null
) m on true
where p.categoria = 'Aguja'
group by 1, 2, 3, 4;
