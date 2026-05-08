// ─── Misc ─────────────────────────────────────────────────────────────────────
function renderKitCfg(){
  const el=document.getElementById('kit-cfg-body');if(!el)return;
  const allProds=S.productos.filter(p=>p.cat!=='Activo');
  const opts=allProds.map(p=>`<option value="${p.id}">[${p.cat}] ${p.nom}</option>`).join('');
  el.innerHTML=S.kit.map((ki,i)=>`<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
    <select style="flex:1;font-size:12px" onchange="S.kit[${i}].pid=this.value;persist()">${opts.replace(`value="${ki.pid}"`,`value="${ki.pid}" selected`)}</select>
    <input type="number" min="0" value="${ki.qty}" style="width:55px" onchange="S.kit[${i}].qty=parseInt(this.value)||0;persist()">
    <button class="btn btn-xs" onclick="S.kit.splice(${i},1);persist();renderKitCfg()">✕</button>
  </div>`).join('')+`<button class="btn btn-sm" style="margin-top:4px" onclick="S.kit.push({pid:'${allProds[0]?.id||''}',qty:1});persist();renderKitCfg()">+ Agregar</button>`;
}

function toggleNewFields(){
  const cat=document.getElementById('np-cat')?.value;
  const f=document.getElementById('vum-field');if(f)f.style.display=cat==='Activo'?'':'none';
  const pf=document.getElementById('prac-field');if(pf)pf.style.display=cat==='Aguja'?'':'none';
}


function addProd(){
  const nom=document.getElementById('np-nom').value.trim();if(!nom){msg('np-msg','Nombre requerido','err');return;}
  const cat=document.getElementById('np-cat').value;
  const prac=cat==='Aguja'&&!!document.getElementById('np-prac')?.checked;
  S.productos.push({id:'P'+Date.now(),nom,cat,sub:document.getElementById('np-sub').value.trim(),um:document.getElementById('np-um').value,mon:document.getElementById('np-mon').value,cu:parseFloat(document.getElementById('np-cu').value)||0,upu:parseInt(document.getElementById('np-upu').value)||1,si:parseInt(document.getElementById('np-si').value)||0,sm:parseInt(document.getElementById('np-sm').value)||0,vum:cat==='Activo'?(parseInt(document.getElementById('np-vum').value)||24):0,practica:prac});
  persist();msg('np-msg','Guardado','ok');clearNewForm();
}
function clearNewForm(){['np-nom','np-sub'].forEach(id=>document.getElementById(id).value='');document.getElementById('np-cu').value='0';document.getElementById('np-upu').value='1';document.getElementById('np-si').value='1';document.getElementById('np-sm').value='1';document.getElementById('np-vum').value='24';}
function saveTc(){const v=parseFloat(document.getElementById('tc-val').value);if(v>0){S.tc=v;persist();document.getElementById('tc-display').textContent='USD = $'+v.toLocaleString('es-AR');msg('tc-msg','Actualizado','ok');}}
function saveSpm(){const v=parseInt(document.getElementById('spm-val').value);if(v>0){S.spm=v;persist();msg('spm-msg','Actualizado','ok');}}

function exportJSON(){const b=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='siget-'+today+'.json';a.click();}
function importJSON(){document.getElementById('import-file').click();}
function handleImport(input){const file=input.files[0];if(!file)return;const r=new FileReader();r.onload=e=>{try{S=JSON.parse(e.target.result);persist();renderAll();alert('Importado correctamente.');}catch(err){alert('Error al leer el JSON.');}};r.readAsText(file);}
function resetAll(){S={productos:[],movimientos:[],sesiones:[],tatuajes:[],kit:[],tc:1400,spm:8};seed();seedKit();persist();renderAll();go('dash');}

