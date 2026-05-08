function renderEgresos(){
  const el=document.getElementById('t-egresos');if(!el)return;
  const salidas=S.movimientos.filter(m=>m.tipo==='salida'&&m.costoAlMomento>0);
  const entradas=S.movimientos.filter(m=>m.tipo==='entrada'&&m.costoAlMomento>0);
  if(!salidas.length&&!entradas.length){
    el.innerHTML='<div class="empty" style="padding:2.5rem">Sin movimientos con costo registrado todavía.<br><span class="hint">Los egresos se generan al registrar sesiones o movimientos de salida.</span></div>';
    return;
  }
  const byCat={};
  salidas.forEach(m=>{
    const p=S.productos.find(x=>x.id===m.pid);if(!p)return;
    if(!byCat[p.cat])byCat[p.cat]={total:0,count:0};
    byCat[p.cat].total+=Math.round(m.qty*(m.costoAlMomento||0));
    byCat[p.cat].count++;
  });
  const totalEg=Object.values(byCat).reduce((a,v)=>a+v.total,0);
  const totalEnt=entradas.reduce((a,m)=>a+Math.round(m.qty*(m.costoAlMomento||0)),0);
  const bySes={};
  salidas.forEach(m=>{
    const key=(m.ref||'Sin ref').split(' ')[0];
    if(!bySes[key])bySes[key]={total:0,fecha:m.fecha,items:[]};
    const p=S.productos.find(x=>x.id===m.pid);
    bySes[key].total+=Math.round(m.qty*(m.costoAlMomento||0));
    if(p)bySes[key].items.push(p.nom);
  });
  const sortedCats=Object.entries(byCat).sort((a,b)=>b[1].total-a[1].total);
  el.innerHTML='<div class="g4">'+
    '<div class="metric"><div class="ml">Total egresos</div><div class="mv" style="color:var(--red);font-size:17px">'+ars(totalEg)+'</div><div class="ms">insumos consumidos</div></div>'+
    '<div class="metric"><div class="ml">Total entradas</div><div class="mv" style="color:var(--green);font-size:17px">'+ars(totalEnt)+'</div><div class="ms">inversión en stock</div></div>'+
    '<div class="metric"><div class="ml">Movimientos</div><div class="mv">'+salidas.length+'</div><div class="ms">salidas registradas</div></div>'+
    '<div class="metric"><div class="ml">Balance</div><div class="mv '+(totalEnt-totalEg>=0?'margin-pos':'margin-neg')+'" style="font-size:16px">'+ars(totalEnt-totalEg)+'</div><div class="ms">entradas − egresos</div></div>'+
    '</div>'+
    '<div class="card"><div class="ct">Egresos por categoría</div>'+
    sortedCats.map(function(entry){var cat=entry[0];var data=entry[1];var pct=totalEg>0?Math.round((data.total/totalEg)*100):0;return'<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="font-weight:500">'+cat+'</span><span>'+ars(data.total)+' <span class="hint">('+pct+'%)</span></span></div><div class="progress-bar"><div class="progress-fill pf-red" style="width:'+pct+'%"></div></div></div>';}).join('')+
    '</div>'+
    '<div class="card"><div class="ct">Egresos por sesión / evento</div><table><thead><tr><th>Referencia</th><th>Fecha</th><th>Ítems</th><th>Total</th></tr></thead><tbody>'+
    Object.entries(bySes).sort(function(a,b){return b[1].total-a[1].total;}).map(function(entry){var ref=entry[0];var data=entry[1];return'<tr><td style="font-size:11px">'+ref+'</td><td class="hint">'+fdate(data.fecha)+'</td><td class="hint" style="font-size:11px;max-width:150px">'+data.items.slice(0,4).join(', ')+(data.items.length>4?'...':'')+'</td><td style="color:var(--red);font-weight:500">'+ars(data.total)+'</td></tr>';}).join('')+
    '</tbody></table></div>'+
    '<div class="card"><div class="ct">Historial de salidas</div><table><thead><tr><th>Fecha</th><th>Producto</th><th>Cat.</th><th>Cant.</th><th>Costo unit.</th><th>Total</th><th>Referencia</th></tr></thead><tbody>'+
    salidas.slice().reverse().map(function(m){var p=S.productos.find(function(x){return x.id===m.pid;});var monto=Math.round(m.qty*(m.costoAlMomento||0));return'<tr><td>'+fdate(m.fecha)+'</td><td>'+(p?p.nom:m.pid)+'</td><td class="hint">'+(p?p.cat:'—')+'</td><td>'+m.qty+'</td><td class="hint">'+(m.costoAlMomento?ars(m.costoAlMomento):'—')+'</td><td style="color:var(--red)">'+(monto?ars(monto):'—')+'</td><td class="hint" style="font-size:11px;max-width:110px">'+(m.ref||'—')+'</td></tr>';}).join('')+
    '</tbody></table></div>';
}
