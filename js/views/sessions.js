// ARCHIVADO — Estructura modular antigua. El sistema activo es F4H_Sistema_Beta_v6.html. No modificar.
// ─── Sesiones ────────────────────────────────────────────────────────────────
function renderSes(){
  document.getElementById('t-ses').innerHTML=`
    <div class="page-hdr">
      <div>
        <div class="page-hdr-lbl">T&eacute;cnica</div>
        <div class="page-hdr-title">Sesiones</div>
        <div class="page-hdr-sub">${S.sesiones.length} sesiones registradas</div>
      </div>
    </div>
    <div class="subtab-row">
      <button class="subtab ${sesView==='nueva'?'on':''}" onclick="setSesView('nueva')">Nueva sesi&oacute;n</button>
      <button class="subtab ${sesView==='bit'?'on':''}" onclick="setSesView('bit')">Bit&aacute;cora (${S.sesiones.length})</button>
    </div>
    ${sesView==='nueva'?buildNuevaSes():sesView==='edit'&&editSesionId?buildEditSes(editSesionId):buildBitacora()}`;
  if(sesView==='nueva')applyScores();
}

function buildNuevaSes(){
  const maquinas=S.productos.filter(p=>p.cat==='Activo'&&p.sub==='Maquina');
  const agujas=S.productos.filter(p=>p.cat==='Aguja');
  const realAgujas=agujas.filter(p=>!p.practica);
  const pracAgujas=agujas.filter(p=>p.practica);
  const amortS=amortTotalSes();const kitC=calcKitCostStatic();
  const testedChips=agujas.map(a=>`<button type="button" class="aguja-chip${a.practica?' prac':''}${nTestedIds.has(a.id)?' on':''}" onclick="toggleTested('${a.id}')">${a.nom}${a.practica?' ★':''}</button>`).join('');
  const tattooOpts=S.tatuajes.filter(t=>t.estado!=='Finalizado').map(t=>`<option value="${t.id}">#${t.num} · ${t.cliente} — ${t.diseno}</option>`).join('');
  return`<div class="card">
    <div class="ct">Nueva sesión</div>
    <div class="fgrid" style="margin-bottom:1rem">
      <div class="fg"><label class="fl">Fecha</label><input id="sf-fecha" type="date" value="${today}"></div>
      <div class="fg"><label class="fl">Cliente</label><input id="sf-cli" placeholder="Nombre o 'Yo mismo'"></div>
      <div class="fg"><label class="fl">Zona</label><input id="sf-zona" list="zonas-dl" placeholder="Muslo, Antebrazo...">
        <datalist id="zonas-dl"><option>Muslo</option><option>Antebrazo</option><option>Brazo</option><option>Pecho</option><option>Espalda</option><option>Costillas</option><option>Tobillo</option><option>Piel sintética</option></datalist>
      </div>
      <div class="fg"><label class="fl">Tiempo (hrs)</label><input id="sf-hrs" type="number" min="0.25" step="0.25" value="2"></div>
      <div class="fg"><label class="fl">Máquina</label><select id="sf-maq"><option value="">— Seleccionar —</option>${maquinas.map(m=>`<option value="${m.nom}">${m.nom}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">Voltaje (V)</label><input id="sf-volt" type="number" min="0" step="0.1" value="8"></div>
      <div class="fg"><label class="fl">Stroke</label><input id="sf-stroke" placeholder="Ej: 3.8 o 'fijo'"></div>
      <div class="fg"><label class="fl">Tatuaje vinculado <span class="hint">(opcional)</span></label>
        <select id="sf-tattoo"><option value="">— Práctica / sin proyecto —</option>${tattooOpts}</select>
      </div>
    </div>

    <div style="margin-bottom:1rem">
      <div class="fl" style="margin-bottom:6px">Aguja principal</div>
      <select id="sf-aguja">
        <option value="">— Sin registrar —</option>
        ${realAgujas.length?`<optgroup label="Real (descuenta stock)">${realAgujas.map(a=>`<option value="${a.id}">${a.nom} (stock: ${stockOf(a.id)})</option>`).join('')}</optgroup>`:''}
        ${pracAgujas.length?`<optgroup label="★ Práctica (no descuenta)">${pracAgujas.map(a=>`<option value="${a.id}">${a.nom}</option>`).join('')}</optgroup>`:''}
      </select>
    </div>

    <div style="margin-bottom:1rem">
      <div class="fl" style="margin-bottom:6px">Agujas testeadas <span class="hint">— todas las que probaste</span></div>
      <div class="aguja-grid" id="tested-grid">${testedChips}</div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin-bottom:.5rem">
      <input type="checkbox" id="sf-kit" style="width:auto" checked onchange="updateSesTotal()">
      <label for="sf-kit" style="font-size:12px;font-weight:500;cursor:pointer">Aplicar kit base</label>
      <span class="hint">(${ars(kitC)} · ${S.kit.length} ítems)</span>
    </div>
    <div class="card-inner">
      ${S.kit.map(ki=>{const p=S.productos.find(x=>x.id===ki.pid);return p?`<div class="kit-row"><span>${p.nom} ×${ki.qty}</span><span class="hint">${p.cu>0?ars(cxu(p)*ki.qty):'sin costo'}</span></div>`:''}).join('')}
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin:.75rem 0 .5rem">
      <span style="font-size:12px;font-weight:500">Insumos adicionales</span>
      <button class="btn btn-sm" onclick="addExtra()">+ Agregar</button>
    </div>
    <div id="extras-sec">${renderExtras()}</div>

    <div style="margin:.75rem 0 .5rem"><span class="fl">Evaluación (1–10)</span></div>
    ${DIMS.map(({k,lbl})=>`<div class="sc-dim-card">
      <div class="sc-dim-title">${lbl}</div>
      <div>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="sc-btn" id="s${k}${n}" onclick="setScore('${k}',${n})">${n}</button>`).join('')}</div>
    </div>`).join('')}

    <div style="margin:.75rem 0 .4rem"><span class="fl">Notas</span></div>
    <textarea id="sf-notas" placeholder="¿Qué funcionó? ¿Qué cambiarías?"></textarea>

    <div class="cost-bar">
      <div><div style="font-size:12px;color:#666">Costo estimado sesión</div>
      <div class="hint">amort. ${ars(amortS)} + insumos <span id="ins-cost">${ars(kitC+calcExtrasCost())}</span></div></div>
      <div class="cost-total" id="ses-total">${ars(amortS+kitC+calcExtrasCost())}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <button class="btn btn-p" onclick="saveSes()">Guardar sesión</button>
      <span id="ses-msg"></span>
    </div>
  </div>`;
}


