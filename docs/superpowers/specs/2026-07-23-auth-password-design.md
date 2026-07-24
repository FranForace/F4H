# Auth por contraseña (reemplaza magic link)

## Contexto

El login actual usa Supabase Auth magic link (`signInWithOtp`): el usuario pone su mail,
espera un correo, hace click en el link. Francesco (único usuario del sistema hoy) reporta
que esto genera fricción — tiene que reingresar el mail y esperar el link cada vez que
la sesión se pierde.

La causa de fondo de la pérdida de sesión (un bug donde el handler `SIGNED_OUT` disparaba
`window.location.reload()` y podía entrar en loop, tirando la sesión) ya está corregida en
`dev` (commit `f0a6381`) pero no deployada a producción — eso se resuelve por separado
mergeando `dev` → `main`. Independientemente de ese fix, el usuario prefiere pasar a
login con contraseña para no depender del viaje por mail en absoluto.

## Alcance

Reemplazar el flujo de magic link por email+contraseña, reusando el mismo usuario de
Supabase Auth que ya existe (`franforace@gmail.com`). Sin cambios de schema, sin cambios
de RLS — el endurecimiento de RLS por `auth.email()` sigue siendo un pendiente separado
(ya documentado en `CLAUDE.md`).

## Diseño

### 1. `js/db.js`
- `dbSignIn(email)` → `dbSignIn(email, password)`, usa `_db.auth.signInWithPassword({email, password})`
  en vez de `_db.auth.signInWithOtp(...)`.
- `dbSignOut()` y `dbOnAuthChange(cb)` no cambian.

### 2. `F4H_Sistema_Beta_v6.html`
- Overlay de login: se agrega `<input type="password">` al formulario existente.
- Se elimina el estado "revisá tu mail" / pantalla de "link enviado" — ya no aplica,
  el login es síncrono (una sola pantalla, un solo submit).
- `initAuthUI()`: el manejo de eventos `SIGNED_IN` / `SIGNED_OUT` / `INITIAL_SESSION`
  no cambia — ya está corregido en `dev` (`f0a6381`, pendiente de merge a `main`
  por separado).

### 3. Manejo de errores
- Contraseña o mail incorrectos: Supabase devuelve error de `signInWithPassword`
  → mostrar mensaje inline reusando el patrón `msg()` que ya usa el resto de la app
  (mismo patrón que "Stock insuficiente" en Inventario/Movimientos).

### 4. Setup inicial (manual, no código)
- Francesco setea la contraseña de su usuario existente desde el dashboard de
  Supabase → Authentication → Users → editar usuario → contraseña.
- No requiere flujo de "elegir contraseña" en la app.

### 5. Recovery
- Sin flujo de "olvidé mi contraseña" por ahora. Usuario único con acceso al
  dashboard de Supabase — reset manual ahí si hace falta.

## Fuera de alcance (explícitamente, no se implementa ahora)

- **RLS lockdown** (`auth.email() = 'franforace@gmail.com'` en las 8 tablas) —
  pendiente ya documentado, no depende de este cambio.
- **Multi-tenant / multi-usuario real.** Francesco mencionó que posiblemente venda
  el sistema más adelante, lo cual requeriría que cada usuario tenga sus propios
  datos aislados. Hoy no existe ningún concepto de "dueño de fila": las tablas no
  tienen `user_id`/`tenant_id`, y la RLS planeada es para un solo email fijo,
  hardcodeado. Pasar a multi-tenant real sería un rediseño de schema (agregar
  columna de propietario a cada tabla + políticas RLS por fila + flujo de alta de
  usuarios) y una decisión de producto (¿cuentas separadas? ¿un Supabase project
  por cliente? ¿planes/billing?). No se toca en este cambio — queda anotado acá
  para cuando ese trabajo se planee en serio.
- **Recovery de contraseña por mail** — ver sección Recovery arriba.

## Testing (manual, no hay suite automatizada en este repo)

- Login con contraseña correcta → entra a la app, sesión persiste tras recargar la página.
- Login con contraseña incorrecta → mensaje de error inline, no rompe la UI.
- Logout → vuelve a la pantalla de login (sin loop, ya cubierto por el fix de `dev`).
- Confirmar que ya no aparece ningún estado de "revisá tu mail" en la UI.
