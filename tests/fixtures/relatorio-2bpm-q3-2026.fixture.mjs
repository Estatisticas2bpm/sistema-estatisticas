const principais=[
  'MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA','FURTO','ROUBO','AMEAÇA','LESÃO CORPORAL',
  'TRÁFICO DE DROGAS','PERTURBAÇÃO DO SOSSEGO','DESCUMPRIMENTO DE MEDIDA CAUTELAR',
  'DANO','VIAS DE FATO','ACIDENTE DE TRÂNSITO','POSSE DE ENTORPECENTE','MANDADO DE PRISÃO',
  'APOIO AO SAMU','RECUPERAÇÃO DE VEÍCULO','AVERIGUAÇÃO','DESACATO','PORTE ILEGAL DE ARMA',
  'MAUS-TRATOS','CONFLITO DIVERSO / MEDIAÇÃO'
];

const complementares=Array.from({length:42},(_,i)=>
  `CLASSIFICAÇÃO COMPLEMENTAR ${String(i+1).padStart(2,'0')} COM DESCRIÇÃO OPERACIONAL`
);

export const naturezas=[...principais,...complementares];
export const bairros=Array.from({length:24},(_,i)=>`BAIRRO INSTITUCIONAL ${String(i+1).padStart(2,'0')}`);
export const ruas=Array.from({length:20},(_,i)=>`AVENIDA OPERACIONAL DE REFERÊNCIA ${String(i+1).padStart(2,'0')}`);
export const comandantes=Array.from({length:98},(_,i)=>`${i%3===0?'SGT':i%3===1?'CB':'SD'} PM COMANDANTE ${String(i+1).padStart(3,'0')}`);

const topCounts=[100,70,55,45,40,35,30,28,26,24,22,20,18,16,14,12,11,10,9,14];
const otherCounts=[...Array(28).fill(3),...Array(14).fill(2)];
export const frequencias=[...topCounts,...otherCounts];

function isoDate(index,year=2026){
  const start=Date.UTC(year,6,1);
  return new Date(start+(index%92)*86400000).toISOString().slice(0,10);
}

function registro(indice,natureza,year=2026){
  const temArma=indice%29===0,temMunicao=indice%23===0,temDroga=indice%17===0,temBranca=indice%31===0;
  const nacionalidade=indice%11===0?'VE':indice%19===0?'GY':'BR';
  return{
    id:`fixture-${year}-${String(indice+1).padStart(4,'0')}`,
    data_ocorrencia:isoDate(indice,year),
    tipo_registro:indice%13===0?'ROP':indice%17===0?'TÁTICO SETORIAL':'BO',
    ocorrencia:natureza,
    crime:natureza,
    naturezas_itens:[{nome:natureza}],
    bairro:bairros[indice%bairros.length],
    endereco:ruas[indice%ruas.length],
    turno:['MADRUGADA','MANHÃ','TARDE','NOITE'][indice%4],
    comandante:comandantes[indice%comandantes.length],
    sisc:['SISC 4','SISC 5','SISC 6'][indice%3],
    companhia:['1ª CIA','2ª CIA','3ª CIA'][indice%3],
    infrator_idade:18+(indice%53),
    infrator_nacionalidade:nacionalidade,
    infrator_sexo:indice%2?'F':'M',
    vitima_nacionalidade:indice%7===0?'VE':'BR',
    vitima_sexo:indice%3?'F':'M',
    conducoes_operacionais:indice%5===0?1:0,
    orientacoes:indice%9===0?1:0,
    numero_prisoes:indice%14===0?1:0,
    foragidos:indice%37===0?1:0,
    veiculos_recuperados:indice%41===0?1:0,
    veiculos_restricao:indice%43===0?1:0,
    tatico_setorial:indice%21===0,
    quantidade_autos_infracao:indice%47===0?1:0,
    auto_infracao:indice%89===0?'AUTO DE REMOÇÃO':'',
    auto_resistencia:indice%97===0?'SIM':'NÃO',
    quantidade_armas:temArma?1:0,
    armas_itens:temArma?[{categoria:indice%58===0?'SIMULACRO':'ARMA DE FOGO',tipo:indice%2?'REVÓLVER':'PISTOLA',calibre:indice%2?'.38':'9 MM',quantidade:1}]:[],
    quantidade_municoes:temMunicao?8+(indice%7):0,
    municoes_itens:temMunicao?[{calibre:indice%2?'.38':'9 MM',quantidade:8+(indice%7)}]:[],
    quantidade_arma_branca:temBranca?1:0,
    arma_branca:temBranca?[ 'FACA DE CABO PRETO','FACÃO','CANIVETE','CUTELO' ][indice%4]:'',
    entorpecentes_itens:temDroga?[{tipo:indice%34===0?'SKANK':indice%3===0?'COCAÍNA':'MACONHA',forma_apresentacao:indice%2?'INVÓLUCRO':'PORÇÃO',quantidade:1+(indice%5)}]:[]
  };
}

function montarRegistros(year=2026){
  const rows=[];
  let indice=0;
  frequencias.forEach((quantidade,naturezaIndex)=>{
    for(let n=0;n<quantidade;n+=1){rows.push(registro(indice,naturezas[naturezaIndex],year));indice+=1}
  });
  return rows;
}

export const ocorrencias=montarRegistros(2026);
export const ocorrenciasComparadas=montarRegistros(2025).slice(0,487);
export const tcos=Array.from({length:17},(_,i)=>({id:`tco-2026-${i+1}`,data_ocorrencia:isoDate(i),sisc:'SISC 4',companhia:'1ª CIA'}));
export const tcosComparados=Array.from({length:13},(_,i)=>({id:`tco-2025-${i+1}`,data_ocorrencia:isoDate(i,2025),sisc:'SISC 4',companhia:'1ª CIA'}));

export const esperado={
  ocorrencias:711,
  naturezas:62,
  bairros:24,
  ruas:20,
  comandantes:98,
  top20:599,
  outras:112
};

const soma=lista=>lista.reduce((total,valor)=>total+valor,0);
if(ocorrencias.length!==esperado.ocorrencias||naturezas.length!==esperado.naturezas||soma(topCounts)!==esperado.top20||soma(otherCounts)!==esperado.outras){
  throw new Error('Fixture visual do relatório foi montado com contagens incorretas.');
}
