// ─── Tatuajes ────────────────────────────────────────────────────────────────
function renderTattoos(){
  const el=document.getElementById('t-tattoos');
  el.innerHTML=`
    <div class="stabs">
      <button class="stab ${tattooView==='lista'?'on':''}" onclick="tattooView='lista';renderTattoos()">Lista (${S.tatuajes.length})</button>
      <button class="stab ${tattooView==='nuevo'?'on':''}" onclick="tattooView='nuevo';renderTattoos()">+ Nuevo tatuaje</button>
      <button class="stab ${tattooView==='stats'?'on':''}" onclick="tattooView='stats';renderTattoos()">Estadísticas</button>
    </div>
    ${tattooView==='nuevo'?buildNuevoTattoo():tattooView==='stats'?buildStatsTattoos():tattooView==='detalle'&&selectedTattooId?buildDetalleTattoo(selectedTattooId):buildListaTattoos()}`;
}

function buildListaTattoos(){
  if(!S.tatuajes.length)return`<div class="empty" style="padding:2.5rem">Ningún tatuaje registrado todavía.<br>Creá el primero con "+ Nuevo tatuaje".</div>`;
  return S.tatuajes.map(t=>{
    const sess=tattooSesiones(t.id);
    const costo=tattooCosto(t.id);
    const margen=t.precio?(t.precio-costo):null;
    return`<div class="card-tattoo${selectedTattooId===t.id?' active':''}" onclick="selectedTattooId='${t.id}';tattooView='detalle';renderTattoos()">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
        <div>
          <span style="font-size:11px;color:#aaa;font-weight:500">#${t.num} · ${t.cliente}</span><br>
          <span style="font-size:15px;font-weight:600">${t.diseno}</span>
        </div>
        <div style="text-align:right">
          ${estadoBadge(t.estado)}
          ${t.precio?`<div style="font-size:12px;margin-top:4px;color:#888">Precio: ${ars(t.precio)}</div>`:''}
        </div>
      </div>
      <div style="display:flex;gap:12px;font-size:11px;color:#888;flex-wrap:wrap">
        <span>${sess.length} sesión(es)</span>
        ${t.estilo?`<span class="badge b-prac">${t.estilo}</span>`:''}
        ${t.zona?`<span>${t.zona}</span>`:''}
        ${t.tamano?`<span>${t.tamano}</span>`:''}
        <span>Costo acum: ${ars(costo)}</span>
        ${margen!=null?`<span class="${margen>=0?'margin-pos':'margin-neg'}">Margen: ${margen>=0?'+':''}${ars(margen)}</span>`:''}
      </div>
    </div>`;
  }).join('');
}

