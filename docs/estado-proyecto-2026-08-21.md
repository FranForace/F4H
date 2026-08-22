# Estado del proyecto F4H — 2026-08-21

Informe de estado para actualizar el contexto del proyecto (memoria de Claude y/o CLAUDE.md).
No es un spec ni un plan — es una foto del momento. Verificar contra `git log` / la DB antes
de confiar en esto pasado un tiempo.

## 1. Resumen ejecutivo

- **La base de datos de producción (Supabase) ya es multi-tenant.** Se migró completa: columnas
  `tenant_id`, RLS por `tenant_id = auth.uid()`, trigger de bootstrap para tenants nuevos.
- **El código que documenta ese cambio (`schema.sql`, `CLAUDE.md`) vive en un worktree sin
  mergear** (`worktree-multi-tenancy`). La branch `dev` todavía describe el modelo viejo
  (single-user, RLS por `auth.email()`). Esto es una divergencia real entre repo y producción
  que hay que cerrar mergeando el worktree.
- **Se cargó el inventario real de Francesco** (42 productos desde `F4H_costos.xlsx`),
  reemplazando el catálogo placeholder de seed.
- **Falta una sola tarea** para cerrar el plan de multi-tenancy: QA end-to-end en navegador
  (Task 9 del plan), después de la cual corresponde mergear el worktree a `dev`.

## 2. Estado de memoria (auto-memory de Claude)

Actualizado en esta sesión:
- `project_f4h.md` — reescrito con el estado real de agosto-2026 (antes describía julio-2026,
  antes de multi-tenancy). Incluye: UIDs de ambos usuarios de Supabase Auth, estado de la
  migración, la carga de inventario real, y el roadmap de 3 proyectos (multi-tenancy →
  invitaciones → cobro).
- `MEMORY.md` (índice) — línea de F4H actualizada para reflejar el estado de agosto.
- Sin cambios: `user_profile.md`, `project_trading_platform.md`,
  `feedback_f4h_inline_styles.md` (siguen vigentes, no relacionados a este trabajo).

## 3. Estado del repo (git)

### Checkout principal (`C:\Users\FFORACE\f4h-sistema`, branch `dev`)

- 2 commits locales por encima de `origin/dev` (spec + plan de multi-tenancy, ya commiteados
  pero no pusheados): `58b5ff9` (spec), `2b73945` (plan).
- Archivos sin trackear: `.claude/` (metadata de la herramienta), `docs/superpowers/plans/backups/`
  (backup JSON del pre-multi-tenancy, ver sección 5).
- `schema.sql` y `CLAUDE.md` en esta branch **todavía describen el modelo viejo** (sin
  `tenant_id`, RLS por `auth.email()`) — desactualizados respecto a producción.

### Worktree `worktree-multi-tenancy` (`.claude/worktrees/multi-tenancy`)

7 commits por encima de `dev`, ninguno mergeado todavía:

```
2af2408 docs: SQL de migración de schema para multi-tenancy
735dd24 fix: reemplazar placeholder FRANCESCO_UID restante en comentario
da08013 docs: SQL de RLS y trigger de bootstrap para multi-tenancy
9fe6ff8 fix: fijar search_path en fn_tenant_bootstrap (security definer)
c49065a fix(db): usar clave compuesta (tenant_id, clave) en el upsert de config
50d9c5d fix: revocar EXECUTE público de fn_tenant_bootstrap
77a7a9f docs: actualizar schema.sql y CLAUDE.md al modelo multi-tenant
```

Este worktree tiene el `schema.sql` y `CLAUDE.md` que sí coinciden con producción. Falta la
Task 9 del plan (QA en navegador) antes de mergear a `dev`.

### Worktree `worktree-demo-local` (`.claude/worktrees/demo-local`)

Proyecto aparte, no relacionado a multi-tenancy: versión standalone del sistema
(`DEMO_Sistema_gest_tatto.html`) para mostrarle la app a terceros sin exponer credenciales
reales. 8 commits, tampoco mergeados. Pendiente: Task 6 de ese plan (QA manual en navegador).
Tiene un `DEMO_Sistema_gest_tatto.zip` sin trackear, ya generado.

## 4. Estado de la base de datos (Supabase, proyecto `minletiyftpmufqpmviv`)

**Schema (aplicado en producción, no solo diseñado):**
- `productos`, `tatuajes`, `kits`, `sesiones`, `movimientos`, `config` tienen
  `tenant_id uuid not null references auth.users(id) default auth.uid()`.
