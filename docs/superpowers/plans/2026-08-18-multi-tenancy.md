# Multi-tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolate F4H's data by tenant (`tenant_id = auth.uid()`) in the shared production Supabase project, so a second Supabase Auth user gets their own inventory/sessions/tattoos/movements with zero visibility into Francesco's real data, and Francesco's existing data survives as tenant #1.

**Architecture:** Add a `tenant_id uuid references auth.users(id)` column to the six tenant-scoped tables (`productos`, `tatuajes`, `kits`, `sesiones`, `movimientos`, `config`), backfill it to Francesco's `auth.uid()`, then replace the single-user RLS policies (`auth.email() = 'franforace@gmail.com'`) with `tenant_id = auth.uid()` policies (join-based for the two child tables `kit_items` / `sesion_agujas_testeadas`, which get no column of their own). A new `AFTER INSERT ON auth.users` trigger (`fn_tenant_bootstrap`) seeds every new tenant with the same catalog as `seed.sql`, so a new signup is immediately usable. No change to `fn_movimiento_aplicar` is needed — it's `SECURITY INVOKER` by default, so RLS already scopes its internal `productos` lookups to the calling tenant.

**Tech Stack:** PostgreSQL (Supabase), plpgsql triggers, Supabase Auth, vanilla JS (`js/db.js`) talking to Supabase via `@supabase/supabase-js@2`.

**Spec:** `docs/superpowers/specs/2026-08-18-multi-tenancy-design.md`

## Global Constraints

- Project ID for all Supabase MCP calls: `minletiyftpmufqpmviv`.
- Never put the `service_role` key in any file in this repo or in any SQL run through the publishable-key client — only the Supabase MCP tools (which use their own credentials) or the Supabase SQL Editor touch privileged operations.
- `localStorage` key `siget_f4h_v6` must not change.
- Do not modify `F4H_Sistema_Beta_v5.html` (emergency fallback, out of scope).
- Every migration step that runs DDL/DML against the live project touches Francesco's real production data — confirm with Francesco before running any step marked **PRODUCTION** below, even though the plan itself lays out the exact commands.
- `fn_movimiento_aplicar`, `fn_touch_updated_at`, and all existing business logic in `js/db.js` (WAC calc, stock alerts, kit application) stay untouched except where a task explicitly says otherwise.

---

## Task 1: Back up production data before touching anything

