-- 2026-08-18 — Multi-tenancy: schema (tenant_id columns, config PK, unique fixes)
-- Run inside a single transaction.
-- Francesco's UID (94238974-9389-486b-ba3c-9915f4988496) is already substituted below.

begin;

-- 1. Add tenant_id as NULLABLE first — a NOT NULL default of auth.uid()
--    would insert NULL for every existing row (no authenticated session
--    exists while this migration runs), which would violate NOT NULL
--    immediately. Backfill first, then lock it down.
alter table productos   add column if not exists tenant_id uuid references auth.users(id);
alter table tatuajes    add column if not exists tenant_id uuid references auth.users(id);
alter table kits        add column if not exists tenant_id uuid references auth.users(id);
alter table sesiones    add column if not exists tenant_id uuid references auth.users(id);
alter table movimientos add column if not exists tenant_id uuid references auth.users(id);
alter table config      add column if not exists tenant_id uuid references auth.users(id);

-- 2. Backfill all existing rows to Francesco's tenant.
update productos   set tenant_id = '94238974-9389-486b-ba3c-9915f4988496' where tenant_id is null;
update tatuajes    set tenant_id = '94238974-9389-486b-ba3c-9915f4988496' where tenant_id is null;
update kits         set tenant_id = '94238974-9389-486b-ba3c-9915f4988496' where tenant_id is null;
update sesiones     set tenant_id = '94238974-9389-486b-ba3c-9915f4988496' where tenant_id is null;
update movimientos  set tenant_id = '94238974-9389-486b-ba3c-9915f4988496' where tenant_id is null;
update config        set tenant_id = '94238974-9389-486b-ba3c-9915f4988496' where tenant_id is null;

-- 3. Lock down: NOT NULL + default for future inserts from authenticated sessions.
alter table productos   alter column tenant_id set not null, alter column tenant_id set default auth.uid();
alter table tatuajes    alter column tenant_id set not null, alter column tenant_id set default auth.uid();
alter table kits        alter column tenant_id set not null, alter column tenant_id set default auth.uid();
alter table sesiones    alter column tenant_id set not null, alter column tenant_id set default auth.uid();
alter table movimientos alter column tenant_id set not null, alter column tenant_id set default auth.uid();
alter table config      alter column tenant_id set not null, alter column tenant_id set default auth.uid();

-- 4. config's PK was just `clave` (one global row per key). It becomes
--    one row per (tenant_id, clave).
alter table config drop constraint config_pkey;
alter table config add primary key (tenant_id, clave);

-- 5. productos.nombre and kits.nombre were globally unique — that breaks
--    the moment a second tenant's seed tries to insert "Papel Stencil" or
--    "Kit base" again. Scope uniqueness to the tenant.
alter table productos drop constraint productos_nombre_key;
alter table productos add constraint productos_tenant_nombre_key unique (tenant_id, nombre);

alter table kits drop constraint kits_nombre_key;
alter table kits add constraint kits_tenant_nombre_key unique (tenant_id, nombre);

commit;
