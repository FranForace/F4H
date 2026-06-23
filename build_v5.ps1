$ErrorActionPreference = 'Stop'
$v4 = "C:\Users\FFORACE\f4h-sistema\F4H_Sistema_Beta_v4.html"
$v5 = "C:\Users\FFORACE\f4h-sistema\F4H_Sistema_Beta_v5.html"

# Leer como raw UTF-8 y separar por LF (el archivo usa LF)
$rawContent = [System.IO.File]::ReadAllText($v4, [System.Text.Encoding]::UTF8)
$lines = $rawContent -split "`n"
Write-Host "Total lines: $($lines.Length)"

# ─── Extraer secciones viejas para reemplazo por string ───────────────────────
$oldCssStr  = ($lines[32..42])  -join "`n"   # CSS Header + Tabs (líneas 33-43)
$oldGoStr   = ($lines[428..444]) -join "`n"  # nav comment + go() (líneas 429-445)
$oldDashStr = ($lines[449..497]) -join "`n"  # dash comment + renderDash() (líneas 450-498)

Write-Host "CSS match starts: $($oldCssStr.Substring(0,25))"
Write-Host "go() match starts: $($oldGoStr.Substring(0,25))"
Write-Host "dash match starts: $($oldDashStr.Substring(0,25))"

# ─── Img tag del logo (índice 192 = línea 193) ───────────────────────────────
$imgLine = $lines[192]

# ─── Nuevo HTML del nav-header ───────────────────────────────────────────────
$newNavLines = @(
  '<div class="nav-header">',
  '  <button class="nav-home" onclick="go(''dash'')">&#x2302; Inicio</button>',
  '  <div class="nav-logo">',
  "    $($imgLine.Trim())",
  '    <span class="nav-logo-sub">Sistema Beta</span>',
  '  </div>',
  '  <div class="nav-menu-wrap">',
  '    <button class="nav-burger" id="nav-burger" onclick="toggleMenu()">&#9776;</button>',
  '    <div class="nav-dropdown" id="nav-dropdown">',
  '      <div class="nav-group">',
  '        <div class="nav-group-label">Principal</div>',
  '        <button class="nav-item" onclick="go(''tattoos'')">&#x1F58B; Tatuajes</button>',
  '        <button class="nav-item" onclick="go(''inv'')">&#x1F4E6; Inventario</button>',
  '        <button class="nav-item" onclick="go(''act'')">&#x1F527; Activos</button>',
  '      </div>',
  '      <div class="nav-group">',
  '        <div class="nav-group-label">Registro</div>',
  '        <button class="nav-item" onclick="go(''ses'')">&#x1F4CB; Sesiones</button>',
  '        <button class="nav-item" onclick="go(''egresos'')">&#x1F4B8; Egresos</button>',
  '        <button class="nav-item" onclick="go(''mov'')">&#x2195; Movimientos</button>',
  '        <button class="nav-item" onclick="go(''new'')">&#xFF0B; Nuevo producto</button>',
  '      </div>',
  '      <div class="nav-group">',
  '        <button class="nav-item" onclick="go(''cfg'')">&#x2699; Configuraci&#xF3;n</button>',
  '      </div>',
  '    </div>',
  '  </div>',
  '</div>'
)

# ─── Reconstruir líneas: reemplazar header (191-198) y eliminar tabs (202-212) ─
# Mantener: 0..190 (antes del header) + nuevo nav + 199..201 (blank+inject-banner+blank) + 213.. (después del tabs)
$newLines = $lines[0..190] + $newNavLines + $lines[199..201] + $lines[213..($lines.Length-1)]
$content = $newLines -join "`n"

