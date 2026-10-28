/* SIE-CPC — Visualização em janela ampliada para ocorrências dos mapas.
 * Usa leitura autenticada da tabela ocorrencias, sujeita às políticas RLS.
 * Sem edição, sem download e sem exposição prévia dos detalhes no HTML dos marcadores.
 */
(function(global){
  'use strict';
  const campos=[
    ['numero_bo','Número do BO'],['tipo_registro','Documento'],['data_ocorrencia','Data da ocorrência'],
    ['hora_inicial','Hora'],['ocorrencia','Ocorrência'],['crime','Tipificação'],
    ['historico_resumido','Histórico resumido'],
    ['status_atendimento','Situação'],['municipio','Município'],['bairro','Bairro'],
    ['endereco','Endereço'],['companhia','Companhia'],['sisc','SISC'],
    ['turno','Turno'],['comandante','Comandante da viatura'],['vtr','Viatura'],
    ['numero_prisoes','Prisões'],['numero_conduzidos','Conduzidos'],
    ['auto_resistencia','Auto de resistência/prisão'],
    ['auto_resistencia_resultou_morte','Auto de resistência com resultado morte'],
    ['origem_ocorrencia','Origem da ocorrência — BOPE'],
    ['origem_ocorrencia_detalhe','Detalhes da origem — BOPE'],
    ['latitude','Latitude GPS'],['longitude','Longitude GPS']
  ];
  const opcionais=new Set([
    'origem_ocorrencia','origem_ocorrencia_detalhe',
    'auto_resistencia_resultou_morte','latitude','longitude'
  ]);
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let janela=null,corpo=null,subtitulo=null,sequencia=0;
  function preparar(){
    if(janela)return;
    const estilo=document.createElement('style');
    estilo.textContent=[
      '.sieOcDetalheModal{box-sizing:border-box;width:min(870px,95vw);max-width:95vw;max-height:90dvh;margin:auto;padding:0;border:1px solid #b9cadb;border-radius:16px;background:#fff;color:#182d40;box-shadow:0 24px 70px #04182c70;overflow:hidden}',
      '.sieOcDetalheModal::backdrop{background:rgba(4,20,37,.76)}',
      '.sieOcDetalheModal .sieOcTopo{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:20px 24px;background:linear-gradient(120deg,#071b33,#145277);color:white}',
      '.sieOcDetalheModal .sieOcTopo h2{margin:3px 0 0;font-size:21px;color:white}',
      '.sieOcDetalheModal .sieOcTopo p{margin:5px 0 0;color:#d4e5f1;font-size:12px;line-height:1.5}',
      '.sieOcDetalheModal .sieOcFechar{border:1px solid #d3e2eb;border-radius:9px;background:white;color:#154261;font-weight:800;min-width:88px;cursor:pointer;padding:10px 13px}',
      '.sieOcDetalheModal .sieOcConteudo{max-height:calc(90dvh - 112px);overflow:auto;padding:20px 24px;overscroll-behavior:contain}',
      '.sieOcDetalheModal .sieOcGrade{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}',
      '.sieOcDetalheModal .sieOcCampo{min-width:0;border:1px solid #e0e8f1;border-radius:9px;padding:11px 13px;background:#f7fafc}',
      '.sieOcDetalheModal .sieOcCampo b{display:block;margin-bottom:5px;color:#567086;font-size:10px;text-transform:uppercase;letter-spacing:.4px}',
      '.sieOcDetalheModal .sieOcCampo span{display:block;font-size:13px;line-height:1.6;color:#152f45;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.sieOcDetalheModal .sieOcHistorico{grid-column:1/-1;border-color:#bfd8eb;background:#f1f7fc}',
      '.sieOcDetalheModal .sieOcHistorico span{font-size:14px;line-height:1.75}',
      '.sieOcDetalheModal .sieOcAviso{padding:16px;border-radius:9px;background:#f1f7fc;color:#214f70;line-height:1.6;font-size:13px}',
      '@media(max-width:610px){.sieOcDetalheModal{width:100vw;max-width:100vw;max-height:100dvh;border-radius:0}.sieOcDetalheModal .sieOcTopo{padding:16px}.sieOcDetalheModal .sieOcTopo h2{font-size:17px}.sieOcDetalheModal .sieOcConteudo{padding:12px;max-height:calc(100dvh - 95px)}.sieOcDetalheModal .sieOcGrade{grid-template-columns:1fr}.sieOcDetalheModal .sieOcHistorico{grid-column:1}.sieOcDetalheModal .sieOcFechar{min-width:68px;padding:9px}}'
    ].join('\n');
    document.head.appendChild(estilo);
    janela=document.createElement('dialog');
    janela.className='sieOcDetalheModal';
    janela.setAttribute('aria-labelledby','sieOcTitulo');
    janela.innerHTML='<div class="sieOcTopo"><div><h2 id="sieOcTitulo">Visualizar ocorrência</h2><p id="sieOcSubtitulo">Consulta somente leitura · dados autorizados</p></div><button type="button" class="sieOcFechar">Fechar</button></div><div class="sieOcConteudo" id="sieOcConteudo" role="status" aria-live="polite"></div>';
    document.body.appendChild(janela);
    corpo=janela.querySelector('#sieOcConteudo');
    subtitulo=janela.querySelector('#sieOcSubtitulo');
    janela.querySelector('.sieOcFechar').addEventListener('click',()=>janela.close());
    janela.addEventListener('close',()=>{sequencia++;});
  }
  function aviso(mensagem){
    corpo.replaceChildren();
    const p=document.createElement('p');
    p.className='sieOcAviso';
    p.textContent=mensagem;
    corpo.appendChild(p);
  }
  function dataBr(valor){
    const m=String(valor||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m?m[3]+'/'+m[2]+'/'+m[1]:String(valor||'');
  }
  function preencher(registro){
    subtitulo.textContent='Consulta somente leitura · dados autorizados'+
      (registro.numero_bo?' · BO '+String(registro.numero_bo):'');
    const grade=document.createElement('div');
    grade.className='sieOcGrade';
    for(const [campo,rotulo] of campos){
      const valor=registro[campo];
      if(opcionais.has(campo)&&(valor===null||valor===undefined||String(valor)===''))continue;
      const bloco=document.createElement('div');
      bloco.className='sieOcCampo'+(campo==='historico_resumido'?' sieOcHistorico':'');
      const etiqueta=document.createElement('b');
      etiqueta.textContent=rotulo;
      const conteudo=document.createElement('span');
      conteudo.textContent=(valor===null||valor===undefined||valor==='')?'—':
        campo==='data_ocorrencia'?dataBr(valor):String(valor);
      bloco.append(etiqueta,conteudo);
      grade.appendChild(bloco);
    }
    corpo.replaceChildren(grade);
  }
  async function abrir(id,cliente){
    preparar();
    const identificador=String(id||'').trim();
    if(!janela.open)janela.showModal();
    const versao=++sequencia;
    subtitulo.textContent='Consulta somente leitura · dados autorizados';
    aviso('Consultando ocorrência...');
    if(!uuid.test(identificador)||!cliente||typeof cliente.from!=='function'){
      aviso('Não foi possível identificar a ocorrência selecionada.');
      return;
    }
    try{
      const {data,error}=await cliente.from('ocorrencias')
        .select('id,'+campos.map(item=>item[0]).join(','))
        .eq('id',identificador).maybeSingle();
      if(versao!==sequencia||!janela.open)return;
      if(error||!data){
        aviso('Ocorrência não encontrada ou não autorizada para a sua unidade.');
        return;
      }
      preencher(data);
    }catch(e){
      if(versao===sequencia&&janela.open)aviso('Não foi possível consultar esta ocorrência. Tente novamente.');
    }
  }
  function vincularMarcador(marcador,registro,cliente,opcoes){
    const id=String(registro?.id||'').trim();
    if(!uuid.test(id))return marcador;
    marcador.options.title='Visualizar ocorrência e histórico';
    if(opcoes?.manterResumo!==true&&typeof marcador.unbindPopup==='function'){
      marcador.unbindPopup();
    }
    marcador.on('click',function(){
      if(typeof marcador.closePopup==='function')marcador.closePopup();
      abrir(id,cliente);
    });
    return marcador;
  }
  global.SieDetalheOcorrenciaMapa=Object.freeze({abrir,vincularMarcador});
})(window);
