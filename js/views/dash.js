// ─── Dashboard ───────────────────────────────────────────────────────────────
function renderDash(){
  const alerts=S.productos.filter(p=>status(p)!=='ok');
  const n=S.sesiones.length;
  const avgGlobal=n?(S.sesiones.reduce((a,s)=>a+globalScore(s),0)/n).toFixed(1):'—';
  const avgDim=k=>{const vals=S.sesiones.map(s=>s[k]).filter(v=>v>0);return vals.length?(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(1):0;};
  const amortS=amortTotalSes();
  const amortM=amortTotalMes();
  const kitC=calcKitCostStatic();
  const costoMinSes=amortS+kitC;
  const tatActive=S.tatuajes.filter(t=>t.estado==='En curso').length;
  const tatFin=S.tatuajes.filter(t=>t.estado==='Finalizado');
  const gananciaTotal=tatFin.reduce((a,t)=>{const m=tattooMargen(t);return m!=null?a+m:a;},0);
  const topCxu=S.productos.filter(p=>p.cat!=='Activo'&&cxu(p)>0).map(p=>({nom:p.nom,v:cxu(p)})).sort((a,b)=>b.v-a.v).slice(0,5);

  // Break-even: cuántas sesiones/mes para cubrir amortización
  const sesBreakEven=amortM>0?Math.ceil(amortM/costoMinSes):0;
  const pct=Math.min(100,S.spm>0?Math.round((S.spm/Math.max(sesBreakEven,1))*100):0);
  const beColor=S.spm>=sesBreakEven?'over':'under';

  document.getElementById('t-dash').innerHTML=`
    <div class="g4">
      <div class="metric"><div class="ml">Sesiones</div><div class="mv">${n}</div><div class="ms">score global: ${avgGlobal}</div></div>
      <div class="metric"><div class="ml">Tatuajes activos</div><div class="mv">${tatActive}</div><div class="ms">${tatFin.length} finalizados</div></div>
      <div class="metric"><div class="ml">Amort./sesión</div><div class="mv" style="font-size:15px">${ars(amortS)}</div><div class="ms">costo mín: ${ars(costoMinSes)}</div></div>
      <div class="metric"><div class="ml">Ganancia acum.</div><div class="mv ${gananciaTotal>=0?'margin-pos':'margin-neg'}" style="font-size:15px">${ars(gananciaTotal)}</div><div class="ms">tatuajes cerrados</div></div>
    </div>

    <div class="card">
      <div class="ct">Break-even mensual</div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span>Depreciación mensual: <strong>${ars(amortM)}</strong></span>
        <span>Costo mín/sesión: <strong>${ars(costoMinSes)}</strong></span>
      </div>
      <div style="font-size:13px;margin-bottom:6px">Necesitás <strong>${sesBreakEven} sesiones/mes</strong> solo para cubrir activos. Configuraste <strong>${S.spm}</strong>.</div>
      <div class="be-bar"><div class="be-fill ${beColor}" style="width:${pct}%"></div></div>
      <div class="hint">${S.spm>=sesBreakEven?'✓ Tu carga de sesiones cubre los activos.':'⚠ Con '+S.spm+' sesiones/mes no cubrís la depreciación.'}</div>
    </div>

    <div class="card">
      <div class="ct">Mapa de desarrollo técnico</div>
      ${DIMS.map(({k,lbl})=>{const avg=avgDim(k);const pct=avg?Math.round((avg/10)*100):0;const col=avg>=7?'pf-green':avg>=4?'pf-amber':'pf-red';return`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px"><span>${lbl}</span><span style="font-weight:500">${avg||'—'} / 10</span></div><div class="progress-bar"><div class="progress-fill ${col}" style="width:${pct}%"></div></div></div>`;}).join('')}
    </div>
    ${alerts.length?`<div class="card"><div class="ct">Alertas de stock</div><table><thead><tr><th>Producto</th><th>Stock</th><th>Mín.</th><th>Estado</th></tr></thead><tbody>${alerts.map(p=>`<tr class="al"><td>${p.nom}</td><td>${stockOf(p.id)}</td><td>${p.sm}</td><td>${badge(status(p))}</td></tr>`).join('')}</tbody></table></div>`:''}

    <div class="card"><div class="ct">Costo por uso — top insumos</div>
    ${topCxu.length?`<table><thead><tr><th>Producto</th><th>Costo/uso</th></tr></thead><tbody>${topCxu.map(x=>`<tr><td>${x.nom}</td><td>${ars(x.v)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">Cargá costos para ver el análisis.</div>'}
    </div>`;
}

