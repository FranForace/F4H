-- ═══════════════════════════════════════════════════════════
-- F4H — Seed inicial (asiento de apertura)
-- Generado desde F4H_Carga_Inicial.xlsx
-- Ejecutar DESPUÉS de schema.sql
-- ═══════════════════════════════════════════════════════════

-- ── productos ──────────────────────────────────────────────
insert into productos
  (nombre, categoria, subcategoria, tipo_consumo, unidad_medida,
   stock, stock_minimo, moneda, costo_unitario, usos_por_unidad,
   vida_util_meses, practica)
values
  ('Pen Garage', 'Activo', 'Maquina', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 25000, 1, 24, false),
  ('Ambition Soldier', 'Activo', 'Maquina', 'UNIDAD', 'Unidad', 1, 0, 'USD', 147.36, 1, 36, false),
  ('Fuente Critical', 'Activo', 'Fuente', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 205000, 1, 36, false),
  ('Pedal', 'Activo', 'Otros', 'UNIDAD', 'Unidad', 0, 0, 'ARS', 0, 1, 60, false),
  ('iPad A16 + Apple Pen', 'Activo', 'Tecnologia', 'UNIDAD', 'Unidad', 1, 0, 'USD', 505, 1, 24, false),
  ('Inkless Printer', 'Activo', 'Impresora', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 150000, 1, 36, false),
  ('Tornito Bate Pintura', 'Activo', 'Otros', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 15000, 1, 60, false),
  ('Mesita', 'Activo', 'Mobiliario', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 55000, 1, 60, false),
  ('Apoyabrazos plegable', 'Activo', 'Mobiliario', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 82700, 1, 60, false),
  ('Trípode Genki', 'Activo', 'Mobiliario', 'UNIDAD', 'Unidad', 1, 0, 'ARS', 39600, 1, 60, false),
  ('Cups Medianos (100u)', 'Descartable', 'Cups', 'UNIDAD', 'Caja', 2, 1, 'ARS', 2000, 100, null, false),
  ('Papel Stencil', 'Descartable', 'Papel', 'UNIDAD', 'Unidad', 15, 4, 'ARS', 2000, 1, null, false),
  ('Grip p/ Pen', 'Descartable', 'Otros', 'UNIDAD', 'Unidad', 9, 5, 'ARS', 1700, 3, null, false),
  ('Cinta para Grip (pack)', 'Descartable', 'Otros', 'UNIDAD', 'Pack', 3, 1, 'ARS', 5000, 3, null, false),
  ('Guantes Nitrilo Ref (100u)', 'Descartable', 'Guantes', 'UNIDAD', 'Caja', 4, 1, 'ARS', 7400, 100, null, false),
  ('Compresas Negras (50u)', 'Descartable', 'Compresas', 'UNIDAD', 'Caja', 4, 1, 'ARS', 7400, 50, null, false),
  ('Guantes Latex Negros (100u)', 'Descartable', 'Guantes', 'UNIDAD', 'Caja', 4, 1, 'ARS', 3400, 100, null, false),
  ('Papel de Cocina', 'Descartable', 'Papel cocina', 'UNIDAD', 'Unidad', 2, 1, 'ARS', 2600, 200, null, false),
  ('Film para Pen (100u)', 'Descartable', 'Film', 'UNIDAD', 'Caja', 1, 1, 'ARS', 2500, 100, null, false),
  ('Tinta Dynamic Triple Black', 'Consumible', 'Tinta', 'VARIABLE', 'Onza', 1, 1, 'ARS', 27000, 30, null, false),
  ('Piel Sintética Gruesa', 'Consumible', 'Piel sint.', 'UNIDAD', 'Unidad', 2, 6, 'ARS', 6000, 1, null, false),
  ('Stencil Stuff', 'Consumible', 'Stencil', 'SESION', 'Frasco', 1, 1, 'ARS', 9000, 40, null, false),
  ('Vaselina Grande', 'Consumible', 'Vaselina', 'SESION', 'Frasco', 1, 1, 'ARS', 12000, 60, null, false),
  ('Green Soap', 'Consumible', 'Green Soap', 'SESION', 'Frasco', 1, 1, 'ARS', 9000, 50, null, false),
  ('Diluyente', 'Consumible', 'Diluyente', 'SESION', 'Frasco', 1, 1, 'ARS', 8000, 50, null, false),
  ('Levanta Lengua (100u)', 'Consumible', 'Otros', 'SESION', 'Caja', 1, 1, 'ARS', 6000, 100, null, false),
  ('Remove Stencil', 'Consumible', 'Limpieza', 'SESION', 'Frasco', 1, 1, 'ARS', 9000, 20, null, false),
  ('RS 7', 'Aguja', 'RS', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
  ('Magnum 7', 'Aguja', 'MG', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
  ('Magnum 13', 'Aguja', 'MG', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
  ('RL 3', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 4, 2, 'ARS', 1500, 1, null, false),
  ('RL 5', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
  ('RL 7', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 3, 2, 'ARS', 1500, 1, null, false),
  ('RL 9', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
  ('RL 11', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
  ('RL 14', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false),
  ('RL 15', 'Aguja', 'RL', 'UNIDAD', 'Unidad', 2, 2, 'ARS', 1500, 1, null, false);

-- ── kits ───────────────────────────────────────────────────
insert into kits (nombre) values ('Kit base');

insert into kit_items (kit_id, producto_id, cantidad) values
  ((select id from kits where nombre='Kit base'),
   (select id from productos where nombre='Papel Stencil'), 1),
  ((select id from kits where nombre='Kit base'),
   (select id from productos where nombre='Stencil Stuff'), 1),
  ((select id from kits where nombre='Kit base'),
   (select id from productos where nombre='Vaselina Grande'), 1),
  ((select id from kits where nombre='Kit base'),
   (select id from productos where nombre='Green Soap'), 1),
  ((select id from kits where nombre='Kit base'),
   (select id from productos where nombre='Diluyente'), 1),
  ((select id from kits where nombre='Kit base'),
   (select id from productos where nombre='Levanta Lengua (100u)'), 2);

-- ── config ─────────────────────────────────────────────────
insert into config (clave, valor) values
  ('tipo_cambio', '1500'::jsonb),
  ('sesiones_por_mes', '8'::jsonb);

-- ── Verificación post-seed ─────────────────────────────────
-- select count(*) from productos;   -- esperado: 37
-- select count(*) from kits;        -- esperado: 1
-- select count(*) from kit_items;   -- esperado: 6
-- select * from config;