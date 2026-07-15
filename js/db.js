// F4H Sistema — Capa de datos Supabase
// ARCHIVADO: estructura modular, NO es el archivo activo.
// Este archivo SÍ es válido: lo usa F4H_Sistema_Beta_v6.html via <script src>.
// Requiere supabase-js CDN cargado ANTES que este script.

const SUPA_URL = 'https://minletiyftpmufqpmviv.supabase.co';
const SUPA_KEY = 'sb_publishable_8dl1Rolu23DUX35Gk8s24g_06GRANqH';
const _db = supabase.createClient(SUPA_URL, SUPA_KEY);

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

function adaptSesion(s) {
  return {
    id:          String(s.id),
    fecha:       s.fecha,
    cliente:     s.cliente           || '',
    zona:        s.zona              || '',
    hrs:         s.horas             || 0,
    maquina:     s.maquina           || '',
    agujaId:     s.aguja_principal_id ? String(s.aguja_principal_id) : null,
    voltaje:     s.voltaje           || 0,
    stroke:      s.stroke            || '',
    tattooId:    s.tatuaje_id  ? String(s.tatuaje_id)  : null,
    kitId:       s.kit_id      ? String(s.kit_id)      : null,
    sL:          s.score_linea       || 0,
    sR:          s.score_relleno     || 0,
    sT:          s.score_tecnica     || 0,
    sD:          s.score_diseno      || 0,
    sC:          s.score_conformidad || 0,
    practica:    s.practica,
    notas:       s.notas             || '',
    agujasTested: (s.sesion_agujas_testeadas || []).map(r => String(r.producto_id)),
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
    .select('*, sesion_agujas_testeadas(producto_id)')
    .order('fecha', { ascending: false });
  if (error) { dbError('Error cargando sesiones: ' + error.message); return null; }
  return data.map(s => adaptSesion({ ...s, sesion_agujas_testeadas: s.sesion_agujas_testeadas || [] }));
}

async function getTatuajes() {
  const { data, error } = await _db.from('tatuajes').select('*').order('id');
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
    const txt = error.message || '';
    if (txt.includes('stock') || txt.includes('check'))
      dbError('Stock insuficiente para realizar la salida.');
    else
      dbError('Error registrando movimiento: ' + txt);
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

async function dbSaveSesion(params) {
  const payload = {
    fecha:              params.fecha,
    cliente:            params.cliente   || null,
    zona:               params.zona      || null,
    horas:              params.hrs       || null,
    maquina:            params.maquina   || null,
    aguja_principal_id: params.agujaId   ? Number(params.agujaId)  : null,
    voltaje:            params.voltaje   || null,
    stroke:             params.stroke    || null,
    tatuaje_id:         params.tattooId  ? Number(params.tattooId) : null,
    kit_id:             params.kitId     ? Number(params.kitId)    : null,
    score_linea:        params.sL        || 0,
    score_relleno:      params.sR        || 0,
    score_tecnica:      params.sT        || 0,
    score_diseno:       params.sD        || 0,
    score_conformidad:  params.sC        || 0,
    practica:           params.practica  ?? false,
    notas:              params.notas     || null,
  };

  let sesionId;
  if (params.id) {
    const { error } = await _db.from('sesiones').update(payload).eq('id', Number(params.id));
    if (error) { dbError('Error actualizando sesión: ' + error.message); return null; }
    sesionId = params.id;
    await _db.from('sesion_agujas_testeadas').delete().eq('sesion_id', Number(sesionId));
  } else {
    const { data, error } = await _db.from('sesiones').insert(payload).select().single();
    if (error) { dbError('Error guardando sesión: ' + error.message); return null; }
    sesionId = String(data.id);
  }

  // Agujas testeadas (tabla puente, sin descuento de stock)
  const testedIds = params.agujasTested || [];
  if (testedIds.length > 0) {
    const rows = testedIds.map(pid => ({ sesion_id: Number(sesionId), producto_id: Number(pid) }));
    const { error } = await _db.from('sesion_agujas_testeadas').insert(rows);
    if (error) dbError('Error guardando agujas testeadas: ' + error.message);
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
    // Aguja principal (descuenta si no es de práctica)
    if (params.agujaId) {
      const ap = S.productos.find(x => x.id === String(params.agujaId));
      if (ap && !ap.practica)
        await dbAddMovimiento({ productoId: params.agujaId, tipo: 'salida', cantidad: 1, sesionId, referencia: 'ses-' + sesionId + ' (aguja)' });
    }
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
  S.sesiones.forEach(s => { if (s.tattooId === String(id)) s.tattooId = null; });
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
    .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' });
  if (error) { dbError('Error guardando configuración: ' + error.message); return false; }
  return true;
}

// ── Hidratación inicial de S desde Supabase ───────────────────────────────────

async function initDB() {
  try {
    const [productos, movimientos, sesiones, tatuajes, kits, cfg] = await Promise.all([
      getProductos(), getMovimientos(), getSesiones(), getTatuajes(), getKits(), getConfig(),
    ]);
    if (!productos) throw new Error('productos null');
    S.productos   = productos;
    S.movimientos = movimientos || [];
    S.sesiones    = sesiones    || [];
    S.tatuajes    = tatuajes    || [];
    S.kits        = kits        || [];
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
