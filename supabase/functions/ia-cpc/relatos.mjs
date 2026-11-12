// SIE-CPC — análise contextual DETERMINÍSTICA local em Edge Function.
// NUNCA retorna trechos, nomes, endereços, identificadores ou texto original.
// São marcadores exploratórios, não prova, autoria, validação jurídica ou IA semântica.
// Não há classificação retrospectiva de envolvimento policial/autoridades.

const CAMPOS = ["historico_resumido","detalhes","observacao","observacao_final"];
const LIMITE_CARACTERES = 16000;
const STATUS = Object.freeze({
  NEGADA:"negada_ou_ausente_no_texto",
  INCERTA:"hipotese_nao_confirmada",
  RELATADA:"atribuida_a_relato",
  CONSTATADA:"descrita_como_constatada",
  INDEFINIDA:"sem_contexto_claro",
  MISTA:"contextos_divergentes"
});
const PADROES = Object.freeze({
  mencao_arma_fogo: /\b(?:ARMA\s+DE\s+FOGO|ARMAS\s+DE\s+FOGO|REVOLVER(?:ES)?|PISTOLA(?:S)?|ESPINGARDA(?:S)?|FUZIL(?:IS)?)\b/u,
  mencao_arma_branca: /\b(?:ARMA\s+BRANCA|FACAO|FACA(?:S)?|CANIVETE(?:S)?)\b/u,
  mencao_motocicleta: /\b(?:MOTOCICLETA(?:S)?|MOTO(?:S)?|MOTOCICLO(?:S)?)\b/u,
  mencao_automovel: /\b(?:AUTOMOVEL(?:IS)?|CARRO(?:S)?|VEICULO(?:S)?|CAMINHONETE(?:S)?)\b/u,
  mencao_residencia: /\b(?:RESIDENCIA(?:L)?|CASA(?:S)?|DOMICILIO(?:S)?|IMOVEL(?:IS)?)\b/u,
  mencao_comercio: /\b(?:COMERCIO|COMERCIAL|LOJA(?:S)?|SUPERMERCADO(?:S)?|ESTABELECIMENTO(?:S)?)\b/u,
  mencao_via_publica: /\b(?:VIA\s+PUBLICA|LOGRADOURO|AVENIDA|RUA(?:S)?|CALCADA(?:S)?)\b/u,
  mencao_cameras: /\b(?:CAMERA(?:S)?|FILMAGEM(?:S)?|CFTV|VIDEOMONITORAMENTO)\b/u,
  mencao_ameaca: /\b(?:AMEACA(?:S|DO|DOR|RAM|VA)?|INTIMIDACAO)\b/u,
  mencao_danos_materiais: /\b(?:DANOS?\s+MATERIAIS|DANO(?:S)?\s+AO\s+PATRIMONIO)\b/u
});
function textoValido(v) { return typeof v === "string" && v.trim().length > 0; }
function normalizar(v) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toUpperCase().replace(/[ \t\r\f\v]+/g," ");
}
/** Analisa somente contexto lexical próximo, nunca texto integral como prompt. */
function qualificarMencao(frase, inicio, tamanho) {
  // Não deixar uma negação ou informação de outra oração afetar a menção atual.
  const antes=frase.slice(Math.max(0,inicio-135),inicio);
  const proximidade=antes.slice(-85);
  const depois=frase.slice(inicio+tamanho,inicio+tamanho+85);
  const vizinhanca=antes.slice(-115)+" "+depois.slice(0,45);

  // "Não foi possível confirmar a arma" indica INCERTEZA, não ausência.
  const naoConfirmado=/(?:NAO\s+(?:FOI|ERA)\s+(?:POSSIVEL\s+)?(?:CONFIRMAR|COMPROVAR|VERIFICAR)|SEM\s+CONFIRMACAO|SEM\s+COMPROVACAO|NAO\s+CONFIRMAD[AO]S?)\b/u;
  if(naoConfirmado.test(proximidade)||
     /^\s+(?:NAO\s+(?:FOI|ESTAVA)\s+CONFIRMAD[AO]|SEM\s+CONFIRMACAO)\b/u.test(depois))
    return STATUS.INCERTA;

  // O prefixo de negação deve terminar MUITO perto da palavra-chave.
  const negacaoAntes=/(?:\bSEM\b|\bAUSENCIA\s+DE\b|\bNENHUM[AOS]?\b|\bNAO\s+(?:FOI|FORAM|HOUVE|HAVIA|TINHA|PORTAVA|POSSUIA|LOCALIZOU|ENCONTROU|APREENDEU|CONSTATOU|UTILIZOU|IDENTIFICOU|SE\s+ENCONTROU|SE\s+VERIFICOU)\b|\bNEGOU\s+(?:PORTAR|POSSUIR|TER|USAR)\b)(?:\s+[A-Z0-9/-]+){0,4}\s*$/u;
  const negacaoDepois=/^\s+(?:NAO\s+(?:FOI|FORAM|ESTAVA|ESTAVAM|ERA|ERAM|HOUVE|EXISTIA|HAVIA)\b(?:\s+[A-Z0-9/-]+){0,4}|INEXISTENTE\b)/u;
  if(negacaoAntes.test(proximidade)||negacaoDepois.test(depois))
    return STATUS.NEGADA;

  // Hipótese expressa, sem validação nos dados estruturados.
  if(/(?:\bTERIA\b|\bTERIAM\b|\bPODERIA\b|\bPODERIAM\b|\bSUPOSTAMENTE\b|\bPOSSIVELMENTE\b|\bPROVAVELMENTE\b|\bSUSPEITA\s+DE\b|\bINDICIOS\s+DE\b)(?:\s+[A-Z0-9/-]+){0,6}\s*$/u.test(proximidade) ||
     /^\s+(?:POSSIVEL|PROVAVEL|SUSPEIT[AO]|NAO\s+VERIFICAD[AO])\b/u.test(depois))
    return STATUS.INCERTA;

  const relatada=/(?:\bSEGUNDO\b|\bCONFORME\s+(?:RELATO|DECLARACAO)\b|\bDE\s+ACORDO\s+COM\b|\bRELATOU\b|\bINFORMOU\b|\bAFIRMOU\b|\bALEGOU\b|\bDISSE\b|\bDECLAROU\b|\bNARROU\b)/u.test(vizinhanca);
  const constatada=/(?:\b(?:FOI|FORAM)\s+(?:LOCALIZAD[AO]S?|APREENDID[AO]S?|ENCONTRAD[AO]S?|CONSTATAD[AO]S?|RECUPERAD[AO]S?)\b|\b(?:EQUIPE|GUARNICAO)\s+(?:CONSTATOU|APREENDEU|VERIFICOU|LOCALIZOU|ENCONTROU)\b)/u.test(vizinhanca);
  if(relatada&&constatada) return STATUS.INDEFINIDA;
  if(relatada) return STATUS.RELATADA;
  if(constatada) return STATUS.CONSTATADA;
  return STATUS.INDEFINIDA;
}

