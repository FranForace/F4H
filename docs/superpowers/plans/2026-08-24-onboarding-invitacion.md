# Onboarding por Invitación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a new tatuador create their own F4H account via a shareable invitation code (`?invite=CODIGO` link → signup form), with no public self-signup and no manual account creation by Francesco.

**Architecture:** A new `invitaciones` table (codigo, usos_maximos, usos_actuales, expira_en) holds codes Francesco inserts by hand via the SQL Editor. A `BEFORE INSERT ON auth.users` trigger (`fn_validar_invitacion`) reads `raw_user_meta_data->>'invite_code'`, locks and validates the matching row, and aborts the insert if the code is missing/invalid/expired/exhausted — otherwise it increments `usos_actuales` and lets the insert (and the existing `fn_tenant_bootstrap` AFTER-INSERT trigger) proceed. The frontend gets a signup form (mirroring the existing login form) shown only when the URL carries `?invite=`, which calls `supabase.auth.signUp()` with the code in `options.data`. No email confirmation — `signUp()` returns an active session immediately, and the existing `onAuthStateChange` listener in `initAuthUI()` already handles any newly-active session generically (no changes needed there).

**Tech Stack:** PostgreSQL (Supabase) plpgsql trigger, Supabase Auth REST API (`/auth/v1/signup`) for verification, vanilla JS (`js/db.js` + `F4H_Sistema_Beta_v6.html`) via `@supabase/supabase-js@2`.

**Spec:** `docs/superpowers/specs/2026-08-24-onboarding-invitacion-design.md`

## Global Constraints

- Project ID for all Supabase MCP calls: `minletiyftpmufqpmviv`.
- Never put the `service_role` key in any file in this repo or in any request made with the publishable/anon key — only the Supabase MCP tools (own credentials) or the Supabase SQL Editor touch privileged operations.
- Publishable/anon key (safe for the curl-based verification in Task 3, already public in `js/db.js`): `sb_publishable_8dl1Rolu23DUX35Gk8s24g_06GRANqH`. Supabase URL: `https://minletiyftpmufqpmviv.supabase.co`.
- Do not modify `F4H_Sistema_Beta_v5.html` (emergency fallback, out of scope). `localStorage` key `siget_f4h_v6` must not change.
- Every step that runs DDL/DML against the live project or that creates real `auth.users` rows touches production — confirm with Francesco before any step marked **PRODUCTION**, even though the exact commands are laid out below.
- The trigger applies to **every** insert into `auth.users`, with no bypass for Francesco's own manual dashboard-created accounts (accepted trade-off, see spec's "Decisiones ya tomadas"). Do not add a bypass unless Francesco asks for one.
- `fn_tenant_bootstrap`, `fn_movimiento_aplicar`, `fn_touch_updated_at`, and all existing RLS policies stay untouched — this plan only adds a new table and one new trigger.
- All test data created during verification (Tasks 3 and 5) must be fully cleaned up before the task is considered done — this project has no automated test suite, so leftover test rows are the only trace and must not linger in production.

---

## Task 1: Create the `invitaciones` table (PRODUCTION — confirm with Francesco first)

**Files:** none (SQL against the live project via `execute_sql`)

**Interfaces:**
- Produces: table `invitaciones(codigo, usos_maximos, usos_actuales, expira_en, nota, creado_en)`, consumed by Task 2's trigger and by Francesco's manual `INSERT`s going forward.

- [ ] **Step 1: Create the table with RLS enabled and no policies**

Run via `mcp__claude_ai_Supabase__execute_sql` (project_id: `minletiyftpmufqpmviv`):

```sql
create table invitaciones (
  codigo         text primary key,
  usos_maximos   integer,
  usos_actuales  integer not null default 0,
  expira_en      timestamptz,
  nota           text,
  creado_en      timestamptz not null default now(),
  constraint invitaciones_usos_check check (usos_maximos is null or usos_maximos > 0)
);

alter table invitaciones enable row level security;
```

- [ ] **Step 2: Verify the table exists, RLS is on, and no policies were created**

```sql
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='invitaciones') as tabla_existe,
  (select relrowsecurity from pg_class where relname='invitaciones') as rls_habilitado,
  (select count(*) from pg_policies where tablename='invitaciones') as cantidad_policies;
```

