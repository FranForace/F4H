# Multi-tenancy — diseño

## Motivación

Francesco quiere transformar F4H de una app personal (un solo usuario,
`franforace@gmail.com`, RLS lockeada a ese email) en un producto que se pueda
vender a otros tatuadores. Cada uno necesita su propio inventario, sesiones,
tatuajes y movimientos, completamente aislados de los demás.

Este es el primero de tres proyectos identificados para llegar a la versión
vendible:

1. **Multi-tenancy** (este spec) — aislamiento de datos por tenant.
2. Onboarding por invitación — códigos/links que permiten a un tatuador
   nuevo crear su cuenta.
3. Cobro automatizado — integración de gateway de pago, planes y
   activación/desactivación de acceso según el estado de la suscripción.

Cada uno se diseña e implementa por separado. Este spec cubre únicamente el
punto 1: **no** incluye la mecánica real de invitación (cómo se genera o
valida un código de acceso), **no** incluye cobro, y **no** incluye un panel
de administración — para operaciones cross-tenant, Francesco sigue usando el
SQL Editor de Supabase con la service role key, tal como puede hacer hoy.

## Decisiones ya tomadas (respuestas del usuario)

- Onboarding futuro: invitación con código (no self-signup público, no alta
  100% manual por Francesco).
- Aislamiento de datos: una única DB Supabase compartida, filtrada por
  `tenant_id` + RLS (no un proyecto Supabase separado por cliente).
- Cobro futuro: automatizado in-app (gateway de pago con webhooks) — no
  manual fuera del sistema.
- Un usuario = un tenant. No hay múltiples usuarios/empleados compartiendo un
  mismo tenant en este diseño.
- Los datos reales actuales de Francesco se migran como el tenant #1 dentro
  del mismo esquema multi-tenant — no se separan en un deploy aparte.
- Un tenant nuevo arranca con el catálogo base de productos precargado
  (mismo seed que ya existe: tintas, agujas, descartables genéricos), no
  vacío.
- Modelo de tenant: `tenant_id = auth.uid()` directo. No se crea una tabla
  `tenants` separada en este spec — sería anticipar un requisito (multi-
  usuario por tenant, transferencia de titularidad) que ya fue descartado.
  Si el spec de cobro necesita metadata a nivel estudio (nombre, plan,
  estado), se agrega ahí, cuando exista un motivo concreto.

## Estado actual verificado

- Tablas en `public`: `productos`, `tatuajes`, `kits`, `kit_items`,
  `sesiones`, `sesion_agujas_testeadas`, `movimientos`, `config`.
- RLS actual: policies con `USING (auth.email() = 'franforace@gmail.com')`
  en todas las tablas (ver `docs/superpowers/specs/2026-07-23-auth-password-design.md`
  y CLAUDE.md — confirmar contra `pg_policies` antes de migrar, no asumir).
- `fn_movimiento_aplicar` (trigger BEFORE INSERT en `movimientos`) calcula
  WAC y actualiza `productos.stock`. Es de un solo usuario hoy — no filtra
  ni propaga tenant.
- `fn_touch_updated_at` (trigger BEFORE UPDATE en `productos`/`tatuajes`/
  `sesiones`/`config`) no depende de identidad de usuario, no necesita
  cambios.
- `js/db.js` es la única capa que habla con Supabase; llama funciones
  nombradas (`dbAddProducto`, `dbSaveSesion`, `dbAddMovimiento`, etc.) que no
  mandan ningún identificador de usuario explícito hoy — confían en RLS +
  sesión autenticada.
- `config` es hoy una fila global única (tc, spm) sin distinción de usuario.

## Diseño

### 1. Columna `tenant_id`

Se agrega `tenant_id uuid not null references auth.users(id) default auth.uid()`
a: `productos`, `tatuajes`, `kits`, `sesiones`, `movimientos`, `config`.

`kit_items` y `sesion_agujas_testeadas` **no** reciben columna propia — son
tablas hijas con FK a `kits` / `sesiones` respectivamente, y su aislamiento
se resuelve en la policy RLS vía join al padre. Duplicar `tenant_id` ahí no
aporta aislamiento adicional, solo una columna redundante que puede
desincronizarse del padre.

