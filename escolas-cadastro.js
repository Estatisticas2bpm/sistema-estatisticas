/* Cadastro mestre SIE — escolas e aliases; não cria escolas por digitação livre. */
(function(global){
  "use strict";
  const chave=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]+/g," ").replace(/\s+/g," ").trim();
  const assinatura=v=>chave(v).replace(/^(?:ESCOLA|COLEGIO|CRECHE|CENTRO EDUCACIONAL|UNIDADE ESCOLAR|CEM)\s+/,"")
    .replace(/^(?:(?:ESTADUAL|MUNICIPAL|MILITARIZADA|MILITARIZADO|PROFESSORA|PROFESSOR|PROF|PROFA|EST)\s+)+/,"")
    .replace(/\s+CEM\s+[IVX]+$/,"").trim();
  function distancia(a,b){
    if(Math.abs(a.length-b.length)>8)return 99;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const cur=[i];
      for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev=cur;
    }
    return prev[b.length];
  }
  function iniciar({banco,input,status,botao,obterMunicipio}){
    let escolas=[],erroCarregamento="",pronto;
    const municipio=()=>chave(obterMunicipio?.()||"BOA VISTA");
    const mensagem=(texto,alerta=false)=>{status.textContent=texto;status.style.color=alerta?"#a64909":"#566b80";};
    const itens=()=>escolas.filter(e=>chave(e.municipio)===municipio());
    function exato(valor){
      const chaveBusca=chave(valor);
      if(!chaveBusca)return null;
      return itens().find(e=>chave(e.nome)===chaveBusca||(e.aliases||[]).some(a=>chave(a)===chaveBusca))||null;
    }
    function parecidos(valor){
      const alvo=assinatura(valor);
      if(!alvo)return [];
      return itens().map(e=>{
        const candidatas=[e.nome,...(e.aliases||[])].map(assinatura);
        const dist=Math.min(...candidatas.map(n=>distancia(alvo,n)));
        const inclui=candidatas.some(n=>n.includes(alvo)||alvo.includes(n));
        return {escola:e,dist,inclui};
      }).filter(x=>x.dist<=Math.max(3,Math.round(alvo.length*.22))||x.inclui)
        .sort((a,b)=>Number(b.inclui)-Number(a.inclui)||a.dist-b.dist).slice(0,4).map(x=>x.escola);
    }
    function popular(){
      const lista=document.getElementById("listaEscolas");
      if(!lista)return;
      lista.replaceChildren();
      for(const e of itens()){
        const o=document.createElement("option");
        o.value=e.nome;
        lista.appendChild(o);
      }
    }
    async function carregar(){
      try{
        if(global.SistemaAuth?.ready)await global.SistemaAuth.ready;
        const {data,error}=await banco.rpc("listar_escolas_sie");
        if(error)throw error;
        escolas=Array.isArray(data)?data:[];
        erroCarregamento="";
        popular();
        const perfil=String(global.SistemaAuth?.perfil?.perfil||global.SistemaAuth?.contexto?.perfil||"").toUpperCase();
        if(botao)botao.hidden=perfil!=="ADMIN";
        return escolas;
      }catch(e){
        console.error("Falha ao carregar escolas",e);
        erroCarregamento="Não foi possível consultar o catálogo de escolas.";
        if(botao)botao.hidden=true;
        return [];
      }
    }
    pronto=carregar();
    function avaliar(){
      const raw=input.value.trim();
      if(!raw){mensagem("Se a ocorrência ocorreu dentro de uma escola, informe a instituição; caso contrário deixe vazio.");return null;}
      if(erroCarregamento){mensagem(erroCarregamento,true);return null;}
      const r=exato(raw);
      if(r){mensagem("Escola cadastrada: "+r.nome+". Ocorrência será vinculada ao mesmo identificador estatístico.");return r;}
      const sugestoes=parecidos(raw);
      mensagem(sugestoes.length
        ?"Nome ainda não confirmado. Confira se é uma destas escolas: "+sugestoes.map(x=>x.nome).join(" | ")+"."
        :"Escola ainda não cadastrada. Solicite ao administrador a validação do nome.",true);
      return null;
    }
    input.addEventListener("input",avaliar);
    input.addEventListener("blur",()=>{
      const r=avaliar();if(r)input.value=r.nome;
    });
    async function validar(){
      await pronto;
      if(!input.value.trim())return {ok:true,id:null,nome:null};
      if(erroCarregamento)return {ok:false,mensagem:erroCarregamento};
      const r=exato(input.value);
      if(!r)return {ok:false,mensagem:"Escola não localizada no catálogo. Selecione uma escola cadastrada ou solicite ao ADMIN a inclusão/alias (não salve com nome aproximado)."};
      input.value=r.nome;
      return {ok:true,id:r.id,nome:r.nome};
    }
    async function sugerirPdf(nome){
      if(!nome)return;
      await pronto;
      const r=exato(nome);
      if(r){input.value=r.nome;mensagem("Nome do PDF reconhecido como "+r.nome+". Confira antes de salvar.");}
      else avaliar();
    }
    async function adicionar(){
      await pronto;
      const perfil=String(global.SistemaAuth?.perfil?.perfil||global.SistemaAuth?.contexto?.perfil||"").toUpperCase();
      if(perfil!=="ADMIN")return;
      let nome=prompt("Nome completo da escola conforme documento oficial:",input.value.trim()||"");
      if(nome===null)return;
      nome=nome.trim();
      if(!nome)return;
      let mun=municipio();
      let args={p_nome:nome,p_municipio:mun};
      let retorno;
      if(confirm("Esse nome é uma abreviação, erro de digitação ou outro nome de uma escola JÁ CADASTRADA?\n\nOK = vincular como alias.\nCancelar = solicitar cadastro de escola distinta.")){
        const sugestao=parecidos(nome)[0]?.nome||"";
        const escolhida=prompt("Digite ou cole o NOME EXATO da escola já cadastrada.\n\nSugestão: ",sugestao);
        if(escolhida===null)return;
        const escolaExistente=exato(escolhida);
        if(!escolaExistente){alert("A escola informada não foi encontrada no catálogo deste município. Escolha uma escola existente.");return;}
        if(!confirm("Confirma que \""+nome+"\" e \""+escolaExistente.nome+"\" são a MESMA escola?"))return;
        const r=await banco.rpc("cadastrar_escola_sie_admin",{...args,p_escola_existente_id:escolaExistente.id});
        if(r.error){alert("Erro ao cadastrar nome alternativo: "+r.error.message);return;}
        retorno=r.data;
      }else{
        const {data,error}=await banco.rpc("cadastrar_escola_sie_admin",args);
        if(error){alert("Não foi possível validar a escola: "+error.message);return;}
        retorno=data;
      }
      if(retorno?.status==="possivel_duplicata"){
        const texto="O nome informado se parece com uma escola existente:\n\n"+retorno.nome+
          "\n\nClique OK se é a MESMA instituição para salvar como nome alternativo.\nClique Cancelar se são escolas DIFERENTES.";
        if(confirm(texto)){
          const r=await banco.rpc("cadastrar_escola_sie_admin",{...args,p_escola_existente_id:retorno.escola_id});
          if(r.error){alert("Erro no registro do nome alternativo: "+r.error.message);return;}
          retorno=r.data;
        }else{
          if(!confirm("ATENÇÃO: criar outra escola com nome parecido pode duplicar os indicadores. Você conferiu e confirma que são instituições distintas?"))return;
          const r=await banco.rpc("cadastrar_escola_sie_admin",{...args,p_confirmar_distinta:true});
          if(r.error){alert("Erro ao criar escola distinta: "+r.error.message);return;}
          retorno=r.data;
        }
      }
      await (pronto=carregar());
      if(retorno?.nome){input.value=retorno.nome;avaliar();}
    }
    if(botao)botao.addEventListener("click",adicionar);
    const campoMunicipio=document.getElementById("municipio");
    if(campoMunicipio)campoMunicipio.addEventListener("change",()=>{popular();avaliar();});
    return Object.freeze({carregar,validar,sugerirPdf,avaliar});
  }
  global.EscolasSIE=Object.freeze({iniciar,chave,assinatura});
})(typeof window!=="undefined"?window:globalThis);