Expected: `tabla_existe=1`, `rls_habilitado=true`, `cantidad_policies=0`. If `cantidad_policies` is anything but `0`, something added a policy unexpectedly — stop and investigate before continuing (a stray policy could let the `anon`/`authenticated` roles read or write invitation codes directly, defeating the whole design).

---

## Task 2: Create the `fn_validar_invitacion` trigger (PRODUCTION — confirm with Francesco first)

**Files:** none (SQL against the live project)

**Interfaces:**
- Consumes: `invitaciones` table from Task 1.
- Produces: trigger `trg_validar_invitacion` on `auth.users`, which Task 3 exercises via real `signUp()` calls.

- [ ] **Step 1: Create the trigger function and trigger**

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

- [ ] **Step 2: Verify the trigger is registered as BEFORE INSERT**

```sql
select t.tgname, pg_get_triggerdef(t.oid) as definicion
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
where c.relname = 'users' and c.relnamespace = 'auth'::regnamespace and not t.tgisinternal;
```

Expected: a row for `trg_validar_invitacion` whose `definicion` contains `BEFORE INSERT ON auth.users ... EXECUTE FUNCTION fn_validar_invitacion()`, alongside Supabase's own internal auth triggers (ignore those — only confirm this one is present and BEFORE INSERT, not AFTER).

---

## Task 3: Verify the trigger against real signups (PRODUCTION — creates and deletes real test auth.users rows, confirm with Francesco first)

**Files:** none (verification only, via `curl` against the Supabase Auth REST API and `execute_sql` for setup/cleanup)

**Interfaces:**
- Consumes: `trg_validar_invitacion` from Task 2.
- Produces: confidence that Task 4's frontend (which calls the exact same `signUp()` mechanism through the JS SDK instead of raw `curl`) will work correctly.

This task must use real `supabase.auth.signUp()` calls (via the REST API), not a raw `insert into auth.users` — a raw insert would skip Supabase's own bookkeeping (the `auth.identities` row, password hashing, etc.) and wouldn't be a faithful test of what the frontend will actually do in Task 4.

- [ ] **Step 1: Seed three test invitation codes**

```sql
insert into invitaciones (codigo, usos_maximos, nota) values
  ('TEST-SINGLE', 1, 'Task 3 verification — single use'),
  ('TEST-MULTI',  3, 'Task 3 verification — reusable, 3 uses'),
  ('TEST-EXPIRED', 1, 'Task 3 verification — expired');
update invitaciones set expira_en = now() - interval '1 day' where codigo = 'TEST-EXPIRED';
```

- [ ] **Step 2: Signup with no code at all — expect rejection**

```bash
curl -s -X POST 'https://minletiyftpmufqpmviv.supabase.co/auth/v1/signup' \
  -H 'apikey: sb_publishable_8dl1Rolu23DUX35Gk8s24g_06GRANqH' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-invite-nocode@example.com","password":"Test1234!"}'
```

Expected: HTTP error response (non-2xx status embedded in the JSON `error`/`msg` field, e.g. `"Database error saving new user"`) — the trigger's `raise exception 'Se requiere un código de invitación'` aborted the insert.

- [ ] **Step 3: Signup with a nonexistent code — expect rejection**

```bash
curl -s -X POST 'https://minletiyftpmufqpmviv.supabase.co/auth/v1/signup' \
  -H 'apikey: sb_publishable_8dl1Rolu23DUX35Gk8s24g_06GRANqH' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-invite-badcode@example.com","password":"Test1234!","data":{"invite_code":"DOES-NOT-EXIST"}}'
```

Expected: same shape of error as Step 2.

- [ ] **Step 4: Signup with the expired code — expect rejection**

```bash
curl -s -X POST 'https://minletiyftpmufqpmviv.supabase.co/auth/v1/signup' \
  -H 'apikey: sb_publishable_8dl1Rolu23DUX35Gk8s24g_06GRANqH' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-invite-expired@example.com","password":"Test1234!","data":{"invite_code":"TEST-EXPIRED"}}'
```

Expected: error, same shape.

- [ ] **Step 5: Signup with the single-use code — expect success**

```bash
curl -s -X POST 'https://minletiyftpmufqpmviv.supabase.co/auth/v1/signup' \
  -H 'apikey: sb_publishable_8dl1Rolu23DUX35Gk8s24g_06GRANqH' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-invite-single@example.com","password":"Test1234!","data":{"invite_code":"TEST-SINGLE"}}'
```

