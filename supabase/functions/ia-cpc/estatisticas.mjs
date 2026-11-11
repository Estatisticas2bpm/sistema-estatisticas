// Regras puras e testáveis do assistente estatístico CPC.
// Não exportar dados de pessoas, relatos ou documentos para o provedor.
export function categoria(v) {
  const texto = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!texto || texto.length > 65 || !/^[\p{L}\p{N} .,()\-\/]+$/u.test(texto)) return "NÃO CLASSIFICADO";
  return texto.toUpperCase();
}
export function ranking(m, maximo = 10) {
  return [...m.entries()].filter(([, quantidade]) => quantidade >= 5)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, maximo)
    .map(([nome, quantidade]) => ({ nome, quantidade }));
}
export function somar(m, k, quantidade = 1) {
  m.set(k, (m.get(k) || 0) + quantidade);
}
export function conducoesOperacionaisPorOcorrencia(conduzidos, prisoes) {
  const nConduzidos = Number(conduzidos) || 0;
  const nPrisoes = Number(prisoes) || 0;
  return Math.max(0, nConduzidos, nPrisoes);
}

export function intervaloAnterior(inicio, fim) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fim)) return null;
  const t1=Date.parse(inicio+"T00:00:00Z"), t2=Date.parse(fim+"T00:00:00Z");
  if (!Number.isFinite(t1)||!Number.isFinite(t2)||t2<t1)return null;
  const duracao=t2-t1+86400000;
  const iso=t=>new Date(t).toISOString().slice(0,10);
  return {inicio:iso(t1-duracao), fim:iso(t1-86400000)};
}
export function compararTotal(atual, anterior) {
  const a=Number(atual)||0,b=Number(anterior)||0;
  const diferenca=a-b;
  return {atual:a,anterior:b,diferenca,
    variacao_percentual:b>0?Math.round((diferenca/b)*10000)/100:null,
    base_comparavel:b>=5&&a>=5};
}
export function mudancasSignificativas(mapaAtual, mapaAnterior, maximo=10) {
  const saida=[];
  for(const [nome,atual] of mapaAtual.entries()) {
    const anterior=mapaAnterior.get(nome)||0;
    // Nenhuma célula pequena (inclusive na comparação) sai para o provedor.
    if(atual<5||anterior<5)continue;
    const m=compararTotal(atual,anterior);
    if(Math.abs(m.diferenca)<5||Math.abs(m.variacao_percentual)<25)continue;
    saida.push({nome,...m});
  }
  return saida.sort((a,b)=>Math.abs(b.diferenca)-Math.abs(a.diferenca))
    .slice(0,maximo);
}

// Usa apenas termos de catálogos; texto livre nunca é exportado.
// Prioriza a natureza padronizada de "ocorrencia" e só depois "crime".
// Agrupamento por prefixo seguro exige natureza-mãe cadastrada oficialmente.
export function classificarNatureza(ocorrencia, crime, catalogo) {
  // Preserva a prioridade do campo principal: não usar um "crime" secundário
  // exato para sobrescrever a natureza primária que só exige agrupamento.
  for (const valor of [ocorrencia, crime].map(categoria)) {
    if (catalogo.has(valor)) return valor;
    // Registro misto não pode virar automaticamente furto ou roubo consumado.
    if (/^(?:FURTO\s+(?:E|OU|\/)\s+ROUBO|ROUBO\s+(?:E|OU|\/)\s+FURTO)\b/u.test(valor)) continue;
    if (/^FURTO [\p{L}\p{N}]/u.test(valor) && catalogo.has("FURTO")) return "FURTO";
    if (/^ROUBO [\p{L}\p{N}]/u.test(valor) && catalogo.has("ROUBO")) return "ROUBO";
  }
  return "NÃO CLASSIFICADO";
}
export function naturezaAlvoPergunta(pergunta, catalogo) {
  const texto=String(pergunta||"").toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const opcoes=[
    {expr:/\bFURTOS?\b/,nome:"FURTO"},
    {expr:/\bROUBOS?\b/,nome:"ROUBO"},
    {expr:/MARIA DA PENHA|VIOLENCIA DOMESTICA/,nome:"MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA"}
  ];
  const candidatas=opcoes.filter(x=>x.expr.test(texto)&&catalogo.has(x.nome));
  return candidatas.length===1?candidatas[0].nome:null;
}

