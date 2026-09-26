// F4H Sistema — Capa de datos Supabase
// ARCHIVADO: estructura modular, NO es el archivo activo.
// Este archivo SÍ es válido: lo usa F4H_Sistema_Beta_v6.html via <script src>.
// Requiere supabase-js CDN cargado ANTES que este script.

const SUPA_URL = 'https://minletiyftpmufqpmviv.supabase.co';
const SUPA_KEY = 'sb_publishable_8dl1Rolu23DUX35Gk8s24g_06GRANqH';
const _db = supabase.createClient(SUPA_URL, SUPA_KEY);

// ── Auth ─────────────────────────────────────────────────────────────────────

async function dbSignIn(email, password) {
  const { error } = await _db.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

async function dbSignOut() {
  await _db.auth.signOut();
}

function dbOnAuthChange(cb) {
  return _db.auth.onAuthStateChange((event, session) => cb(event, session));
}

// ── UI helpers ───────────────────────────────────────────────────────────────

function dbError(m) {
  let bar = document.getElementById('db-error-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'db-error-bar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#b02a2a;color:#fff;padding:10px 20px;font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:12px';
    document.body.prepend(bar);
  }
  bar.innerHTML = '⚠ ' + m + ' <button onclick="this.parentElement.remove()" style="background:none;border:1px solid rgba(255,255,255,.4);color:#fff;padding:2px 10px;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap">✕ Cerrar</button>';
}

function showOfflineBanner() {
  if (document.getElementById('offline-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'offline-bar';
  bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:#7a5c00;color:#ffe;padding:8px 20px;font-size:12px;font-weight:600;text-align:center';
  bar.textContent = '⚡ Modo offline — mostrando datos en caché, solo lectura';
  document.body.prepend(bar);
}

// ── Adaptadores: Supabase columnas → campos cortos del S en memoria ──────────
// IDs se almacenan como strings en S para compatibilidad con .value del DOM.
// Se convierten a Number() al escribir en Supabase.

function adaptProducto(p) {
  return {
    id:           String(p.id),
    nom:          p.nombre,
    cat:          p.categoria,
    sub:          p.subcategoria   || '',
    tipo_consumo: p.tipo_consumo,
    um:           p.unidad_medida,
    stock:        Number(p.stock),
    sm:           Number(p.stock_minimo),
    mon:          p.moneda,
    cu:           Number(p.costo_unitario),
    upu:          Number(p.usos_por_unidad),
    vum:          p.vida_util_meses || 0,
    practica:     p.practica,
    notas:        p.notas          || '',
  };
}

function adaptMovimiento(m) {
  return {
    id:             String(m.id),
    fecha:          m.fecha,
    pid:            String(m.producto_id),
    tipo:           m.tipo,
    qty:            Number(m.cantidad),
    costoAlMomento: m.costo_al_momento,
    ref:            m.referencia || '',
    sesion_id:      m.sesion_id ? String(m.sesion_id) : null,
  };
}

const SCORE_COLS = { sL: 'score_linea', sR: 'score_relleno', sT: 'score_tecnica', sD: 'score_diseno', sC: 'score_conformidad' };

// Promedio por dimensión de los puntajes de cada tatuaje (0 = sin puntuar, no cuenta)
function avgScores(tats) {
  const out = {};
  Object.keys(SCORE_COLS).forEach(k => {
    const vals = tats.map(t => t[k]).filter(v => v > 0);
    out[k] = vals.length ? Math.round(vals.reduce((a, v) => a + v, 0) / vals.length) : 0;
  });
  return out;
}

function adaptSesion(s) {
  // Hijos: varios tatuajes (con puntaje propio), agujas usadas, técnicas
  const tats = (s.sesion_tatuajes || []).map(r => {
    const o = { tid: String(r.tatuaje_id) };
    Object.entries(SCORE_COLS).forEach(([k, col]) => { o[k] = r[col] || 0; });
    return o;
  });
  // tid = tatuaje al que corresponde dentro de la sesión ('' = práctica / sin tatuaje)
  const agujas = (s.sesion_agujas || []).slice().sort((a, b) => a.id - b.id)
    .map(r => ({ tid: r.tatuaje_id ? String(r.tatuaje_id) : '', pid: String(r.producto_id), qty: Number(r.cantidad) || 1 }));
  const tecnicas = (s.sesion_tecnicas || []).slice().sort((a, b) => a.orden - b.orden)
    .map(r => ({ tid: r.tatuaje_id ? String(r.tatuaje_id) : '', tec: r.tecnica, pid: r.producto_id ? String(r.producto_id) : '', volt: r.voltaje != null ? Number(r.voltaje) : '' }));
  return {
    tats, agujas, tecnicas,
    id:          String(s.id),
    fecha:       s.fecha,
    cliente:     s.cliente           || '',
    zona:        s.zona              || '',
    hrs:         s.horas             || 0,
    maquina:     s.maquina           || '',
    agujaId:     agujas[0] ? agujas[0].pid : (s.aguja_principal_id ? String(s.aguja_principal_id) : null),
    voltaje:     s.voltaje           || 0,
    stroke:      s.stroke            || '',
    tattooId:    tats[0] ? tats[0].tid : (s.tatuaje_id ? String(s.tatuaje_id) : null),
    kitId:       s.kit_id      ? String(s.kit_id)      : null,
    // Con tatuajes: puntaje de sesión = promedio de los tatuajes. Sin tatuajes (práctica): columnas propias
    ...(tats.length ? avgScores(tats) : {
      sL: s.score_linea || 0, sR: s.score_relleno || 0, sT: s.score_tecnica || 0,
      sD: s.score_diseno || 0, sC: s.score_conformidad || 0,
    }),
    practica:    s.practica,
    notas:       s.notas             || '',
    // compat: vistas que muestran "la" aguja / "el" tatuaje / "el" voltaje usan el primero
    agujasTested: agujas.map(a => a.pid),
    kitOn:       !!s.kit_id,
    extras:      [],
  };
}

function adaptTatuaje(t) {
  return {
    id:      String(t.id),
    num:     t.numero,
    cliente: t.cliente       || '',
    diseno:  t.diseno,
    estilo:  t.estilo        || '',
    zona:    t.zona          || '',
    tam:     t.tamano        || '',
    estado:  t.estado,
    precio:  Number(t.precio) || 0,
    fotoUrl: t.url_referencia || '',
    notas:   t.notas          || '',
    fotos:   (t.tatuaje_fotos || []).slice().sort((a, b) => a.id - b.id)
      .map(r => ({ id: String(r.id), path: r.path, tipo: r.tipo, sesionId: r.sesion_id ? String(r.sesion_id) : null, fecha: r.created_at })),
  };
}

function adaptTurno(t) {
  return {
    id:       String(t.id),
    fecha:    t.fecha,
    hora:     t.hora_inicio ? t.hora_inicio.slice(0, 5) : '',
    dur:      t.duracion_min || null,
    cli:      t.cliente,
    contacto: t.contacto || '',
    tid:      t.tatuaje_id ? String(t.tatuaje_id) : null,
    sid:      t.sesion_id  ? String(t.sesion_id)  : null,
    estado:   t.estado,
    cupo:     t.cupo_lanzamiento,
    sena:     Number(t.sena_ars) || 0,
    notas:    t.notas || '',
  };
}

function adaptRegla(r) {
  return {
    id:      String(r.id),
    efecto:  r.efecto,
    dias:    r.dias_semana || null,
    desde:   r.desde || null,
    hasta:   r.hasta || null,
    hDesde:  r.hora_desde ? r.hora_desde.slice(0, 5) : '',
    hHasta:  r.hora_hasta ? r.hora_hasta.slice(0, 5) : '',
    motivo:  r.motivo || '',
    created: r.created_at,
  };
}

// ── Lecturas ─────────────────────────────────────────────────────────────────

async function getProductos() {
  const { data, error } = await _db.from('productos').select('*').order('id');
  if (error) { dbError('Error cargando productos: ' + error.message); return null; }
  return data.map(adaptProducto);
}

async function getMovimientos() {
  const { data, error } = await _db
    .from('movimientos').select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) { dbError('Error cargando movimientos: ' + error.message); return null; }
  return data.map(adaptMovimiento);
}

async function getSesiones() {
  const { data, error } = await _db
    .from('sesiones')
    .select('*, sesion_tatuajes(*), sesion_agujas(*), sesion_tecnicas(*)')
    .order('fecha', { ascending: false });
  if (error) { dbError('Error cargando sesiones: ' + error.message); return null; }
  return data.map(adaptSesion);
}

async function getTatuajes() {
  const { data, error } = await _db.from('tatuajes').select('*, tatuaje_fotos(*)').order('id');
  if (error) { dbError('Error cargando tatuajes: ' + error.message); return null; }
  return data.map(adaptTatuaje);
}

async function getKits() {
  const { data, error } = await _db
    .from('kits').select('*, kit_items(producto_id, cantidad)').order('id');
  if (error) { dbError('Error cargando kits: ' + error.message); return null; }
  return data.map(k => ({
    id:     String(k.id),
    nombre: k.nombre,
    items:  (k.kit_items || []).map(i => ({ pid: String(i.producto_id), qty: Number(i.cantidad) })),
  }));
}

async function getConfig() {
  const { data, error } = await _db.from('config').select('*');
  if (error) { dbError('Error cargando config: ' + error.message); return null; }
  const cfg = {};
  (data || []).forEach(row => { cfg[row.clave] = row.valor; });
  return cfg;
}

async function getTurnos() {
  const { data, error } = await _db.from('turnos').select('*').order('fecha').order('hora_inicio');
  if (error) { dbError('Error cargando turnos: ' + error.message); return null; }
  return data.map(adaptTurno);
}

async function getReglas() {
  const { data, error } = await _db
    .from('disponibilidad_reglas').select('*')
    .order('created_at', { ascending: false });
  if (error) { dbError('Error cargando reglas de disponibilidad: ' + error.message); return null; }
  return data.map(adaptRegla);
}

async function getCupos() {
  const { data, error } = await _db.from('v_cupos_lanzamiento').select('*').maybeSingle();
  if (error) { dbError('Error cargando cupos de lanzamiento: ' + error.message); return null; }
  return data || null;
}

async function dbAgendaDias(desde, hasta) {
  const { data, error } = await _db.rpc('fn_agenda_dias', { p_desde: desde, p_hasta: hasta });
  if (error) { dbError('Error calculando disponibilidad: ' + error.message); return null; }
  return data;
}

// ── Escrituras ────────────────────────────────────────────────────────────────

async function dbAddMovimiento({ productoId, tipo, cantidad, costoAlMomento = null, sesionId = null, referencia = null }) {
  const { data, error } = await _db.from('movimientos').insert({
    producto_id:      Number(productoId),
    tipo,
    cantidad,
    costo_al_momento: costoAlMomento || null,
    sesion_id:        sesionId ? Number(sesionId) : null,
    referencia:       referencia || null,
  }).select().single();
  if (error) {
    if (error.code === '23514')
      dbError('Stock insuficiente para realizar la salida.');
    else
      dbError('Error registrando movimiento: ' + (error.message || error.code));
    return null;
  }
  // El trigger actualizó stock y WAC — refrescar el producto en cache
  const { data: prod } = await _db.from('productos').select('*').eq('id', Number(productoId)).single();
  if (prod) {
    const idx = S.productos.findIndex(p => p.id === String(productoId));
    const adapted = adaptProducto(prod);
    if (idx !== -1) S.productos[idx] = adapted; else S.productos.push(adapted);
  }
  return adaptMovimiento(data);
}

// params.tats: [{tid, sL..sC}] · params.agujas: [{pid, qty}] · params.tecnicas: [{tec, pid, volt}]
async function dbSaveSesion(params) {
  const tats     = (params.tats     || []).filter(t => t.tid);
  const agMap = {};
  (params.agujas || []).filter(a => a.pid && a.qty > 0).forEach(a => {
    const k = (a.tid || '') + '|' + a.pid;
    agMap[k] = agMap[k] ? { ...agMap[k], qty: agMap[k].qty + a.qty } : { ...a };
  });
  const agujas   = Object.values(agMap);
  const tecnicas = (params.tecnicas || []).filter(t => t.tec);
  // Puntaje de la sesión: con tatuajes = promedio de ellos; sin tatuajes = el cargado directo
  const sc = tats.length ? avgScores(tats) : params;
  const payload = {
    fecha:              params.fecha,
    cliente:            params.cliente   || null,
    zona:               params.zona      || null,
    horas:              params.hrs       || null,
    maquina:            params.maquina   || null,
    // columnas legacy (V5): se completan con el primer elemento de cada lista
    aguja_principal_id: agujas[0]   ? Number(agujas[0].pid) : null,
    voltaje:            tecnicas.find(t => t.volt !== '' && t.volt != null)?.volt ?? null,
    tatuaje_id:         tats[0]     ? Number(tats[0].tid)   : null,
    stroke:             params.stroke    || null,
    kit_id:             params.kitId     ? Number(params.kitId)    : null,
    score_linea:        sc.sL        || 0,
    score_relleno:      sc.sR        || 0,
    score_tecnica:      sc.sT        || 0,
    score_diseno:       sc.sD        || 0,
    score_conformidad:  sc.sC        || 0,
    practica:           tats.length === 0,
    notas:              params.notas     || null,
  };

  let sesionId;
  if (params.id) {
    const { error } = await _db.from('sesiones').update(payload).eq('id', Number(params.id));
    if (error) { dbError('Error actualizando sesión: ' + error.message); return null; }
    sesionId = params.id;
    await Promise.all(['sesion_tatuajes', 'sesion_agujas', 'sesion_tecnicas']
      .map(tb => _db.from(tb).delete().eq('sesion_id', Number(sesionId))));
  } else {
    const { data, error } = await _db.from('sesiones').insert(payload).select().single();
    if (error) { dbError('Error guardando sesión: ' + error.message); return null; }
    sesionId = String(data.id);
  }

  // Hijos
  const sid = Number(sesionId);
  const inserts = [];
  if (tats.length) inserts.push(['tatuajes', _db.from('sesion_tatuajes').insert(tats.map(t => {
    const row = { sesion_id: sid, tatuaje_id: Number(t.tid) };
    Object.entries(SCORE_COLS).forEach(([k, col]) => { row[col] = t[k] || 0; });
    return row;
  }))]);
  if (agujas.length) inserts.push(['agujas', _db.from('sesion_agujas').insert(agujas.map(a => ({ sesion_id: sid, tatuaje_id: a.tid ? Number(a.tid) : null, producto_id: Number(a.pid), cantidad: a.qty })))]);
  if (tecnicas.length) inserts.push(['técnicas', _db.from('sesion_tecnicas').insert(tecnicas.map((t, i) => ({
    sesion_id: sid, tatuaje_id: t.tid ? Number(t.tid) : null, orden: i, tecnica: t.tec,
    producto_id: t.pid ? Number(t.pid) : null,
    voltaje: t.volt !== '' && t.volt != null ? Number(t.volt) : null,
  })))]);
  for (const [nom, q] of inserts) {
    const { error } = await q;
    if (error) dbError('Error guardando ' + nom + ' de la sesión: ' + error.message);
  }

  // Movimientos (solo para sesiones nuevas — las ediciones no regeneran stock)
  if (!params.id) {
    // Kit items
    if (params.kitId) {
      const kit = S.kits.find(k => k.id === String(params.kitId));
      const excl = params.kitExcludes || [];
      if (kit) {
        for (const ki of kit.items) {
          if (!excl.includes(ki.pid) && ki.qty > 0) {
            await dbAddMovimiento({ productoId: ki.pid, tipo: 'salida', cantidad: ki.qty, sesionId, referencia: 'ses-' + sesionId + ' (kit)' });
          }
        }
      }
    }
    // Extras
    for (const ex of (params.extras || [])) {
      if (ex.pid && ex.qty > 0)
        await dbAddMovimiento({ productoId: ex.pid, tipo: 'salida', cantidad: ex.qty, sesionId, referencia: 'ses-' + sesionId + ' (extra)' });
    }
    // Agujas usadas (todas descuentan, incluidas las de práctica)
    for (const a of agujas)
      await dbAddMovimiento({ productoId: a.pid, tipo: 'salida', cantidad: a.qty, sesionId, referencia: 'ses-' + sesionId + ' (aguja)' });
  }

  // Refrescar cache
  const [nuevasSes, nuevosMov] = await Promise.all([getSesiones(), getMovimientos()]);
  if (nuevasSes) S.sesiones = nuevasSes;
  if (nuevosMov) S.movimientos = nuevosMov;
  return sesionId;
}

async function dbDeleteSesion(id) {
  const { error } = await _db.from('sesiones').delete().eq('id', Number(id));
  if (error) { dbError('Error eliminando sesión: ' + error.message); return false; }
  S.sesiones = S.sesiones.filter(s => s.id !== String(id));
  return true;
}

async function dbSaveTatuaje(t) {
  const payload = {
    numero:         t.num    || null,
    cliente:        t.cliente || null,
    diseno:         t.diseno,
    estilo:         t.estilo || null,
    zona:           t.zona   || null,
    tamano:         t.tam    || null,
    estado:         t.estado || 'Pendiente',
    precio:         t.precio || 0,
    url_referencia: t.fotoUrl || null,
    notas:          t.notas  || null,
  };
  if (t.id) {
    const { error } = await _db.from('tatuajes').update(payload).eq('id', Number(t.id));
    if (error) { dbError('Error actualizando tatuaje: ' + error.message); return null; }
  } else {
    const { data, error } = await _db.from('tatuajes').insert(payload).select().single();
    if (error) { dbError('Error guardando tatuaje: ' + error.message); return null; }
    t.id = String(data.id);
  }
  const nuevos = await getTatuajes();
  if (nuevos) S.tatuajes = nuevos;
  return t.id;
}

async function dbDeleteTatuaje(id) {
  const { error } = await _db.from('tatuajes').delete().eq('id', Number(id));
  if (error) { dbError('Error eliminando tatuaje: ' + error.message); return false; }
  S.tatuajes = S.tatuajes.filter(t => t.id !== String(id));
  S.sesiones.forEach(s => {
    s.tats = (s.tats || []).filter(t => t.tid !== String(id));
    if (s.tattooId === String(id)) s.tattooId = s.tats[0] ? s.tats[0].tid : null;
  });
  return true;
}

async function dbAddProducto(prod) {
  const { data, error } = await _db.from('productos').insert({
    nombre:          prod.nom,
    categoria:       prod.cat,
    subcategoria:    prod.sub           || null,
    tipo_consumo:    prod.tipo_consumo  || 'UNIDAD',
    unidad_medida:   prod.um,
    stock:           prod.si            || 0,
    stock_minimo:    prod.sm            || 0,
    moneda:          prod.mon,
    costo_unitario:  prod.cu            || 0,
    usos_por_unidad: prod.upu           || 1,
    vida_util_meses: prod.vum > 0 ? prod.vum : null,
    practica:        prod.practica      || false,
  }).select().single();
  if (error) { dbError('Error guardando producto: ' + error.message); return null; }
  const nuevo = adaptProducto(data);
  S.productos.push(nuevo);
  return nuevo;
}

async function dbUpdateProducto(id, fields) {
  const patch = {};
  if (fields.nom          !== undefined) patch.nombre          = fields.nom;
  if (fields.sub          !== undefined) patch.subcategoria    = fields.sub || null;
  if (fields.mon          !== undefined) patch.moneda          = fields.mon;
  if (fields.cu           !== undefined) patch.costo_unitario  = fields.cu;
  if (fields.upu          !== undefined) patch.usos_por_unidad = fields.upu;
  if (fields.sm           !== undefined) patch.stock_minimo    = fields.sm;
  if (fields.vum          !== undefined) patch.vida_util_meses = fields.vum > 0 ? fields.vum : null;
  if (fields.tipo_consumo !== undefined) patch.tipo_consumo    = fields.tipo_consumo;
  if (fields.practica     !== undefined) patch.practica        = fields.practica;
  const { error } = await _db.from('productos').update(patch).eq('id', Number(id));
  if (error) { dbError('Error actualizando producto: ' + error.message); return false; }
  const { data } = await _db.from('productos').select('*').eq('id', Number(id)).single();
  if (data) {
    const idx = S.productos.findIndex(p => p.id === String(id));
    if (idx !== -1) S.productos[idx] = adaptProducto(data);
  }
  return true;
}

async function dbSetConfig(clave, valor) {
  const { error } = await _db.from('config')
    .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id,clave' });
  if (error) { dbError('Error guardando configuración: ' + error.message); return false; }
  return true;
}

// ── Kits ─────────────────────────────────────────────────────────────────────

async function dbSaveKitItems(kitId, items) {
  await _db.from('kit_items').delete().eq('kit_id', Number(kitId));
  const rows = items.filter(i => i.pid && i.qty > 0).map(i => ({
    kit_id: Number(kitId), producto_id: Number(i.pid), cantidad: Number(i.qty),
  }));
  if (rows.length > 0) {
    const { error } = await _db.from('kit_items').insert(rows);
    if (error) { dbError('Error guardando items de kit: ' + error.message); return false; }
  }
  return true;
}

async function dbRenameKit(id, nombre) {
  const { error } = await _db.from('kits').update({ nombre }).eq('id', Number(id));
  if (error) { dbError('Error renombrando kit: ' + error.message); return false; }
  const k = S.kits.find(x => x.id === String(id));
  if (k) k.nombre = nombre;
  return true;
}

async function dbAddKit() {
  const { data, error } = await _db.from('kits').insert({ nombre: 'Kit nuevo' }).select().single();
  if (error) { dbError('Error creando kit: ' + error.message); return null; }
  S.kits.push({ id: String(data.id), nombre: data.nombre, items: [] });
  return String(data.id);
}

async function dbDeleteKit(id) {
  const { error } = await _db.from('kits').delete().eq('id', Number(id));
  if (error) { dbError('Error eliminando kit: ' + error.message); return false; }
  S.kits = S.kits.filter(k => k.id !== String(id));
  return true;
}

async function dbSaveTurno(t) {
  // No toca estado ni sesion_id — eso lo maneja dbSetEstadoTurno/dbVincularSesionTurno.
  const payload = {
    fecha:            t.fecha,
    hora_inicio:      t.hora || null,
    duracion_min:     t.dur  || null,
    cliente:          t.cli,
    contacto:         t.contacto || null,
    tatuaje_id:       t.tid ? Number(t.tid) : null,
    cupo_lanzamiento: !!t.cupo,
    sena_ars:         t.sena || 0,
    notas:            t.notas || null,
  };
  if (t.id) {
    const { error } = await _db.from('turnos').update(payload).eq('id', Number(t.id));
    if (error) { dbError('Error actualizando turno: ' + error.message); return null; }
  } else {
    const { data, error } = await _db.from('turnos').insert(payload).select().single();
    if (error) { dbError('Error guardando turno: ' + error.message); return null; }
    t.id = String(data.id);
  }
  const nuevos = await getTurnos();
  if (nuevos) S.turnos = nuevos;
  return t.id;
}

async function dbSetEstadoTurno(id, estado) {
  if (!['Reservado', 'Confirmado', 'Cancelado', 'No vino'].includes(estado)) {
    dbError('Estado de turno inválido'); return false;
  }
  const { error } = await _db.from('turnos').update({ estado }).eq('id', Number(id));
  if (error) { dbError('Error actualizando estado del turno: ' + error.message); return false; }
  const t = S.turnos.find(x => x.id === String(id));
  if (t) t.estado = estado;
  return true;
}

async function dbVincularSesionTurno(turnoId, sesionId) {
  const { error } = await _db.from('turnos')
    .update({ sesion_id: Number(sesionId), estado: 'Realizado' })
    .eq('id', Number(turnoId));
  if (error) { dbError('Error vinculando la sesión al turno: ' + error.message); return false; }
  const t = S.turnos.find(x => x.id === String(turnoId));
  if (t) { t.sid = String(sesionId); t.estado = 'Realizado'; }
  return true;
}

async function dbDesvincularSesionTurno(turnoId) {
  const { error } = await _db.from('turnos')
    .update({ sesion_id: null, estado: 'Confirmado' })
    .eq('id', Number(turnoId));
  if (error) { dbError('Error desvinculando la sesión del turno: ' + error.message); return false; }
  const t = S.turnos.find(x => x.id === String(turnoId));
  if (t) { t.sid = null; t.estado = 'Confirmado'; }
  return true;
}

async function dbDeleteTurno(id) {
  const t = S.turnos.find(x => x.id === String(id));
  if (t && t.sid) { dbError('Este turno tiene una sesión vinculada — desvinculala antes de borrar.'); return false; }
  const { error } = await _db.from('turnos').delete().eq('id', Number(id));
  if (error) { dbError('Error eliminando turno: ' + error.message); return false; }
  S.turnos = S.turnos.filter(x => x.id !== String(id));
  return true;
}

async function dbSaveRegla(r) {
  const payload = {
    efecto:      r.efecto,
    dias_semana: r.dias || null,
    desde:       r.desde || null,
    hasta:       r.hasta || null,
    hora_desde:  r.hDesde || null,
    hora_hasta:  r.hHasta || null,
    motivo:      r.motivo || null,
  };
  const { data, error } = await _db.from('disponibilidad_reglas').insert(payload).select().single();
  if (error) { dbError('Error guardando la regla: ' + error.message); return null; }
  const nuevas = await getReglas();
  if (nuevas) S.reglas = nuevas;
  return String(data.id);
}

async function dbDeleteRegla(id) {
  const { error } = await _db.from('disponibilidad_reglas').delete().eq('id', Number(id));
  if (error) { dbError('Error eliminando la regla: ' + error.message); return false; }
  S.reglas = S.reglas.filter(x => x.id !== String(id));
  return true;
}

// ── Hidratación inicial de S desde Supabase ───────────────────────────────────

async function initDB() {
  try {
    const [productos, movimientos, sesiones, tatuajes, kits, cfg, turnos, reglas, cupos] = await Promise.all([
      getProductos(), getMovimientos(), getSesiones(), getTatuajes(), getKits(), getConfig(),
      getTurnos(), getReglas(), getCupos(),
    ]);
    if (!productos) throw new Error('productos null');
    S.productos   = productos;
    S.movimientos = movimientos || [];
    S.sesiones    = sesiones    || [];
    S.tatuajes    = tatuajes    || [];
    S.kits        = kits        || [];
    S.turnos      = turnos      || [];
    S.reglas      = reglas      || [];
    S.cupos       = cupos       || null;
    if (cfg) {
      if (cfg.tipo_cambio      !== undefined) S.tc  = Number(cfg.tipo_cambio);
      if (cfg.sesiones_por_mes !== undefined) S.spm = Number(cfg.sesiones_por_mes);
    }
    try { localStorage.setItem('siget_f4h_v6', JSON.stringify(S)); } catch (_) {}
    return true;
  } catch (e) {
    try {
      const raw = localStorage.getItem('siget_f4h_v6');
      if (raw) Object.assign(S, JSON.parse(raw));
    } catch (_) {}
    showOfflineBanner();
    return false;
  }
}

// ── Fotos (Storage bucket privado 'fotos', ruta {uid}/{tatuaje_id}/{archivo}) ──────

// Reduce la imagen en el navegador (lado mayor 1600px, JPEG 0.82) para cuidar el espacio
function comprimirImagen(file, max = 1600, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo comprimir')), 'image/jpeg', calidad);
    };
    img.onerror = () => reject(new Error('Archivo de imagen inválido'));
    img.src = URL.createObjectURL(file);
  });
}

