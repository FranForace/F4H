function badge(st){if(st==='critical')return`<span class="badge b-crit">Crítico</span>`;if(st==='low')return`<span class="badge b-low">Stock bajo</span>`;return`<span class="badge b-ok">OK</span>`;}
function ars(n){return'$'+Math.round(n).toLocaleString('es-AR');}
function fdate(iso){return iso?iso.slice(5).replace('-','/'):'—';}
function msg(id,txt,type){const el=document.getElementById(id);if(!el)return;el.textContent=txt;el.className=type;setTimeout(()=>{if(el)el.textContent='';},3000);}
function scorePill(v){if(!v)return'<span class="sp" style="background:#eee;color:#aaa">—</span>';const cl=v>=7?'sp-hi':v>=4?'sp-md':'sp-lo';return`<span class="sp ${cl}">${v}</span>`;}
function estadoBadge(e){if(e==='En curso')return`<span class="badge b-curso">En curso</span>`;if(e==='Finalizado')return`<span class="badge b-fin">Finalizado</span>`;return`<span class="badge b-pend">Pendiente</span>`;}

