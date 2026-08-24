# Onboarding por invitación — diseño

## Motivación

Segundo de los tres proyectos hacia una versión vendible de F4H (ver
`docs/superpowers/specs/2026-08-18-multi-tenancy-design.md`, que cubrió el
primero: aislamiento de datos por `tenant_id` + RLS). Hoy, para sumar un
tatuador nuevo, Francesco tiene que crearle la cuenta a mano desde el
dashboard de Supabase Auth — el spec de multi-tenancy dejó explícitamente
pendiente "la mecánica real de invitación" para este spec.

Este proyecto reemplaza esa alta 100% manual por un flujo de invitación con
código: Francesco genera un código, se lo comparte al tatuador (por el canal
que sea — WhatsApp, mail, lo que use hoy), y esa persona crea su propia
cuenta en la app usando ese código. No hay self-signup público: sin un
código válido, no se puede crear una cuenta.

No incluye: cobro/suscripciones (proyecto 3 del roadmap), ni un panel de
administración — Francesco sigue generando invitaciones por SQL Editor, tal
como ya opera hoy para todo lo demás.

## Decisiones ya tomadas (respuestas del usuario)

- Flujo de alta: link con código (`?invite=CODIGO`) que lleva a una pantalla
  de signup dentro de la app — el tatuador elige su propio email y
  contraseña. Descartado: que Francesco preasigne el email y solo llegue un
  mail de "fijá tu contraseña".
- Generación del código: por Francesco, vía `INSERT` directo en el SQL
  Editor de Supabase. No hay UI nueva para esto.
- Ciclo de vida del código: soporta ambos casos — un solo uso (invitación
  puntual a una persona) y reusable con tope de usos y/o vencimiento (link
  genérico compartido más ampliamente). Mismo modelo de datos cubre los dos.
- Enfoque de seguridad: trigger `BEFORE INSERT` en `auth.users` que valida
  el código (en vez de una Edge Function con Admin API). Se descartó
  validar el código solo del lado del cliente antes de llamar a
  `signUp()`, porque la anon key ya es pública (está en `js/db.js`) y
  cualquiera podría pegarle directo al endpoint de signup de Supabase sin
  pasar por la UI.
- Confirmación de email: no requerida. `signUp()` deja al usuario logueado
  de inmediato — el código de invitación ya es la prueba de autorización,
  pedir confirmación de mail encima es fricción redundante.
- El trigger de validación aplica a **cualquier** insert en `auth.users`,
  incluidas altas manuales de Francesco desde el dashboard de Supabase —
  no hay bypass para él. Si en el futuro quiere dar de alta a alguien sin
  invitación, carga igual una fila en `invitaciones` primero. Mantiene un
  solo camino de alta, sin casos especiales.

## Estado actual verificado

- `fn_tenant_bootstrap` (`AFTER INSERT ON auth.users`, `SECURITY DEFINER`)
  ya siembra `config` + catálogo base de productos para cualquier fila
  nueva en `auth.users`, sin importar el mecanismo que la creó. No requiere
  cambios — sigue disparando después del trigger nuevo de este spec.
- `fn_movimiento_aplicar` (`BEFORE INSERT ON movimientos`) es el precedente
  de patrón a seguir: lock de fila (`FOR UPDATE`) + validación + updates
  dentro del mismo trigger. El trigger de este spec sigue el mismo molde.
- Auth hoy usa `signInWithPassword` (`dbSignIn` en `js/db.js`), sin flujo de
  `signUp()` implementado en el frontend — es nuevo en este spec.
- No existe tabla `invitaciones` ni ninguna relacionada — es nueva.

## Diseño

### 1. Tabla `invitaciones`

```sql
create table invitaciones (
  codigo         text primary key,
  usos_maximos   integer,                    -- null = ilimitado
  usos_actuales  integer not null default 0,
  expira_en      timestamptz,                -- null = no vence
  nota           text,
  creado_en      timestamptz not null default now(),
  constraint invitaciones_usos_check check (usos_maximos is null or usos_maximos > 0)
);

alter table invitaciones enable row level security;
-- Sin policies: ningún rol de cliente (anon/authenticated) puede leer ni
-- escribir esta tabla. Solo accesible por service_role (SQL Editor de
-- Francesco) y por el trigger de validación, que corre como SECURITY
-- DEFINER y por lo tanto no está sujeto a RLS.
```

Francesco genera un código así (ejemplo, un solo uso):
```sql
insert into invitaciones (codigo, usos_maximos, nota)
values ('JUAN2026', 1, 'Juan, referido por Instagram');
```
O reusable:
```sql
insert into invitaciones (codigo, usos_maximos, expira_en, nota)
values ('LANZAMIENTO', 20, '2026-12-31', 'Link genérico de lanzamiento');
```