async function dbUploadFoto(file, tatuajeId, { sesionId = null, tipo = 'Resultado' } = {}) {
  const { data: { user } } = await _db.auth.getUser();
  if (!user) { dbError('Sesión expirada — volvé a ingresar'); return null; }
  let blob;
  try { blob = await comprimirImagen(file); } catch (e) { dbError(e.message); return null; }
  const path = user.id + '/' + Number(tatuajeId) + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
  const up = await _db.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg' });
  if (up.error) { dbError('Error subiendo foto: ' + up.error.message); return null; }
  const { data, error } = await _db.from('tatuaje_fotos').insert({
    tatuaje_id: Number(tatuajeId), sesion_id: sesionId ? Number(sesionId) : null, tipo, path,
  }).select().single();
  if (error) {
    await _db.storage.from('fotos').remove([path]);
    dbError('Error registrando foto: ' + error.message); return null;
  }
  const t = S.tatuajes.find(x => x.id === String(tatuajeId));
  const foto = { id: String(data.id), path, tipo, sesionId: sesionId ? String(sesionId) : null, fecha: data.created_at };
  if (t) (t.fotos = t.fotos || []).push(foto);
  return foto;
}

async function dbDeleteFoto(tatuajeId, fotoId) {
  const t = S.tatuajes.find(x => x.id === String(tatuajeId));
  const foto = t && (t.fotos || []).find(f => f.id === String(fotoId));
  if (!foto) return false;
  const { error } = await _db.from('tatuaje_fotos').delete().eq('id', Number(fotoId));
  if (error) { dbError('Error eliminando foto: ' + error.message); return false; }
  await _db.storage.from('fotos').remove([foto.path]);
  t.fotos = t.fotos.filter(f => f.id !== String(fotoId));
  return true;
}

// URLs firmadas (el bucket es privado). Cache en memoria hasta 5 min antes de vencer.
const _fotoUrls = {};
async function fotoUrls(paths) {
  const ahora = Date.now();
  const faltan = [...new Set(paths)].filter(p => !_fotoUrls[p] || _fotoUrls[p].exp < ahora);
  if (faltan.length) {
    const { data, error } = await _db.storage.from('fotos').createSignedUrls(faltan, 3600);
    if (!error) (data || []).forEach(d => { if (d.signedUrl) _fotoUrls[d.path] = { url: d.signedUrl, exp: ahora + 55 * 60 * 1000 }; });
  }
  const out = {};
  paths.forEach(p => { if (_fotoUrls[p]) out[p] = _fotoUrls[p].url; });
  return out;
}