Expected: HTTP 200 with a JSON body containing a non-null `"access_token"` and a `"user"` object. **If `access_token` is null and the user object shows `"confirmed_at":null` / `"email_confirmed_at":null`**, email confirmation is still enabled at the project level — stop here and ask Francesco to disable it: Supabase Dashboard → Authentication → Providers → Email → turn off "Confirm email", then re-run this step. This setting isn't reachable via SQL, only the dashboard.

- [ ] **Step 6: Confirm the single-use code is now exhausted and the tenant was bootstrapped**

```sql
select codigo, usos_actuales, usos_maximos from invitaciones where codigo = 'TEST-SINGLE';

select u.id, u.email,
  (select count(*) from productos where tenant_id = u.id) as productos,
  (select count(*) from config where tenant_id = u.id) as config
from auth.users u where u.email = 'test-invite-single@example.com';
```

Expected: `usos_actuales = 1` (equal to `usos_maximos`); the second query returns one row with `productos` and `config` counts matching `fn_tenant_bootstrap`'s seed (same counts as any freshly-bootstrapped tenant — check against `seed.sql`'s documented product count).

- [ ] **Step 7: Retry the now-exhausted single-use code with a different email — expect rejection**

```bash
curl -s -X POST 'https://minletiyftpmufqpmviv.supabase.co/auth/v1/signup' \
  -H 'apikey: sb_publishable_8dl1Rolu23DUX35Gk8s24g_06GRANqH' \
  -H 'Content-Type: application/json' \
  -d '{"email":"test-invite-single-retry@example.com","password":"Test1234!","data":{"invite_code":"TEST-SINGLE"}}'
```

Expected: error (limit reached) — and no new `auth.users` row for this email (spot-check with `select count(*) from auth.users where email = 'test-invite-single-retry@example.com';`, expect `0`).

- [ ] **Step 8: Exhaust the reusable code (3 uses) and confirm the 4th is rejected**

Run three successful signups, each with a distinct email, reusing the Step 5 curl command with `email` set to `test-invite-multi-1@example.com`, `test-invite-multi-2@example.com`, `test-invite-multi-3@example.com` and `"invite_code":"TEST-MULTI"`. All three expect HTTP 200 with a non-null `access_token`, same as Step 5. Then attempt a 4th with `test-invite-multi-4@example.com` and the same code — expect the same rejection shape as Step 7.

Verify: `select usos_actuales from invitaciones where codigo = 'TEST-MULTI';` expect `3`.

- [ ] **Step 9: Clean up every test row created in this task**

Order matters — `tenant_id` foreign keys are `ON DELETE NO ACTION`, so child rows must go before the `auth.users` row:

```sql
do $$
declare
  v_uid uuid;
begin
  for v_uid in
    select id from auth.users where email like 'test-invite-%@example.com'
  loop
    delete from kit_items where kit_id in (select id from kits where tenant_id = v_uid);
    delete from sesion_agujas_testeadas where sesion_id in (select id from sesiones where tenant_id = v_uid);
    delete from movimientos where tenant_id = v_uid;
    delete from sesiones where tenant_id = v_uid;
    delete from kits where tenant_id = v_uid;
    delete from tatuajes where tenant_id = v_uid;
    delete from config where tenant_id = v_uid;
    delete from productos where tenant_id = v_uid;
    delete from auth.users where id = v_uid;
  end loop;
end $$;

delete from invitaciones where codigo in ('TEST-SINGLE', 'TEST-MULTI', 'TEST-EXPIRED');
```

Verify: `select count(*) from auth.users where email like 'test-invite-%@example.com';` and `select count(*) from invitaciones where codigo like 'TEST-%';` both return `0`.

---

## Task 4: Add the signup form to the frontend

**Files:**
- Modify: `js/db.js` (add `dbSignUp`, near `dbSignIn` at `js/db.js:12-15`)
- Modify: `F4H_Sistema_Beta_v6.html:227-236` (add the signup form markup, sibling to `#auth-form`)
- Modify: `F4H_Sistema_Beta_v6.html:439` (`showLoginForm` — decide which form to show based on the URL)
- Modify: `F4H_Sistema_Beta_v6.html:441-453` area (add `doSignUp()`, sibling to `doSignIn()`)

**Interfaces:**
- Consumes: `_db` (the Supabase client instance already initialized in `js/db.js`), `dbError`/`msg` helper patterns already used throughout the file.
- Produces: `dbSignUp(email, password, inviteCode) → string|null` (error message or null), called only from `doSignUp()`.