function editSesFromTattoo(sid){go('ses');setTimeout(()=>{editSesionId=sid;sesView='edit';renderSes();},60);}
function startEditSes(sid){
  editSesionId=sid;
  sesView='edit';
  renderSes();
}

function buildEditSes(sid){
  const s=S.sesiones.find(x=>x.id===sid);
  if(!s)return'<div class="empty">Sesión no encontrada.</div>';
  const maquinas=S.productos.filter(p=>p.cat==='Activo'&&p.sub==='Maquina');
  const agujas=S.productos.filter(p=>p.cat==='Aguja');
  const realAgujas=agujas.filter(p=>!p.practica);
  const pracAgujas=agujas.filter(p=>p.practica);
  const testedSet=new Set(s.agujasTested||[]);
  const tattooOpts=S.tatuajes.map(t=>`<option value="${t.id}"${s.tattooId===t.id?' selected':''}>#${t.num} · ${t.cliente} — ${t.diseno}</option>`).join('');
  const chips=agujas.map(a=>`<button type="button" class="aguja-chip${a.practica?' prac':''}${testedSet.has(a.id)?' on':''}" onclick="toggleEditTested('${a.id}','${sid}')">${a.nom}${a.practica?' ★':''}</button>`).join('');

  // Pre-fill scores
  const es={L:s.sL||0,R:s.sR||0,T:s.sT||0,D:s.sD||0,C:s.sC||0};
  const scoreButtons=DIMS.map(({k,lbl})=>`<div class="sc-dim-card">
    <div class="sc-dim-title">${lbl}</div>
    <div>${[1,2,3,4,5,6,7,8,9,10].map(n=>{const on=n===es[k];const cls=on?(n>=7?'on-green':n>=4?'on-amber':'on-red'):'';return`<button class="sc-btn ${cls}" id="es${k}${n}" onclick="setEditScore('${sid}','${k}',${n})">${n}</button>`;}).join('')}</div>
  </div>`).join('');

  return`<div class="card-blue">
    <div class="ct" style="color:var(--accent)">✏ Editando sesión — ${fdate(s.fecha)} · ${s.zona||'sin zona'}</div>
    <div class="edit-hint">Podés corregir todos los campos incluidos los scores. Los movimientos de stock NO se recalculan — solo los datos de la bitácora.</div>
    <div class="fgrid" style="margin-bottom:1rem">
      <div class="fg"><label class="fl">Fecha</label><input id="es-fecha" type="date" value="${s.fecha}"></div>
      <div class="fg"><label class="fl">Cliente</label><input id="es-cli" value="${s.cliente||''}"></div>
      <div class="fg"><label class="fl">Zona</label><input id="es-zona" list="zonas-dl-e" value="${s.zona||''}">
        <datalist id="zonas-dl-e"><option>Muslo</option><option>Antebrazo</option><option>Brazo</option><option>Pecho</option><option>Espalda</option><option>Costillas</option><option>Piel sintética</option></datalist>
      </div>
      <div class="fg"><label class="fl">Tiempo (hrs)</label><input id="es-hrs" type="number" min="0.25" step="0.25" value="${s.hrs||1}"></div>
      <div class="fg"><label class="fl">Máquina</label><select id="es-maq"><option value="">— —</option>${maquinas.map(m=>`<option value="${m.nom}"${s.maquina===m.nom?' selected':''}>${m.nom}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">Voltaje (V)</label><input id="es-volt" type="number" step="0.1" value="${s.voltaje||0}"></div>
      <div class="fg"><label class="fl">Stroke</label><input id="es-stroke" value="${s.stroke||''}"></div>
      <div class="fg"><label class="fl">Tatuaje vinculado</label>
        <select id="es-tattoo"><option value="">— Práctica —</option>${tattooOpts}</select>
      </div>
    </div>
    <div style="margin-bottom:1rem">
      <div class="fl" style="margin-bottom:6px">Aguja principal</div>
      <select id="es-aguja">
        <option value="">— —</option>
        ${realAgujas.length?`<optgroup label="Real">${realAgujas.map(a=>`<option value="${a.id}"${s.agujaId===a.id?' selected':''}>${a.nom}</option>`).join('')}</optgroup>`:''}
        ${pracAgujas.length?`<optgroup label="★ Práctica">${pracAgujas.map(a=>`<option value="${a.id}"${s.agujaId===a.id?' selected':''}>${a.nom}</option>`).join('')}</optgroup>`:''}
      </select>
    </div>
    <div style="margin-bottom:1rem">
      <div class="fl" style="margin-bottom:6px">Agujas testeadas</div>
      <div class="aguja-grid" id="edit-tested-grid-${sid}">${chips}</div>
    </div>
    <div style="margin:.75rem 0 .5rem"><span class="fl">Evaluación (1–10)</span></div>
    ${scoreButtons}
    <div style="margin:.75rem 0 .4rem"><span class="fl">Notas</span></div>
    <textarea id="es-notas" rows="4">${s.notas||''}</textarea>
    <div style="margin-top:1rem;display:flex;gap:8px;align-items:center">
      <button class="btn btn-p" onclick="saveEditSes('${sid}')">Guardar cambios</button>
      <button class="btn btn-ghost" onclick="editSesionId=null;sesView='bit';renderSes()">Cancelar</button>
      <button class="btn btn-danger btn-sm" onclick="deleteSes('${sid}')">Eliminar sesión</button>
      <span id="es-msg-${sid}"></span>
    </div>
  </div>`;
}

// Track edited scores separately for edit form
function setEditScore(sid,k,v){
  if(!editScoresBuf[sid])editScoresBuf[sid]={L:0,R:0,T:0,D:0,C:0};
  editScoresBuf[sid][k]=v;
  // update button UI
  for(let n=1;n<=10;n++){
    const b=document.getElementById('es'+k+n);
    if(!b)continue;
    const on=n===v;
    b.className='sc-btn'+(on?' '+(n>=7?'on-green':n>=4?'on-amber':'on-red'):'');
  }
}

function toggleEditTested(pid,sid){
  const grid=document.getElementById('edit-tested-grid-'+sid);
  if(!grid)return;
  // toggle in the session object temporarily
  const s=S.sesiones.find(x=>x.id===sid);if(!s)return;
  if(!s._editTested)s._editTested=new Set(s.agujasTested||[]);
  if(s._editTested.has(pid))s._editTested.delete(pid);else s._editTested.add(pid);
  const agujas=S.productos.filter(p=>p.cat==='Aguja');
  grid.innerHTML=agujas.map(a=>`<button type="button" class="aguja-chip${a.practica?' prac':''}${s._editTested.has(a.id)?' on':''}" onclick="toggleEditTested('${a.id}','${sid}')">${a.nom}${a.practica?' ★':''}</button>`).join('');
}

function saveEditSes(sid){
  const s=S.sesiones.find(x=>x.id===sid);if(!s)return;
  s.fecha=document.getElementById('es-fecha').value||s.fecha;
  s.cliente=document.getElementById('es-cli').value.trim();
  s.zona=document.getElementById('es-zona').value.trim();
  s.hrs=parseFloat(document.getElementById('es-hrs').value)||s.hrs;
  s.maquina=document.getElementById('es-maq').value;
  s.voltaje=parseFloat(document.getElementById('es-volt').value)||0;
  s.stroke=document.getElementById('es-stroke').value;
  s.agujaId=document.getElementById('es-aguja').value;
  s.tattooId=document.getElementById('es-tattoo').value||null;
  s.notas=document.getElementById('es-notas').value.trim();
  // scores
  const buf=editScoresBuf[sid]||{};
  s.sL=buf.L||s.sL||0;s.sR=buf.R||s.sR||0;s.sT=buf.T||s.sT||0;
  s.sD=buf.D||s.sD||0;s.sC=buf.C||s.sC||0;
  // tested
  if(s._editTested){s.agujasTested=[...s._editTested];delete s._editTested;}
  persist();
  editSesionId=null;sesView='bit';renderSes();
}

function deleteSes(sid){
  if(!confirm('¿Eliminar esta sesión? Los movimientos de stock generados NO se revierten.'))return;
  S.sesiones=S.sesiones.filter(x=>x.id!==sid);
  persist();editSesionId=null;sesView='bit';renderSes();
}

function buildBitacora(){
  if(!S.sesiones.length)return'<div class="empty">Sin sesiones todavía.</div>';
  const n=S.sesiones.length;
  const avgGlobal=(S.sesiones.reduce((a,s)=>a+globalScore(s),0)/n).toFixed(1);
  const avgDim=k=>{const vals=S.sesiones.map(s=>s[k]).filter(v=>v>0);return vals.length?(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(1):'—';};
  return`<div class="mini-grid">
    <div class="mini-metric"><div class="mm-lbl">Sesiones</div><div class="mm-val">${n}</div></div>
    <div class="mini-metric"><div class="mm-lbl">Score global</div><div class="mm-val" style="color:var(--accent)">${avgGlobal}</div></div>
    <div class="mini-metric"><div class="mm-lbl">L&iacute;nea</div><div class="mm-val">${avgDim('sL')}</div></div>
    <div class="mini-metric"><div class="mm-lbl">Relleno</div><div class="mm-val">${avgDim('sR')}</div></div>
  </div>
  <div class="card" style="padding:0;overflow:hidden"><table>
    <thead><tr><th>Fecha</th><th>Zona</th><th>Proyecto</th><th>Aguja princ.</th><th>Línea</th><th>Relleno</th><th>Técnica</th><th>Diseño</th><th>Conform.</th><th>Global</th><th>Notas</th><th></th></tr></thead>
    <tbody>${[...S.sesiones].reverse().map(s=>{
      const ag=S.productos.find(p=>p.id===s.agujaId);
      const tattoo=S.tatuajes.find(t=>t.id===s.tattooId);
      const tested=(s.agujasTested||[]).map(id=>{const p=S.productos.find(x=>x.id===id);return p?`<span class="badge b-prac">${p.nom}</span>`:id;}).join(' ');
      return`<tr>
        <td>${fdate(s.fecha)}</td><td>${s.zona||'—'}</td>
        <td>${tattoo?`<span style="font-size:11px;color:var(--accent)">#${tattoo.num} ${tattoo.diseno}</span>`:'<span class="hint">práctica</span>'}</td>
        <td class="hint">${ag?ag.nom+(ag.practica?' ★':''):'—'}</td>
        <td>${scorePill(s.sL)}</td><td>${scorePill(s.sR)}</td><td>${scorePill(s.sT)}</td><td>${scorePill(s.sD)}</td><td>${scorePill(s.sC)}</td>
        <td>${scorePill(globalScore(s))}</td>
        <td style="font-size:11px;color:var(--text-2);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(s.notas||'').replace(/"/g,'&quot;')}">${s.notas||'—'}</td>
        <td><button class="btn btn-xs btn-ghost" onclick="startEditSes('${s.id}')">✏</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function toggleTested(pid){
  if(nTestedIds.has(pid))nTestedIds.delete(pid);else nTestedIds.add(pid);
  const grid=document.getElementById('tested-grid');
  if(grid){const agujas=S.productos.filter(p=>p.cat==='Aguja');grid.innerHTML=agujas.map(a=>`<button type="button" class="aguja-chip${a.practica?' prac':''}${nTestedIds.has(a.id)?' on':''}" onclick="toggleTested('${a.id}')">${a.nom}${a.practica?' ★':''}</button>`).join('');}
}
function renderExtras(){
  if(!nExtras.length)return`<p class="hint" style="padding:4px 0 .5rem">Sin insumos adicionales.</p>`;
  const opts=S.productos.filter(p=>p.cat!=='Activo').map(p=>`<option value="${p.id}">[${p.cat}] ${p.nom}</option>`).join('');
  return nExtras.map((e,i)=>{const p=S.productos.find(x=>x.id===e.pid);
    return`<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
      <select style="flex:1;font-size:12px" onchange="nExtras[${i}].pid=this.value;updateSesTotal()">${opts.replace(`value="${e.pid}"`,`value="${e.pid}" selected`)}</select>
      <input type="number" min="1" value="${e.qty}" style="width:55px" onchange="nExtras[${i}].qty=parseInt(this.value)||1;updateSesTotal()">
      <button class="btn btn-xs" onclick="nExtras.splice(${i},1);rerenderExtras();updateSesTotal()">✕</button>
      <span class="hint" style="min-width:55px;text-align:right">${p&&p.cu>0?ars(cxu(p)*e.qty):'—'}</span>
    </div>`;
  }).join('');
}
function rerenderExtras(){const el=document.getElementById('extras-sec');if(el)el.innerHTML=renderExtras();}
function addExtra(){const first=S.productos.find(p=>p.cat!=='Activo');nExtras.push({pid:first?first.id:'',qty:1});rerenderExtras();updateSesTotal();}
function scoreClass(v){return v>=7?'on-green':v>=4?'on-amber':'on-red';}
function applyScores(){DIMS.forEach(({k})=>{for(let n=1;n<=10;n++){const b=document.getElementById('s'+k+n);if(!b)continue;const on=n===nScores[k];b.className='sc-btn'+(on?' '+scoreClass(n):'');}});}
function setScore(k,v){nScores[k]=v;applyScores();}
function updateSesTotal(){
  const kitOn=document.getElementById('sf-kit')?.checked;
  const kitC=kitOn?calcKitCostStatic():0;const extC=calcExtrasCost();const amortS=amortTotalSes();
  const el=document.getElementById('ses-total');const eli=document.getElementById('ins-cost');
  if(el)el.textContent=ars(amortS+kitC+extC);if(eli)eli.textContent=ars(kitC+extC);
}
function saveSes(){
  const fecha=document.getElementById('sf-fecha').value||today;
  const agujaId=document.getElementById('sf-aguja').value;
  const kitOn=document.getElementById('sf-kit').checked;
  const tattooId=document.getElementById('sf-tattoo').value||null;
  const sesId='S'+Date.now();
  const agujasTested=[...nTestedIds];
  S.sesiones.push({id:sesId,fecha,
    cliente:document.getElementById('sf-cli').value.trim(),
    zona:document.getElementById('sf-zona').value.trim(),
    hrs:parseFloat(document.getElementById('sf-hrs').value)||0,
    maquina:document.getElementById('sf-maq').value,
    agujaId,agujasTested,tattooId,
    voltaje:parseFloat(document.getElementById('sf-volt').value)||0,
    stroke:document.getElementById('sf-stroke').value,
    kitOn,extras:[...nExtras],
    sL:nScores.L,sR:nScores.R,sT:nScores.T,sD:nScores.D,sC:nScores.C,
    notas:document.getElementById('sf-notas').value.trim(),
    practica:!tattooId
  });
  if(kitOn)S.kit.forEach(ki=>{if(ki.qty>0){const _kp=S.productos.find(x=>x.id===ki.pid);S.movimientos.push({id:'M'+Date.now()+'k'+ki.pid,fecha,pid:ki.pid,tipo:'salida',qty:ki.qty,ref:sesId+' (kit)',costoAlMomento:_kp?Math.round(cuARS(_kp)):0});}});
  nExtras.forEach(e=>{if(e.pid&&e.qty>0){const _ep=S.productos.find(x=>x.id===e.pid);S.movimientos.push({id:'M'+Date.now()+'x'+e.pid,fecha,pid:e.pid,tipo:'salida',qty:e.qty,ref:sesId+' (extra)',costoAlMomento:_ep?Math.round(cuARS(_ep)):0});}});
  if(agujaId){const ap=S.productos.find(x=>x.id===agujaId);if(ap&&!ap.practica)S.movimientos.push({id:'M'+Date.now()+'ag',fecha,pid:agujaId,tipo:'salida',qty:1,ref:sesId+' (aguja)',costoAlMomento:Math.round(cuARS(ap))});}
  persist();msg('ses-msg','Sesión guardada','ok');
  nExtras=[];nScores={L:0,R:0,T:0,D:0,C:0};nTestedIds=new Set();
  setTimeout(()=>setSesView('bit'),1000);
}

