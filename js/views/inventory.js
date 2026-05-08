// ─── Inventario ──────────────────────────────────────────────────────────────
function renderInv(){
  let prods=S.productos;
  if(fCat)prods=prods.filter(p=>p.cat===fCat);
  if(fSt)prods=prods.filter(p=>status(p)===fSt);
  const editCard=editingId?buildEditCard(S.productos.find(x=>x.id===editingId)):'';
  document.getElementById('t-inv').innerHTML=`
    ${editCard}
    <div class="sec-head">
      <div style="display:flex;gap:6px">
        <select style="width:145px;font-size:12px" onchange="fCat=this.value;renderInv()">
          <option value="">Todas las categorías</option>
          ${['Activo','Descartable','Consumible','Aguja'].map(c=>`<option${fCat===c?' selected':''}>${c}</option>`).join('')}
        </select>
        <select style="width:115px;font-size:12px" onchange="fSt=this.value;renderInv()">
          <option value="">Todos</option><option value="ok">OK</option><option value="low">Bajo</option><option value="critical">Crítico</option>
        </select>
      </div>
      <span class="hint">${prods.length} productos</span>
    </div>
    <div class="card" style="padding:0;overflow:hidden"><table>
      <thead><tr><th>Producto</th><th>Stock</th><th>Mín.</th><th>Estado</th><th>Costo/uso</th><th>Usos/un.</th><th></th></tr></thead>
      <tbody>${prods.map(p=>{const st=status(p);const isEd=p.id===editingId;
        return`<tr${st!=='ok'?' class="al"':''}${isEd?' style="background:#E6F1FB"':''}>
          <td><strong>${p.nom}</strong>${p.practica?' <span class="badge b-prac">práctica</span>':''}<br><span class="hint">${p.cat} · ${p.sub}</span></td>
          <td>${stockOf(p.id)} <span class="hint">${p.um}</span></td><td>${p.sm}</td><td>${badge(st)}</td>
          <td>${p.cu>0?ars(cxu(p)):'—'}</td><td class="hint">${p.upu}</td>
          <td><button class="btn btn-xs" onclick="editingId='${p.id}';renderInv()">✏</button></td>
        </tr>`;}).join('')}
      </tbody>
    </table></div>
    <p class="hint" style="padding:4px">Stock → usá Movimientos para mantener historial.</p>`;
}

function buildEditCard(p){
  if(!p)return'';
  return`<div class="card-blue">
    <div class="ct" style="color:var(--accent)">✏ Editando: ${p.nom}</div>
    <div class="edit-hint"><strong>Usos por unidad</strong>: cuántas sesiones rinde el envase.</div>
    <div class="fgrid">
      <div class="fg" style="grid-column:1/-1"><label class="fl">Nombre</label><input id="ep-nom" value="${p.nom}"></div>
      <div class="fg"><label class="fl">Subcategoría</label><input id="ep-sub" value="${p.sub}"></div>
      <div class="fg"><label class="fl">Moneda</label><select id="ep-mon"><option value="ARS"${p.mon==='ARS'?' selected':''}>ARS</option><option value="USD"${p.mon==='USD'?' selected':''}>USD</option></select></div>
      <div class="fg"><label class="fl">Costo unitario</label><input id="ep-cu" type="number" min="0" step="0.01" value="${p.cu}"></div>
      <div class="fg"><label class="fl">Usos por unidad ←</label><input id="ep-upu" type="number" min="1" value="${p.upu}" style="border-color:#378ADD"></div>
      <div class="fg"><label class="fl">Stock mínimo</label><input id="ep-sm" type="number" min="0" value="${p.sm}"></div>
      ${p.cat==='Activo'?`<div class="fg"><label class="fl">Vida útil (meses)</label><input id="ep-vum" type="number" min="1" value="${p.vum||24}"></div>`:''}
      ${p.cat==='Aguja'?`<div class="fg" style="grid-column:1/-1"><label class="fl" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ep-prac" style="width:auto"${p.practica?' checked':''}> Aguja de práctica (no descuenta stock)</label></div>`:''}
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

