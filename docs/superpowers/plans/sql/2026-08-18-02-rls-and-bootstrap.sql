-- 2026-08-18 — Multi-tenancy: RLS policies + new-tenant bootstrap trigger
-- Run inside a single transaction.

begin;

-- 1. Drop every existing policy on the 8 tables, whatever it's currently
--    named (CLAUDE.md flags policy state as unverified in git — this is
--    idempotent regardless of what's actually there).
do $$
declare pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('productos','tatuajes','kits','kit_items',
                         'sesiones','sesion_agujas_testeadas','movimientos','config')
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- 2. Tenant-scoped policies on the 6 tables that now carry tenant_id.
create policy tenant_isolation on productos   for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy tenant_isolation on tatuajes    for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy tenant_isolation on kits        for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy tenant_isolation on sesiones    for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy tenant_isolation on movimientos for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());
create policy tenant_isolation on config      for all using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- 3. Join-based policies for the two child tables (no tenant_id column of
--    their own — isolation comes from their parent).
create policy tenant_isolation on kit_items for all
  using (exists (select 1 from kits where kits.id = kit_items.kit_id and kits.tenant_id = auth.uid()))
  with check (exists (select 1 from kits where kits.id = kit_items.kit_id and kits.tenant_id = auth.uid()));

create policy tenant_isolation on sesion_agujas_testeadas for all
  using (exists (select 1 from sesiones where sesiones.id = sesion_agujas_testeadas.sesion_id and sesiones.tenant_id = auth.uid()))
  with check (exists (select 1 from sesiones where sesiones.id = sesion_agujas_testeadas.sesion_id and sesiones.tenant_id = auth.uid()));

-- 4. Bootstrap trigger: seeds a brand-new tenant with the same catalog as
--    seed.sql. Runs as the function owner (postgres, via SECURITY DEFINER)
--    because at signup time there is no authenticated session yet, so
--    auth.uid() inside this function would be NULL and every insert would
--    be blocked by the policies above.
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

-- 5. fn_tenant_bootstrap is a trigger function (returns trigger) — Postgres
--    refuses to run it if called directly outside a real trigger context,
--    but Supabase's security linter still flags it as reachable via
--    PostgREST RPC (/rest/v1/rpc/fn_tenant_bootstrap) for anon/authenticated.
--    Postgres grants EXECUTE to the PUBLIC pseudo-role by default when a
--    function is created, so revoking from the named roles anon/authenticated
--    individually does NOT remove that inherited grant — both roles still
--    execute the function through PUBLIC. Revoking from PUBLIC itself closes
--    that off; it does not affect the trigger itself, which fires through
--    the trigger manager, not a role's EXECUTE grant.
revoke execute on function public.fn_tenant_bootstrap() from public;

commit;