**Files:**
- Create: `docs/superpowers/plans/backups/2026-08-18-pre-multitenancy.json` (gitignored-safe: contains only Francesco's own business data, not secrets — fine to keep locally, do not need to commit)

**Interfaces:**
- Produces: `FRANCESCO_UID` — Francesco's `auth.users.id`, captured in Step 2, referenced as `<FRANCESCO_UID>` in every later task.

- [ ] **Step 1: Restore the Supabase project if paused**

Run `mcp__claude_ai_Supabase__list_projects` (no args). If `status` for project `minletiyftpmufqpmviv` is not `ACTIVE_HEALTHY`, restore it with `mcp__claude_ai_Supabase__restore_project` (project_id: `minletiyftpmufqpmviv`), then poll `list_projects` until it's active.

- [ ] **Step 2: Capture Francesco's auth.uid()**

Run via `mcp__claude_ai_Supabase__execute_sql` (project_id: `minletiyftpmufqpmviv`):

```sql
select id, email from auth.users where email = 'franforace@gmail.com';
```

Expected: exactly one row. Record the `id` value — this is `<FRANCESCO_UID>`, needed in every later SQL step in this plan.

- [ ] **Step 3: Export all current table data as a safety net**

Run via `execute_sql`, one query per table, and save the combined JSON result to `docs/superpowers/plans/backups/2026-08-18-pre-multitenancy.json`:

```sql
select
  (select jsonb_agg(t) from productos t) as productos,
  (select jsonb_agg(t) from tatuajes t) as tatuajes,
  (select jsonb_agg(t) from kits t) as kits,
  (select jsonb_agg(t) from kit_items t) as kit_items,
  (select jsonb_agg(t) from sesiones t) as sesiones,
  (select jsonb_agg(t) from sesion_agujas_testeadas t) as sesion_agujas_testeadas,
  (select jsonb_agg(t) from movimientos t) as movimientos,
  (select jsonb_agg(t) from config t) as config;
```

Expected: one JSON row with all 8 keys populated (non-null arrays matching current row counts). Write the result to the file above with the `Write` tool.

- [ ] **Step 4: Confirm the backup file is non-empty and well-formed**

Read the file back and confirm `productos` has the expected row count (37 per `seed.sql`, possibly more if Francesco added items since) and `config` has 2 rows (`tipo_cambio`, `sesiones_por_mes`).

---

## Task 2: Author the schema migration SQL (tenant_id columns, config PK, unique constraint fixes)

**Files:**
- Create: `docs/superpowers/plans/sql/2026-08-18-01-schema.sql`

**Interfaces:**
- Consumes: `<FRANCESCO_UID>` from Task 1.
- Produces: the exact SQL text applied in Task 3.

- [ ] **Step 1: Write the migration file**

```sql
-- 2026-08-18 — Multi-tenancy: schema (tenant_id columns, config PK, unique fixes)
-- Run inside a single transaction. Replace <FRANCESCO_UID> with the value
-- captured in Task 1 Step 2 before running.

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
update productos   set tenant_id = '<FRANCESCO_UID>' where tenant_id is null;
update tatuajes    set tenant_id = '<FRANCESCO_UID>' where tenant_id is null;
update kits         set tenant_id = '<FRANCESCO_UID>' where tenant_id is null;
update sesiones     set tenant_id = '<FRANCESCO_UID>' where tenant_id is null;
update movimientos  set tenant_id = '<FRANCESCO_UID>' where tenant_id is null;
update config        set tenant_id = '<FRANCESCO_UID>' where tenant_id is null;

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
```

- [ ] **Step 2: Verify the constraint names exist before relying on them**

Before running Task 3, run this read-only check via `execute_sql` to confirm `productos_nombre_key` and `kits_nombre_key` are the actual current constraint names (Postgres auto-names single-column inline `unique` constraints this way, but confirm rather than assume):

```sql
select conname, conrelid::regclass as table_name
from pg_constraint
where conrelid in ('productos'::regclass, 'kits'::regclass, 'config'::regclass)
  and contype in ('u', 'p');
```

Expected: rows including `productos_nombre_key` (unique, on productos), `kits_nombre_key` (unique, on kits), `config_pkey` (primary key, on config). If any name differs, update Step 1's SQL to match before proceeding.

---

## Task 3: Apply the schema migration to production (PRODUCTION — confirm with Francesco first)

**Files:** none (executes Task 2's SQL against the live database)

**Interfaces:**
- Consumes: `docs/superpowers/plans/sql/2026-08-18-01-schema.sql` from Task 2, with `<FRANCESCO_UID>` substituted.

- [ ] **Step 1: Get explicit go-ahead**

Show Francesco the finalized SQL from Task 2 (with the real UID substituted) and confirm before running — this alters live tables with real business data.

- [ ] **Step 2: Apply it**

Run via `mcp__claude_ai_Supabase__apply_migration` (project_id: `minletiyftpmufqpmviv`, name: `multi_tenancy_schema`, query: the finalized SQL from Task 2 Step 1). If it errors with something like "cannot start transaction within transaction" (the tool may already wrap the query in one), strip the `begin;`/`commit;` lines and resubmit the same SQL — the individual statements are still safe to run sequentially without an explicit wrapper in that case.

- [ ] **Step 3: Verify zero NULL tenant_id rows**

```sql
select
  (select count(*) from productos where tenant_id is null) as productos,
  (select count(*) from tatuajes where tenant_id is null) as tatuajes,
  (select count(*) from kits where tenant_id is null) as kits,
  (select count(*) from sesiones where tenant_id is null) as sesiones,
  (select count(*) from movimientos where tenant_id is null) as movimientos,
  (select count(*) from config where tenant_id is null) as config;
```

Expected: all 6 counts are `0`.

- [ ] **Step 4: Verify row counts match the Task 1 backup**

```sql
select count(*) from productos; -- compare to backup file's productos.length
select count(*) from config;    -- expected 2
```

Expected: counts match the pre-migration backup exactly (no rows lost).

---

## Task 4: Author the RLS + bootstrap trigger migration SQL

**Files:**
- Create: `docs/superpowers/plans/sql/2026-08-18-02-rls-and-bootstrap.sql`

**Interfaces:**
- Consumes: `tenant_id` columns on all 6 tables from Task 3.
- Produces: function `fn_tenant_bootstrap`, trigger `trg_tenant_bootstrap` on `auth.users`, policy `tenant_isolation` on all 8 RLS-enabled tables.

- [ ] **Step 1: Write the migration file**

```sql
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
$$ language plpgsql security definer;

drop trigger if exists trg_tenant_bootstrap on auth.users;
create trigger trg_tenant_bootstrap after insert on auth.users
  for each row execute function fn_tenant_bootstrap();

commit;
```

---

## Task 5: Apply the RLS + bootstrap migration to production (PRODUCTION — confirm with Francesco first)

**Files:** none (executes Task 4's SQL against the live database)

**Interfaces:**
- Consumes: `docs/superpowers/plans/sql/2026-08-18-02-rls-and-bootstrap.sql` from Task 4.

- [ ] **Step 1: Get explicit go-ahead**

Confirm with Francesco before running — this drops and recreates every RLS policy in the database. It's wrapped in a single transaction so there's no window where the tables are unprotected, but confirm anyway since it changes how every existing query is authorized.

- [ ] **Step 2: Apply it**

Run via `apply_migration` (project_id: `minletiyftpmufqpmviv`, name: `multi_tenancy_rls_and_bootstrap`, query: Task 4's SQL). Same caveat as Task 3 Step 2: if the tool rejects the explicit `begin;`/`commit;` because it already wraps the migration in a transaction, strip those two lines and resubmit.

- [ ] **Step 3: Verify the policies exist**

```sql
select tablename, policyname, cmd from pg_policies where schemaname = 'public' order by tablename;
```

Expected: exactly one `tenant_isolation` policy per table, for all 8 tables (`productos`, `tatuajes`, `kits`, `kit_items`, `sesiones`, `sesion_agujas_testeadas`, `movimientos`, `config`).

- [ ] **Step 4: Verify the trigger exists**

```sql
select tgname, tgrelid::regclass from pg_trigger where tgname = 'trg_tenant_bootstrap';
```

Expected: one row, `tgrelid` resolving to `auth.users`.

- [ ] **Step 5: Sanity check — Francesco can still see his own data as postgres/service-role**

```sql
select count(*) from productos where tenant_id = '<FRANCESCO_UID>';
```

Expected: same count as Task 3 Step 4 (service_role queries bypass RLS, so this just confirms the data and tenant_id are intact — the real RLS test is Task 8, from an authenticated session).

---

## Task 6: Fix `dbSetConfig`'s upsert conflict target for the new composite key

**Files:**
- Modify: `js/db.js:362-367`

**Interfaces:**
- Consumes: `config` table's new primary key `(tenant_id, clave)` from Task 3.

**Why this is needed:** `config`'s primary key changed from `clave` alone to `(tenant_id, clave)`. `dbSetConfig`'s `upsert(..., { onConflict: 'clave' })` still names only the old single-column key — with the PK now composite, Postgres will reject `onConflict: 'clave'` because there's no unique constraint on `clave` alone anymore.

- [ ] **Step 1: Update the upsert call**

In `js/db.js`, change:

```js
async function dbSetConfig(clave, valor) {
  const { error } = await _db.from('config')
    .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' });
  if (error) { dbError('Error guardando configuración: ' + error.message); return false; }
  return true;
}
```

to:

```js
async function dbSetConfig(clave, valor) {
  const { error } = await _db.from('config')
    .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,clave' });
  if (error) { dbError('Error guardando configuración: ' + error.message); return false; }
  return true;
}
```

Note: `tenant_id` itself isn't in the row payload — it's filled by the column default (`auth.uid()`) on insert, and on conflict-update Postgres matches using the existing row's `tenant_id`, so no client-side change to the payload is needed, only to `onConflict`.

- [ ] **Step 2: Commit**

```bash
git add js/db.js
git commit -m "fix(db): usar clave compuesta (tenant_id, clave) en el upsert de config"
```

This task's correctness is verified end-to-end in Task 8, Step 4 (Config tab exercises `dbSetConfig` directly) — there's no unit-test harness for `js/db.js` in this repo (it talks to live Supabase; no `package.json`/test framework exists here).

---

## Task 7: Create a second test tenant and verify the bootstrap trigger

**Files:** none (Supabase Auth + SQL verification only)

**Interfaces:**
- Produces: `TENANT_B_UID` and `TENANT_B_EMAIL` — a real test Supabase Auth user, referenced in Task 8.

- [ ] **Step 1: Create the test user**

Ask Francesco to create a second user in Supabase Auth (dashboard → Authentication → Add user, or `mcp__claude_ai_Supabase__execute_sql` is not appropriate here — creating auth users must go through Supabase Auth, not a raw insert). Suggested: `f4h-test-tenant-b@example.com` with a throwaway password. Record the resulting `id` as `<TENANT_B_UID>`.

- [ ] **Step 2: Verify the bootstrap trigger ran**

```sql
select
  (select count(*) from productos where tenant_id = '<TENANT_B_UID>') as productos,
  (select count(*) from kits where tenant_id = '<TENANT_B_UID>') as kits,
  (select count(*) from kit_items ki join kits k on k.id = ki.kit_id where k.tenant_id = '<TENANT_B_UID>') as kit_items,
  (select count(*) from config where tenant_id = '<TENANT_B_UID>') as config;
```

Expected: `productos` = 37, `kits` = 1, `kit_items` = 6, `config` = 2 — matching `seed.sql`'s documented counts exactly, for a tenant that has never touched the app.

---

## Task 8: RLS cross-tenant isolation verification (SQL-level)

**Files:** none (verification only)

**Interfaces:**
- Consumes: `<FRANCESCO_UID>` (Task 1) and `<TENANT_B_UID>` (Task 7).

- [ ] **Step 1: Simulate tenant B's session and confirm it cannot see Francesco's data**

Run via `execute_sql` (this runs as service_role, which bypasses RLS by default — to actually test RLS you must impersonate a specific `auth.uid()` in the session, which Supabase supports via `set local role authenticated; set local request.jwt.claim.sub = '<uid>';` inside the same transaction):

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub": "<TENANT_B_UID>"}';

select count(*) from productos; -- expect 37, not Francesco's real count
select count(*) from productos where tenant_id = '<FRANCESCO_UID>'; -- expect 0

rollback;
```

Expected: the first count is exactly 37 (tenant B's seeded catalog only); the second is `0` (RLS hides Francesco's rows entirely, even when explicitly filtering for his tenant_id).

- [ ] **Step 2: Confirm tenant B cannot write into Francesco's tenant**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub": "<TENANT_B_UID>"}';

update productos set stock = 999 where tenant_id = '<FRANCESCO_UID>';
select count(*) from productos where tenant_id = '<FRANCESCO_UID>' and stock = 999;

rollback;
```

Expected: the `update` affects 0 rows (RLS `USING` clause hides them from the UPDATE target), and the follow-up count is `0`.

- [ ] **Step 3: Confirm the child-table join policies work (kit_items)**

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub": "<TENANT_B_UID>"}';

select count(*) from kit_items; -- expect 6 (tenant B's own kit only)

rollback;
```

Expected: `6`, not Francesco's kit_items count.

---

## Task 9: End-to-end browser QA with both tenants

**Files:** none (manual verification via the real app)

**Interfaces:**
- Consumes: `<TENANT_B_EMAIL>` + password from Task 7.

- [ ] **Step 1: Log in as tenant B in the real app**

Open `F4H_Sistema_Beta_v6.html` (locally via a static server, or `f4-h.vercel.app` if already deployed) and sign in with tenant B's credentials.

Expected: Dashboard loads without errors. Inventario shows exactly the 37 seeded products (Pen Garage, Tinta Dynamic Triple Black, RS 7, etc.) — none of Francesco's real inventory. Tatuajes and Sesiones are empty (tenant B has created nothing yet).

- [ ] **Step 2: Mutate as tenant B**

Register a movimiento (entrada) for "Papel Stencil", create a Tatuaje, create a Sesión. Confirm no console errors and the Dashboard/Movimientos reflect the new data.

- [ ] **Step 3: Set config as tenant B (exercises the Task 6 fix)**

Go to Config, change "Sesiones por mes" to a new value, save, reload the page, log back in as tenant B. Expected: the new value persisted — this is the `dbSetConfig` composite-key upsert from Task 6 working correctly.

- [ ] **Step 4: Log back in as Francesco and confirm nothing leaked**

Sign out, sign in as `franforace@gmail.com`. Expected: all of Francesco's real data is exactly as it was before this migration (same product count as the Task 1 backup, same sessions/tattoos), the movimiento/tatuaje/sesión created by tenant B in Steps 2-3 are **not** visible, and Francesco's own "Sesiones por mes" config value is unchanged by tenant B's edit in Step 3.

---

## Task 10: Update schema.sql and CLAUDE.md to reflect the new multi-tenant reality

**Files:**
- Modify: `schema.sql`
- Modify: `CLAUDE.md`

**Interfaces:** none (documentation only)

- [ ] **Step 1: Rewrite `schema.sql`**

Update every `create table` block to include the `tenant_id uuid not null references auth.users(id) default auth.uid()` column (per Task 2), update `config`'s primary key to `(tenant_id, clave)`, update the unique constraints on `productos.nombre` and `kits.nombre` to be composite with `tenant_id` (per Task 2 Step 1), replace the RLS section at the bottom with the `tenant_isolation` policies and the `fn_tenant_bootstrap` trigger (per Task 4 Step 1), so `schema.sql` matches what's actually running in production instead of the stale single-user version currently committed.

- [ ] **Step 2: Update CLAUDE.md's "Backend: Supabase" section**

Replace the RLS bullet (`diseño de un solo usuario, policies por auth.email()...`) with a description of the tenant_id + auth.uid() model, and add a short "Multi-tenancy" note pointing to `docs/superpowers/specs/2026-08-18-multi-tenancy-design.md` for the full design, and to the next two planned projects (invitaciones, cobro) so future sessions know this is in progress, not finished.

- [ ] **Step 3: Commit**

```bash
git add schema.sql CLAUDE.md
git commit -m "docs: actualizar schema.sql y CLAUDE.md al modelo multi-tenant"
```
