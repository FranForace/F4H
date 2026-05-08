const today=new Date().toISOString().slice(0,10);
const SK='siget_f4h_v6';
let S={productos:[],movimientos:[],sesiones:[],tatuajes:[],kit:[],tc:1400,spm:8};
const ESTILOS=['American Traditional','Neo Traditional','New School','Blackwork','Realismo','Fine Line','Minimalista','Geométrico','Japonés (Irezumi)','Lettering','Acuarela','Chicano','Tribal','Dark / Horror','Ilustración','Otro'];
let curTab='dash',sesView='nueva',tattooView='lista',fCat='',fSt='',editingId=null,selectedTattooId=null;
let nExtras=[],nScores={L:0,R:0,T:0,D:0,C:0},nTestedIds=new Set(),editSesionId=null;
const DIMS=[{k:'L',lbl:'Calidad de línea'},{k:'R',lbl:'Solidez del relleno'},{k:'T',lbl:'Técnica'},{k:'D',lbl:'Diseño'},{k:'C',lbl:'Conformidad'}];

const TATUAJES_SEED=[
  {id:'TAT_FANTASMA_001',num:1,cliente:'Yo mismo (práctica)',diseno:'Fantasma — American Traditional',estilo:'American Traditional',zona:'Piel sintética',tamano:'~5cm',precio:0,estado:'Finalizado',fotoUrl:'',notas:'Práctica en piel sintética. Fantasma con halo y alas, estilo american traditional. Primera exploración sistemática de selección de aguja por tamaño de diseño. Conclusión: RL7 como estándar para diseños ≤5cm. RL3/RL5 para detalles finos. Evitar RL11+ y RS para contornos.'},
  {id:'TAT_BOTELLA_002',num:2,cliente:'Yo mismo (práctica)',diseno:'Botella con calavera y flores',estilo:'American Traditional',zona:'Piel sintética',tamano:'No registrado',precio:0,estado:'Finalizado',fotoUrl:'',notas:'Práctica en piel sintética. Botella con calavera y flores. Contorno con RL7, detalles internos con RL5. Aprendizaje principal: el cuello de botella NO es la elección de aguja sino la velocidad de ejecución. Trabajar en bajar velocidad, mejorar control de dirección de trazo y reducir el impacto de la fatiga.'}
];

const SESIONES_SEED=[
  {id:'SES_FANTASMA_20260421',fecha:'2026-04-21',cliente:'Yo mismo',zona:'Piel sintética',hrs:0.75,maquina:'Pen Garage',agujaId:'P27',agujasTested:['P28','P23','P26','P27'],voltaje:7.8,stroke:'fijo',kitOn:true,extras:[],sL:0,sR:0,sT:0,sD:0,sC:0,practica:true,tattooId:'TAT_FANTASMA_001',notas:'Fantasma ~5cm. RL11: demasiado grueso. RS7: sin nitidez. RL5: parcial. MEJOR: RL7 — balance definición/control. CONCLUSIÓN: diseños ≤5cm → RL7 principal. Detalles finos → RL3/RL5. Evitar RL11+ y RS para contornos.'},
  {id:'SES_BOTELLA_20260421',fecha:'2026-04-21',cliente:'Yo mismo',zona:'Piel sintética',hrs:1,maquina:'Pen Garage',agujaId:'P27',agujasTested:['P27','P26'],voltaje:7.8,stroke:'fijo',kitOn:true,extras:[],sL:0,sR:0,sT:0,sD:0,sC:0,practica:true,tattooId:'TAT_BOTELLA_002',notas:'Botella con calavera y flores. RL7 contorno principal, RL5 detalles finos. PROBLEMA: ejecución apresurada → errores y exceso de tinta. Dificultad dirección de aguja. Fatiga impacta calidad. CONCLUSIÓN: la mejora no pasa por agujas sino por bajar velocidad y mejorar control de trazo.'}
];


let editScoresBuf={};
