/* Tatuajes view */
function renderTattoos(){
  const el=document.getElementById('t-tattoos');
  const hdr=`
    <div class="page-hdr">
      <div>
        <div class="page-hdr-lbl">Proyectos</div>
        <div class="page-hdr-title">Tatuajes</div>
        <div class="page-hdr-sub">${S.tatuajes.length} proyectos &middot; ${S.tatuajes.filter(t=>t.estado==='En curso').length} en curso &middot; ${S.tatuajes.filter(t=>t.estado==='Finalizado').length} finalizados</div>
      </div>
    </div>
    <div class="subtab-row">
      <button class="subtab${tattooView!=='stats'&&tattooView!=='nuevo'?' on':''}" onclick="tattooView='lista';renderTattoos()">Lista (${S.tatuajes.length})</button>
      <button class="subtab${tattooView==='stats'?' on':''}" onclick="tattooView='stats';renderTattoos()">Estad&iacute;sticas</button>
    </div>`;

  if(tattooView==='nuevo'){
    el.innerHTML=hdr+buildNuevoTattoo();
    return;
  }
  if(tattooView==='stats'){
    el.innerHTML=hdr+buildStatsTattoos();
    return;
  }

  const projList=buildProjectList();
  const detail=selectedTattooId?buildDetalleTattoo(selectedTattooId):buildEmptyDetail();
  el.innerHTML=`${hdr}
    <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
      <button class="btn btn-p" onclick="tattooView='nuevo';renderTattoos()">+ Nuevo tatuaje</button>
    </div>
    <div class="split">
      <div class="proj-list">${projList}</div>
      <div class="detail-pnl">${detail}</div>
    </div>`;
}

function buildProjectList(){
  if(!S.tatuajes.length)return`<div class="empty" style="padding:2rem;text-align:center">Ning&uacute;n tatuaje registrado.<br><br><button class="btn btn-p" onclick="tattooView='nuevo';renderTattoos()">+ Crear primero</button></div>`;
  return S.tatuajes.map(t=>{
    const sess=tattooSesiones(t.id);
    const costo=tattooCosto(t.id);
    const margen=t.precio?(t.precio-costo):null;
    const isOn=selectedTattooId===t.id;
    return`<div class="proj-card${isOn?' on':''}" onclick="selectedTattooId='${t.id}';tattooView='lista';renderTattoos()">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div>
          <div class="proj-num">#${t.num} &middot; ${t.diseno.substring(0,12).toUpperCase()}</div>
          <div class="proj-name">${t.diseno}</div>
          <div style="font-size:12px;color:var(--text-2);margin-top:1px">${t.cliente}</div>
        </div>
        ${estadoBadge(t.estado)}
      </div>
      <div class="proj-meta">
        <span>${sess.length} ses.</span>
        ${t.zona?`<span>${t.zona}</span>`:''}
        ${t.estilo?`<span class="badge b-prac">${t.estilo}</span>`:''}
      </div>
      <div class="proj-meta" style="margin-top:4px">
        <span style="color:var(--text-3)">Costo: ${ars(costo)}</span>
        ${margen!=null?`<span class="${margen>=0?'margin-pos':'margin-neg'}">${margen>=0?'+':''}${ars(margen)}</span>`:''}
      </div>
    </div>`;
  }).join('');
}

function buildEmptyDetail(){
  return`<div class="card" style="padding:3rem;text-align:center;border-style:dashed">
    <div style="font-size:28px;opacity:.2;margin-bottom:10px">&#9998;</div>
    <div style="font-size:13px;color:var(--text-3)">Seleccion&aacute; un proyecto de la lista</div>
  </div>`;
}