# ─── Nuevo CSS: reemplaza bloque Header + Tabs ────────────────────────────────
$newCssStr = @'
/* ── Nav Header ── */
.nav-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;padding:10px 0;border-bottom:1px solid var(--border);position:relative;font-family:"Segoe UI",system-ui,-apple-system,sans-serif}
.nav-home{background:transparent;border:1px solid var(--border);color:var(--text-2);padding:6px 14px;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-family:inherit;transition:all .15s}
.nav-home:hover{border-color:var(--border-hover);color:var(--text)}
.nav-logo{display:flex;flex-direction:column;align-items:center;gap:2px}
.nav-logo img{height:28px;width:auto}
.nav-logo-sub{font-size:10px;color:var(--text-2);letter-spacing:.5px}
.nav-menu-wrap{position:relative}
.nav-burger{background:transparent;border:1px solid var(--border);color:var(--text-2);padding:6px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:16px;line-height:1;transition:all .15s;font-family:inherit}
.nav-burger:hover{border-color:var(--border-hover);color:var(--text)}
.nav-dropdown{display:none;position:absolute;right:0;top:calc(100% + 8px);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:6px;min-width:200px;z-index:100;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.nav-dropdown.open{display:block}
.nav-group{margin-bottom:4px}
.nav-group:last-child{margin-bottom:0}
.nav-group-label{font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;padding:6px 10px 2px}
.nav-item{display:block;width:100%;text-align:left;background:transparent;border:none;color:var(--text-2);padding:7px 10px;border-radius:var(--radius-sm);cursor:pointer;font-size:13px;font-family:inherit;transition:all .1s}
.nav-item:hover{background:var(--bg-elevated);color:var(--text)}
'@

# ─── Nuevo go() + toggleMenu + click-outside ────────────────────────────────
$newGoStr = @'
// ─── Navigation ──────────────────────────────────────────────────────────────
function go(t){
  curTab=t;editingId=null;
  const dd=document.getElementById('nav-dropdown');
  if(dd)dd.classList.remove('open');
  ['dash','tattoos','inv','act','ses','egresos','new','mov','cfg'].forEach(x=>{
    document.getElementById('t-'+x).style.display=x===t?'':'none';
  });
  if(t==='dash')renderDash();
  if(t==='tattoos')renderTattoos();
  if(t==='inv')renderInv();
  if(t==='act')renderActivos();
  if(t==='ses'){nExtras=[];nScores={L:0,R:0,T:0,D:0,C:0};nTestedIds=new Set();nKitExcludes=new Set();editSesionId=null;editScoresBuf={};renderSes();}
  if(t==='egresos')renderEgresos();
  if(t==='mov'){fillMovSel();renderMovTable();}
  if(t==='cfg'){document.getElementById('tc-val').value=S.tc;document.getElementById('spm-val').value=S.spm;renderKitCfg();updateCfgAmort();}
}
function toggleMenu(){document.getElementById('nav-dropdown').classList.toggle('open');}
document.addEventListener('click',function(e){var d=document.getElementById('nav-dropdown');var b=document.getElementById('nav-burger');if(d&&b&&!d.contains(e.target)&&!b.contains(e.target))d.classList.remove('open');});
'@

# ─── Nuevo renderDash() ───────────────────────────────────────────────────────
$newDashStr = @'
// ─── Dashboard ───────────────────────────────────────────────────────────────
function renderDash(){
  const n=S.sesiones.length;
  const avgGlobal=n?(S.sesiones.reduce((a,s)=>a+globalScore(s),0)/n).toFixed(1):'—';
  const avgDim=k=>{const vals=S.sesiones.map(s=>s[k]).filter(v=>v>0);return vals.length?(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(1):0;};
  const amortS=amortTotalSes();
  const amortM=amortTotalMes();
  const kitC=calcKitCostStatic();
  const costoMinSes=amortS+kitC;
  const tatFin=S.tatuajes.filter(t=>t.estado==='Finalizado');
  const gananciaTotal=tatFin.reduce((a,t)=>{const m=tattooMargen(t);return m!=null?a+m:a;},0);
  const sesBreakEven=amortM>0?Math.ceil(amortM/costoMinSes):0;
  const bePct=Math.min(100,S.spm>0?Math.round((S.spm/Math.max(sesBreakEven,1))*100):0);
  const alerts=S.productos.filter(p=>status(p)!=='ok');
  const salidas=S.movimientos.filter(m=>m.tipo==='salida'&&m.costoAlMomento>0);
  const byCat={};
  salidas.forEach(m=>{const p=S.productos.find(x=>x.id===m.pid);if(!p)return;if(!byCat[p.cat])byCat[p.cat]={total:0};byCat[p.cat].total+=Math.round(m.qty*(m.costoAlMomento||0));});
  const egresosTotal=Object.values(byCat).reduce((a,v)=>a+v.total,0);
  const ultimasSes=[...S.sesiones].sort((a,b)=>b.fecha>a.fecha?1:-1).slice(0,3);
  document.getElementById('t-dash').innerHTML=`
    <div style="text-align:center;padding:1.5rem 0 1rem;border-bottom:1px solid var(--border);margin-bottom:1.25rem">
      <div style="font-size:44px;font-weight:700;letter-spacing:-1.5px;color:var(--green);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;line-height:1">${ars(gananciaTotal)}</div>
      <div style="font-size:12px;color:var(--text-2);margin-top:6px">Ganancia acumulada · ${tatFin.length} tatuaje${tatFin.length!==1?'s':''} cerrado${tatFin.length!==1?'s':''}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:1.25rem">
      <div style="padding:.85rem 1rem;border-right:1px solid var(--border)">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-2);margin-bottom:4px">Egresos totales</div>
        <div style="font-size:22px;font-weight:700;letter-spacing:-.3px;color:var(--red);line-height:1">${ars(egresosTotal)}</div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px">insumos consumidos</div>
      </div>
      <div style="padding:.85rem 1rem;border-right:1px solid var(--border)">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-2);margin-bottom:4px">Amort. / sesi&#xF3;n</div>
        <div style="font-size:22px;font-weight:700;letter-spacing:-.3px;color:var(--accent);line-height:1">${ars(amortS)}</div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px">costo m&#xED;n: ${ars(costoMinSes)}</div>
      </div>
      <div style="padding:.85rem 1rem">
        <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-2);margin-bottom:4px">Score global</div>
        <div style="font-size:22px;font-weight:700;letter-spacing:-.3px;color:var(--text);line-height:1">${avgGlobal}</div>
        <div style="font-size:10px;color:var(--text-3);margin-top:3px">${n} sesi&#xF3;n${n!==1?'es':''} registrada${n!==1?'s':''}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.25rem">
      <div class="card" style="margin-bottom:0">
        <div class="ct">Desarrollo t&#xE9;cnico</div>
        ${DIMS.map(({k,lbl})=>{const avg=avgDim(k);const pct=avg?Math.round((avg/10)*100):0;const col=avg>=7?'var(--green)':avg>=4?'var(--amber)':'var(--red)';return`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="color:var(--text-2)">${lbl}</span><span style="font-weight:600;color:${col}">${avg||'—'}</span></div><div style="height:3px;background:var(--bg-elevated);border-radius:2px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${col};border-radius:2px;transition:width .5s"></div></div></div>`;}).join('')}
      </div>
      <div class="card" style="margin-bottom:0">
        <div class="ct">Break-even</div>
        <div style="font-size:12px;color:var(--text-2);margin-bottom:3px">Deprec. mensual: <span style="color:var(--text);font-weight:600">${ars(amortM)}</span></div>
        <div style="font-size:12px;color:var(--text-2);margin-bottom:3px">Sesiones config.: <span style="color:var(--text);font-weight:600">${S.spm}/mes</span></div>
        <div style="font-size:12px;color:var(--text-2);margin-bottom:8px">Umbral m&#xED;nimo: <span style="color:var(--text);font-weight:600">${sesBreakEven} ses./mes</span></div>
        <div style="height:3px;background:var(--bg-elevated);border-radius:2px;overflow:hidden;margin-bottom:6px"><div style="height:100%;width:${bePct}%;background:${S.spm>=sesBreakEven?'var(--green)':'var(--red)'};border-radius:2px;transition:width .5s"></div></div>
        <div style="font-size:11px;margin-bottom:12px;color:${S.spm>=sesBreakEven?'var(--green)':'var(--amber)'}">${S.spm>=sesBreakEven?'&#x2713; Cubr&#xED;s la depreciaci&#xF3;n.':'&#x26A0; Con '+S.spm+' ses./mes no cubr&#xED;s la deprec.'}</div>
        <div style="height:1px;background:var(--border);margin-bottom:10px"></div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-2);margin-bottom:6px">Alertas</div>
        ${alerts.length?alerts.map(p=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:12px"><span style="width:7px;height:7px;border-radius:50%;background:${status(p)==='critical'?'var(--red)':'var(--amber)'};flex-shrink:0;display:inline-block"></span><span style="color:var(--text)">${p.nom}</span><span class="badge ${status(p)==='critical'?'b-crit':'b-low'}" style="margin-left:auto">${status(p)==='critical'?'Cr&#xED;tico':'Bajo'}</span></div>`).join(''):'<div style="font-size:12px;color:var(--green)">&#x2713; Sin alertas de stock.</div>'}
      </div>
    </div>
    <div class="card">
      <div class="ct">&#xDA;ltimas sesiones</div>
      ${ultimasSes.length?ultimasSes.map(s=>{const tat=S.tatuajes.find(t=>t.id===s.tattooId);const gs=globalScore(s);const gsColor=gs>=7?'var(--green)':gs>=4?'var(--amber)':gs>0?'var(--red)':'var(--text-3)';return`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)"><div><div style="font-size:14px;font-weight:600;letter-spacing:-.3px;margin-bottom:3px">${tat?tat.diseno:(s.cliente||'Sin proyecto')}</div><div style="font-size:11px;color:var(--text-2)">${fdate(s.fecha)}${s.zona?' · '+s.zona:''}${s.aguja?' · '+s.aguja:''}</div></div><div style="font-size:22px;font-weight:700;color:${gsColor};letter-spacing:-.5px">${gs>0?gs.toFixed(1):'—'}</div></div>`;}).join(''):'<div class="empty">Sin sesiones registradas.</div>'}
    </div>`;
}
'@

# ─── Aplicar reemplazos ───────────────────────────────────────────────────────
$content = $content.Replace($oldCssStr, $newCssStr)
if($content -notmatch 'nav-header'){Write-Host "ERROR: CSS replacement failed"; exit 1}
Write-Host "CSS OK"

$content = $content.Replace($oldGoStr, $newGoStr)
if($content -notmatch 'toggleMenu'){Write-Host "ERROR: go() replacement failed"; exit 1}
Write-Host "go() OK"

$content = $content.Replace($oldDashStr, $newDashStr)
if($content -notmatch 'egresosTotal'){Write-Host "ERROR: renderDash() replacement failed"; exit 1}
Write-Host "renderDash() OK"

# Título y font-family global
$content = $content.Replace('<title>F4H Sistema Beta v3</title>', '<title>F4H Sistema Beta v5</title>')
$content = $content.Replace('body{font-family:system-ui,-apple-system,sans-serif;', 'body{font-family:"Segoe UI",system-ui,-apple-system,sans-serif;')

# ─── Escribir v5 ─────────────────────────────────────────────────────────────
[System.IO.File]::WriteAllText($v5, $content, [System.Text.Encoding]::UTF8)
$size = (Get-Item $v5).Length
Write-Host "SUCCESS: F4H_Sistema_Beta_v5.html generado ($size bytes)"
