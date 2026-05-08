async function persist(){try{localStorage.setItem(SK,JSON.stringify(S));}catch(e){}}
function load(){
  try{const d=localStorage.getItem(SK);if(d){const p=JSON.parse(d);S.productos=p.productos||[];S.movimientos=p.movimientos||[];S.sesiones=p.sesiones||[];S.tatuajes=p.tatuajes||[];S.kit=p.kit||[];S.tc=p.tc||1200;S.spm=p.spm||8;}}catch(e){}
  if(!S.productos.length)seed();
  if(!S.kit.length)seedKit();
  if(!S.tatuajes)S.tatuajes=[];
  let injected=0;
  TATUAJES_SEED.forEach(t=>{if(!S.tatuajes.find(x=>x.id===t.id)){S.tatuajes.push(t);injected++;}});
  SESIONES_SEED.forEach(ses=>{
    if(!S.sesiones.find(s=>s.id===ses.id)){S.sesiones.push(ses);injected++;}
    else{const ex=S.sesiones.find(s=>s.id===ses.id);if(ex&&!ex.tattooId&&ses.tattooId){ex.tattooId=ses.tattooId;}}
  });
  if(injected>0){
    persist();
    const b=document.getElementById('inject-banner');
    b.textContent='✓ Tatuajes y sesiones cargados: Fantasma + Botella calavera (21/04)';
    b.style.display='flex';setTimeout(()=>b.style.display='none',5000);
  }
  document.getElementById('tc-display').textContent='USD = $'+S.tc.toLocaleString('es-AR');
}

function seed(){
  const p=(id,nom,cat,sub,um,mon,cu,upu,si,sm,vum,prac)=>({id,nom,cat,sub,um,mon,cu,upu,si,sm,vum:vum||0,practica:!!prac});
  S.productos=[
    p('P01','Pen Garage','Activo','Maquina','Unidad','ARS',25000,1,1,1,24),
    p('P02','Fuente Critical','Activo','Fuente','Unidad','ARS',205000,1,1,1,36),
    p('P03','Pedal','Activo','Otros','Unidad','ARS',0,1,1,1,60),
    p('P04','Ambition Soldier','Activo','Maquina','Unidad','USD',147.36,1,1,1,36),
    p('P05','iPad A16 + Apple Pen','Activo','Tecnologia','Unidad','USD',505,1,1,1,24),
    p('P06','Inkless Printer','Activo','Impresora','Unidad','ARS',150000,1,1,1,36),
    p('P07','Tornito Bate Pintura','Activo','Otros','Unidad','ARS',0,1,1,1,60),
    p('P08','Cups Medianos (100u)','Descartable','Cups','Caja','ARS',2000,100,2,1),
    p('P09','Papel Stencil','Descartable','Papel','Unidad','ARS',2000,1,13,4),
    p('P10','Grip p/ Pen','Descartable','Otros','Unidad','ARS',0,1,1,3),
    p('P11','Guantes Nitrilo Ref (100u)','Descartable','Guantes','Caja','ARS',7400,100,4,1),
    p('P12','Compresas Negras (50u)','Descartable','Compresas','Caja','ARS',7400,50,5,1),
    p('P13','Guantes Latex Negros (100u)','Descartable','Guantes','Caja','ARS',3400,100,1,1),
    p('P14','Papel de Cocina','Descartable','Papel cocina','Unidad','ARS',2600,200,1,1),
    p('P15','Film para Pen (100u)','Descartable','Film','Caja','ARS',2500,100,1,1),
    p('P16','Tinta Dynamic Triple Black','Consumible','Tinta','Onza','ARS',27000,30,1,1),
    p('P17','Piel Sintética Gruesa','Consumible','Piel sint.','Unidad','ARS',6000,1,3,6),
    p('P18','Stencil Stuff','Consumible','Stencil','Uso','ARS',0,40,1,1),
    p('P19','Vaselina Grande','Consumible','Vaselina','Uso','ARS',0,60,1,1),
    p('P20','Green Soap','Consumible','Green Soap','Uso','ARS',0,50,1,1),
    p('P21','Diluyente','Consumible','Diluyente','Uso','ARS',8000,50,1,1),
    p('P22','Levanta Lengua (100u)','Consumible','Otros','Caja','ARS',0,100,1,1),
    p('P23','RS 7','Aguja','RS','Unidad','ARS',1500,1,4,2,0,false),
    p('P24','Magnum 7','Aguja','MG','Unidad','ARS',1500,1,1,2,0,false),
    p('P25','RL 3','Aguja','RL','Unidad','ARS',1500,1,3,2,0,false),
    p('P26','RL 5','Aguja','RL','Unidad','ARS',1500,1,3,2,0,false),
    p('P27','RL 7','Aguja','RL','Unidad','ARS',1500,1,2,2,0,false),
    p('P28','RL 11','Aguja','RL','Unidad','ARS',1500,1,2,2,0,false),
  ];
}
function seedKit(){S.kit=[{pid:'P09',qty:1},{pid:'P18',qty:1},{pid:'P19',qty:1},{pid:'P20',qty:1},{pid:'P21',qty:1},{pid:'P22',qty:2}];}