- [ ] **Step 1: Add `dbSignUp` to `js/db.js`, right after `dbSignIn`**

In `js/db.js`, after line 15 (`}` closing `dbSignIn`):

```js
async function dbSignUp(email, password, inviteCode) {
  const { error } = await _db.auth.signUp({
    email, password,
    options: { data: { invite_code: inviteCode } },
  });
  return error ? error.message : null;
}
```

- [ ] **Step 2: Add the signup form markup**

In `F4H_Sistema_Beta_v6.html`, immediately after the `</div>` that closes `#auth-form` (currently line 235, right before the `</div>` that closes `#auth-card` on line 236), insert:

```html
      <div id="auth-signup-form" style="display:none">
        <div style="font-size:20px;font-weight:700;color:#f0f0ee;margin-bottom:6px">Crear cuenta</div>
        <div style="font-size:13px;color:#888;margin-bottom:1.5rem">Invitaci&#xF3;n v&#xE1;lida &#x2014; eleg&#xED; tu email y contrase&#xF1;a</div>
        <input id="signup-email" type="email" placeholder="tu@email.com" style="width:100%;padding:10px 14px;background:#141414;border:1.5px solid #2e2e2e;border-radius:8px;color:#f0f0ee;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px">
        <input id="signup-password" type="password" placeholder="Contrase&#xF1;a" style="width:100%;padding:10px 14px;background:#141414;border:1.5px solid #2e2e2e;border-radius:8px;color:#f0f0ee;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px">
        <input id="signup-password2" type="password" placeholder="Repet&#xED; la contrase&#xF1;a" style="width:100%;padding:10px 14px;background:#141414;border:1.5px solid #2e2e2e;border-radius:8px;color:#f0f0ee;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px">
        <button id="signup-btn" onclick="doSignUp()" style="width:100%;padding:11px;background:#c8a96e;color:#111;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:inherit">Crear cuenta</button>
        <div id="signup-msg" style="margin-top:10px;font-size:12px;text-align:center;color:#888"></div>
      </div>
```

- [ ] **Step 3: Make `showLoginForm` choose the right form based on `?invite=`**

Replace line 439:

```js
function showLoginForm(){document.getElementById('auth-loading').style.display='none';document.getElementById('auth-card').style.display='';}
```

with:

```js
function showLoginForm(){
  document.getElementById('auth-loading').style.display='none';
  document.getElementById('auth-card').style.display='';
  const invite=new URLSearchParams(window.location.search).get('invite');
  document.getElementById('auth-form').style.display=invite?'none':'';
  document.getElementById('auth-signup-form').style.display=invite?'':'none';
}
```

- [ ] **Step 4: Add `doSignUp()`**

Immediately after the existing `doSignOut` function (currently `F4H_Sistema_Beta_v6.html:454`, right before `function initAuthUI(){`), insert:

```js
async function doSignUp(){
  const invite=new URLSearchParams(window.location.search).get('invite');
  const email=(document.getElementById('signup-email').value||'').trim();
  const password=document.getElementById('signup-password').value||'';
  const password2=document.getElementById('signup-password2').value||'';
  const msgEl=document.getElementById('signup-msg');
  const btn=document.getElementById('signup-btn');
  if(!email||!password){if(msgEl)msgEl.textContent='Ingres\xE1 email y contrase\xF1a';return;}
  if(password!==password2){if(msgEl)msgEl.textContent='Las contrase\xF1as no coinciden';return;}
  if(btn)btn.disabled=true;
  if(msgEl)msgEl.textContent='Creando cuenta...';
  const err=await dbSignUp(email,password,invite);
  if(btn)btn.disabled=false;
  if(err){if(msgEl)msgEl.textContent='Ese c\xF3digo de invitaci\xF3n no es v\xE1lido o ya venci\xF3. Pedi uno nuevo.';return;}
  if(msgEl)msgEl.textContent='';
}
```

No changes are needed to `initAuthUI()` (`F4H_Sistema_Beta_v6.html:455-472`) — its `dbOnAuthChange` listener already hides the auth screen and calls `load(); renderAll();` for any session that becomes active, regardless of whether it came from `signInWithPassword` or `signUp`.

- [ ] **Step 5: Syntax-check the file**

