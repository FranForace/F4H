-- 2026-09-30 — Cobertor Pen (id 50): pasar de "1 uso = 1 paquete" a 100 cobertores por paquete
-- Migración registrada (nombre: cobertor_pen_usos). Mismo criterio que el hallazgo 3 de PASO 3
-- (Papel de Cocina, Green Soap, etc.): stock y movimientos en usos, costo por uso.
-- Confirmado por Francesco: 100 por paquete (~$50 c/u), conteo físico hoy = 85.
--
-- Movimientos:
--   12 y 85 (entradas, 1 paquete a $5.000)  → 100 usos a $50  (misma plata)
--   52 (salida carga inicial, 0,01 paquete)  → 1 uso a $50     (misma plata)
--   102 (salida sesión 4 por kit, 1 paquete) → 1 uso a $50     (la sesión usó UN cobertor: −$4.950)
-- Ledger resultante: 100 − 1 + 100 − 1 = 198. Se ajusta al conteo físico (85) con una salida
-- sin sesión de 113 a $50, que el trigger fn_movimiento_aplicar descuenta del stock.

do $$
declare
  v_tenant constant uuid := '94238974-9389-486b-ba3c-9915f4988496';
  v_ledger numeric;
begin
  if (select usos_por_unidad from productos where id = 50 and tenant_id = v_tenant) <> 1
  then raise exception 'Cobertor Pen ya no tiene upu=1 (¿ya migrado?)'; end if;
  if (select count(*) from movimientos where producto_id = 50) <> 4
  then raise exception 'Cobertor Pen tiene movimientos nuevos, revisar antes'; end if;

  update movimientos set cantidad = cantidad * 100, costo_al_momento = costo_al_momento / 100
   where producto_id = 50 and id in (12, 85, 52);
  update movimientos set costo_al_momento = costo_al_momento / 100
   where producto_id = 50 and id = 102;

  update productos set usos_por_unidad = 100, costo_unitario = 50, stock = 198
   where id = 50 and tenant_id = v_tenant;

  insert into movimientos (tenant_id, fecha, producto_id, tipo, cantidad, costo_al_momento, referencia)
  values (v_tenant, current_date, 50, 'salida', 113, 50,
          'Ajuste a conteo físico 30/09 (cobertores usados sin registrar)');

  select sum(case tipo when 'entrada' then cantidad else -cantidad end) into v_ledger
    from movimientos where producto_id = 50;
  if v_ledger <> 85 or (select stock from productos where id = 50) <> 85
  then raise exception 'No cuadra: ledger=% stock=%', v_ledger, (select stock from productos where id = 50); end if;
end $$;
