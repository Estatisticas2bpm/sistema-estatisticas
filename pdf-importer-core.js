(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PdfImporterCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const GRADUACOES = ["TEN CEL", "AL SGT", "CEL", "MAJ", "CAP", "TEN", "ASP", "ST", "SGT", "CB", "SD"];
  const PALAVRAS_NOME_IGNORADAS = new Set(["DA", "DAS", "DE", "DO", "DOS", "E", "PM", "POLICIAL", "MILITAR"]);

  function normalizar(valor) {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function limitar(valor, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, valor));
  }

  function graduacao(valor) {
    const n = normalizar(valor);
    return GRADUACOES.find(item => n === item || n.startsWith(item + " ") || n.includes(" " + item + " ")) || "";
  }

  function tokensNome(valor) {
    const tokens = normalizar(valor).split(" ").filter(Boolean);
    return tokens.filter(token => !PALAVRAS_NOME_IGNORADAS.has(token) && !GRADUACOES.some(g => g.split(" ").includes(token)));
  }

  function distanciaLevenshtein(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const anterior = Array.from({length:b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let diagonal = anterior[0];
      anterior[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const acima = anterior[j];
        anterior[j] = Math.min(anterior[j] + 1, anterior[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
        diagonal = acima;
      }
    }
    return anterior[b.length];
  }

  function similaridadeTexto(a, b) {
    const x = normalizar(a).replace(/ /g, "");
    const y = normalizar(b).replace(/ /g, "");
    if (!x || !y) return 0;
    return 1 - distanciaLevenshtein(x, y) / Math.max(x.length, y.length);
  }

  function candidatosComandante(texto) {
    const candidatos = [];
    const adicionar = (nome, origem, confiancaContexto) => {
      const valor = String(nome || "").replace(/\s+/g, " ").trim().replace(/[|;]+$/g, "");
      if (valor.length < 3 || normalizar(valor).includes("NAO INFORMADO")) return;
      const chave = normalizar(valor) + "|" + origem;
      if (!candidatos.some(item => item.chave === chave)) candidatos.push({chave, valor, origem, confiancaContexto});
    };
    const linhas = String(texto || "").split(/\r?\n/).map(linha => linha.trim()).filter(Boolean);
    linhas.forEach((linha, indice) => {
      let m = linha.match(/(?:COMANDANTE\s+DA\s+GUARNI[ÇC][ÃA]O|COMANDANTE\s+DA\s+VTR|COMANDANTE|CMT\s+GU|CMT\s+VTR)\s*:?\s*(.+)$/i);
      if (m) adicionar(m[1], "campo explícito", 0.10);
      m = linha.match(/^CMT\s+((?:(?:TEN\s+CEL|AL\s+SGT|CEL|MAJ|CAP|TEN|ASP|ST|SGT|CB|SD)(?:\s+PM)?\s+).+)$/i);
      if (m) adicionar(m[1], "identificação CMT", 0.10);
      if (/RESPONS[ÁA]VEL\s+PELO\s+ATENDIMENTO/i.test(linha)) {
        for (let volta = 1; volta <= 4; volta++) {
          const nome = linhas[indice - volta] || "";
          if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç .'-]{4,}$/u.test(nome) && !/POLICIAL|MATR[ÍI]CULA|ASSINATURAS/i.test(nome)) {
            adicionar(nome, "assinatura responsável", 0.03);
            break;
          }
        }
      }
    });
    const impresso = String(texto || "").match(/Impresso\s+por:\s*([^\n-]{4,100})/i);
    if (impresso) adicionar(impresso[1], "responsável pela impressão", -0.04);
    return candidatos;
  }

  function pontuarNome(candidatoPdf, nomeCatalogo, frequenciaTokens, confiancaContexto) {
    const fonte = tokensNome(candidatoPdf);
    const destino = tokensNome(nomeCatalogo);
    if (!fonte.length || !destino.length) return 0;
    const encontrados = destino.filter(token => fonte.includes(token));
    const pesos = destino.map(token => 1 / Math.max(1, frequenciaTokens.get(token) || 1));
    const pesoTotal = pesos.reduce((a,b) => a + b, 0) || 1;
    const cobertura = destino.reduce((soma, token, i) => soma + (fonte.includes(token) ? pesos[i] : 0), 0) / pesoTotal;
    const coberturaFonte = new Set(encontrados).size / Math.max(1, Math.min(fonte.length, destino.length + 2));
    const todos = encontrados.length === destino.length;
    const ultimoIgual = fonte[fonte.length - 1] === destino[destino.length - 1];
    const sequencia = normalizar(candidatoPdf).includes(destino.join(" "));
    const raridade = encontrados.length ? Math.max(...encontrados.map(token => 1 / Math.max(1, frequenciaTokens.get(token) || 1))) : 0;
    let score;
    if (todos && destino.length >= 2) score = 0.80 + (sequencia ? 0.06 : 0) + (ultimoIgual ? 0.04 : 0);
    else if (todos) score = 0.62 + (ultimoIgual ? 0.12 : 0) + Math.min(0.12, raridade * 0.12);
    else score = 0.42 * cobertura + 0.18 * coberturaFonte + 0.16 * similaridadeTexto(fonte.join(" "), destino.join(" ")) + (ultimoIgual ? 0.10 : 0);
    const gradFonte = graduacao(candidatoPdf);
    const gradDestino = graduacao(nomeCatalogo);
    if (gradFonte && gradDestino) score += gradFonte === gradDestino ? 0.10 : -0.16;
    score += Number(confiancaContexto || 0);
    return limitar(score, 0, 0.99);
  }

  function associarComandante(texto, catalogo) {
    const nomes = (catalogo || []).map(item => typeof item === "string" ? item : item && item.nome).filter(Boolean);
    const frequencia = new Map();
    nomes.forEach(nome => new Set(tokensNome(nome)).forEach(token => frequencia.set(token, (frequencia.get(token) || 0) + 1)));
    const fontes = candidatosComandante(texto);
    const resultados = [];
    fontes.forEach(fonte => nomes.forEach(nome => resultados.push({
      valor:nome,
      score:pontuarNome(fonte.valor, nome, frequencia, fonte.confiancaContexto),
      origem:fonte.origem,
      candidatoPdf:fonte.valor
    })));
    resultados.sort((a,b) => b.score - a.score || a.valor.localeCompare(b.valor, "pt-BR"));
    const melhor = resultados[0] || {valor:null,score:0,origem:null,candidatoPdf:null};
    const segundoDiferente = resultados.find(item => item.valor !== melhor.valor && item.origem === melhor.origem && item.candidatoPdf === melhor.candidatoPdf) || {score:0};
    const margem = melhor.score - segundoDiferente.score;
    const ambiguo = melhor.score >= 0.65 && margem < 0.07;
    const automatico = melhor.score >= 0.85 && !ambiguo;
    return {
      valor:automatico ? melhor.valor : null,
      sugestao:!automatico && !ambiguo && melhor.score >= 0.65 ? melhor.valor : null,
      score:Number(melhor.score.toFixed(2)),
      margem:Number(margem.toFixed(2)),
      origem:melhor.origem,
      candidatoPdf:melhor.candidatoPdf,
      automatico,
      ambiguo,
      alternativas:resultados.filter((item, indice, lista) => lista.findIndex(x => x.valor === item.valor) === indice).slice(0,3).map(item => ({nome:item.valor,score:Number(item.score.toFixed(2))}))
    };
  }

  const ALIASES_LOCAIS = {
    "PRIMEIRO DISTRITO POLICIAL":"1 DP", "1 DISTRITO POLICIAL":"1 DP", "1 DP":"1 DP",
    "SEGUNDO DISTRITO POLICIAL":"PC II", "2 DISTRITO POLICIAL":"PC II", "2 DP":"PC II",
    "TERCEIRO DISTRITO POLICIAL":"3 DP", "3 DISTRITO POLICIAL":"3 DP", "3 DP":"3 DP",
    "QUARTO DISTRITO POLICIAL":"4 DP", "4 DISTRITO POLICIAL":"4 DP", "4 DP":"4 DP",
    "QUINTO DISTRITO POLICIAL":"5 DP", "5 DISTRITO POLICIAL":"5 DP", "5 DP":"5 DP",
    "PLANTAO CENTRAL II":"PC II", "PLANTAO CENTRAL 2":"PC II", "PC II":"PC II", "PCII":"PC II",
    "PLANTAO CENTRAL I":"PC I", "PLANTAO CENTRAL 1":"PC I", "PC I":"PC I", "PCI":"PC I",
    "DELEGACIA ESPECIALIZADA DE ATENDIMENTO A MULHER":"DEAM", "DELEGACIA DA MULHER":"DEAM", "DEAM":"DEAM",
    "DIVISAO DE CAPTURA E INTELIGENCIA":"DICAP", "DICAP":"DICAP"
  };

  function associarLocalEntrega(texto, catalogo, historico) {
    const nomes = (catalogo || []).map(item => typeof item === "string" ? item : item && item.nome).filter(Boolean);
    const alvo = normalizar(historico || texto);
    const resultados = [];
    function adicionar(nomeEsperado, score, origem) {
      const chave = normalizar(nomeEsperado).replace(/ /g, "");
      const oficial = nomes.find(nome => normalizar(nome).replace(/ /g, "") === chave);
      if (oficial) resultados.push({valor:oficial,score,origem});
    }
    Object.entries(ALIASES_LOCAIS).forEach(([alias, oficial]) => {
      if (alvo.includes(alias)) adicionar(oficial, alias === normalizar(oficial) ? 0.94 : 0.90, `menção: ${alias}`);
    });
    nomes.forEach(nome => {
      const n = normalizar(nome);
      if (n.length >= 3 && alvo.includes(n)) adicionar(nome, 0.92, "nome do catálogo no relato");
    });
    if (/AO\s+SENHOR\s+CHEFE\s+DA\s+DICAP|ORIENTACOES\s+DA\s+DICAP|CONSULTA\s+(?:VIA|A)\s+DICAP/.test(alvo) && /APRESENTAD|CONDUZID|ENCAMINHAD/.test(alvo)) adicionar("DICAP", 0.96, "contexto da apresentação");
    resultados.sort((a,b) => b.score - a.score);
    const melhor = resultados[0] || {valor:null,score:0,origem:null};
    const segundo = resultados.find(item => item.valor !== melhor.valor) || {score:0};
    const ambiguo = Boolean(melhor.valor && segundo.score >= melhor.score - 0.06);
    return {
      valor:melhor.score >= 0.85 && !ambiguo ? melhor.valor : null,
      sugestao:melhor.score >= 0.65 && (ambiguo || melhor.score < 0.85) ? melhor.valor : null,
      score:Number(melhor.score.toFixed(2)), origem:melhor.origem, automatico:melhor.score >= 0.85 && !ambiguo, ambiguo
    };
  }

  function numeroFisico(valor, padrao) {
    const texto = String(valor || "");
    const m = texto.match(new RegExp("\\b(\\d{1,4})\\s*(?:\\([^)]*\\)\\s*)?(?:" + padrao + ")\\b", "i"));
    if (m) return Math.max(1, Number(m[1]));
    const q = texto.match(/\bQuantidade\s+(\d+(?:[.,]\d+)?)/i);
    return q ? Math.max(1, Number(q[1].replace(",", ".")) || 1) : 1;
  }

  function adicionarUnico(lista, item) {
    const chave = normalizar(JSON.stringify(item));
    if (!lista.some(existente => normalizar(JSON.stringify(existente)) === chave)) lista.push(item);
  }

  function extrairItensOperacionais(textoObjetos) {
    const texto = String(textoObjetos || "");
    const dados = {armas:[],municoes:[],entorpecentes:[],recuperados:[],subtraidos:[],armasBrancas:[],balanca:false};
    const gruposConhecidos = "Droga|Arma\\s+Branca|Arma\\s+de\\s+Fogo|Muni[çc][ãa]o|Celulares?|Ve[íi]culo|Outros\\s+Meios\\s+de\\s+Transporte|Ferramentas\\s+e\\s+Acess[óo]rios|Moeda\\s+Nacional|Outros";
    const indiceDescricao = texto.search(/\bDescri[çc][ãa]o\s+/i);
    const indiceGrupo = texto.search(/\bGrupo\s+/i);
    let registros;
    if (indiceGrupo >= 0 && (indiceDescricao < 0 || indiceGrupo < indiceDescricao)) {
      registros = texto.split(/(?=\bGrupo\s+)/i).filter(bloco=>/^\s*Grupo\s+/i.test(bloco)).map(bloco => {
        const grupo = ((bloco.match(/^Grupo\s+(.+?)\s+Subgrupo\s+/i)||[])[1]||"").replace(/\s+/g," ").trim();
        const subgrupo = ((bloco.match(/\bSubgrupo\s+(.+?)(?=\s+Identificador\s+[ÚU]nico\b|\s+Descri[çc][ãa]o\b|\s+Situa[çc][ãa]o\b)/i)||[])[1]||"").replace(/\s+/g," ").trim();
        const descricao = ((bloco.match(/\bDescri[çc][ãa]o\s+([\s\S]*?)(?=\s+Situa[çc][ãa]o\b|\s+Quantidade\b|\s+Valor Total\b|\s+Marca\b|$)/i)||[])[1]||"").replace(/\s+/g," ").trim();
        const situacao = ((bloco.match(/\bSitua[çc][ãa]o\s+([\s\S]*?)(?=\s+Nome\s+Envolvido\b|\s+Grupo\s+|$)/i)||[])[1]||"").replace(/\s+/g," ").trim();
        return `Descrição ${descricao}\nSituação ${situacao}\n${grupo}Grupo ${subgrupo}Subgrupo\n${bloco}`;
      });
    } else registros = texto.split(/(?=\bDescri[çc][ãa]o\s+)/i).filter(registro=>/^\s*Descri[çc][ãa]o\s+/i.test(registro));
    registros.forEach(registro => {
      const descricao = ((registro.match(/^Descri[çc][ãa]o\s+([\s\S]*?)(?=\s+Situa[çc][ãa]o\b|\s+Quantidade\b|\s+Valor Total\b|\s+Marca\b|$)/i) || [])[1] || "").replace(/\s+/g," ").trim();
      const classificacao = registro.match(new RegExp("(?:^|\\s)(" + gruposConhecidos + ")\\s*Grupo\\s*([\\s\\S]*?)Subgrupo", "i"));
      const grupo = classificacao ? classificacao[1].replace(/\s+/g," ").trim() : "";
      const subgrupo = classificacao ? classificacao[2].replace(/\s+/g," ").trim() : "";
      const situacao = normalizar(((registro.match(new RegExp("\\bSitua[çc][ãa]o\\s+([\\s\\S]*?)(?=\\s+(?:" + gruposConhecidos + ")\\s*Grupo|$)", "i")) || [])[1]) || "");
      const chave = normalizar([grupo,subgrupo,descricao].join(" "));
      const calibre = ((registro.match(/(?:CALIBRE|CAL\.?)\s*:?\s*(\.?\d{1,3}(?:\s*MM)?|12|20|28|32|36)/i) || [])[1]) || null;
      if (/SIMULACRO|REPLICA/.test(chave)) {
        adicionarUnico(dados.armas,{categoria:"SIMULACRO",quantidade:numeroFisico(descricao,"SIMULACROS?|ARMAS?"),tipo:null,calibre:null,detalhes:descricao || subgrupo});
        return;
      }
      if (/ARMA DE FOGO|PISTOLA|REVOLVER|ESPINGARDA|FUZIL|CARABINA|SUBMETRALHADORA|GARRUCHA/.test(chave)) {
        const tipos = ["PISTOLA","REVÓLVER","ESPINGARDA","FUZIL","CARABINA","SUBMETRALHADORA","GARRUCHA","ARMA ARTESANAL"];
        const tipo = tipos.find(item=>chave.includes(normalizar(item))) || "OUTRO";
        adicionarUnico(dados.armas,{categoria:"ARMA DE FOGO",quantidade:numeroFisico(descricao,"PISTOLAS?|REVOLVERES?|ESPINGARDAS?|FUZIS?|CARABINAS?|SUBMETRALHADORAS?|GARRUCHAS?|ARMAS?"),tipo,calibre,detalhes:descricao});
        return;
      }
      if (/MUNICAO|CARTUCHO/.test(chave)) {
        adicionarUnico(dados.municoes,{quantidade:numeroFisico(descricao,"MUNI(?:ÇÕES?|COES?)|CARTUCHOS?"),calibre,detalhes:descricao});
        return;
      }
      if (/ARMA BRANCA|\bFACA\b|\bCANIVETE\b|\bFACAO\b/.test(chave)) {
        adicionarUnico(dados.armasBrancas,{quantidade:numeroFisico(descricao,"FACAS?|CANIVETES?|FACOES?"),descricao:descricao || subgrupo});
        return;
      }
      if (normalizar(grupo) === "DROGA") {
        const droga = normalizar(subgrupo);
        const tipo = droga.includes("PASTA BASE") ? "PASTA BASE" : droga.includes("CRACK") ? "CRACK" : droga.includes("COCAINA") ? "COCAÍNA" : droga.includes("MACONHA") ? "MACONHA" : droga.includes("SKANK") ? "SKANK" : "OUTRO";
        const achado = descricao.match(/\b(\d+)\s*(?:\([^)]*\)\s*)?(INV[ÓO]LUCROS?|POR[ÇC][ÕO]ES?|TABLETES?|TIJOLOS?|PAPELOTES?|PINOS?|COMPRIMIDOS?|SACOLAS?|UNIDADES?|PEDRAS?)\b/i);
        if (!achado) return;
        const formaChave = normalizar(achado[2]);
        const forma = formaChave.includes("INVOLUCRO") ? "INVÓLUCRO" : formaChave.includes("PORCAO") ? "PORÇÃO" : formaChave.includes("TABLETE") ? "TABLETE" : formaChave.includes("TIJOLO") ? "TIJOLO" : formaChave.includes("PAPELOTE") ? "PAPELOTE" : formaChave.includes("PINO") ? "PINO" : formaChave.includes("COMPRIMIDO") ? "COMPRIMIDO" : formaChave.includes("SACOLA") ? "SACOLA" : "UNIDADE";
        adicionarUnico(dados.entorpecentes,{tipo,quantidade:Number(achado[1]),forma_apresentacao:forma,detalhes:descricao});
        return;
      }
      if (normalizar(grupo) === "VEICULO") return;
      if (chave.includes("BALANCA") && chave.includes("PRECISAO")) dados.balanca = true;
      if (!/RECUPERAD|APREENDID|ENCONTRAD/.test(situacao)) return;
      let tipo = "OUTRO";
      if (chave.includes("BICICLETA ELETRICA")) tipo="BICICLETA ELÉTRICA";
      else if (chave.includes("BICICLETA MOTORIZADA")) tipo="BICICLETA MOTORIZADA";
      else if (chave.includes("MOTOCICLETA")) tipo="MOTOCICLETA";
      else if (chave.includes("MOTONETA")) tipo="MOTONETA";
      else if (chave.includes("CAMINHONETE")) tipo="CAMINHONETE";
      else if (chave.includes("CAMINHAO")) tipo="CAMINHÃO";
      else if (chave.includes("ONIBUS")) tipo="ÔNIBUS/MICRO-ÔNIBUS";
      else if (chave.includes("BICICLETA")) tipo="BICICLETA";
      else if (chave.includes("CELULAR")) tipo="CELULAR";
      else if (chave.includes("TABLET")) tipo="TABLET";
      else if (chave.includes("NOTEBOOK")) tipo="NOTEBOOK";
      else if (chave.includes("BALANCA") && chave.includes("PRECISAO")) tipo="BALANÇA DE PRECISÃO";
      adicionarUnico(dados.recuperados,{tipo,quantidade:numeroFisico(registro,"UNIDADES?"),detalhes:descricao || subgrupo});
    });
    const placasProcessadas = new Set();
    function processarVeiculo(placaInformada, blocoInformado) {
      const placa = String(placaInformada || "").toUpperCase();
      const bloco = String(blocoInformado || "");
      if (!placa || placasProcessadas.has(placa)) return;
      const marcaModelo = ((bloco.match(/Marca\/Modelo\s+(.+?)(?=\s+Ve[íi]culo Adulterado|\s+Situa[çc][ãa]o|$)/i)||[])[1]||"").replace(/\s+/g," ").trim();
      const cor = ((bloco.match(/\bCor\s+(.+?)(?=\s+UF Ve[íi]culo|\s+Munic[íi]pio Ve[íi]culo|$)/i)||[])[1]||"").replace(/\s+/g," ").trim();
      const ano = ((bloco.match(/Ano\/Modelo Fabrica[çc][ãa]o\s+(\d{4}\/\d{4})/i)||[])[1])||"";
      const chassi = ((bloco.match(/N[úu]mero do Chassi\s+([A-Z0-9-]+)/i)||[])[1])||"";
      const situacao = normalizar(((bloco.match(/Situa[çc][ãa]o\s+([\s\S]*?)(?=\s+[ÚU]ltima Atualiza[çc][ãa]o|$)/i)||[])[1])||"");
      const categoria = /MOTO|BIZ|CG\b|MOTONETA/.test(normalizar(marcaModelo)) ? "MOTOCICLETA" : "AUTOMÓVEL";
      if (/FURTAD|ROUBAD/.test(situacao)) adicionarUnico(dados.subtraidos,{tipoSubtracao:situacao.includes("ROUBAD")?"ROUBO":"FURTO",categoria,quantidade:1,descricao:marcaModelo||categoria,marcaModelo,cor,placa,imei:"",identificador:chassi,situacao:/RECUPERAD|APREENDID|ENCONTRAD/.test(situacao)?"RECUPERADO":"SUBTRAÍDO"});
      if (/RECUPERAD|APREENDID|ENCONTRAD/.test(situacao)) adicionarUnico(dados.recuperados,{tipo:categoria==="MOTOCICLETA"?"MOTOCICLETA":"CARRO",quantidade:1,detalhes:[marcaModelo,cor&&"COR "+cor,placa&&"PLACA "+placa,ano&&"ANO/MODELO "+ano].filter(Boolean).join(", ")});
      placasProcessadas.add(placa);
    }
    texto.split(/(?=\bGrupo\s+Ve[íi]culo\s+Subgrupo\s+)/i)
      .filter(bloco=>/^\s*Grupo\s+Ve[íi]culo\s+Subgrupo\s+/i.test(bloco))
      .forEach(bloco=>processarVeiculo(((bloco.match(/\bPlaca\s+([A-Z0-9-]+)/i)||[])[1])||"",bloco));
    const regexVeiculo = /Placa\s+([A-Z0-9-]+)([\s\S]*?)(?=Ve[íi]culoGrupo\s+[^\n]*?Subgrupo)/gi;
    let veiculo;
    while ((veiculo = regexVeiculo.exec(texto))) {
      processarVeiculo(veiculo[1],veiculo[2]);
    }
    return dados;
  }

  function limparHistorico(valor) {
    return String(valor || "")
      .replace(/(?:Era o que tinha|Era o que havia|Diante dos fatos, era o que havia) a relatar\.?/gi, " ")
      .replace(/Senhor\s*\(?a\)?\s*[,.:]?/gi, " ")
      .replace(/Informo(?: ainda)? que/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function anonimizarNomes(relato, pessoas) {
    let texto = String(relato || "");
    const grupos = [
      [pessoas && pessoas.vitimas || [], "A VÍTIMA"],
      [pessoas && pessoas.infratores || [], "O INFRATOR"],
      [pessoas && pessoas.envolvidos || [], "O ENVOLVIDO"]
    ];
    grupos.forEach(([lista, rotulo]) => lista.forEach(pessoa => {
      if (!pessoa.nome) return;
      texto = texto.replace(new RegExp(pessoa.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), rotulo);
    }));
    return texto;
  }

  function resumirHistorico(relato, pessoas) {
    const limpo = limparHistorico(anonimizarNomes(relato, pessoas));
    const comparavel = normalizar(limpo);
    const quantidadeInfratores = (pessoas && pessoas.infratores || []).length;
    if (!limpo) return "";
    if (comparavel.includes("DESCUMPRIMENTO") && comparavel.includes("CAUTELAR") && comparavel.includes("REEDUCAND") && comparavel.includes("DICAP")) {
      const dois = /\bDOIS\s+INDIVIDUOS\b/.test(comparavel) || ((pessoas && pessoas.infratores || []).length === 2);
      return `${comparavel.includes("PATRULHAMENTO") ? "DURANTE PATRULHAMENTO, " : ""}${dois ? "DOIS INDIVÍDUOS" : "INDIVÍDUOS"} EM ATITUDE SUSPEITA FORAM ABORDADOS E IDENTIFICADOS COMO REEDUCANDOS EM DESCUMPRIMENTO DE MEDIDAS CAUTELARES. APÓS CONSULTA À DICAP, ${dois ? "AMBOS" : "OS ENVOLVIDOS"} FORAM CONDUZIDOS À UNIDADE PARA AS PROVIDÊNCIAS CABÍVEIS.`;
    }
    if ((/TRAFICO|ENTORPECENTE|DROGA|COCAINA|PASTA BASE|CRACK|MACONHA/.test(comparavel)) && /ABORD|BUSCA PESSOAL|PATRULHAMENTO/.test(comparavel)) {
      const envolvidos = quantidadeInfratores === 1 ? "UM INDIVÍDUO" : quantidadeInfratores === 2 ? "DOIS INDIVÍDUOS" : "INDIVÍDUOS";
      const suspeita = /ATITUDE SUSPEITA|FUNDADA SUSPEITA/.test(comparavel) ? " EM ATITUDE SUSPEITA" : "";
      const frases = [`${comparavel.includes("PATRULHAMENTO") ? "DURANTE PATRULHAMENTO, " : ""}A GUARNIÇÃO ABORDOU ${envolvidos}${suspeita}.`];
      if (/APREEND|LOCALIZ|ENCONTRAD/.test(comparavel)) frases.push("NA AÇÃO, FORAM LOCALIZADAS E APREENDIDAS SUBSTÂNCIAS ENTORPECENTES E OS DEMAIS OBJETOS DESCRITOS NO BO.");
      if (/CONDUZID|APRESENTAD/.test(comparavel)) frases.push(`${quantidadeInfratores === 1 ? "O INFRATOR FOI" : "OS ENVOLVIDOS FORAM"} CONDUZIDO${quantidadeInfratores === 1 ? "" : "S"} À UNIDADE POLICIAL PARA AS PROVIDÊNCIAS CABÍVEIS.`);
      return frases.join(" ");
    }
    if (/VIOLENCIA DOMESTICA|MARIA DA PENHA/.test(comparavel)) {
      const frases = ["A GUARNIÇÃO FOI ACIONADA PARA ATENDER UMA OCORRÊNCIA DE VIOLÊNCIA DOMÉSTICA."];
      const condutas = [];
      if (/AGRED|LESAO CORPORAL/.test(comparavel)) condutas.push("AGRESSÕES");
      if (/AMEAC/.test(comparavel)) condutas.push("AMEAÇAS");
      if (/DANIFIC/.test(comparavel)) condutas.push("DANO AO PATRIMÔNIO");
      if (condutas.length) frases.push(`NO LOCAL, A VÍTIMA RELATOU ${condutas.join(condutas.length > 1 ? " E " : "")} EM CONTEXTO DOMÉSTICO.`);
      if (/LOCALIZAD/.test(comparavel) && /CONDUZID|APRESENTAD/.test(comparavel)) frases.push("O INFRATOR FOI LOCALIZADO E CONDUZIDO À UNIDADE POLICIAL PARA AS PROVIDÊNCIAS CABÍVEIS.");
      else if (/CONDUZID|APRESENTAD/.test(comparavel)) frases.push("O INFRATOR FOI CONDUZIDO À UNIDADE POLICIAL PARA AS PROVIDÊNCIAS CABÍVEIS.");
      else if (/ORIENTA/.test(comparavel)) frases.push("A VÍTIMA RECEBEU ORIENTAÇÕES QUANTO ÀS PROVIDÊNCIAS CABÍVEIS.");
      return frases.join(" ");
    }
    if (/VIAS DE FATO|CONFUSAO FAMILIAR|BRIGA|DESENTENDIMENTO/.test(comparavel)) {
      const contexto = /FAMILIAR|IRMAO|IRMA/.test(comparavel) ? " EM CONTEXTO FAMILIAR" : "";
      const frases = [`A GUARNIÇÃO FOI ACIONADA PARA ATENDER UMA OCORRÊNCIA DE VIAS DE FATO${contexto}.`];
      if (/FACA|CANIVETE|FACAO|ARMA BRANCA/.test(comparavel) && /APREEND|LOCALIZ|ENCONTRAD/.test(comparavel)) frases.push("DURANTE O ATENDIMENTO, FORAM LOCALIZADAS E APREENDIDAS AS ARMAS BRANCAS DESCRITAS NO BO.");
      if (/CONDUZID|APRESENTAD/.test(comparavel)) frases.push("OS ENVOLVIDOS FORAM CONDUZIDOS À UNIDADE POLICIAL PARA AS PROVIDÊNCIAS CABÍVEIS.");
      else if (/ORIENTA/.test(comparavel)) frases.push("OS ENVOLVIDOS RECEBERAM ORIENTAÇÕES QUANTO ÀS PROVIDÊNCIAS CABÍVEIS.");
      return frases.join(" ");
    }
    const frases = (limpo.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [limpo])
      .map(frase => frase.replace(/^\s*(?:DESTARTE|DIANTE DISSO|ATO CONT[ÍI]NUO|POR FIM)[,;:]?\s*/i, "").trim())
      .filter(frase => frase.length >= 20)
      .filter(frase => !/USO DE ALGEMAS|S[ÚU]MULA VINCULANTE|ESTADO F[ÍI]SICO|INTEGRIDADE F[ÍI]SICA|COMPARTIMENTO HUMANIZADO|IMPRESSO POR|C[ÓO]DIGO VERIFICADOR|DIREITOS E GARANTIAS|MATR[ÍI]CULA/i.test(frase));
    const categorias = [
      /ACIONAD|PATRULHAMENTO|AVERIGUAR|ATENDIMENTO DE OCORR[ÊE]NCIA/i,
      /RELATOU|AGRED|AMEA[ÇC]|SUBTRA[ÍI]|FURT|ROUB|DANIFIC|DESCUMPR|DROGA|ARMA|FLAGRANTE/i,
      /ABORD|LOCALIZ|BUSCA PESSOAL|APREEND|RECUPER|DILIG[ÊE]NCIA/i,
      /CONDUZ|APRESENTAD|PRIS[ÃA]O|ORIENTA[ÇC]|PROVID[ÊE]NCIA/i
    ];
    const escolhidas = [];
    categorias.forEach(regex => {
      const frase = frases.find(item => regex.test(item) && !escolhidas.includes(item));
      if (frase) escolhidas.push(frase);
    });
    if (!escolhidas.length && frases[0]) escolhidas.push(frases[0]);
    const compactas = escolhidas.slice(0,4).map(frase => frase
      .replace(/\b(?:esta|a presente) guarni[çc][ãa]o\b/gi, "A guarnição")
      .replace(/\b(?:o senhor|a senhora|sr\.?|sra\.?)\s+(A V[ÍI]TIMA|O INFRATOR|O ENVOLVIDO)\b/gi, "$1")
      .replace(/\s+/g, " ")
      .trim())
      .map(frase => {
        if (frase.length <= 260) return frase;
        const corte = frase.slice(0,257);
        const limite = Math.max(corte.lastIndexOf(","), corte.lastIndexOf(";"), corte.lastIndexOf(" "));
        return corte.slice(0, limite > 140 ? limite : 257).replace(/[,:;\s]+$/, "") + ".";
      });
    let resumo = compactas.join(" ").replace(/\s+/g, " ").trim();
    if (resumo.length > 560) resumo = resumo.slice(0, 557).replace(/\s+\S*$/, "") + "...";
    return resumo.toUpperCase();
  }

  return {
    normalizar,
    graduacao,
    tokensNome,
    similaridadeTexto,
    candidatosComandante,
    associarComandante,
    associarLocalEntrega,
    extrairItensOperacionais,
    limparHistorico,
    anonimizarNomes,
    resumirHistorico
  };
});