function buildNuevoTattoo(){
  const nextNum=(S.tatuajes.length?Math.max(...S.tatuajes.map(t=>t.num||0))+1:1);
  return`<div class="card">
    <div class="ct">Nuevo tatuaje</div>
    <div class="fgrid">
      <div class="fg"><label class="fl">N° de tatuaje</label><input id="nt-num" type="number" value="${nextNum}" min="1"></div>
      <div class="fg"><label class="fl">Estado</label><select id="nt-estado"><option>En curso</option><option>Finalizado</option><option>Pendiente</option></select></div>
      <div class="fg" style="grid-column:1/-1"><label class="fl">Cliente</label><input id="nt-cli" placeholder="Nombre o referencia"></div>
      <div class="fg" style="grid-column:1/-1"><label class="fl">Diseño / descripción</label><input id="nt-dis" placeholder="Ej: Fantasma americano tradicional, antebrazo"></div>
      <div class="fg"><label class="fl">Zona del cuerpo</label><input id="nt-zona" list="zonas-dl2" placeholder="Ej: Muslo, Brazo...">
        <datalist id="zonas-dl2"><option>Muslo</option><option>Antebrazo</option><option>Brazo</option><option>Pecho</option><option>Espalda</option><option>Costillas</option><option>Tobillo</option><option>Cuello</option><option>Mano</option></datalist>
      </div>
      <div class="fg"><label class="fl">Tamaño estimado</label><input id="nt-tam" placeholder="Ej: 5cm, A4, pequeño"></div>
      <div class="fg"><label class="fl">Estilo</label><select id="nt-est"><option value="">— Sin definir —</option>${ESTILOS.map(e=>`<option>${e}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">Precio acordado (ARS)</label><input id="nt-precio" type="number" min="0" step="100" placeholder="0"></div>
      <div class="fg"><label class="fl">URL foto de referencia</label><input id="nt-foto" placeholder="https://..."></div>
      <div class="fg" style="grid-column:1/-1"><label class="fl">Notas</label><textarea id="nt-notas" rows="2" placeholder="Estilo, restricciones, preferencias del cliente..."></textarea></div>
    </div>
    <div style="margin-top:1rem;display:flex;gap:8px;align-items:center">
      <button class="btn btn-p" onclick="addTattoo()">Guardar tatuaje</button>
      <button class="btn" onclick="tattooView='lista';renderTattoos()">Cancelar</button>
      <span id="nt-msg"></span>
    </div>
  </div>`;
}

function buildDetalleTattoo(tid){
  const t=S.tatuajes.find(x=>x.id===tid);if(!t)return'';
  const sess=tattooSesiones(tid);
  const costo=tattooCosto(tid);
  const margen=t.precio?(t.precio-costo):null;
  const pct=t.precio?Math.min(100,Math.round((costo/t.precio)*100)):null;

  return`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
    <button class="btn btn-sm" onclick="tattooView='lista';selectedTattooId=null;renderTattoos()">← Volver</button>
    <div style="display:flex;gap:6px">
      <button class="btn btn-sm" onclick="editTattoo('${tid}')">✏ Editar</button>
      <button class="btn btn-sm btn-danger" onclick="deleteTattoo('${tid}')">Eliminar</button>
    </div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:1rem">
      <div>
        <div class="hint">#${t.num} · ${t.cliente}</div>
        <div style="font-size:18px;font-weight:600;margin:2px 0;color:var(--text)">${t.diseno}</div>
        ${t.zona?`<div class="hint">${t.zona}${t.tamano?' · '+t.tamano:''}</div>`:''}
      </div>
      ${estadoBadge(t.estado)}
    </div>
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-lbl">Precio acordado</div><div class="detail-val">${t.precio?ars(t.precio):'—'}</div></div>
      <div class="detail-item"><div class="detail-lbl">Costo acumulado</div><div class="detail-val">${ars(costo)}</div></div>
      <div class="detail-item"><div class="detail-lbl">Margen</div><div class="detail-val ${margen!=null?(margen>=0?'margin-pos':'margin-neg'):'margin-zero'}">${margen!=null?(margen>=0?'+':'')+ars(margen):'sin precio'}</div></div>
      <div class="detail-item"><div class="detail-lbl">Sesiones</div><div class="detail-val">${sess.length}</div></div>
      <div class="detail-item"><div class="detail-lbl">Tiempo total</div><div class="detail-val">${tattooHrs(t.id).toFixed(2)} hrs</div></div>
      <div class="detail-item" style="grid-column:1/-1"><div class="detail-lbl">Estilo</div><div class="detail-val">${t.estilo||'— Sin definir'}</div></div>
    </div>
    ${pct!=null?`<div style="font-size:11px;color:var(--text-2);margin-bottom:4px">Costo vs precio: ${pct}%</div>
    <div class="be-bar"><div class="be-fill ${pct<=100?'over':'under'}" style="width:${Math.min(pct,100)}%"></div></div>`:'' }
    ${t.fotoUrl?`<div style="margin-top:10px"><a href="${t.fotoUrl}" target="_blank" style="font-size:12px;color:#378ADD">Ver referencia →</a></div>`:''}
    ${t.notas?`<div style="margin-top:10px;font-size:12px;color:#666;background:#f5f5f3;padding:8px 10px;border-radius:8px">${t.notas}</div>`:''}
  </div>

  <div class="card">
    <div class="sec-head">
      <div class="ct" style="margin:0">Sesiones vinculadas</div>
      <button class="btn btn-sm" onclick="go('ses')">+ Nueva sesión</button>
    </div>
    ${sess.length?`<table>
      <thead><tr><th>Fecha</th><th>Zona</th><th>Máquina</th><th>Aguja</th><th>Línea</th><th>Relleno</th><th>Tec.</th><th>Dis.</th><th>Con.</th><th>Global</th><th>Costo</th><th>Notas</th><th></th></tr></thead>
      <tbody>${sess.map(s=>{
        const ag=S.productos.find(p=>p.id===s.agujaId);
        return`<tr><td>${fdate(s.fecha)}</td><td>${s.zona||'—'}</td><td class="hint">${s.maquina||'—'}</td>
          <td class="hint">${ag?ag.nom:'—'}</td>
          <td>${scorePill(s.sL)}</td><td>${scorePill(s.sR)}</td><td>${scorePill(s.sT)}</td><td>${scorePill(s.sD)}</td><td>${scorePill(s.sC)}</td>
          <td>${scorePill(globalScore(s))}</td>
          <td>${ars(sesionCosto(s))}</td>
          <td style="font-size:11px;color:var(--text-2);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.notas||'—'}</td>
          <td><button class="btn btn-xs btn-ghost" onclick="editSesFromTattoo('${s.id}')">✏</button></td>
        </tr>`;
      }).join('')}</tbody>
      <tfoot><tr class="total-row"><td colspan="7">Total</td><td>${ars(costo)}</td><td></td></tr></tfoot>
    </table>`:`<div class="empty">Sin sesiones vinculadas aún.<br>Al crear una sesión, seleccioná este tatuaje en el campo correspondiente.</div>`}
  </div>`;
}


function buildStatsTattoos(){
  const allSes=S.sesiones.filter(s=>s.tattooId);
  if(!allSes.length)return'<div class="empty" style="padding:2.5rem">Sin sesiones vinculadas a tatuajes todavía.</div>';
  // Group by estilo
  const estiloMap={};
  allSes.forEach(s=>{
    const t=S.tatuajes.find(x=>x.id===s.tattooId);
    const est=(t&&t.estilo)||'Sin estilo';
    if(!estiloMap[est])estiloMap[est]={sesiones:[],tattoos:new Set()};
    estiloMap[est].sesiones.push(s);
    if(t)estiloMap[est].tattoos.add(t.id);
  });
  const rows=Object.entries(estiloMap).map(([est,data])=>{
    const n=data.sesiones.length;
    const avgG=(data.sesiones.reduce((a,s)=>a+globalScore(s),0)/n).toFixed(1);
    const dimAvg=k=>{const v=data.sesiones.map(s=>s[k]).filter(x=>x>0);return v.length?(v.reduce((a,x)=>a+x,0)/v.length).toFixed(1):'—';};
    const avgL=dimAvg('sL'),avgR=dimAvg('sR'),avgT=dimAvg('sT'),avgD=dimAvg('sD'),avgC=dimAvg('sC');
    const hrs=data.sesiones.reduce((a,s)=>a+(s.hrs||0),0).toFixed(2);
    return{est,n,avgL,avgR,avgT,avgD,avgC,avgG,hrs,tattoos:data.tattoos.size};
  }).sort((a,b)=>b.avgG-a.avgG);

  const scoreColor=v=>v>=7?'var(--green)':v>=4?'var(--amber)':'var(--red)';

  return`<div class="card">
    <div class="ct">Promedio de scores por estilo</div>
    <table>
      <thead><tr><th>Estilo</th><th>Tattoos</th><th>Ses.</th><th>Hrs</th><th>Línea</th><th>Relleno</th><th>Técnica</th><th>Diseño</th><th>Conform.</th><th>Global</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td><strong>${r.est}</strong></td>
        <td>${r.tattoos}</td><td>${r.n}</td><td>${r.hrs}</td>
        <td style="color:${scoreColor(r.avgL||0)};font-weight:500">${r.avgL}</td>
        <td style="color:${scoreColor(r.avgR||0)};font-weight:500">${r.avgR}</td>
        <td style="color:${scoreColor(r.avgT||0)};font-weight:500">${r.avgT}</td>
        <td style="color:${scoreColor(r.avgD||0)};font-weight:500">${r.avgD}</td>
        <td style="color:${scoreColor(r.avgC||0)};font-weight:500">${r.avgC}</td>
        <td><span class="sp ${r.avgG>=4?'sp-hi':r.avgG>=3?'sp-md':'sp-lo'}">${r.avgG}</span></td>
      </tr>`).join('')}</tbody>
    </table>
  </div>
  <div class="card">
    <div class="ct">Notas por sesión vinculada</div>
    <table>
      <thead><tr><th>Fecha</th><th>Tatuaje</th><th>Estilo</th><th>Línea</th><th>Rell.</th><th>Tec.</th><th>Dis.</th><th>Con.</th><th>Hrs</th><th>Notas</th></tr></thead>
      <tbody>${[...allSes].reverse().map(s=>{
        const t=S.tatuajes.find(x=>x.id===s.tattooId);
        return`<tr>
          <td>${fdate(s.fecha)}</td>
          <td style="font-size:11px">${t?t.diseno:'—'}</td>
          <td class="hint">${(t&&t.estilo)||'—'}</td>
          <td>${scorePill(s.sL)}</td><td>${scorePill(s.sR)}</td><td>${scorePill(s.sT)}</td><td>${scorePill(s.sD)}</td><td>${scorePill(s.sC)}</td>
          <td>${s.hrs||'—'}</td>
          <td style="font-size:11px;color:var(--text-2);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(s.notas||'').replace(/"/g,'&quot;')}">${s.notas||'—'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function addTattoo(){
  const diseno=document.getElementById('nt-dis').value.trim();
  const cli=document.getElementById('nt-cli').value.trim();
  if(!diseno||!cli){msg('nt-msg','Cliente y diseño requeridos','err');return;}
  const t={
    id:'T'+Date.now(),
    num:parseInt(document.getElementById('nt-num').value)||1,
    cliente:cli,diseno,
    estado:document.getElementById('nt-estado').value,
    zona:document.getElementById('nt-zona').value.trim(),
    tamano:document.getElementById('nt-tam').value.trim(),
    precio:parseFloat(document.getElementById('nt-precio').value)||0,
    estilo:document.getElementById('nt-est').value,
    fotoUrl:document.getElementById('nt-foto').value.trim(),
    notas:document.getElementById('nt-notas').value.trim()
  };
  if(!t.precio)t.precio=0;
  S.tatuajes.push(t);
  persist();
  selectedTattooId=t.id;tattooView='detalle';renderTattoos();
}