### 2. Trigger `fn_validar_invitacion`

```sql
create or replace function fn_validar_invitacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_inv    invitaciones%rowtype;
begin
  v_codigo := new.raw_user_meta_data ->> 'invite_code';

  if v_codigo is null then
    raise exception 'Se requiere un código de invitación';
  end if;

  select * into v_inv from invitaciones where codigo = v_codigo for update;

  if not found then
    raise exception 'Código de invitación inválido';
  end if;

  if v_inv.expira_en is not null and v_inv.expira_en < now() then
    raise exception 'Código de invitación vencido';
  end if;

  if v_inv.usos_maximos is not null and v_inv.usos_actuales >= v_inv.usos_maximos then
    raise exception 'Código de invitación ya alcanzó su límite de usos';
  end if;

  update invitaciones set usos_actuales = usos_actuales + 1 where codigo = v_codigo;

  return new;
end;
$$;

create trigger trg_validar_invitacion
  before insert on auth.users
  for each row execute function fn_validar_invitacion();
```

Orden de ejecución en un alta nueva: `trg_validar_invitacion` (BEFORE,
este spec) → INSERT confirmado en `auth.users` → `trg_tenant_bootstrap`
(AFTER, ya existente) siembra `config` + catálogo. Si el código es
inválido, el `RAISE EXCEPTION` aborta la transacción completa — no llega a
crearse la fila en `auth.users` ni a dispararse el bootstrap.

### 3. Frontend — pantalla de signup

En `F4H_Sistema_Beta_v6.html`, al cargar: si `location.search` trae
`invite=<codigo>` y no hay sesión activa, se muestra un formulario de
signup (email, contraseña, confirmar contraseña) en vez del login
existente. El código va oculto en el estado del formulario, tomado de la
URL — el usuario no lo tipea.

Al enviar:
```js
const { data, error } = await _db.auth.signUp({
  email, password,
  options: { data: { invite_code: codigo } }
});
```
Con éxito, `signUp()` deja la sesión activa de inmediato (sin confirmación
de mail) — se llama a `initDB()` igual que en `dbSignIn` y se entra al
dashboard normalmente, con el catálogo semilla ya cargado.

Si `_db.auth.signUp` fue llamado sin `invite` en la URL (alguien navega
directo a la app sin link), no se muestra la opción de signup — solo el
login existente. La única puerta de entrada a crear cuenta es el link con
código.

### 4. Manejo de errores

`signUp()` devuelve `error` cuando el trigger aborta el INSERT. Supabase
envuelve el error de Postgres en un mensaje genérico del lado del SDK — no
se intenta parsear el texto exacto de la excepción. El formulario muestra
un mensaje único para cualquier rechazo: "Ese código de invitación no es
válido o ya venció. Pedí uno nuevo." No se distingue en la UI entre
"inválido" / "vencido" / "agotado" (la distinción vive en el mensaje de la
excepción en Postgres, útil si Francesco necesita debuggear por logs, pero
no se propaga al usuario final).

### 5. Testing

Manual (no hay entorno de test automatizado para Auth/RLS en este
proyecto, mismo criterio que se usó para multi-tenancy):

1. Insertar una invitación de un solo uso por SQL.
2. Abrir `?invite=<codigo>` sin sesión activa → debe verse el form de
   signup, no el login.
3. Completar el signup → debe entrar directo al dashboard, con el
   catálogo base sembrado (mismo criterio que el tenant de prueba de
   multi-tenancy) y `usos_actuales` en 1.
4. Reintentar el mismo código → debe rechazar ("ya alcanzó su límite").
5. Probar con un código inexistente → debe rechazar ("inválido").
6. Insertar una invitación con `expira_en` en el pasado y probarla → debe
   rechazar ("vencido").
7. Insertar una invitación reusable (`usos_maximos = 3`) y usarla dos
   veces con emails distintos → ambas deben funcionar, la tercera también,
   la cuarta debe rechazar.

## Fuera de alcance

- Panel de administración para generar/listar invitaciones — sigue siendo
  SQL directo.
- Reenvío de invitaciones por mail automático — Francesco comparte el link
  por el canal que use hoy.
- Revocar un código ya generado — si hace falta, es un `UPDATE
  invitaciones SET expira_en = now()` manual, no se construye una función
  dedicada para esto.
- Cobro/planes — proyecto 3 del roadmap, spec aparte.
