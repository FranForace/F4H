function onMovChange(){
  const tipo=document.getElementById('mv-tipo')?.value;
  const pid=document.getElementById('mv-prod')?.value;
  const p=S.productos.find(x=>x.id===pid);
  const cw=document.getElementById('mv-costo-wrap');
  const uw=document.getElementById('mv-unidad-wrap');
  const info=document.getElementById('mv-info');
  if(cw)cw.style.display=tipo==='entrada'?'':'none';
  if(uw)uw.style.display=(tipo==='salida'&&p&&p.upu>1)?'':'none';
  if(info&&p){const stk=stockOf(p.id);info.textContent='Stock actual: '+stk+' '+p.um+' · Costo vigente: $'+Math.round(cuARS(p)).toLocaleString('es-AR')+(p.upu>1?' · '+p.upu+' usos/unidad':'');}
  else if(info)info.textContent='';
}
function fillMovSel(){const sel=document.getElementById('mv-prod');const cur=sel.value;sel.innerHTML=S.productos.map(p=>`<option value="${p.id}"${p.id===cur?' selected':''}>[${p.cat}] ${p.nom}</option>`).join('');}
function renderMovTable(){
  const rows=[...S.movimientos].reverse().slice(0,60);
  document.getElementById('mv-body').innerHTML=rows.length?rows.map(m=>{const p=S.productos.find(x=>x.id===m.pid);return`<tr><td>${fdate(m.fecha)}</td><td>${p?p.nom:m.pid}</td><td>${m.tipo==='entrada'?'<span class="tag-in">+ entrada</span>':'<span class="tag-out">− salida</span>'}</td><td>${m.qty}</td><td class="hint">${m.costoAlMomento?'$'+Math.round(m.costoAlMomento).toLocaleString('es-AR'):'—'}</td><td class="hint">${m.ref||'—'}</td><td>${stockOf(m.pid)}</td></tr>`;}).join(''):'<tr><td colspan="7" class="empty">Sin movimientos</td></tr>';
}
function addMov(){
  const pid=document.getElementById('mv-prod').value;
  const tipo=document.getElementById('mv-tipo').value;
  const qty=parseInt(document.getElementById('mv-qty').value)||1;
  const ref=document.getElementById('mv-ref').value.trim();
  const costoInput=parseFloat(document.getElementById('mv-costo')?.value)||0;
  const unidad=document.getElementById('mv-unidad')?.value||'unidad';
  if(!pid){msg('mv-msg','Seleccioná un producto','err');return;}
  const p=S.productos.find(x=>x.id===pid);
  let qtyFinal=qty;
  let refExtra='';
  if(tipo==='salida'&&unidad==='uso'&&p&&p.upu>1){qtyFinal=Math.round((qty/p.upu)*1000)/1000;refExtra=' ['+qty+' usos]';}
  if(tipo==='salida'&&stockOf(pid)<qtyFinal){msg('mv-msg','Stock insuficiente ('+stockOf(pid)+')','err');return;}
  if(tipo==='entrada'&&costoInput>0)updateCostoPromedio(pid,qty,costoInput);
  const costoMom=p?Math.round(cuARS(p)):0;
  S.movimientos.push({id:'M'+Date.now(),fecha:today,pid,tipo,qty:qtyFinal,ref:ref+refExtra,costoAlMomento:costoMom});
  persist();msg('mv-msg','Registrado','ok');
  document.getElementById('mv-ref').value='';document.getElementById('mv-qty').value='1';
  const mc=document.getElementById('mv-costo');if(mc)mc.value='';
  onMovChange();renderMovTable();
}
