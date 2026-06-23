// ─── Dashboard ───────────────────────────────────────────────────────────────
function renderDash(){
  const alerts=S.productos.filter(p=>status(p)!=='ok');
  const n=S.sesiones.length;
  const avgGlobal=n?(S.sesiones.reduce((a,s)=>a+globalScore(s),0)/n).toFixed(1):'—';
  const avgDim=function(k){const vals=S.sesiones.map(s=>s[k]).filter(v=>v>0);return vals.length?(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(1):0;};
  const amortS=amortTotalSes();
  const amortM=amortTotalMes();
  const kitC=calcKitCostStatic();
  const costoMinSes=amortS+kitC;
  const tatActive=S.tatuajes.filter(t=>t.estado==='En curso').length;
  const tatFin=S.tatuajes.filter(t=>t.estado==='Finalizado');
  const gananciaTotal=tatFin.reduce(function(a,t){const m=tattooMargen(t);return m!=null?a+m:a;},0);
  const topCxu=S.productos.filter(p=>p.cat!=='Activo'&&cxu(p)>0).map(p=>({nom:p.nom,v:cxu(p)})).sort((a,b)=>b.v-a.v).slice(0,5);
  const sesBreakEven=amortM>0?Math.ceil(amortM/costoMinSes):0;
  const pct=Math.min(100,S.spm>0?Math.round((S.spm/Math.max(sesBreakEven,1))*100):0);
  const beOk=S.spm>=sesBreakEven;
  const ganPos=gananciaTotal>=0;
  const valFontSize=gananciaTotal>9999999?'28px':gananciaTotal>999999?'34px':'44px';
  const margen=S.spm-sesBreakEven;

  const dimRows=DIMS.map(function(d){
    const avg=avgDim(d.k);
    const p2=avg?Math.round((avg/10)*100):0;
    const col=avg>=7?'green':avg>=4?'amber':'red';
    return '<div class="dim-row"><div class="dim-top"><span class="dim-name">'+d.lbl+'</span><span class="dim-score">'+(avg||'&mdash;')+' / 10</span></div><div class="dim-track"><div class="dim-fill '+col+'" style="width:'+p2+'%"></div></div></div>';
  }).join('');

  const alertRows=alerts.length
    ?alerts.map(function(p){
      const st=status(p);
      return '<div class="dash-alert-row"><div><div class="dash-alert-name">'+p.nom+'</div><div class="dash-alert-detail">Stock: '+stockOf(p.id)+' &middot; M&iacute;n: '+p.sm+'</div></div><span class="dash-badge '+(st==='crit'?'red':'amber')+'">'+(st==='crit'?'Cr&iacute;tico':'Bajo')+'</span></div>';
    }).join('')
    :'<div class="empty" style="padding:1.5rem">Sin alertas activas</div>';

  const cxuRows=topCxu.length
    ?topCxu.map(function(x,i){
      return '<div class="cxu-row"><span class="cxu-rank">'+(i+1)+'</span><span class="cxu-name">'+x.nom+'</span><span class="cxu-val">'+ars(x.v)+'</span></div>';
    }).join('')
    :'<div class="empty">Cargá costos para ver el análisis.</div>';

  const beMsg=beOk
    ?'Con '+S.spm+' sesiones/mes cubr&iacute;s los activos con margen de '+margen+' sesi'+(margen===1?'&oacute;n':'ones')+'.'
    :'Con '+S.spm+' sesiones/mes no cubr&iacute;s la depreciaci&oacute;n. Necesit&aacute;s '+sesBreakEven+'.';

  document.getElementById('t-dash').innerHTML=
    '<div class="dash-page-hdr">'+
      '<div>'+
        '<div class="page-hdr-lbl">Sistema</div>'+
        '<div class="page-hdr-title">Dashboard</div>'+
        '<div class="page-hdr-sub">'+n+' sesiones &middot; '+S.tatuajes.length+' tatuajes registrados</div>'+
      '</div>'+
      '<img src="logo-v2.png" alt="F4H" class="dash-logo-center">'+
    '</div>'+

    '<div class="dash-hero-grid">'+
      '<div class="dash-hero-card">'+
        '<div class="dash-eyebrow">Sesiones totales</div>'+
        '<div class="dash-hero-val">'+n+'</div>'+
        '<div class="dash-hero-sub">Score global promedio</div>'+
        '<div class="dash-hero-badge ok">'+avgGlobal+' / 10</div>'+
      '</div>'+
      '<div class="dash-hero-card '+(ganPos?'pos':'neg')+'">'+
        '<div class="dash-eyebrow">Ganancia acumulada</div>'+
        '<div class="dash-hero-val '+(ganPos?'margin-pos':'margin-neg')+'" style="font-size:'+valFontSize+'">'+ars(gananciaTotal)+'</div>'+
        '<div class="dash-hero-sub">Tatuajes cerrados</div>'+
        '<div class="dash-hero-badge ok">'+tatFin.length+' finalizado'+(tatFin.length!==1?'s':'')+'</div>'+
      '</div>'+
    '</div>'+

    '<div class="dash-mini-grid">'+
      '<div class="dash-mini-card">'+
        '<div class="dash-mini-left">'+
          '<div class="dash-mini-lbl">Tatuajes activos</div>'+
          '<div class="dash-mini-val" style="color:var(--amber)">'+tatActive+'</div>'+
        '</div>'+
        '<div class="dash-mini-detail">En curso</div>'+
      '</div>'+
      '<div class="dash-mini-card">'+
        '<div class="dash-mini-left">'+
          '<div class="dash-mini-lbl">Amortizaci&oacute;n / sesi&oacute;n</div>'+
          '<div class="dash-mini-val">'+ars(amortS)+'</div>'+
        '</div>'+
        '<div class="dash-mini-detail">Costo m&iacute;n: '+ars(costoMinSes)+'</div>'+
      '</div>'+
    '</div>'+

    '<div class="be-card">'+
      '<div class="be-card-hdr">'+
        '<span class="be-card-title">Break-even mensual</span>'+
        '<span class="be-card-status '+(beOk?'ok':'warn')+'">'+(beOk?'&#10003; Cubierto':'&#9888; Sin cubrir')+'</span>'+
      '</div>'+
      '<div class="be-numbers">'+
        '<div class="be-num-item"><div class="be-label">Depreciaci&oacute;n mensual</div><div class="be-val">'+ars(amortM)+'</div></div>'+
        '<div class="be-num-item"><div class="be-label">Sesiones necesarias</div><div class="be-val">'+sesBreakEven+'</div></div>'+
        '<div class="be-num-item"><div class="be-label">Sesiones configuradas</div><div class="be-val">'+S.spm+'</div></div>'+
      '</div>'+
      '<div class="be-track"><div class="be-fill '+(beOk?'ok':'warn')+'" style="width:'+pct+'%"></div></div>'+
      '<div class="be-hint">'+beMsg+'</div>'+
    '</div>'+

    '<div class="dash-bottom-grid">'+
      '<div class="dash-mapa-card">'+
        '<div class="dash-card-hdr"><span class="dash-card-title">Mapa de desarrollo t&eacute;cnico</span></div>'+
        dimRows+
      '</div>'+
      '<div class="dash-right-col">'+
        '<div class="dash-info-card">'+
          '<div class="dash-card-hdr"><span class="dash-card-title">Alertas de stock'+(alerts.length?' ('+alerts.length+')':'')+'</span></div>'+
          alertRows+
        '</div>'+
        '<div class="dash-info-card">'+
          '<div class="dash-card-hdr"><span class="dash-card-title">Costo por uso &mdash; top insumos</span></div>'+
          cxuRows+
        '</div>'+
      '</div>'+
    '</div>';
}