```bash
node -e "
const fs=require('fs');
const html=fs.readFileSync('F4H_Sistema_Beta_v6.html','utf8');
const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
fs.writeFileSync('.scratch_check.js', scripts[2]);
"
node --check .scratch_check.js && echo SYNTAX_OK
rm -f .scratch_check.js
```

Expected: `SYNTAX_OK` with no errors. (If the file has a different number of `<script>` blocks than 3 at plan-execution time, print each block's length first to find the right index — see how this was done earlier in `js/db.js`/`F4H_Sistema_Beta_v6.html` history.)

- [ ] **Step 6: Commit**

```bash
git add js/db.js F4H_Sistema_Beta_v6.html
git commit -m "feat: agregar pantalla de signup por código de invitación"
```

---

## Task 5: End-to-end browser QA (PRODUCTION — creates and deletes one real test account, confirm with Francesco first)

**Files:** none (manual verification)

**Interfaces:**
- Consumes: the frontend from Task 4, the trigger from Task 2.

This task requires a human to type an email and password into a real browser form — per the standing policy against entering credentials on someone's behalf, the agentic worker must ask Francesco to type the signup email/password himself when this step is reached, the same way login was handled earlier in this project's session history.

- [ ] **Step 1: Seed one QA invitation code**

```sql
insert into invitaciones (codigo, usos_maximos, nota) values ('QA-E2E', 1, 'Task 5 end-to-end QA');
```

- [ ] **Step 2: Serve the app locally and open the invite link**

```bash
cat > .scratch_server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/F4H_Sistema_Beta_v6.html';
  const fp = path.join(root, p);
  fs.readFile(fp, (err,data)=>{
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(fp);
    res.writeHead(200, {'Content-Type': mime[ext]||'application/octet-stream'});
    res.end(data);
  });
}).listen(8934, ()=>console.log('listening on 8934'));
EOF
(node .scratch_server.js > /tmp/f4h_server.log 2>&1 &)
```

Open `http://localhost:8934/F4H_Sistema_Beta_v6.html?invite=QA-E2E` in the browser (claude-in-chrome or manually). Expected: the "Crear cuenta" form is shown, not "Acceder".

- [ ] **Step 3: Complete the signup (Francesco types email/password)**

Ask Francesco for a throwaway test email (e.g. `f4h-qa+e2e@<his domain>`) and to type it plus a password into the form himself, then submit. Expected: no error message, the app loads straight into the Dashboard with an empty (freshly-seeded) tenant — 0 tatuajes, 0 sesiones, and the seed catalog visible under Inventario.

- [ ] **Step 4: Verify in the database**

```sql
select codigo, usos_actuales from invitaciones where codigo = 'QA-E2E';
select id, email from auth.users where email = '<the email Francesco used>';
```

Expected: `usos_actuales = 1`; the new user exists.

- [ ] **Step 5: Clean up**

Reuse the same cleanup pattern as Task 3 Step 9, scoped to this one user's `id` (from Step 4) instead of the `LIKE 'test-invite-%'` filter:

```sql
delete from kit_items where kit_id in (select id from kits where tenant_id = '<uid>');
delete from sesion_agujas_testeadas where sesion_id in (select id from sesiones where tenant_id = '<uid>');
delete from movimientos where tenant_id = '<uid>';
delete from sesiones where tenant_id = '<uid>';
delete from kits where tenant_id = '<uid>';
delete from tatuajes where tenant_id = '<uid>';
delete from config where tenant_id = '<uid>';
delete from productos where tenant_id = '<uid>';
delete from auth.users where id = '<uid>';
delete from invitaciones where codigo = 'QA-E2E';
```

Also stop the local server and remove the scratch script:

```bash
pkill -f ".scratch_server.js" 2>/dev/null
rm -f .scratch_server.js
```

---

## Task 6: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the new table, trigger, and signup flow**

Add a short subsection under the existing "Backend: Supabase" section (near where `fn_tenant_bootstrap` is already documented) describing: the `invitaciones` table and its columns, that `fn_validar_invitacion` (`BEFORE INSERT ON auth.users`) gates every account creation — including Francesco's own manual dashboard signups — on a valid invitation code, and that `dbSignUp`/`doSignUp` in the frontend are the only path that supplies `invite_code` metadata. Note that Francesco generates codes via `INSERT INTO invitaciones` in the SQL Editor — no admin UI exists for this.

Update the "Próximas features pendientes" section: mark "Onboarding por invitación" as done, referencing this plan and its spec.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documentar onboarding por invitación en CLAUDE.md"
```
