(function(){
  'use strict';

  const normalizar = (valor) => String(valor || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toUpperCase().replace(/\s+/g,' ').trim();

  const TIPOS_VEICULO = new Set([
    'CARRO','MOTOCICLETA','MOTONETA','CAMINHONETE','CAMINHAO','ONIBUS/MICRO-ONIBUS',
    'BICICLETA','BICICLETA ELETRICA','BICICLETA MOTORIZADA','VEICULO ELETRICO'
  ]);

  function ehVeiculo(tipo){ return TIPOS_VEICULO.has(normalizar(tipo)); }

  function inferirSituacao(dados){
    const explicita = normalizar(dados?.situacao);
    if(explicita === 'RECUPERADO' || explicita === 'APREENDIDO') return explicita;
    const contexto = normalizar([dados?.detalhes,dados?.descricao,dados?.observacao].filter(Boolean).join(' '));
    if(/\bAPREEND/.test(contexto)) return 'APREENDIDO';
    if(/\bRECUPER|\bLOCALIZAD[OA].*RESTITU|\bRESTITUID[OA]/.test(contexto)) return 'RECUPERADO';
    return '';
  }

  function atualizarResumoVisualVeiculos(){
    const recipiente = document.getElementById('itensRecuperados');
    if(!recipiente) return;
    let recuperados = 0, apreendidos = 0;
    recipiente.querySelectorAll('.item-estruturado.recuperado').forEach(bloco=>{
      const tipo = bloco.querySelector('[data-item="tipo"]')?.value || '';
      if(!ehVeiculo(tipo)) return;
      const qtd = Math.max(0, Number(bloco.querySelector('[data-item="quantidade"]')?.value) || 0);
      const situacao = normalizar(bloco.querySelector('[data-item="situacao"]')?.value);
      if(situacao === 'RECUPERADO') recuperados += qtd;
      if(situacao === 'APREENDIDO') apreendidos += qtd;
    });

    let linha = document.getElementById('resumoSituacaoVeiculos');
    if(!linha){
      linha = document.createElement('div');
      linha.id = 'resumoSituacaoVeiculos';
      linha.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;font-size:12px;font-weight:800;color:#475569';
      recipiente.insertAdjacentElement('afterend', linha);
    }
    linha.innerHTML = '<span style="padding:6px 9px;border-radius:999px;background:#ecfdf3;color:#047857">Recuperados: '+recuperados+'</span>'+
      '<span style="padding:6px 9px;border-radius:999px;background:#fff7ed;color:#c2410c">Apreendidos: '+apreendidos+'</span>';

    const check = document.getElementById('resultadoVeiculo');
    const campo = document.getElementById('campoQtdVeiculo');
    const input = document.getElementById('veiculosRecuperados');
    const haClassificacao = Array.from(recipiente.querySelectorAll('[data-item="situacao"]')).some(el => el.value);
    if(haClassificacao && check && campo && input){
      check.checked = recuperados > 0;
      campo.hidden = recuperados <= 0;
      input.value = recuperados > 0 ? String(recuperados) : '';
    }
  }

  const PADROES_RUIDO = [
    /USO DE ALGEMAS/i,/ESTADO F[ÍI]SICO/i,/INTEGRIDADE F[ÍI]SICA/i,/NADA MAIS HAVIA A RELATAR/i,
    /ERA O QUE (?:TINHA|HAVIA) A RELATAR/i,/IMPRESSO POR/i,/C[ÓO]DIGO VERIFICADOR/i,
    /CIENTE DOS SEUS DIREITOS/i,/LEITURA DOS DIREITOS/i,/DIREITO CONSTITUCIONAL/i,
    /FOI CONFECCIONADO/i,/FOI LAVRADO/i,/FOI PREENCHIDO/i,/BOLETIM DE OCORR[ÊE]NCIA/i,
    /GUARNI[CÇ][ÃA]O (?:DE SERVI[CÇ]O )?COMPOSTA/i,/VTR\s+[A-Z0-9-]+/i
  ];

  function limparFrase(frase){
    let f = String(frase || '').replace(/\s+/g,' ').trim();
    f = f.replace(/^RESUMO:\s*/i,'');
    f = f.replace(/\b(?:CPF|RG|CNH)\s*[:º°-]?\s*[A-Z0-9.\/-]+/gi,'');
    f = f.replace(/\b(?:telefone|celular)\s*[:º°-]?\s*\(?\d{2}\)?[\d\s-]{8,}/gi,'');
    f = f.replace(/\s+([,.;:])/g,'$1').replace(/\s{2,}/g,' ').trim();
    return f;
  }

  function fraseInutil(frase){
    if(!frase || frase.length < 12) return true;
    return PADROES_RUIDO.some(re=>re.test(frase));
  }

  function pontuar(frase, termos){
    const n = normalizar(frase);
    return termos.reduce((p,t)=>p+(n.includes(t)?1:0),0);
  }

  function encurtarProcedimento(frase){
    let f = limparFrase(frase);
    f = f.replace(/A GUARNI[CÇ][ÃA]O (?:POLICIAL )?(?:FOI )?ACIONADA (?:VIA CIOPS )?(?:PARA|A FIM DE) (?:ATENDER|AVERIGUAR)\s+/i,'Guarnição acionada para ');
    f = f.replace(/A GUARNI[CÇ][ÃA]O (?:POLICIAL )?DESLOCOU-SE (?:AT[ÉE]|AO) LOCAL[^,.]*[,.:]?\s*/i,'No local, ');
    f = f.replace(/DIANTE DOS FATOS[,,:]?\s*/i,'');
    f = f.replace(/PARA QUE FOSSEM TOMADAS? AS MEDIDAS CAB[ÍI]VEIS/i,'para as providências cabíveis');
    f = f.replace(/PARA ADO[CÇ][ÃA]O DAS MEDIDAS CAB[ÍI]VEIS/i,'para as providências cabíveis');
    return f.charAt(0).toUpperCase()+f.slice(1);
  }

  function limitarFrase(frase, max=230){
    const f = encurtarProcedimento(frase);
    if(f.length <= max) return /[.!?]$/.test(f) ? f : f+'.';
    const corte = f.slice(0,max).replace(/\s+\S*$/,'').replace(/[,:;\s]+$/,'');
    return corte+'.';
  }

  function resumoMelhorado(relato){
    const bruto = String(relato || '')
      .replace(/(?:Era o que tinha|Era o que havia|Diante dos fatos, era o que havia) a relatar\.?/gi,' ')
      .replace(/\s+/g,' ').trim();
    if(!bruto) return '';

    const frases = (bruto.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [bruto])
      .map(limparFrase).filter(f=>!fraseInutil(f));
    if(!frases.length) return limitarFrase(bruto,380);

    const TERMOS_FATO = ['AGRED','AMEAC','SUBTRAI','FURT','ROUB','INVADI','DANIFIC','DESCUMPR','COLIDI','ACIDENT','DISPAR','PORTE','TRAFIC','DROGA','ENTORPEC','VIOLENCIA','PERTURB','DESACAT','LESION','TENTOU','AUTOR','INFRATOR','VITIMA'];
    const TERMOS_MOTIVO = ['APOS DISCUS','APOS DESENTEND','POR CIUME','DEVIDO','EM RAZAO','MOTIVAD','POR NAO ACEIT','POR CONTA','PORQUE','EM VIRTUDE','DESCUMPRIMENTO DE MEDIDA'];
    const TERMOS_DESFECHO = ['CONDUZ','PRESO','PRISAO','APREEND','RECUPER','LOCALIZ','RESTITU','ENCAMINH','APRESENTAD','ORIENTAD','NAO LOCALIZ','EVADIU','FUGIU','DELEGACIA','DISTRITO POLICIAL'];

    const avaliadas = frases.map((frase,indice)=>({
      frase, indice,
      fato:pontuar(frase,TERMOS_FATO),
      motivo:pontuar(frase,TERMOS_MOTIVO),
      desfecho:pontuar(frase,TERMOS_DESFECHO)
    }));

    const escolher = (campo, filtro=()=>true) => avaliadas
      .filter(filtro)
      .sort((a,b)=>b[campo]-a[campo] || a.indice-b.indice)[0];

    const contexto = avaliadas.find(x=>/ACIONAD|SOLICITAD|COMPARECEU|RELATOU|INFORMOU/i.test(x.frase) && (x.fato>0 || /OCORR[ÊE]NCIA/i.test(x.frase)));
    const fato = escolher('fato', x=>x.fato>0 && x.desfecho===0) || escolher('fato',x=>x.fato>0) || avaliadas[0];
    const motivo = escolher('motivo',x=>x.motivo>0 && x.indice!==fato?.indice);
    const desfecho = avaliadas.filter(x=>x.desfecho>0).sort((a,b)=>b.indice-a.indice || b.desfecho-a.desfecho)[0];

    const escolhidas = [];
    function incluir(item){
      if(!item) return;
      if(escolhidas.some(x=>x.indice===item.indice)) return;
      escolhidas.push(item);
    }
    if(contexto && contexto.indice !== fato?.indice && contexto.frase.length < 210) incluir(contexto);
    incluir(fato);
    incluir(motivo);
    incluir(desfecho);
    escolhidas.sort((a,b)=>a.indice-b.indice);

    let selecionadas = escolhidas;
    if(selecionadas.length > 3){
      const obrigatorios = new Set([fato?.indice,desfecho?.indice,motivo?.indice].filter(v=>v!==undefined));
      selecionadas = selecionadas.filter(x=>obrigatorios.has(x.indice)).slice(0,3);
      if(selecionadas.length<3 && contexto && !selecionadas.some(x=>x.indice===contexto.indice)) selecionadas.unshift(contexto);
      selecionadas = selecionadas.slice(0,3).sort((a,b)=>a.indice-b.indice);
    }

    let resultado = selecionadas.map(x=>limitarFrase(x.frase)).join(' ').replace(/\s+/g,' ').trim();
    if(resultado.length > 520){
      resultado = resultado.slice(0,520).replace(/\s+\S*$/,'').replace(/[,:;\s]+$/,'')+'.';
    }
    return resultado;
  }

  try{
    if(typeof resumirRelatoPdf === 'function') resumirRelatoPdf = resumoMelhorado;
  }catch(e){ console.warn('Não foi possível substituir o resumidor do PDF:',e); }

  const mo = document.getElementById('mo');
  if(mo){
    mo.placeholder = 'Em 2 a 4 frases: o que aconteceu, motivo/contexto relevante e desfecho final. Sem nomes ou informações desnecessárias.';
    const nota = document.createElement('span');
    nota.className = 'nota';
    nota.textContent = 'Priorize o fato principal, o motivo quando for relevante e o resultado da atuação policial.';
    mo.insertAdjacentElement('afterend',nota);
  }

  try{
    if(typeof adicionarItemRecuperado === 'function'){
      adicionarItemRecuperado = function(dados = {}){
        const recipiente = document.getElementById('itensRecuperados');
        const bloco = document.createElement('div');
        bloco.className = 'item-estruturado recuperado';
        const situacao = inferirSituacao(dados);
        bloco.innerHTML = `<div class="campo"><label>Tipo do objeto/veículo</label><select data-item="tipo">${opcoesHtml(TIPOS_ITENS_RECUPERADOS,dados.tipo)}</select></div>`+
          `<div class="campo"><label>Situação *</label><select data-item="situacao"><option value="">Selecione</option><option value="RECUPERADO"${situacao==='RECUPERADO'?' selected':''}>RECUPERADO</option><option value="APREENDIDO"${situacao==='APREENDIDO'?' selected':''}>APREENDIDO</option></select></div>`+
          `<div class="campo"><label>Quantidade</label><input data-item="quantidade" type="number" min="1" value="${Number(dados.quantidade)||1}"></div>`+
          `<div class="campo"><label>Detalhes/observações</label><input data-item="detalhes" value="${escaparHtml(dados.detalhes||'')}" placeholder="Marca, modelo, cor, placa ou outra informação útil"></div>`+
          `<button class="remover-item" type="button" title="Remover este item" aria-label="Remover objeto ou veículo">×</button>`;
        bloco.querySelector('.remover-item').addEventListener('click',()=>{
          bloco.remove();
          atualizarListaVazia(recipiente,'Nenhum objeto ou veículo informado.');
          atualizarResumoVisualVeiculos();
        });
        bloco.querySelectorAll('select,input').forEach(el=>el.addEventListener('change',atualizarResumoVisualVeiculos));
        recipiente.appendChild(bloco);
        atualizarListaVazia(recipiente,'Nenhum objeto ou veículo informado.');
        atualizarResumoVisualVeiculos();
      };
    }

    if(typeof coletarItensRecuperados === 'function'){
      coletarItensRecuperados = function(){ return coletarItens('itensRecuperados',['tipo','situacao','quantidade','detalhes']); };
    }

    if(typeof sincronizarCamposLegadosEstruturados === 'function'){
      const sincronizarOriginal = sincronizarCamposLegadosEstruturados;
      sincronizarCamposLegadosEstruturados = function(){
        const resultado = sincronizarOriginal();
        atualizarResumoVisualVeiculos();
        return resultado;
      };
    }
  }catch(e){ console.warn('Não foi possível instalar a classificação recuperado/apreendido:',e); }

  const grupo = document.getElementById('itensRecuperados');
  if(grupo){
    grupo.addEventListener('change',atualizarResumoVisualVeiculos);
    atualizarResumoVisualVeiculos();
  }

  const form = document.getElementById('formOcorrencia');
  if(form){
    form.addEventListener('submit',function(evento){
      const blocos = Array.from(document.querySelectorAll('#itensRecuperados .item-estruturado.recuperado'));
      const semSituacao = blocos.find(bloco=>{
        const tipo = bloco.querySelector('[data-item="tipo"]')?.value;
        const situacao = bloco.querySelector('[data-item="situacao"]')?.value;
        return Boolean(tipo) && !situacao;
      });
      if(semSituacao && !new URLSearchParams(location.search).get('id')){
        evento.preventDefault();
        evento.stopImmediatePropagation();
        const select = semSituacao.querySelector('[data-item="situacao"]');
        select?.focus();
        alert('Informe se cada objeto ou veículo foi RECUPERADO ou APREENDIDO.');
        return;
      }
      atualizarResumoVisualVeiculos();
    },true);
  }
})();
