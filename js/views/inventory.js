// ARCHIVADO — Estructura modular antigua. El sistema activo es F4H_Sistema_Beta_v6.html. No modificar.
// ─── Inventario ──────────────────────────────────────────────────────────────
function renderInv(){
  let prods=S.productos;
  if(fCat)prods=prods.filter(p=>p.cat===fCat);
  if(fSt)prods=prods.filter(p=>status(p)===fSt);
  const editCard=editingId?buildEditCard(S.productos.find(x=>x.id===editingId)):'';

  const cats=['Activo','Descartable','Consumible','Aguja'];
  const sts=[{v:'ok',l:'OK'},{v:'low',l:'Bajo'},{v:'critical',l:'Cr&iacute;tico'}];

  document.getElementById('t-inv').innerHTML=`
    <div class="page-hdr">
      <div>
        <div class="page-hdr-lbl">Stock</div>
        <div class="page-hdr-title">Inventario</div>
        <div class="page-hdr-sub">${S.productos.length} productos &middot; ${S.productos.filter(p=>status(p)!=='ok').length} con alertas</div>
      </div>
    </div>

    <div class="pill-row">
      <button class="pill${!fCat?' on':''}" onclick="fCat='';renderInv()">Todos</button>
      ${cats.map(c=>`<button class="pill${fCat===c?' on':''}" onclick="fCat='${c}';renderInv()">${c}s</button>`).join('')}
      <div class="pill-sep"></div>
      <button class="pill${!fSt?' on':''}" onclick="fSt='';renderInv()">Todos</button>
      ${sts.map(s=>`<button class="pill${fSt===s.v?' on':''}" onclick="fSt='${s.v}';renderInv()">${s.l}</button>`).join('')}
      <span class="hint" style="margin-left:auto">${prods.length} producto${prods.length!==1?'s':''}</span>
    </div>

    ${editCard}

    <div class="card" style="padding:0;overflow:hidden"><table>
      <thead><tr><th>Producto</th><th>Stock</th><th>M&iacute;n.</th><th>Estado</th><th>Costo/uso</th><th>Usos/un.</th><th></th></tr></thead>
      <tbody>${prods.map(p=>{const st=status(p);const isEd=p.id===editingId;
        return`<tr${st!=='ok'?' class="al"':''}${isEd?' style="background:rgba(200,169,110,0.07)"':''}>
          <td><strong>${p.nom}</strong>${p.practica?' <span class="badge b-prac">pr&aacute;ctica</span>':''}<br><span class="hint">${p.cat} &middot; ${p.sub}</span></td>
          <td>${stockOf(p.id)} <span class="hint">${p.um}</span></td>
          <td>${p.sm}</td>
          <td>${badge(st)}</td>
          <td>${p.cu>0?ars(cxu(p)):'&mdash;'}</td>
          <td class="hint">${p.upu}</td>
          <td><button class="btn btn-xs" onclick="editingId='${p.id}';renderInv()">&sharp;</button></td>
        </tr>`;}).join('')}
      </tbody>
    </table></div>
    <p class="hint" style="padding:8px 4px">Stock &rarr; us&aacute; Movimientos para mantener historial.</p>`;
}

function buildEditCard(p){
  if(!p)return'';
  return`<div class="card-blue" style="margin-bottom:14px">
    <div class="ct" style="color:var(--accent)">&#9998; Editando: ${p.nom}</div>
    <div class="edit-hint"><strong>Usos por unidad</strong>: cu&aacute;ntas sesiones rinde el envase.</div>
    <div class="fgrid">
      <div class="fg" style="grid-column:1/-1"><label class="fl">Nombre</label><input id="ep-nom" value="${p.nom}"></div>
      <div class="fg"><label class="fl">Subcategor&iacute;a</label><input id="ep-sub" value="${p.sub}"></div>
      <div class="fg"><label class="fl">Moneda</label><select id="ep-mon"><option value="ARS"${p.mon==='ARS'?' selected':''}>ARS</option><option value="USD"${p.mon==='USD'?' selected':''}>USD</option></select></div>
      <div class="fg"><label class="fl">Costo unitario</label><input id="ep-cu" type="number" min="0" step="0.01" value="${p.cu}"></div>
      <div class="fg"><label class="fl">Usos por unidad &larr;</label><input id="ep-upu" type="number" min="1" value="${p.upu}" style="border-color:var(--accent)"></div>
      <div class="fg"><label class="fl">Stock m&iacute;nimo</label><input id="ep-sm" type="number" min="0" value="${p.sm}"></div>
      ${p.cat==='Activo'?`<div class="fg"><label class="fl">Vida &uacute;til (meses)</label><input id="ep-vum" type="number" min="1" value="${p.vum||24}"></div>`:''}
      ${p.cat==='Aguja'?`<div class="fg" style="grid-column:1/-1"><label class="fl" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ep-prac" style="width:auto"${p.practica?' checked':''}> Aguja de pr&aacute;ctica (no descuenta stock)</label></div>`:''}
    </div>
    <div style="margin-top:1rem;display:flex;gap:8px;align-items:center">
      <button class="btn btn-p" onclick="saveEdit('${p.id}')">Guardar</button>
      <button class="btn" onclick="editingId=null;renderInv()">Cancelar</button>
      <span id="ep-msg"></span>
    </div>
  </div>`;
}

function saveEdit(pid){
  const p=S.productos.find(x=>x.id===pid);if(!p)return;
  const nom=document.getElementById('ep-nom').value.trim();if(!nom){msg('ep-msg','Nombre requerido','err');return;}
  p.nom=nom;p.sub=document.getElementById('ep-sub').value.trim();
  p.mon=document.getElementById('ep-mon').value;
  p.cu=parseFloat(document.getElementById('ep-cu').value)||0;
  p.upu=parseInt(document.getElementById('ep-upu').value)||1;
  p.sm=parseInt(document.getElementById('ep-sm').value)||0;
  if(p.cat==='Activo'){const v=document.getElementById('ep-vum');if(v)p.vum=parseInt(v.value)||0;}
  if(p.cat==='Aguja'){const v=document.getElementById('ep-prac');if(v)p.practica=v.checked;}
  persist();editingId=null;renderInv();
}
