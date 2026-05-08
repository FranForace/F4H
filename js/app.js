// ─── Navigation ──────────────────────────────────────────────────────────────
function go(t){
  curTab=t;editingId=null;
  ['dash','tattoos','inv','act','ses','egresos','new','mov','cfg'].forEach(x=>{
    const b=document.querySelector(`.tab[onclick="go('${x}')"]`);
    if(b)b.classList.toggle('on',x===t);
    document.getElementById('t-'+x).style.display=x===t?'':'none';
  });
  if(t==='dash')renderDash();
  if(t==='tattoos')renderTattoos();
  if(t==='inv')renderInv();
  if(t==='act')renderActivos();
  if(t==='ses'){nExtras=[];nScores={L:0,R:0,T:0,D:0,C:0};nTestedIds=new Set();editSesionId=null;editScoresBuf={};renderSes();}
  if(t==='egresos')renderEgresos();
  if(t==='mov'){fillMovSel();renderMovTable();}
  if(t==='cfg'){document.getElementById('tc-val').value=S.tc;document.getElementById('spm-val').value=S.spm;renderKitCfg();}
}
function setSesView(v){sesView=v;editSesionId=null;editScoresBuf={};nExtras=[];nScores={L:0,R:0,T:0,D:0,C:0};nTestedIds=new Set();renderSes();}
function renderAll(){if(curTab==='dash')renderDash();else if(curTab==='tattoos')renderTattoos();else if(curTab==='inv')renderInv();else if(curTab==='act')renderActivos();else if(curTab==='ses')renderSes();else if(curTab==='egresos')renderEgresos();
  else if(curTab==='mov'){fillMovSel();renderMovTable();}else if(curTab==='cfg'){document.getElementById('tc-val').value=S.tc;document.getElementById('spm-val').value=S.spm;renderKitCfg();}}


toggleNewFields();
load();
renderAll();
