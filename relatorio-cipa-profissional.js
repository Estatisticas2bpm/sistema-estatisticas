/*
 * Relatório institucional de produtividade ambiental da CIPA/PMRR.
 * Identidade nominal: Companhia Independente de Policiamento Ambiental.
 * Os dados são extraídos do SIE-CPC; não são valores exemplificativos.
 * A insígnia específica da CIPA NÃO foi reproduzida sem fonte oficial.
 */
(function(){
  'use strict';
  const INSTITUICAO='COMPANHIA INDEPENDENTE DE POLICIAMENTO AMBIENTAL';
  const SIGLA='CIPA';
  const q=id=>document.getElementById(id);
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>{const r=Number(v);return Number.isFinite(r)?r:0;};
  const fmt=v=>n(v).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const real=v=>n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const ha=v=>fmt(v)+' ha';
  const data=v=>/^\d{4}-\d{2}-\d{2}/.test(String(v||''))?String(v).slice(0,10).split('-').reverse().join('/'):'Não informado';
  const dado=v=>String(v||'').trim()||'Não informado';
  const soma=(arr,key)=>(arr||[]).reduce((s,r)=>s+n(r[key]),0);
  const rank=(arr,key,limite=1000)=>{
    const m=new Map();
    (arr||[]).forEach(x=>{
      const v=typeof key==='function'?key(x):x[key];
      const k=dado(v);m.set(k,(m.get(k)||0)+1);
    });
    return [...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).slice(0,limite);
  };
  const rankQtd=(arr,key)=>{
    const m=new Map();
    (arr||[]).forEach(x=>{const k=dado(x[key]);m.set(k,(m.get(k)||0)+n(x.quantidade));});
    return [...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'));
  };
  const chunk=(arr,max)=>Array.from({length:Math.ceil(arr.length/max)},(_,i)=>arr.slice(i*max,(i+1)*max));
  const linha=(...valores)=>'<tr>'+valores.map(v=>'<td>'+h(v)+'</td>').join('')+'</tr>';
  const tabela=(cab,rows)=>{
    const corpo=rows.length?rows.join(''):'<tr><td class="center" colspan="'+cab.length+'">SEM REGISTROS DOCUMENTADOS NO PERÍODO</td></tr>';
    return '<table class="cipa-table"><thead><tr>'+cab.map(v=>'<th>'+h(v)+'</th>').join('')+'</tr></thead><tbody>'+corpo+'</tbody></table>';
  };
  const blocos=(campos)=>'<div class="cipa-kpis">'+campos.map(([rotulo,valor])=>'<div class="cipa-metrica"><strong>'+h(valor)+'</strong><span>'+h(rotulo)+'</span></div>').join('')+'</div>';
  const subtitulo=texto=>'<h3 class="cipa-subtitulo">'+h(texto)+'</h3>';
  const nota=texto=>'<p class="cipa-nota">'+h(texto)+'</p>';
  const fonte='Fonte: Sistema Integrado de Estatísticas do CPC (SIE-CPC) / CIPA. Período e datas conforme a metodologia deste relatório.';
  const secPag=(titulo,corpo,key,periodo)=>{
    return '<section class="page cipa-page"'+(key?' data-section="'+h(key)+'"':'')+'>'+
      '<div class="internal-head">'+h(periodo.titulo)+'<br>POLÍCIA MILITAR DE RORAIMA · '+INSTITUICAO+' — CIPA</div>'+
      '<h2 class="title cipa-titulo">'+h(titulo)+'</h2>'+corpo+
      '<div class="footer"></div></section>';
  };
  const linhasRank=(lista)=>lista.map((v,i)=>linha(i+1,v[0],fmt(v[1])));
  const comparacao=(a,b)=>{
    if(!b)return a?'Novo registro':'Sem alteração';
    const v=100*(a-b)/b;
    return (v>0?'+':'')+v.toFixed(1).replace('.',',')+'%';
  };
  const mesKey=d=>/^\d{4}-\d{2}/.test(String(d||''))?String(d).slice(0,7):'';
  const mesBr=v=>/^\d{4}-\d{2}$/.test(v)?v.slice(5,7)+'/'+v.slice(0,4):v;
  async function paginar(db,tabela,coluna,ini,fim,campos='*'){
    const saida=[],passo=1000;
    for(let offset=0;;offset+=passo){
      const res=await db.from(tabela).select(campos).gte(coluna,ini).lte(coluna,fim)
        .order('id',{ascending:true}).range(offset,offset+passo-1);
      if(res.error)throw Error('Falha ao ler '+tabela+': '+res.error.message);
      const bloco=res.data||[];saida.push(...bloco);
      if(bloco.length<passo)break;
      if(offset>199000)throw Error('Consulta muito extensa: reduza o período para gerar o relatório.');
    }
    return saida;
  }
  function tabelaDetalhada(pages,periodo,numero,titulo,key,arr,cab,descrever,perPage=18){
    if(!arr.length)return;
    chunk(arr,perPage).forEach((parte,idx)=>{
      const cabecalho=idx?' (CONTINUAÇÃO '+(idx+1)+')':'';
      const corpo=tabela(cab,parte.map(descrever))+
        nota('Relação documental vinculada às informações estatísticas do período. Campos não informados permanecem identificados como tal.');
      pages.push(secPag(numero+'. '+titulo+cabecalho,corpo,idx?'':key,periodo));
    });
  }
  async function obterTdbas(db,ids){
    if(!ids.length)return [];
    // TDBA sem data própria: apurado pelos PPEs cuja data consta do período.
    const saida=[];
    for(const lote of chunk([...new Set(ids)],150)){
      const r=await db.from('cipa_tdba').select('*').in('ocorrencia_id',lote);
      if(r.error)throw Error('Falha ao consultar TDBA: '+r.error.message);
      saida.push(...(r.data||[]));
    }
    return saida;
  }
  function partesAno(inicio,fim){
    const a=new Date(inicio+'T12:00:00'),b=new Date(fim+'T12:00:00');
    if(!Number.isFinite(a.valueOf())||!Number.isFinite(b.valueOf()))return [];
    const out=[],cursor=new Date(a.getFullYear(),a.getMonth(),1);
    while(cursor<=b&&out.length<240){out.push(cursor.getFullYear()+'-'+String(cursor.getMonth()+1).padStart(2,'0'));cursor.setMonth(cursor.getMonth()+1);}
    return out;
  }
  function resumoQualidade(dados){
    const linhas=[
      ['Ocorrências sem município',dados.oc.filter(o=>!String(o.municipio||'').trim()).length],
      ['Ocorrências sem origem do acionamento',dados.oc.filter(o=>!String(o.cipa_origem_atuacao||'').trim()).length],
      ['Registros de fauna sem procedimento',dados.fauna.filter(o=>!String(o.procedimento||'').trim()).length],
      ['Registros de fauna sem destinação',dados.fauna.filter(o=>!String(o.destinacao||'').trim()).length],
      ['Autos sem valor de multa informado',dados.autos.filter(o=>o.valor_multa===null||o.valor_multa===undefined).length],
      ['Autos sem área desmatada constatada',dados.autos.filter(o=>o.area_desmatada_constatada_ha===null||o.area_desmatada_constatada_ha===undefined).length]
    ];
    return tabela(['VERIFICAÇÃO DE COMPLETUDE','REGISTROS'],linhas.map(x=>linha(x[0],fmt(x[1]))));
  }
  window.buildRelatorioCipa=async function(){
    const inicio=q('ini')?.value||'',fim=q('fim')?.value||'';
    if(!inicio||!fim||inicio>fim){q('document').innerHTML='<div class="notice">Selecione um intervalo de datas válido.</div>';return;}
    const db=window.SistemaAuth?.client||window.db;
    const periodo=window.periodoRelatorio(inicio,fim),comparado=window.comparisonRange();
    q('document').innerHTML='<div class="notice">Consolidando produtividade ambiental da CIPA...</div>';
    try{
      const [
        rOc,rAnterior,rTco,rTcoAnterior,
        autos,autosAnt,embargos,embargosAnt,notif,fauna,faunaAnt,educacao,eduAnt
      ]=await Promise.all([
        db.rpc('obter_dados_dashboard_territorial',{data_inicio:inicio,data_fim:fim}),
        db.rpc('obter_dados_dashboard_territorial',{data_inicio:comparado[0],data_fim:comparado[1]}),
        db.rpc('obter_tcos_dashboard_territorial',{data_inicio:inicio,data_fim:fim}),
        db.rpc('obter_tcos_dashboard_territorial',{data_inicio:comparado[0],data_fim:comparado[1]}),
        paginar(db,'cipa_autos_infracao','data_autuacao',inicio,fim,
          'id,ocorrencia_id,numero,data_autuacao,tipo_sancao,tipo_infracao,descricao_infracao,valor_multa,area_embargada_ha,area_desmatada_constatada_ha'),
        paginar(db,'cipa_autos_infracao','data_autuacao',comparado[0],comparado[1],
          'id,ocorrencia_id,numero,data_autuacao,tipo_sancao,tipo_infracao,descricao_infracao,valor_multa,area_embargada_ha,area_desmatada_constatada_ha'),
        paginar(db,'cipa_termos_embargo','data_embargo',inicio,fim,
          'id,ocorrencia_id,numero,data_embargo,auto_infracao_originario,area_embargada_ha'),
        paginar(db,'cipa_termos_embargo','data_embargo',comparado[0],comparado[1],
          'id,ocorrencia_id,numero,data_embargo,area_embargada_ha'),
        paginar(db,'cipa_autos_notificacao','data_notificacao',inicio,fim,
          'id,ocorrencia_id,numero,data_notificacao,descricao'),
        paginar(db,'cipa_fauna','data_registro',inicio,fim,
          'id,ocorrencia_id,numero_tr,data_registro,nome_comum,nome_cientifico,quantidade,procedimento,destinacao'),
        paginar(db,'cipa_fauna','data_registro',comparado[0],comparado[1],'id,quantidade'),
        paginar(db,'cipa_educacao_ambiental','data_acao',inicio,fim,
          'id,ocorrencia_id,data_acao,acao,local_acao,publico_estimado'),
        paginar(db,'cipa_educacao_ambiental','data_acao',comparado[0],comparado[1],
          'id,publico_estimado')
      ]);
      for(const ret of [rOc,rAnterior,rTco,rTcoAnterior])if(ret.error)throw Error(ret.error.message);
      const oc=rOc.data||[],ocAnt=rAnterior.data||[];
      const tcos=rTco.data||[],tcoAnt=rTcoAnterior.data||[];
      const tdbas=await obterTdbas(db,oc.map(x=>x.id).filter(Boolean));
      const totalAnimais=soma(fauna,'quantidade');
      const hectares=soma(embargos,'area_embargada_ha');
      const multas=soma(autos,'valor_multa');
      const desmatadas=autos.filter(x=>x.area_desmatada_constatada_ha!==null&&x.area_desmatada_constatada_ha!==undefined);
      const hectaresDesmatados=desmatadas.length?soma(desmatadas,'area_desmatada_constatada_ha'):null;
      const animaisAnt=soma(faunaAnt,'quantidade'),multasAnt=soma(autosAnt,'valor_multa');
      const resTco=[...new Set(tcos.map(x=>String(x.numero_tco||x.id||'').trim()).filter(Boolean))].length;
      const docsDistintos=(arr,key)=>new Set(arr.map(x=>String(x[key]||'').trim())
        .filter(v=>v&&!/^(?:-|S\/?N|N\/?I|NI|SEM N[ÚU]MERO|NÃO INFORMADO)$/i.test(v))).size;
      const totalTR=docsDistintos(fauna,'numero_tr');
      const qMes=partesAno(inicio,fim);
      const ocorrenciasPorMes=new Map(),autosPorMes=new Map(),embargosPorMes=new Map(),faunaPorMes=new Map();
      for(const x of oc){const k=mesKey(x.data_ocorrencia);if(k)ocorrenciasPorMes.set(k,(ocorrenciasPorMes.get(k)||0)+1)}
      for(const x of autos){const k=mesKey(x.data_autuacao);if(k){const y=autosPorMes.get(k)||{q:0,m:0};y.q++;y.m+=n(x.valor_multa);autosPorMes.set(k,y)}}
      for(const x of embargos){const k=mesKey(x.data_embargo);if(k){const y=embargosPorMes.get(k)||{q:0,a:0};y.q++;y.a+=n(x.area_embargada_ha);embargosPorMes.set(k,y)}}
      for(const x of fauna){const k=mesKey(x.data_registro);if(k)faunaPorMes.set(k,(faunaPorMes.get(k)||0)+n(x.quantidade))}
      const origem=rank(oc,'cipa_origem_atuacao'),natureza=rank(oc,x=>x.ocorrencia||x.crime),municipios=rank(oc,'municipio'),areas=rank(oc,'cipa_area_tipo');
      const autTipos=rank(autos,x=>x.tipo_infracao||x.descricao_infracao),sancoes=rank(autos,'tipo_sancao');
      const especies=rankQtd(fauna,'nome_comum'),procedimentos=rankQtd(fauna,'procedimento'),destinos=rankQtd(fauna,'destinacao');
      const valorMultasPorTipo=new Map();
      for(const a of autos){const k=dado(a.tipo_infracao||a.descricao_infracao),v=valorMultasPorTipo.get(k)||{q:0,total:0};v.q++;v.total+=n(a.valor_multa);valorMultasPorTipo.set(k,v);}
      const multaPorTipo=[...valorMultasPorTipo].sort((a,b)=>b[1].total-a[1].total);
      const pages=[];
      // Capa: símbolo oficial PMRR na esquerda; identificação textual CIPA
      // no lado direito até a disponibilização de insígnia oficial verificável.
      const cover='<section class="page cover cipa-capa" data-section="cover">'+
        '<div class="cover-top cipa-cover-head"><img src="brasao-pmrr.png" alt="Brasão da Polícia Militar de Roraima">'+
        '<div>ESTADO DE RORAIMA<br>POLÍCIA MILITAR DE RORAIMA<br>COMANDO DE POLICIAMENTO DA CAPITAL - CPC<br>'+
        INSTITUICAO+' - CIPA<br>“Amazônia: Patrimônio dos Brasileiros”</div>'+
        '<div class="cipa-cover-identificacao" aria-label="Identificação textual da unidade CIPA"><span>CIPA</span><small>POLICIAMENTO<br>AMBIENTAL</small></div></div>'+
        '<div class="cover-title cipa-cover-title"><div class="cipa-cover-linha"></div>'+
        '<h1>RELATÓRIO DE PRODUTIVIDADE E ESTATÍSTICAS AMBIENTAIS</h1>'+
        '<h2>'+h(periodo.titulo)+'</h2><p>COMPANHIA INDEPENDENTE DE POLICIAMENTO AMBIENTAL</p>'+
        '<div class="cipa-cover-linha"></div></div>'+
        '<div class="cover-bottom">BOA VISTA - RR<br>'+h(periodo.anos)+'</div></section>';
      pages.push(cover);
      const sumario=[
        ['1. APRESENTAÇÃO E SÍNTESE EXECUTIVA','cipa-executivo'],
        ['2. OCORRÊNCIAS E PERFIL OPERACIONAL','cipa-ocorrencias'],
        ['3. DISTRIBUIÇÃO TERRITORIAL','cipa-territorio'],
        ['4. EVOLUÇÃO MENSAL DA PRODUTIVIDADE','cipa-evolucao'],
        ['5. AUTOS DE INFRAÇÃO E MULTAS','cipa-autos'],
        ['6. EMBARGOS E NOTIFICAÇÕES','cipa-embargos'],
        ['7. FAUNA: ESPÉCIES E DESTINAÇÃO','cipa-fauna'],
        ['8. EDUCAÇÃO AMBIENTAL','cipa-educacao'],
        ['9. DOCUMENTOS E PROCEDIMENTOS','cipa-documentos'],
        ['10. ANÁLISE COMPARATIVA E LEITURA GERENCIAL','cipa-comparativo'],
        ['11. METODOLOGIA, LIMITAÇÕES E VALIDAÇÃO','cipa-metodologia'],
        ['ANEXO A. AUTOS DE INFRAÇÃO','cipa-anexo-auto'],
        ['ANEXO B. TERMOS DE EMBARGO','cipa-anexo-embargo'],
        ['ANEXO C. AUTOS DE NOTIFICAÇÃO','cipa-anexo-notifica'],
        ['ANEXO D. FAUNA E EDUCAÇÃO AMBIENTAL','cipa-anexo-fauna'],
        ['ANEXO E. TERMOS CIRCUNSTANCIADOS','cipa-anexo-tco']
      ];
      const anexosDisponiveis={
        'cipa-anexo-auto':autos.length>0,
        'cipa-anexo-embargo':embargos.length>0,
        'cipa-anexo-notifica':notif.length>0,
        'cipa-anexo-fauna':fauna.length>0||educacao.length>0,
        'cipa-anexo-tco':tcos.length>0
      };
      const indiceSumario=sumario.filter(([,id])=>!(id in anexosDisponiveis)||anexosDisponiveis[id]);
      pages.push(secPag('SUMÁRIO',
        '<ol class="cipa-toc">'+indiceSumario.map(x=>'<li><span>'+h(x[0])+'</span><span class="dots"></span><strong data-toc-target="'+h(x[1])+'">-</strong></li>').join('')+'</ol>'+
        nota('Os anexos são exibidos quando houver documentos cadastrados no período. A numeração será atualizada após a composição final das páginas.'),'summary',periodo));
      const resumoTexto=oc.length
        ?'Foram registrados '+fmt(oc.length)+' PPE(s)/BO(s) no intervalo informado. A fiscalização produziu '+fmt(autos.length)+' Auto(s) de Infração e '+fmt(embargos.length)+' termo(s) de embargo. O conjunto inclui '+fmt(totalAnimais)+' animal(is) registrado(s) em fauna. Os totais de fauna, multas, embargos e PPEs medem dimensões distintas da atividade e não devem ser somados.'
        :'Não há PPEs/BOs da CIPA na base consultada neste intervalo. Os dados dos documentos especializados são apresentados somente quando existem registros com datas próprias dentro do período, sem inferir ocorrências não cadastradas.';
      pages.push(secPag('1. APRESENTAÇÃO E SÍNTESE EXECUTIVA',
        '<p class="cipa-paragrafo">O presente relatório consolida os resultados operacionais e administrativos registrados pela Companhia Independente de Policiamento Ambiental (CIPA), com ênfase na atuação ostensiva ambiental, medidas administrativas, fauna e atividades preventivas.</p>'+
        blocos([['PPEs/BOs',fmt(oc.length)],['Autos de Infração',fmt(autos.length)],
          ['Multas aplicadas',real(multas)],['Termos de embargo',fmt(embargos.length)],
          ['Área embargada',ha(hectares)],['Desmatamento constatado',hectaresDesmatados===null?'Não informado':ha(hectaresDesmatados)],
          ['Animais registrados',fmt(totalAnimais)],['Ações educativas',fmt(educacao.length)]])+
        subtitulo('Leitura executiva')+'<p class="cipa-paragrafo">'+h(resumoTexto)+'</p>'+
        nota('Multas aplicadas correspondem ao valor lançado nos autos, não ao valor efetivamente recolhido. Desmatamento e embargo são indicadores independentes.')+
        '<p class="source">'+h(fonte)+'</p>','cipa-executivo',periodo));
      pages.push(secPag('2. OCORRÊNCIAS E PERFIL OPERACIONAL',
        blocos([['PPEs/BOs',fmt(oc.length)],['Atuação rural',fmt((areas.find(x=>x[0]==='RURAL')||[])[1])],
          ['Atuação urbana',fmt((areas.find(x=>x[0]==='URBANA')||[])[1])],
          ['Municípios distintos',fmt(municipios.filter(x=>x[0]!=='Não informado').length)]])+
        subtitulo('Naturezas mais registradas')+
        tabela(['ORDEM','NATUREZA DA OCORRÊNCIA','PPEs'],linhasRank(natureza.slice(0,17)))+
        subtitulo('Origem do acionamento e operação')+
        tabela(['ORDEM','ORIGEM','PPEs'],linhasRank(origem.slice(0,9)))+
        nota('Uma ocorrência é contada uma vez no total de PPEs/BOs. A origem é diferente do documento formal que determinou a missão.'),'cipa-ocorrencias',periodo));
      pages.push(secPag('3. DISTRIBUIÇÃO TERRITORIAL',
        subtitulo('Produtividade por município')+
        tabela(['ORDEM','MUNICÍPIO','PPEs'],linhasRank(municipios.slice(0,22)))+
        subtitulo('Classificação urbano/rural')+
        tabela(['ÁREA','PPEs'],areas.map(x=>linha(x[0],fmt(x[1]))))+
        nota('O campo município é associado ao PPE; a distribuição não substitui a análise espacial dos locais com coordenadas GPS.'),'cipa-territorio',periodo));
      const series=qMes.map(k=>{
        const a=autosPorMes.get(k)||{},b=embargosPorMes.get(k)||{};
        return [mesBr(k),fmt(ocorrenciasPorMes.get(k)||0),fmt(a.q||0),real(a.m||0),fmt(b.q||0),ha(b.a||0),fmt(faunaPorMes.get(k)||0)];
      });
      chunk(series,12).forEach((grupo,i)=>pages.push(secPag('4. EVOLUÇÃO MENSAL DA PRODUTIVIDADE'+(i?' — CONTINUAÇÃO':''),
        tabela(['MÊS','PPEs','AUTOS','MULTAS (R$)','EMBARGOS','ÁREA (HA)','ANIMAIS'],grupo.map(x=>linha(...x)))+
        nota('PPEs por data da ocorrência; autos por data de autuação; embargos por data do termo; fauna por data do respectivo registro. Em meses distintos, o mesmo PPE pode originar documentos lavrados posteriormente.'),
        i?'':'cipa-evolucao',periodo)));
      pages.push(secPag('5. AUTOS DE INFRAÇÃO E MULTAS',
        blocos([['Autos de Infração',fmt(autos.length)],['Valor total aplicado',real(multas)],
          ['Autos com área desmatada informada',fmt(desmatadas.length)],['Desmatamento constatado',hectaresDesmatados===null?'Não informado':ha(hectaresDesmatados)]])+
        subtitulo('Infração administrativa e valor')+
        tabela(['TIPO DA INFRAÇÃO','AUTOS','VALOR DAS MULTAS'],multaPorTipo.slice(0,16).map(x=>linha(x[0],fmt(x[1].q),real(x[1].total))))+
        subtitulo('Sanções registradas')+
        tabela(['SANÇÃO','AUTOS'],sancoes.slice(0,11).map(x=>linha(x[0],fmt(x[1]))))+
        nota('Área desmatada é apurada exclusivamente nos autos que contêm medição específica. Ausência de preenchimento não é considerada zero. O relatório não atesta pagamento ou trânsito definitivo de multa.'),
        'cipa-autos',periodo));
      pages.push(secPag('6. EMBARGOS E NOTIFICAÇÕES',
        blocos([['Termos de embargo',fmt(embargos.length)],['Área efetivamente embargada',ha(hectares)],
          ['Autos de notificação',fmt(notif.length)]])+
        subtitulo('Situação dos documentos no período')+
        tabela(['INSTRUMENTO ADMINISTRATIVO','QUANTIDADE','OBSERVAÇÃO'],[
          linha('Termo de embargo',fmt(embargos.length),'Contabilizado pelo documento lavrado'),
          linha('Auto de notificação',fmt(notif.length),'Documento de notificação, sem presumir sanção'),
          linha('Auto de Infração',fmt(autos.length),'Documento distinto do termo de embargo')
        ])+
        subtitulo('Área embargada por documento')+
        tabela(['TERMO','DATA','ÁREA (HA)'],embargos.slice(0,14).map(x=>linha(x.numero,data(x.data_embargo),fmt(x.area_embargada_ha))))+
        nota('A área embargada é somada por termo de embargo e pode haver sobreposição espacial entre termos. A soma representa as áreas documentadas, não necessariamente hectares territoriais únicos.'),
        'cipa-embargos',periodo));
      pages.push(secPag('7. FAUNA: ESPÉCIES E DESTINAÇÃO',
        blocos([['Animais documentados',fmt(totalAnimais)],['Registros de fauna',fmt(fauna.length)],
          ['Espécies/nome popular',fmt(especies.filter(x=>x[0]!=='Não informado').length)],
          ['TRs distintos registrados',fmt(totalTR)]])+
        subtitulo('Espécies mais registradas')+
        tabela(['ANIMAL','INDIVÍDUOS'],especies.slice(0,12).map(x=>linha(x[0],fmt(x[1]))))+
        subtitulo('Procedimentos relacionados à fauna')+
        tabela(['PROCEDIMENTO','ANIMAIS'],procedimentos.slice(0,8).map(x=>linha(x[0],fmt(x[1]))))+
        subtitulo('Destinação / custódia dos animais')+
        tabela(['DESTINAÇÃO','ANIMAIS'],destinos.slice(0,8).map(x=>linha(x[0],fmt(x[1]))))+
        nota('Procedimento e destinação classificam os mesmos animais: não se somam os totais de ambas as tabelas. Apreensão não deve ser interpretada automaticamente como resgate, remoção, entrega ao CETAS ou soltura.'),
        'cipa-fauna',periodo));
      const eduTipos=rank(educacao,'acao',13),eduLocais=rank(educacao,'local_acao',12);
      pages.push(secPag('8. EDUCAÇÃO AMBIENTAL',
        blocos([['Ações realizadas',fmt(educacao.length)],['Público estimado',fmt(soma(educacao,'publico_estimado'))],
          ['Locais registrados',fmt(eduLocais.filter(x=>x[0]!=='Não informado').length)]])+
        subtitulo('Ações por tipo')+
        tabela(['ATIVIDADE','QUANTIDADE'],eduTipos.map(x=>linha(x[0],fmt(x[1]))))+
        subtitulo('Locais de atuação')+
        tabela(['LOCAL','AÇÕES'],eduLocais.map(x=>linha(x[0],fmt(x[1]))))+
        nota('Público estimado equivale à soma das estimativas por ação. Se uma mesma pessoa participou de atividades diferentes, pode estar representada em mais de um evento.'),
        'cipa-educacao',periodo));
      pages.push(secPag('9. DOCUMENTOS E PROCEDIMENTOS',
        blocos([['TCOs vinculados',fmt(resTco)],['TDBAs dos PPEs',fmt(tdbas.length)],
          ['TRs distintos informados',fmt(totalTR)],['Autos de Notificação',fmt(notif.length)]])+
        subtitulo('Documentos vinculados à produtividade')+
        tabela(['DOCUMENTO','QUANTIDADE','CRITÉRIO'],[
          linha('PPE / BO',fmt(oc.length),'Data da ocorrência'),
          linha('TCO',fmt(resTco),'Data do TCO no cadastro geral; vínculo ao BO/PPE'),
          linha('Auto de Infração',fmt(autos.length),'Data do Auto'),
          linha('Termo de Embargo',fmt(embargos.length),'Data do Termo'),
          linha('Auto de Notificação',fmt(notif.length),'Data da Notificação'),
          linha('TR de fauna',fmt(totalTR),'Referências distintas informadas nos registros de fauna'),
          linha('TDBA',fmt(tdbas.length),'Documento associado aos PPEs do período')
        ])+
        nota('Um PPE pode possuir diversos documentos administrativos. Cada instrumento é apurado separadamente, evitando duplicação de ocorrências ou de animais. O TCO não é uma modalidade ambiental própria.'),
        'cipa-documentos',periodo));
      const linhasComparativo=[
        ['PPE / BO',oc.length,ocAnt.length,'n'],
        ['Autos de Infração',autos.length,autosAnt.length,'n'],
        ['Multas aplicadas',multas,multasAnt,'moeda'],
        ['Termos de embargo',embargos.length,embargosAnt.length,'n'],
        ['Área embargada (ha)',hectares,soma(embargosAnt,'area_embargada_ha'),'ha'],
        ['Animais documentados',totalAnimais,animaisAnt,'n'],
        ['Ações educativas',educacao.length,eduAnt.length,'n'],
        ['Público estimado',soma(educacao,'publico_estimado'),soma(eduAnt,'publico_estimado'),'n'],
        ['TCOs cadastrados',resTco,[...new Set(tcoAnt.map(x=>String(x.numero_tco||x.id||'').trim()).filter(Boolean))].length,'n']
      ];
      const linhaComparar=([nome,a,b,formato])=>linha(nome,formato==='moeda'?real(a):formato==='ha'?ha(a):fmt(a),formato==='moeda'?real(b):formato==='ha'?ha(b):fmt(b),comparacao(a,b));
      pages.push(secPag('10. ANÁLISE COMPARATIVA E LEITURA GERENCIAL',
        '<p class="cipa-paragrafo"><b>Período atual:</b> '+data(inicio)+' a '+data(fim)+
        ' &nbsp; <b>Referência comparativa:</b> '+data(comparado[0])+' a '+data(comparado[1])+'</p>'+
        tabela(['INDICADOR','ATUAL','COMPARADO','VARIAÇÃO'],linhasComparativo.map(linhaComparar))+
        subtitulo('Síntese objetiva')+
        '<p class="cipa-paragrafo">A produtividade do período contempla '+fmt(oc.length)+' PPE(s), '+fmt(autos.length)+' auto(s) de infração, '+fmt(embargos.length)+' termo(s) de embargo e '+fmt(educacao.length)+' ação(ões) educativas. O desempenho deve ser analisado juntamente com a cobertura territorial, o perfil das ocorrências e as condições operacionais do período, sem inferir causalidade apenas a partir dos números.</p>'+
        nota('Variação percentual compara indicadores da mesma natureza e períodos de referência definidos no filtro. Resultados sem base anterior são classificados como novo registro.'),
        'cipa-comparativo',periodo));
      pages.push(secPag('11. METODOLOGIA, LIMITAÇÕES E VALIDAÇÃO',
        subtitulo('Regras de apuração')+
        '<div class="cipa-metodologia"><p><b>PPEs/BOs:</b> contados segundo data da ocorrência gravada no SIE-CPC; a data do fato e a elaboração do PPE podem ser diferentes.</p>'+
        '<p><b>Autos e multas:</b> apurados pela data de autuação; valores representam multas aplicadas, não arrecadação.</p>'+
        '<p><b>Embargos:</b> contabilizados pelo termo e sua data; área embargada não corresponde automaticamente à área desmatada, e áreas de termos diferentes podem se sobrepor.</p>'+
        '<p><b>Desmatamento constatado:</b> usa exclusivamente a área informada no Auto de Infração; registros sem área não são tratados como zero.</p>'+
        '<p><b>Fauna:</b> quantidade total de animais é distinta de número de PPEs e registros de espécie; procedimento e destinação são dimensões da mesma quantidade.</p>'+
        '<p><b>TCOs:</b> consultados na estrutura geral de TCOs vinculados, sem registros duplicados em módulo ambiental.</p>'+
        '<p><b>Educação ambiental:</b> público representa participantes estimados por evento, sem deduplicação de pessoas entre eventos.</p>'+
        '<p><b>Abrangência:</b> somente registros disponíveis e autorizados ao usuário no SIE-CPC no momento da consulta; o documento não substitui validação dos autos e anexos originais.</p></div>'+
        subtitulo('Completude dos dados cadastrados')+
        resumoQualidade({oc,autos,fauna})+
        nota('Campos “Não informado” preservam a ausência de evidência no cadastro. O relatório é estatístico e não constitui certidão administrativa, laudo ambiental nem demonstração contábil.')+
        '<div class="signature cipa-assinatura">Boa Vista/RR, '+new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})+'.<br><br><br>'+
        '<b>RESPONSÁVEL PELA ELABORAÇÃO</b><br>'+window.assinaturaResponsavelRelatorio('Seção de Estatística - CIPA')+'</div>'+
        '<p class="source">'+h(fonte)+'</p>',
        'cipa-metodologia',periodo));
      // Anexos: sem nomes de autuados, sem expor dados de pessoas envolvidas.
      tabelaDetalhada(pages,periodo,'ANEXO A','AUTOS DE INFRAÇÃO','cipa-anexo-auto',autos,
        ['Nº AUTO','DATA','TIPO','MULTA (R$)','DESM. (HA)'],
        x=>linha(x.numero,data(x.data_autuacao),x.tipo_infracao||'Não informado',real(x.valor_multa),
          x.area_desmatada_constatada_ha===null||x.area_desmatada_constatada_ha===undefined?'Não informado':fmt(x.area_desmatada_constatada_ha)),16);
      tabelaDetalhada(pages,periodo,'ANEXO B','TERMOS DE EMBARGO','cipa-anexo-embargo',embargos,
        ['Nº TERMO','DATA','AUTO ORIGINÁRIO','ÁREA (HA)'],
        x=>linha(x.numero,data(x.data_embargo),x.auto_infracao_originario||'Não informado',fmt(x.area_embargada_ha)),17);
      tabelaDetalhada(pages,periodo,'ANEXO C','AUTOS DE NOTIFICAÇÃO','cipa-anexo-notifica',notif,
        ['Nº NOTIFICAÇÃO','DATA','DESCRIÇÃO RESUMIDA'],
        x=>linha(x.numero,data(x.data_notificacao),String(x.descricao||'Não informado').slice(0,110)),17);
      const faunaAnexo=fauna.map(x=>({...x,_grupo:'FAUNA'}));
      const eduAnexo=educacao.map(x=>({...x,_grupo:'EDUCAÇÃO'}));
      if(faunaAnexo.length||eduAnexo.length){
        const partesFauna=chunk(faunaAnexo,17),partesEdu=chunk(eduAnexo,17);
        let primeira=true;
        for(const bloco of partesFauna){
          pages.push(secPag('ANEXO D. REGISTROS DE FAUNA'+(primeira?'':' — CONTINUAÇÃO'),
            tabela(['ANIMAL','QUANTIDADE','PROCEDIMENTO','DESTINAÇÃO','TR'],bloco.map(x=>
              linha(x.nome_comum,fmt(x.quantidade),x.procedimento||'Não informado',x.destinacao||'Não informado',x.numero_tr||'Não informado'))),
            primeira?'cipa-anexo-fauna':'',periodo));primeira=false;
        }
        for(const bloco of partesEdu){
          pages.push(secPag('ANEXO D. AÇÕES DE EDUCAÇÃO AMBIENTAL'+(primeira?'':' — CONTINUAÇÃO'),
            tabela(['DATA','AÇÃO','LOCAL','PÚBLICO'],bloco.map(x=>
              linha(data(x.data_acao),x.acao,x.local_acao,fmt(x.publico_estimado)))),
            primeira?'cipa-anexo-fauna':'',periodo));primeira=false;
        }
      }
      tabelaDetalhada(pages,periodo,'ANEXO E','TERMOS CIRCUNSTANCIADOS','cipa-anexo-tco',tcos,
        ['Nº TCO','DATA','Nº PPE / BO'],x=>linha(x.numero_tco||'Não informado',
          data(x.data_tco),x.numero_bo||x.numero_bo_origem||'Conferir vínculo no cadastro'),20);
      q('document').classList.add('cipa-report');
      q('document').innerHTML=pages.join('');
      document.title='CIPA - RELATÓRIO DE PRODUTIVIDADE AMBIENTAL - '+periodo.arquivo;
      window.atualizarSumarioRelatorio();
      window.finalizarLayoutRelatorio();
      requestAnimationFrame(()=>{window.finalizarLayoutRelatorio()});
    }catch(err){
      console.error('Falha ao gerar relatório institucional da CIPA',err);
      q('document').innerHTML='<div class="notice">Não foi possível gerar o relatório da CIPA: '+h(err.message||err)+'</div>';
    }
  };
})();
