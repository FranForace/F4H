# Auth por contraseña Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el login por magic link (`signInWithOtp`) por login con email+contraseña (`signInWithPassword`), reusando el usuario de Supabase Auth que ya existe.

**Architecture:** Dos archivos tocados, sin nuevas dependencias ni tablas. `js/db.js` cambia la llamada de auth de OTP a password. `F4H_Sistema_Beta_v6.html` agrega un input de contraseña al formulario existente y elimina el estado "revisá tu mail" que ya no aplica. `initAuthUI()` (manejo de `SIGNED_IN`/`SIGNED_OUT`/`INITIAL_SESSION`) no cambia — ya quedó corregido en el commit `f0a6381`.

**Tech Stack:** HTML/CSS/JS vanilla, `@supabase/supabase-js@2` (UMD, vía CDN), Supabase Auth (mismo proyecto `minletiyftpmufqpmviv`).

## Global Constraints

- No hay suite de tests automatizada en este repo — spec `docs/superpowers/specs/2026-07-23-auth-password-design.md` § Testing: verificación manual, cargando la app en el navegador.
- No tocar `initAuthUI()` (líneas 462-479 de `F4H_Sistema_Beta_v6.html`) — el manejo de eventos de sesión ya está corregido y fuera de alcance.
- No tocar RLS ni schema — spec § Fuera de alcance.
- Reglas de código del proyecto (`CLAUDE.md`): inline styles en HTML dinámico, sin nuevas clases CSS, mantener el patrón `msg()`/mensaje inline ya usado en el resto de la app para errores.
- Sin flujo de "olvidé mi contraseña" — spec § Recovery.

## Prerequisito manual (no es una tarea de código)

Antes de poder probar el Task 2 end-to-end, en el dashboard de Supabase (Authentication → Users →
tu usuario `franforace@gmail.com`) hay que setearle una contraseña. Esto lo hace Francesco directo
en el dashboard, no requiere código. Sin este paso, Task 2 se puede implementar pero no se puede
verificar el login exitoso (sí se puede verificar el caso de error).

---

### Task 1: `js/db.js` — cambiar auth de OTP a password

**Files:**
- Modify: `js/db.js:12-18`

**Interfaces:**
- Consumes: `_db` (cliente Supabase ya creado en `js/db.js:8`)
- Produces: `dbSignIn(email, password)` → `Promise<string|null>` (mensaje de error, o `null` si OK). Firma nueva — Task 2 depende de este cambio de firma.

- [ ] **Step 1: Reemplazar `dbSignIn`**

Reemplazar (líneas 12-18):

```js
async function dbSignIn(email) {
  const { error } = await _db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  return error ? error.message : null;
}
```

por:

```js
async function dbSignIn(email, password) {
  const { error } = await _db.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}
```

- [ ] **Step 2: Verificar que no queda ninguna otra referencia a `signInWithOtp` ni a `emailRedirectTo` en el repo**

Run: `grep -rn "signInWithOtp\|emailRedirectTo" js/ F4H_Sistema_Beta_v6.html`
Expected: sin resultados (ninguna coincidencia).

- [ ] **Step 3: Commit**

```bash
git add js/db.js
git commit -m "feat(auth): dbSignIn usa signInWithPassword en vez de magic link"
```

---

### Task 2: `F4H_Sistema_Beta_v6.html` — formulario de login con contraseña

**Files:**
- Modify: `F4H_Sistema_Beta_v6.html:229-239` (markup del formulario)
- Modify: `F4H_Sistema_Beta_v6.html:447-460` (función `doSignIn`)

**Interfaces:**
- Consumes: `dbSignIn(email, password)` de Task 1 — firma `(string, string) => Promise<string|null>`.
- Consumes: `hideAuthScreen()`, `showLoginForm()` (ya existen, sin cambios, líneas 445-446).
- Produces: nada que otras tasks consuman — es la última task del plan.

- [ ] **Step 1: Reemplazar el markup del formulario**

Reemplazar el bloque completo de `#auth-form` (líneas 228-234):

```html
      <div id="auth-form">
        <div style="font-size:20px;font-weight:700;color:#f0f0ee;margin-bottom:6px">Acceder</div>
        <div style="font-size:13px;color:#888;margin-bottom:1.5rem">Ingres&#xE1; tu email para recibir un enlace de acceso</div>
        <input id="auth-email" type="email" placeholder="tu@email.com" style="width:100%;padding:10px 14px;background:#141414;border:1.5px solid #2e2e2e;border-radius:8px;color:#f0f0ee;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px" onkeydown="if(event.key==='Enter')doSignIn()">
        <button id="auth-btn" onclick="doSignIn()" style="width:100%;padding:11px;background:#c8a96e;color:#111;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:inherit">Enviar enlace</button>
        <div id="auth-msg" style="margin-top:10px;font-size:12px;text-align:center;color:#888"></div>
      </div>
```

por:

```html
      <div id="auth-form">
        <div style="font-size:20px;font-weight:700;color:#f0f0ee;margin-bottom:6px">Acceder</div>
        <div style="font-size:13px;color:#888;margin-bottom:1.5rem">Ingres&#xE1; tu email y contrase&#xF1;a</div>
        <input id="auth-email" type="email" placeholder="tu@email.com" style="width:100%;padding:10px 14px;background:#141414;border:1.5px solid #2e2e2e;border-radius:8px;color:#f0f0ee;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px" onkeydown="if(event.key==='Enter')doSignIn()">
        <input id="auth-password" type="password" placeholder="Contrase&#xF1;a" style="width:100%;padding:10px 14px;background:#141414;border:1.5px solid #2e2e2e;border-radius:8px;color:#f0f0ee;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px" onkeydown="if(event.key==='Enter')doSignIn()">
        <button id="auth-btn" onclick="doSignIn()" style="width:100%;padding:11px;background:#c8a96e;color:#111;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:inherit">Ingresar</button>
        <div id="auth-msg" style="margin-top:10px;font-size:12px;text-align:center;color:#888"></div>
      </div>
```

Y eliminar el bloque `#auth-sent` completo (líneas 235-239, ya no aplica):

```html
      <div id="auth-sent" style="display:none;text-align:center">
        <div style="font-size:48px;margin-bottom:12px;line-height:1">&#x1F4E7;</div>
        <div style="font-size:16px;font-weight:600;color:#f0f0ee;margin-bottom:8px">Revis&#xE1; tu email</div>
        <div style="font-size:13px;color:#888;line-height:1.5">Enviamos un enlace a <span id="auth-email-sent" style="color:#c8a96e;font-weight:600"></span>. Hac&#xE9; clic en el enlace para ingresar.</div>
      </div>
```

- [ ] **Step 2: Reemplazar `doSignIn`**

Reemplazar (líneas 447-460):

```js
async function doSignIn(){
  const email=(document.getElementById('auth-email').value||'').trim();
  const msgEl=document.getElementById('auth-msg');
  const btn=document.getElementById('auth-btn');
  if(!email){if(msgEl)msgEl.textContent='Ingres\xE1 tu email';return;}
  if(btn)btn.disabled=true;
  if(msgEl)msgEl.textContent='Enviando...';
  const err=await dbSignIn(email);
  if(btn)btn.disabled=false;
  if(err){if(msgEl)msgEl.textContent='Error: '+err;return;}
  const sentEl=document.getElementById('auth-email-sent');if(sentEl)sentEl.textContent=email;
  document.getElementById('auth-form').style.display='none';
  document.getElementById('auth-sent').style.display='';
}
```

por:

```js
async function doSignIn(){
  const email=(document.getElementById('auth-email').value||'').trim();
  const password=document.getElementById('auth-password').value||'';
  const msgEl=document.getElementById('auth-msg');
  const btn=document.getElementById('auth-btn');
  if(!email||!password){if(msgEl)msgEl.textContent='Ingres\xE1 email y contrase\xF1a';return;}
  if(btn)btn.disabled=true;
  if(msgEl)msgEl.textContent='Ingresando...';
  const err=await dbSignIn(email,password);
  if(btn)btn.disabled=false;
  if(err){if(msgEl)msgEl.textContent='Error: '+err;return;}
  if(msgEl)msgEl.textContent='';
}
```

(El `hideAuthScreen()`/`load()`/`renderAll()` post-login ya lo dispara `initAuthUI()` al recibir el evento `SIGNED_IN` — no hace falta llamarlo acá.)

- [ ] **Step 3: Verificar que no queda ninguna referencia a los IDs eliminados**

Run: `grep -n "auth-sent\|auth-email-sent" F4H_Sistema_Beta_v6.html`
Expected: sin resultados.

- [ ] **Step 4: Verificación manual — caso de error (no requiere el prerequisito de contraseña seteada)**

Abrir `F4H_Sistema_Beta_v6.html` directo en el navegador (doble click o `file://`).
Escribir cualquier email + cualquier contraseña, click en "Ingresar".
Expected: aparece `Error: ...` en `#auth-msg` (Supabase responde "Invalid login credentials" o similar), el botón se reactiva, la pantalla de login sigue visible.

- [ ] **Step 5: Verificación manual — caso exitoso (requiere el prerequisito: contraseña ya seteada en el dashboard de Supabase)**

Escribir `franforace@gmail.com` + la contraseña seteada en el dashboard, click en "Ingresar" (o Enter).
Expected: la pantalla de login desaparece, carga el dashboard de la app, el botón "Cerrar sesión" aparece en el sidebar.
Recargar la página (F5): la sesión debe persistir sin volver a pedir login (esto ya lo garantiza el `persistSession` por defecto de supabase-js — confirma que no quedó ninguna regresión).

- [ ] **Step 6: Commit**

```bash
git add F4H_Sistema_Beta_v6.html
git commit -m "feat(auth): formulario de login con contrase\xF1a, elimina flujo de magic link"
```

---

## Self-Review

- **Spec coverage:** Task 1 cubre spec §1 (`js/db.js`). Task 2 cubre spec §2 (formulario), §3 (manejo de error inline vía `#auth-msg`, mismo patrón que el resto de la app). Spec §4 (setup inicial) queda como prerequisito manual, no una task de código — correcto, no es código a escribir. Spec §5 (sin recovery) — no requiere ninguna task, es una omisión intencional, ya reflejada en que no se agrega ningún flujo de "olvidé mi contraseña".
- **Placeholder scan:** sin TBD/TODO. Todos los steps tienen código completo, no hay "similar a task N" ni pasos sin contenido.
- **Type consistency:** `dbSignIn(email, password)` definido en Task 1 con esa firma exacta; Task 2 lo llama como `dbSignIn(email,password)` — consistente. IDs de DOM (`auth-email`, `auth-password`, `auth-msg`, `auth-btn`, `auth-form`) usados igual en el markup y en `doSignIn`.
