-- 2026-09-30 — Unificar aguja 39 ("RL09 12 (histórico)", ex "9RL clientes") en la 347 ("RL09 12")
-- Migración registrada aparte (nombre: agujas_unificar_39). Requiere 2026-09-30-agujas.sql aplicada.
-- Tenant: franforace@gmail.com (94238974-9389-486b-ba3c-9915f4988496). No borra nada.
--
-- Por qué mover también los movimientos: fn_movimiento_aplicar es solo BEFORE INSERT, así que un
-- UPDATE de producto_id no toca stock ni WAC. El ledger reunido cuadra: 347 = +2 −1 −1 (ex-39,
-- 21/08 y 26/09) +3 (30/09) = 3 = stock actual. El WAC tampoco cambia: la 39 llegó a 0 el 26/09,
-- antes de la entrada de la 347, así que esa entrada igual habría fijado costo = 2000.
-- Cada movimiento conserva su costo_al_momento (1000), así que el costo histórico de la sesión 4
-- no cambia.

do $$
declare
  v_tenant constant uuid := '94238974-9389-486b-ba3c-9915f4988496';
  v_ok int;
begin
  -- Guardas: ambos productos son del tenant, misma combinación, la 39 sin stock
  select count(*) into v_ok from productos
   where tenant_id = v_tenant and id in (39, 347) and categoria = 'Aguja'
     and aguja_tipo = 'RL' and aguja_numero = 9 and aguja_calibre = '12';
  if v_ok <> 2 then raise exception 'Guardas: 39/347 no coinciden (%)', v_ok; end if;
  if (select stock from productos where id = 39) <> 0 then raise exception 'La 39 tiene stock'; end if;
  -- testeadas: PK (sesion_id, producto_id) — no puede haber choque
  if exists (select 1 from sesion_agujas_testeadas a join sesion_agujas_testeadas b
             on a.sesion_id = b.sesion_id where a.producto_id = 39 and b.producto_id = 347)
  then raise exception 'Choque en sesion_agujas_testeadas'; end if;

  update sesiones                set aguja_principal_id = 347 where aguja_principal_id = 39 and tenant_id = v_tenant;
  update sesion_agujas           set producto_id = 347 where producto_id = 39;
  update sesion_tecnicas         set producto_id = 347 where producto_id = 39;
  update sesion_agujas_testeadas set producto_id = 347 where producto_id = 39;
  update movimientos             set producto_id = 347 where producto_id = 39 and tenant_id = v_tenant;

  -- La 39 queda archivada, sin referencias. Nombre resultante: "RL09 12 histórico".
  update productos set activo = false, aguja_sufijo = 'histórico',
         notas = coalesce(notas || ' · ', '') || 'Unificada en id 347 el 2026-09-30'
   where id = 39;

  -- Verificación: ledger de la 347 cuadra con su stock
  if (select coalesce(sum(case tipo when 'entrada' then cantidad else -cantidad end), 0)
        from movimientos where producto_id = 347) <> (select stock from productos where id = 347)
  then raise exception 'Ledger de 347 no cuadra'; end if;
end $$;

-- Mismo endurecimiento que v_inversion (faltó en agujas_estructuradas)
revoke all on public.v_agujas_uso from anon;
grant select on public.v_agujas_uso to authenticated;