// Não libera séries temporais com pequenos grupos. Se um mês tem menos de
// cinco registros, omite toda a série em vez de permitir inferência por subtração.
export function serieMensalSegura(porMes) {
  const meses=[...porMes.entries()];
  if (meses.some(([,quantidade])=>quantidade<5)) return [];
  return meses.sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([mes,quantidade])=>({mes,quantidade}));
}

// Família estatística: naturezas principais + subtipos comprovadamente ligados.
// Tentativas e registros de localização/recuperação NÃO contam como consumação.
export function familiaNatureza(categoriaOficial) {
  const valor=categoria(categoriaOficial);
  if (/^FURTO(?:$|\s)/u.test(valor) &&
      !/^FURTO\s+(?:E|OU|\/)\s+ROUBO\b/u.test(valor)) return "FURTO";
  if (/^ROUBO(?:$|\s)/u.test(valor) &&
      !/^ROUBO\s+(?:E|OU|\/)\s+FURTO\b/u.test(valor)) return "ROUBO";
  if (valor === "MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA")
    return "MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA";
  return null;
}

// Converte perguntas livres em intenção estatística LIMITADA. Não encaminhar
// o texto do usuário nem o histórico literal à API externa.
export function intencaoEstatistica(pergunta) {
  if (typeof pergunta !== "string" || !pergunta.trim() || pergunta.length > 500)
    return null;
  const texto = pergunta.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();

  // Consultas individuais e recortes por nacionalidade não são recursos do piloto.
  // O bloqueio é semântico de propósito, sem envio do conteúdo a terceiros.
  if (/\b(CPF|RG|MATRICULA|EMAIL|TELEFONE|ENDERECO|PLACA|DOCUMENTO|NOME|IDENTIDADE|IDENTIFICAR|SUSPEITO|INFRATOR|VITIMA|POLICIAL|POLICIAIS|NACIONALIDADE|VENEZUELAN|ESTRANGEIR|ETNIA|RACA|COR DA PELE)\w*/u.test(texto))
    return null;

  const regras = [
    ["resumo", /\b(RESUM\w*|ANALIS\w*|BRIEFING|PANORAMA|CENARIO|SITUACAO|DIAGNOSTICO)\b/u],
    ["ocorrencias", /\b(OCORRENCIAS?|NATUREZAS?|REGISTROS?|CRIMES?|CRIMINAL|FURTOS?|ROUBOS?|VIOLENCIA|MARIA DA PENHA)\b/u],
    ["comparacao_temporal", /\b(COMPARA|COMPARATIV|EVOLU|CRESC|AUMENT|DIMINUI|REDUZ|VARIAC|TENDENC|MUDANC|ANTES|DEPOIS|PERIODO)\w*/u],
    ["distribuicao_territorial", /\b(BAIRROS?|REGIOES?|TERRITORIO|TERRITORIAL|AREA|LOCALIZACAO|CONCENTRACAO|ONDE)\b/u],
    ["horarios", /\b(HORARIOS?|HORAS?|TURNO|DIA DA SEMANA|NOITE|MADRUGADA|TARDE|MANHA)\b/u],
    ["produtividade", /\b(PRODUTIVIDADE|UNIDADES?|BATALHOES?|COMANDO|RESULTADOS?|ATUACOES?|PRISOES?|CONDUCOES?|APREEN(S|D)|ARMAS?|VEICULOS?)\b/u],
    ["qualidade_dos_dados", /\b(QUALIDADE|RASCUNHOS?|FINALIZAD|DUPLICAD|INCONSISTEN|INCOMPLET|AUDITORIA|DIVERGEN)\w*/u],
    ["aprofundamento", /\b(INSIGHT|HIPOTESE|APROFUND|INVESTIG|EXPLIC|POR QUE|QUESTOES|PROBLEMAS?)\w*/u],
    ["transito", /\b(SINISTROS?|TRANSITO|ACIDENTES?)\b/u]
  ];
  const temas = regras.filter(([,regex])=>regex.test(texto)).map(([id])=>id);
  if (!temas.length) return null;
  return {
    temas,
    enquadramento: "Somente estatísticas agregadas já disponíveis; explicar limites de filtros e cruzamentos. Não inferir individualmente.",
  };
}