function buildNuevoTattoo(){
  const nextNum=(S.tatuajes.length?Math.max(...S.tatuajes.map(t=>t.num||0))+1:1);
  return`<div class="card">
    <div class="ct">Nuevo tatuaje</div>
    <div class="fgrid">
      <div class="fg"><label class="fl">N&deg; de tatuaje</label><input id="nt-num" type="number" value="${nextNum}" min="1"></div>
      <div class="fg"><label class="fl">Estado</label><select id="nt-estado"><option>En curso</option><option>Finalizado</option><option>Pendiente</option></select></div>
      <div class="fg" style="grid-column:1/-1"><label class="fl">Cliente</label><input id="nt-cli" placeholder="Nombre o referencia"></div>
      <div class="fg" style="grid-column:1/-1"><label class="fl">Dise&ntilde;o / descripci&oacute;n</label><input id="nt-dis" placeholder="Ej: Fantasma americano tradicional, antebrazo"></div>
      <div class="fg"><label class="fl">Zona del cuerpo</label><input id="nt-zona" list="zonas-dl2" placeholder="Ej: Muslo, Brazo...">
        <datalist id="zonas-dl2"><option>Muslo</option><option>Antebrazo</option><option>Brazo</option><option>Pecho</option><option>Espalda</option><option>Costillas</option><option>Tobillo</option><option>Cuello</option><option>Mano</option></datalist>
      </div>
      <div class="fg"><label class="fl">Tama&ntilde;o estimado</label><input id="nt-tam" placeholder="Ej: 5cm, A4, peque&ntilde;o"></div>
      <div class="fg"><label class="fl">Estilo</label><select id="nt-est"><option value="">&#8212; Sin definir &#8212;</option>${ESTILOS.map(e=>`<option>${e}</option>`).join('')}</select></div>
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
  const t=S.tatuajes.find(x=>x.id===tid);if(!t)return buildEmptyDetail();
  const sess=tattooSesiones(tid);
  const costo=tattooCosto(tid);
  const margen=t.precio?(t.precio-costo):null;
  const pct=t.precio?Math.min(100,Math.round((costo/t.precio)*100)):null;
  const hrsTotal=tattooHrs(t.id).toFixed(1);

  const photoPanel=t.fotoUrl
    ?`<div class="tat-hdr-photo" style="padding:0;overflow:hidden;position:relative">
        <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);background:rgba(15,15,15,.75);padding:3px 8px;position:absolute;top:10px;right:10px;border-radius:4px;z-index:2">Ref</div>
        <img src="${t.fotoUrl}" alt="Referencia" style="width:100%;height:100%;object-fit:cover;margin:0">
      </div>`
    :`<div class="tat-hdr-photo">
        <div style="font-size:24px;opacity:.2">&#128444;</div>
        <div style="font-size:11px;color:var(--text-3);margin-top:4px">Sin foto</div>
        <button class="btn btn-xs" onclick="editTattoo('${tid}')" style="margin-top:6px">+ URL</button>
      </div>`;

  return`
    <div class="tat-hdr" style="position:relative">
      <div class="tat-hdr-content">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
          <div>
            <div style="font-size:11px;color:var(--text-3);font-weight:600;letter-spacing:.06em">#${t.num} &middot; ${t.cliente}</div>
            <div style="font-size:20px;font-weight:800;margin:3px 0">${t.diseno}</div>
            <div style="font-size:12px;color:var(--text-2)">${[t.zona,t.tamano,t.estilo].filter(Boolean).join(' &middot; ')}</div>
            <div style="margin-top:6px">${estadoBadge(t.estado)}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm" onclick="editTattoo('${tid}')">&#9998; Editar</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTattoo('${tid}')">Eliminar</button>
          </div>
        </div>
        <div class="tat-m-grid">
          <div><div class="tat-m-lbl">Precio</div><div class="tat-m-val" style="color:var(--accent)">${t.precio?ars(t.precio):'&#8212;'}</div></div>
          <div><div class="tat-m-lbl">Costo acum.</div><div class="tat-m-val">${ars(costo)}</div></div>
          <div><div class="tat-m-lbl">Margen</div><div class="tat-m-val ${margen!=null?(margen>=0?'margin-pos':'margin-neg'):'margin-zero'}">${margen!=null?(margen>=0?'+':'')+ars(margen):'&#8212;'}</div></div>
          <div><div class="tat-m-lbl">Horas</div><div class="tat-m-val">${hrsTotal}h</div></div>
        </div>
        ${pct!=null?`<div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Costo vs precio: ${pct}%</div>
        <div class="be-bar"><div class="be-fill ${pct<=100?'over':'under'}" style="width:${Math.min(pct,100)}%"></div></div>`:''}
        ${t.notas?`<div class="tat-notes">${t.notas}</div>`:''}
      </div>
      ${photoPanel}
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)">
        <span style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--text-3)">Sesiones vinculadas</span>
        <button class="btn btn-sm btn-p" onclick="go('ses')">+ Nueva sesi&oacute;n</button>
      </div>
      ${sess.length?`<table>
        <thead><tr><th>Fecha</th><th>Zona</th><th>Aguja</th><th>L&iacute;n.</th><th>Rell.</th><th>T&eacute;c.</th><th>Dis.</th><th>Con.</th><th>Global</th><th>Costo</th><th></th></tr></thead>
        <tbody>${sess.map(s=>{
          const ag=S.productos.find(p=>p.id===s.agujaId);
          return`<tr>
            <td>${fdate(s.fecha)}</td>
            <td>${s.zona||'&#8212;'}</td>
            <td class="hint">${ag?ag.nom:'&#8212;'}</td>
            <td>${scorePill(s.sL)}</td><td>${scorePill(s.sR)}</td><td>${scorePill(s.sT)}</td><td>${scorePill(s.sD)}</td><td>${scorePill(s.sC)}</td>
            <td>${scorePill(globalScore(s))}</td>
            <td style="color:var(--accent);font-weight:600">${ars(sesionCosto(s))}</td>
            <td><button class="btn btn-xs btn-ghost" onclick="editSesFromTattoo('${s.id}')">&#9998;</button></td>
          </tr>`;}).join('')}</tbody>
        <tfoot><tr class="total-row"><td colspan="9">Total acumulado</td><td colspan="2">${ars(costo)}</td></tr></tfoot>
      </table>`:`<div class="empty" style="padding:2rem">Sin sesiones vinculadas a&uacute;n.</div>`}
    </div>`;
}

function buildStatsTattoos(){
  const allSes=S.sesiones.filter(s=>s.tattooId);
  if(!allSes.length)return'<div class="empty" style="padding:2.5rem">Sin sesiones vinculadas a tatuajes todav&iacute;a.</div>';
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
    const dimAvg=k=>{const v=data.sesiones.map(s=>s[k]).filter(x=>x>0);return v.length?(v.reduce((a,x)=>a+x,0)/v.length).toFixed(1):'&#8212;';};
    const hrs=data.sesiones.reduce((a,s)=>a+(s.hrs||0),0).toFixed(2);
    return{est,n,avgL:dimAvg('sL'),avgR:dimAvg('sR'),avgT:dimAvg('sT'),avgD:dimAvg('sD'),avgC:dimAvg('sC'),avgG,hrs,tattoos:data.tattoos.size};
  }).sort((a,b)=>b.avgG-a.avgG);
  const sc=v=>v>=7?'var(--green)':v>=4?'var(--amber)':'var(--red)';

  return`<div class="card">
    <div class="ct">Promedio de scores por estilo</div>
    <table><thead><tr><th>Estilo</th><th>Tattoos</th><th>Ses.</th><th>Hrs</th><th>L&iacute;nea</th><th>Relleno</th><th>T&eacute;c.</th><th>Dis.</th><th>Con.</th><th>Global</th></tr></thead>
    <tbody>${rows.map(r=>`<tr>
      <td><strong>${r.est}</strong></td><td>${r.tattoos}</td><td>${r.n}</td><td>${r.hrs}</td>
      <td style="color:${sc(r.avgL||0)};font-weight:500">${r.avgL}</td>
      <td style="color:${sc(r.avgR||0)};font-weight:500">${r.avgR}</td>
      <td style="color:${sc(r.avgT||0)};font-weight:500">${r.avgT}</td>
      <td style="color:${sc(r.avgD||0)};font-weight:500">${r.avgD}</td>
      <td style="color:${sc(r.avgC||0)};font-weight:500">${r.avgC}</td>
      <td><span class="sp ${r.avgG>=7?'sp-hi':r.avgG>=4?'sp-md':'sp-lo'}">${r.avgG}</span></td>
    </tr>`).join('')}</tbody></table>
  </div>
  <div class="card">
    <div class="ct">Notas por sesi&oacute;n vinculada</div>
    <table><thead><tr><th>Fecha</th><th>Tatuaje</th><th>Estilo</th><th>L.</th><th>R.</th><th>T.</th><th>D.</th><th>C.</th><th>Hrs</th><th>Notas</th></tr></thead>
    <tbody>${[...allSes].reverse().map(s=>{
      const t=S.tatuajes.find(x=>x.id===s.tattooId);
      return`<tr>
        <td>${fdate(s.fecha)}</td>
        <td style="font-size:11px">${t?t.diseno:'&#8212;'}</td>
        <td class="hint">${(t&&t.estilo)||'&#8212;'}</td>
        <td>${scorePill(s.sL)}</td><td>${scorePill(s.sR)}</td><td>${scorePill(s.sT)}</td><td>${scorePill(s.sD)}</td><td>${scorePill(s.sC)}</td>
        <td>${s.hrs||'&#8212;'}</td>
        <td style="font-size:11px;color:var(--text-2);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.notas||'&#8212;'}</td>
      </tr>`;}).join('')}</tbody>
    </table>
  </div>`;
}

function addTattoo(){
  const diseno=document.getElementById('nt-dis').value.trim();
  const cli=document.getElementById('nt-cli').value.trim();
  if(!diseno||!cli){msg('nt-msg','Cliente y dise\xF1o requeridos','err');return;}
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
  S.tatuajes.push(t);persist();
  selectedTattooId=t.id;tattooView='lista';renderTattoos();
}

function editTattoo(tid){
  const t=S.tatuajes.find(x=>x.id===tid);if(!t)return;
  const el=document.getElementById('t-tattoos');
  el.innerHTML=`<div style="margin-bottom:1rem"><button class="btn btn-sm" onclick="tattooView='lista';selectedTattooId='${tid}';renderTattoos()">&larr; Cancelar</button></div>
  <div class="card">
    <div class="ct">Editar tatuaje</div>
    <div class="fgrid">
      <div class="fg"><label class="fl">N&deg;</label><input id="et-num" type="number" value="${t.num}"></div>
      <div class="fg"><label class="fl">Estado</label><select id="et-estado"><option${t.estado==='En curso'?' selected':''}>En curso</option><option${t.estado==='Finalizado'?' selected':''}>Finalizado</option><option${t.estado==='Pendiente'?' selected':''}>Pendiente</option></select></div>
      <div class="fg" style="grid-column:1/-1"><label class="fl">Cliente</label><input id="et-cli" value="${t.cliente}"></div>
      <div class="fg" style="grid-column:1/-1"><label class="fl">Dise&ntilde;o</label><input id="et-dis" value="${t.diseno}"></div>
      <div class="fg"><label class="fl">Zona</label><input id="et-zona" value="${t.zona||''}"></div>
      <div class="fg"><label class="fl">Tama&ntilde;o</label><input id="et-tam" value="${t.tamano||''}"></div>
      <div class="fg"><label class="fl">Estilo</label><select id="et-est">${ESTILOS.map(e=>`<option value="${e}"${(t.estilo||'')===e?' selected':''}>${e}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">Precio (ARS)</label><input id="et-precio" type="number" value="${t.precio||0}"></div>
      <div class="fg"><label class="fl">URL foto / referencia</label><input id="et-foto" value="${t.fotoUrl||''}"></div>
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
  persist();tattooView='lista';selectedTattooId=tid;renderTattoos();
}

function deleteTattoo(tid){
  if(!confirm('\xBFEliminar este tatuaje? Las sesiones vinculadas quedan pero sin proyecto.'))return;
  S.tatuajes=S.tatuajes.filter(x=>x.id!==tid);
  S.sesiones.forEach(s=>{if(s.tattooId===tid)s.tattooId=null;});
  persist();tattooView='lista';selectedTattooId=null;renderTattoos();
}
