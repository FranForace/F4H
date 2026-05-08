// ─── Core calculations ───────────────────────────────────────────────────────
function stockOf(pid){
  const pr=S.productos.find(p=>p.id===pid);if(!pr)return 0;
  const ins=S.movimientos.filter(m=>m.pid===pid&&m.tipo==='entrada').reduce((a,m)=>a+m.qty,0);
  const out=S.movimientos.filter(m=>m.pid===pid&&m.tipo==='salida').reduce((a,m)=>a+m.qty,0);
  return pr.si+ins-out;
}

function updateCostoPromedio(pid,qtyEntrada,costoEntrada){const p=S.productos.find(x=>x.id===pid);if(!p||!costoEntrada||costoEntrada<=0)return;const stk=stockOf(pid);p.cu=stk<=0?costoEntrada:Math.round(((stk*cuARS(p))+(qtyEntrada*costoEntrada))/(stk+qtyEntrada));p.lastCostoUpdate=today;}
function cuARS(p){return p.mon==='USD'?p.cu*S.tc:p.cu;}
function amortMensual(p){return p.vum>0?cuARS(p)/p.vum:0;}
function amortSesion(p){return S.spm>0?amortMensual(p)/S.spm:0;}
function cxu(p){return p.upu>0?cuARS(p)/p.upu:cuARS(p);}
function status(p){if(p.cat==='Activo')return'ok';const s=stockOf(p.id);if(s<=0)return'critical';if(s<p.sm)return'low';return'ok';}
function amortTotalSes(){return S.productos.filter(p=>p.cat==='Activo').reduce((a,p)=>a+amortSesion(p),0);}
function amortTotalMes(){return S.productos.filter(p=>p.cat==='Activo').reduce((a,p)=>a+amortMensual(p),0);}
function calcExtrasCost(){return nExtras.reduce((a,e)=>{const p=S.productos.find(x=>x.id===e.pid);return a+(p&&p.cu>0?cxu(p)*e.qty:0);},0);}
function sesionCosto(s){
  let c=amortTotalSes();
  if(s.kitOn)c+=calcKitCostStatic();
  (s.extras||[]).forEach(e=>{const p=S.productos.find(x=>x.id===e.pid);if(p&&p.cu>0)c+=cxu(p)*e.qty;});
  const ag=S.productos.find(x=>x.id===s.agujaId);
  if(ag&&ag.cu>0&&!ag.practica)c+=cxu(ag);
  return c;
}
function calcKitCostStatic(){return S.kit.reduce((a,ki)=>{const p=S.productos.find(x=>x.id===ki.pid);return a+(p&&p.cu>0?cxu(p)*ki.qty:0);},0);}
function tattooSesiones(tid){return S.sesiones.filter(s=>s.tattooId===tid);}
function tattooCosto(tid){return tattooSesiones(tid).reduce((a,s)=>a+sesionCosto(s),0);}
function globalScore(s){const vals=[s.sL,s.sR,s.sT,s.sD,s.sC].filter(v=>v>0);return vals.length?+(vals.reduce((a,v)=>a+v,0)/vals.length).toFixed(1):0;}
function tattooMargen(t){return t.precio?(t.precio-tattooCosto(t.id)):null;}
function tattooHrs(tid){return tattooSesiones(tid).reduce((a,s)=>a+(s.hrs||0),0);}