- `kit_items` y `sesion_agujas_testeadas` no tienen columna propia — se aíslan vía join a su
  tabla padre en la policy RLS.
- `config`: PK pasó de `clave` a `(tenant_id, clave)`.
- `productos.nombre` y `kits.nombre`: unique global → `unique(tenant_id, nombre)`.

**RLS:** policy `tenant_isolation` en las 8 tablas (6 directas, 2 join-based). Reemplazó las
policies viejas por `auth.email() = 'franforace@gmail.com'`.

**Bootstrap de tenants nuevos:** trigger `trg_tenant_bootstrap` (`AFTER INSERT ON auth.users`)
ejecuta `fn_tenant_bootstrap()` (`SECURITY DEFINER`, `search_path` fijo, `EXECUTE` revocado a
`anon`/`authenticated` por hallazgo del linter de seguridad de Supabase) — siembra 37
productos, 1 kit, 2 config por cada usuario nuevo.

**Usuarios en `auth.users`:**

| Email | UID | Rol |
|---|---|---|
| `franforace@gmail.com` | `94238974-9389-486b-ba3c-9915f4988496` | Cuenta real de Francesco |
| `fforace@itpatagonia.com` | `1b779edc-64ef-41d1-b5a6-590569308cc0` | Cuenta de prueba (password `123456`), solo para testear aislamiento multi-tenant. No es cliente real — se puede borrar cuando ya no haga falta. |

**Verificación de aislamiento (Task 8 del plan, ya hecha):** confirmado por SQL que el tenant
de prueba no puede leer ni escribir filas del tenant real, y que la policy join-based de
`kit_items` funciona correctamente.

## 5. Carga de inventario real

Francesco pidió generar los INSERT de carga inicial desde `F4H_costos.xlsx` (fuente: Excel
en Downloads, no en el repo). Proceso:

1. Se verificó el schema real vía `information_schema.columns` (no vía `schema.sql`, que
   estaba desactualizado en `dev`).
2. Se validaron las 42 filas del Excel (10 agujas, 9 descartables, 13 consumibles, 10 activos):
   usado ≤ comprado, upu > 0, activos con usado=0, nombres únicos, consistencia matemática de
   costo unitario y stock — sin hallazgos, el Excel ya venía limpio.
3. Francesco había borrado el catálogo placeholder (37 productos de seed) de su propio tenant
   antes de esta carga, a propósito, para hacer lugar al inventario real.
4. Se generó y aplicó una transacción: 42 productos (stock inicial en 0) + 71 movimientos
   (42 entradas con costo_al_momento del Excel + 29 salidas para los productos con "ya usado"
   > 0). El trigger `fn_movimiento_aplicar` (WAC) calculó el stock final — se verificó que
   coincide exactamente con la columna "Stock actual" del Excel para todas las filas.
5. Ajustes post-carga pedidos por Francesco: `Waze` (upu 1→230, tipo_consumo→VARIABLE, se usa
   a gotas como la tinta), `Levanta lengua` (upu 1→100, viene en paquete de 100).

El script generado (`F4H_carga_inicial.sql`) quedó en `C:\Users\FFORACE\Downloads\`, **no
está versionado en el repo** — es una carga de datos puntual, no código de aplicación.

Backup pre-migración de los datos de Francesco (antes de todo esto, el catálogo placeholder
original): `docs/superpowers/plans/backups/2026-08-18-pre-multitenancy.json` (sin trackear
en git todavía).

## 6. Qué falta para cerrar

1. **Task 9 del plan de multi-tenancy** (pendiente): QA end-to-end en navegador — login como
   tenant de prueba, crear datos, confirmar aislamiento visual, volver a loguearse como
   Francesco y confirmar que no hay fuga de datos ni de configuración (`dbSetConfig` con la
   nueva PK compuesta).
2. **Mergear `worktree-multi-tenancy` a `dev`** (y eventualmente a `main`) una vez que la
   Task 9 cierre limpia — recién ahí `schema.sql`/`CLAUDE.md` de `dev` van a coincidir con
   lo que ya corre en producción.
3. **Pushear `dev` a `origin`** — hay 2 commits locales sin pushear incluso antes de contar
   el merge del worktree.
4. Considerar si versionar `F4H_carga_inicial.sql` (auditoría) o descartarlo una vez que
   Francesco confirme que el inventario cargado es correcto.
5. Los próximos dos proyectos del roadmap (onboarding por invitación, cobro automatizado)
   siguen sin diseñar en detalle — solo hay decisiones de alto nivel tomadas en el
   brainstorming inicial.