function editTattoo(tid){
  const t=S.tatuajes.find(x=>x.id===tid);if(!t)return;
  const el=document.getElementById('t-tattoos');
  el.innerHTML=`<div style="margin-bottom:1rem"><button class="btn btn-sm" onclick="tattooView='detalle';selectedTattooId='${tid}';renderTattoos()">← Cancelar</button></div>
  <div class="card">
    <div class="ct">Editar tatuaje</div>
    <div class="fgrid">
      <div class="fg"><label class="fl">N°</label><input id="et-num" type="number" value="${t.num}"></div>
      <div class="fg"><label class="fl">Estado</label><select id="et-estado"><option${t.estado==='En curso'?' selected':''}>En curso</option><option${t.estado==='Finalizado'?' selected':''}>Finalizado</option><option${t.estado==='Pendiente'?' selected':''}>Pendiente</option></select></div>
      <div class="fg" style="grid-column:1/-1"><label class="fl">Cliente</label><input id="et-cli" value="${t.cliente}"></div>
      <div class="fg" style="grid-column:1/-1"><label class="fl">Diseño</label><input id="et-dis" value="${t.diseno}"></div>
      <div class="fg"><label class="fl">Zona</label><input id="et-zona" value="${t.zona||''}"></div>
      <div class="fg"><label class="fl">Tamaño</label><input id="et-tam" value="${t.tamano||''}"></div>
      <div class="fg"><label class="fl">Estilo</label><select id="et-est">${ESTILOS.map(e=>`<option value="${e}"${(t.estilo||'')===e?' selected':''}>${e}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">Precio (ARS)</label><input id="et-precio" type="number" value="${t.precio||0}"></div>
      <div class="fg"><label class="fl">URL referencia</label><input id="et-foto" value="${t.fotoUrl||''}"></div>
      <div class="fg" style="grid-column:1/-1"><label class="fl">Notas</label><textarea id="et-notas" rows="2">${t.notas||''}</textarea></div>
    </div>
    <div style="margin-top:1rem;display:flex;gap:8px;align-items:center">
      <button class="btn btn-p" onclick="saveEditTattoo('${tid}')">Guardar</button>
      <span id="et-msg"></span>
    </div>
  </div>`;
}

function saveEditTattoo(tid){
  const t=S.tatuajes.find(x=>x.id===tid);if(!t)return;
  t.num=parseInt(document.getElementById('et-num').value)||t.num;
  t.estado=document.getElementById('et-estado').value;
  t.cliente=document.getElementById('et-cli').value.trim();
  t.diseno=document.getElementById('et-dis').value.trim();
  t.zona=document.getElementById('et-zona').value.trim();
  t.tamano=document.getElementById('et-tam').value.trim();
  t.estilo=document.getElementById('et-est').value;
  t.precio=parseFloat(document.getElementById('et-precio').value)||0;
  t.fotoUrl=document.getElementById('et-foto').value.trim();
  t.notas=document.getElementById('et-notas').value.trim();
  persist();tattooView='detalle';selectedTattooId=tid;renderTattoos();
}

function deleteTattoo(tid){
  if(!confirm('¿Eliminar este tatuaje? Las sesiones vinculadas quedan pero sin proyecto.'))return;
  S.tatuajes=S.tatuajes.filter(x=>x.id!==tid);
  S.sesiones.forEach(s=>{if(s.tattooId===tid)s.tattooId=null;});
  persist();tattooView='lista';selectedTattooId=null;renderTattoos();
}

