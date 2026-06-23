// ─── Activos ─────────────────────────────────────────────────────────────────
function renderActivos(){
  const acts=S.productos.filter(p=>p.cat==='Activo');
  const totC=acts.reduce((a,p)=>a+cuARS(p),0);
  const totM=acts.reduce((a,p)=>a+amortMensual(p),0);
  const totS=acts.reduce((a,p)=>a+amortSesion(p),0);
  document.getElementById('t-act').innerHTML=`
    <div class="page-hdr">
      <div>
        <div class="page-hdr-lbl">Equipamiento</div>
        <div class="page-hdr-title">Activos</div>
        <div class="page-hdr-sub">${acts.length} activos &middot; depreciaci&oacute;n ${ars(totS)}/sesi&oacute;n</div>
      </div>
    </div>
    <div class="mini-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="mini-metric"><div class="mm-lbl">Valor total</div><div class="mm-val" style="font-size:16px">${ars(totC)}</div></div>
      <div class="mini-metric"><div class="mm-lbl">Deprec./mes</div><div class="mm-val" style="font-size:16px">${ars(totM)}</div></div>
      <div class="mini-metric"><div class="mm-lbl">Deprec./sesi&oacute;n</div><div class="mm-val" style="font-size:16px">${ars(totS)}</div></div>
    </div>
    <div class="card" style="padding:0;overflow:hidden"><table>
      <thead><tr><th>Activo</th><th>Sub.</th><th>Costo ARS</th><th>Mon.</th><th>Vida útil</th><th>Amort./mes</th><th>Amort./ses.</th><th>Editar</th></tr></thead>
      <tbody>${acts.map(p=>`<tr>
        <td>${p.nom}</td><td class="hint">${p.sub}</td>
        <td>${p.cu>0?ars(cuARS(p)):'—'}</td>
        <td class="hint">${p.mon==='USD'?p.cu+'u$s':''}</td>
        <td>${p.vum?p.vum+'m':'—'}</td>
        <td>${p.vum&&p.cu>0?ars(amortMensual(p)):'—'}</td>
        <td>${p.vum&&p.cu>0?ars(amortSesion(p)):'—'}</td>
        <td><input type="number" min="1" style="width:65px;padding:3px 6px;font-size:11px" value="${p.vum||''}" onchange="updateVum('${p.id}',this.value)"></td>
      </tr>`).join('')}</tbody>
      <tfoot><tr class="total-row"><td colspan="4">Total</td><td>—</td><td>${ars(totM)}</td><td>${ars(totS)}</td><td></td></tr></tfoot>
    </table></div>`;
}


function updateVum(pid,val){const p=S.productos.find(x=>x.id===pid);if(p){p.vum=parseInt(val)||0;persist();renderActivos();}}