`config` dejar de ser una fila global: pasa a tener una fila por tenant,
`tenant_id` como parte de su identidad (si hoy tiene un `id` fijo tipo
singleton, se reemplaza por `tenant_id` como clave; confirmar estructura
real de la tabla antes de escribir la migración).

### 2. Bootstrap de un tenant nuevo

Trigger `fn_tenant_bootstrap`, `AFTER INSERT ON auth.users`:

- Inserta la fila de `config` para `new.id` con los defaults actuales
  (`tc`, `spm`).
- Copia el catálogo base de `productos` (los mismos ítems semilla ya
  documentados en CLAUDE.md: Pen Garage, Tinta Dynamic Black, RS 7, etc.)
  con `tenant_id = new.id`.

Este trigger dispara para **cualquier** alta en `auth.users`, sin importar
el mecanismo (alta manual por Francesco hoy, invitación mañana). La
mecánica de generar/validar el código de invitación que lleva a esa alta es
responsabilidad del spec 2, no de este.

### 3. RLS

Cada policy existente (`USING (auth.email() = 'franforace@gmail.com')`) se
reemplaza por `USING (tenant_id = auth.uid())` (y su `WITH CHECK`
equivalente para INSERT/UPDATE). Para `kit_items` y
`sesion_agujas_testeadas`, la policy usa `EXISTS (SELECT 1 FROM kits WHERE
kits.id = kit_items.kit_id AND kits.tenant_id = auth.uid())` (y análogo para
sesiones).

`fn_movimiento_aplicar` se ajusta para que el `tenant_id` insertado en
`movimientos` sea siempre `auth.uid()` (vía default de columna, no
requiere tocar la lógica de WAC) y para que su lectura/actualización de
`productos.stock` quede acotada a filas del mismo tenant.

### 4. Migración de datos existentes

Antes de aplicar `NOT NULL` y las policies nuevas:

1. Backfill: `UPDATE <tabla> SET tenant_id = '<uid de franforace@gmail.com>'`
   en cada tabla afectada.
2. Verificar cero filas con `tenant_id IS NULL`.
3. Aplicar `NOT NULL` + default `auth.uid()`.
4. Reemplazar las policies viejas por las nuevas basadas en `tenant_id`.

Los datos reales de Francesco quedan como tenant #1, intactos.

### 5. Frontend (`js/db.js`, `F4H_Sistema_Beta_v6.html`)

Como el trigger puebla `tenant_id` automáticamente vía default de columna,
las funciones de mutation existentes (`dbAddMovimiento`, `dbSaveSesion`,
`dbSaveTatuaje`, `dbAddProducto`, `dbUpdateProducto`, `dbSetConfig`,
`dbSaveKitItems`, `dbRenameKit`, `dbAddKit`, `dbDeleteKit`, `dbDeleteSesion`,
`dbDeleteTatuaje`) no necesitan mandar `tenant_id` explícito — siguen
llamando a Supabase igual que hoy, RLS + el default de columna hacen el
resto.

Único punto a confirmar durante la implementación: si `initDB()` o
`dbSetConfig` asumen hoy que existe como máximo una fila en `config` sin
filtrar por usuario (p.ej. `select().single()` sin `.eq()`), habrá que
revisar que siga devolviendo una sola fila — la correcta — una vez que
`config` tenga una fila por tenant. Con RLS activo esto debería resolverse
solo (cada usuario solo ve su propia fila), pero se verifica explícitamente
en la implementación, no se asume acá.

### 6. Testing

Con dos usuarios de prueba reales en Supabase Auth (no el usuario de
producción):

- Verificar a nivel SQL (como service role, simulando cada `auth.uid()`)
  que las policies bloquean lectura y escritura cruzada en cada tabla
  afectada.
- Verificar desde la app: loguear como tenant B, confirmar que Dashboard,
  Inventario, Tatuajes, Sesiones y Movimientos muestran únicamente datos de
  B (cero fuga de datos de A), y que las mutaciones (alta de producto,
  registro de movimiento, creación de sesión/tatuaje) quedan con
  `tenant_id = B`.
- Confirmar que el trigger de bootstrap corrió para B: catálogo base
  presente, fila de `config` con defaults.

## Fuera de alcance (explícito)

- Invitaciones/códigos de acceso y su UI de signup.
- Cobro, planes, suscripciones, webhooks de pago.
- Panel de administración in-app para gestionar tenants.
- Múltiples usuarios/empleados compartiendo un mismo tenant.
