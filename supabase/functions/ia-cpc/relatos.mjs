// SIE-CPC: leitura de textos policiais EXCLUSIVAMENTE dentro da Edge Function.
// O retorno contém só contagens de MENÇÕES; NUNCA relata, cita ou exporta trechos.
// São heurísticas conservadoras, não classificação de autoria, culpa ou modo de ação.
// Não detectar envolvimento de policiais/autoridades em dados antigos (regra do projeto).

const CAMPOS = ["historico_resumido","detalhes","observacao","observacao_final"];
const LIMITE_CARACTERES = 16000;
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
    .toUpperCase().replace(/\s+/g," ");
}

/** Nunca retorna o conteúdo lido. Análise exploratória, com possível falso positivo. */
export function indicadoresLocaisDeRelato(registro) {
  const campos = CAMPOS.filter(c => textoValido(registro?.[c]));
  if (!campos.length) return {com_relato:false,campos_analisados:0,truncado:false,mencoes:[]};
  const combinado=campos.map(c=>registro[c]).join(" ").slice(0,LIMITE_CARACTERES);
  const brutoLength=campos.reduce((n,c)=>n+registro[c].length,0)+campos.length-1;
  const texto=normalizar(combinado);
  const mencoes=Object.entries(PADROES)
    .filter(([,reg])=>reg.test(texto)).map(([nome])=>nome);
  return {
    com_relato:true,
    campos_analisados:campos.length,
    truncado:brutoLength>LIMITE_CARACTERES,
    mencoes,
  };
}
export function criarContadoresRelatos() {
  return {registros_com_texto:0,registros_sem_texto:0,registros_truncados:0,mencoes:new Map()};
}
export function registrarContadoresRelatos(contadores,registro) {
  const r=indicadoresLocaisDeRelato(registro);
  if(!r.com_relato) { contadores.registros_sem_texto++; return; }
  contadores.registros_com_texto++;
  if(r.truncado)contadores.registros_truncados++;
  for(const nome of r.mencoes)contadores.mencoes.set(nome,(contadores.mencoes.get(nome)||0)+1);
}
/** Retorna somente células com contagem >= 5; nenhuma descrição pessoal. */
export function publicarContadoresRelatos(contadores) {
  const mencoes=[...contadores.mencoes.entries()]
    .filter(([,n])=>n>=5)
    .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
    .map(([categoria,quantidade])=>({categoria,quantidade}));
  return {
    registros_com_texto:contadores.registros_com_texto,
    registros_sem_texto:contadores.registros_sem_texto,
    registros_truncados:contadores.registros_truncados,
    mencoes,
    metodo:"Contagem local de menções textuais por dicionário limitado (uma vez por BO); não valida o fato narrado nem atribui autoria.",
    aviso:"A palavra pode ter aparecido em contexto negativo, policial, informativo ou de terceiro; resultado exploratório, sujeito a revisão humana."
  };
}