function separarOracoes(texto) {
  // Cada trecho é limitado para desempenho e contenção da janela de contexto.
  return texto.split(/(?:[.!?;\n]+|\b(?:POREM|MAS|CONTUDO|ENTRETANTO|TODAVIA)\b)/u)
    .map(x=>x.trim()).filter(Boolean);
}

/** Somente IDs de categorias fixas e qualificações; sem trechos ou nomes. */
export function indicadoresLocaisDeRelato(registro) {
  const campos=CAMPOS.filter(c=>textoValido(registro?.[c]));
  if(!campos.length) return {com_relato:false,campos_analisados:0,truncado:false,mencoes:[],contextos:[]};
  const bruto=campos.map(c=>registro[c]).join("\n");
  const truncado=bruto.length>LIMITE_CARACTERES;
  const texto=normalizar(bruto.slice(0,LIMITE_CARACTERES));
  const encontradas=new Map();
  for(const oracao of separarOracoes(texto)){
    for(const [categoria,padrao] of Object.entries(PADROES)){
      const ocorrencias=oracao.matchAll(new RegExp(padrao.source,"gu"));
      for(const match of ocorrencias){
        const status=qualificarMencao(oracao,match.index,match[0].length);
        if(!encontradas.has(categoria))encontradas.set(categoria,new Set());
        encontradas.get(categoria).add(status);
      }
    }
  }
  const mencoes=[...encontradas.keys()];
  const contextos=[...encontradas.entries()].map(([categoria,estados])=>({
    categoria,
    status:estados.size===1?[...estados][0]:STATUS.MISTA
  }));
  return {com_relato:true,campos_analisados:campos.length,truncado,mencoes,contextos};
}
export function criarContadoresRelatos() {
  return {registros_com_texto:0,registros_sem_texto:0,registros_truncados:0,
    mencoes:new Map(),contextos:new Map()};
}
export function registrarContadoresRelatos(contadores,registro) {
  const item=indicadoresLocaisDeRelato(registro);
  if(!item.com_relato){contadores.registros_sem_texto++;return;}
  contadores.registros_com_texto++;
  if(item.truncado)contadores.registros_truncados++;
  for(const nome of item.mencoes) contadores.mencoes.set(nome,(contadores.mencoes.get(nome)||0)+1);
  for(const {categoria,status} of item.contextos){
    if(!contadores.contextos.has(categoria))contadores.contextos.set(categoria,new Map());
    const m=contadores.contextos.get(categoria);
    m.set(status,(m.get(status)||0)+1);
  }
}
/** Publica somente contagens agregadas de >=5 BOs, sem vazamento por diferença. */
export function publicarContadoresRelatos(contadores){
  const mencoes=[...contadores.mencoes.entries()]
    .filter(([,n])=>n>=5)
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .map(([categoria,quantidade])=>({categoria,quantidade}));

  // Para não reconstruir células escondidas usando o total conhecido de menções,
  // só divulgar status quando TODOS os estados presentes na categoria têm >=5.
  const contextos=[];
  for(const [categoria,m] of contadores.contextos.entries()){
    if(!m.size||[...m.values()].some(n=>n<5))continue;
    for(const [status,quantidade] of m.entries())
      contextos.push({categoria,status,quantidade});
  }
  contextos.sort((a,b)=>b.quantidade-a.quantidade||
    a.categoria.localeCompare(b.categoria)||a.status.localeCompare(b.status));
  return {
    registros_com_texto:contadores.registros_com_texto,
    registros_sem_texto:contadores.registros_sem_texto,
    registros_truncados:contadores.registros_truncados,
    mencoes,contextos,
    metodo:"Heurísticas lexicais locais por orações, com qualificação tentativa de negação, hipótese, fonte relatada e registro como constatação. Cada BO entra uma vez por marcador; sem extração de pessoas.",
    aviso:"Classificação contextual aproximada, inclusive 'constatada' indica apenas COMO FOI ESCRITO, sem prova de ocorrência. Negação pode referir-se a fatos distintos. Verificar amostras anonimizadas antes de qualquer conclusão."
  };
}
