// Homologação do script real da página, com DOM e Auth sintéticos.
// Nenhuma biblioteca externa, navegador remoto, Supabase ou rede.
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const assert=require("node:assert/strict");

const html=fs.readFileSync(path.join(__dirname,"..","ia-cpc.html"),"utf8");
const inicio=html.indexOf("  <script>\n  (async function () {");
const fim=html.indexOf("  </script>",inicio);
assert(inicio>=0&&fim>inicio,"Script da página não identificado");
const script=html.slice(inicio+10,fim);
class Elemento {
 constructor(){
   this.hidden=true;this.disabled=false;this.value="";this.textContent="";
   this.children=[];this.lastChild=null;this.scrollTop=0;this.scrollHeight=100;
   this.style={};this.dataset={};this.eventos={};
   const classes=new Set();
   this.classList={add:(classe)=>classes.add(classe),contains:(classe)=>classes.has(classe)};
 }
 append(...itens){this.children.push(...itens);this.lastChild=itens.at(-1)||null;}
 replaceChildren(...itens){this.children=[...itens];this.lastChild=itens.at(-1)||null;}
 addEventListener(evt,fn){this.eventos[evt]=fn;}
 requestSubmit(){return this.eventos.submit?.({preventDefault(){}});}
 focus(){}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function executar({permitido,config=false,resposta}){
 const elementos=new Map();
 const get=id=>{
   if(!elementos.has(id))elementos.set(id,new Elemento());
   return elementos.get(id);
 };
 const chamadas=[];
 const client={functions:{
   invoke:async (nome,arg)=>{
     chamadas.push({nome,arg});
     return resposta || {data:{resposta:"Síntese apenas fictícia.",
       registros:12,qualidade:{exclusivamente_preliminar:true},
       comparacao_total:{atual:12,anterior:10,variacao_percentual:20},
       cota:{restante_centavos:9800,alerta_80:false,reserva_pendente:false}}};
   }
 }};
 const auth=config ? undefined : {
   ready:Promise.resolve({pode:(p)=>permitido&&p==="ia_cpc",client})
 };
 const document={
   getElementById:get,
   createElement:()=>new Elemento(),
   querySelectorAll:()=>[]
 };
 vm.runInNewContext(script,{window:{SistemaAuth:auth},document,console,Date,Math,Number},
   {filename:"ia-cpc.html"});
 await tick();
 return {get,client,chamadas};
}

(async()=>{
 const negado=await executar({permitido:false});
 assert.equal(negado.get("conteudo").hidden,true);
 assert.equal(negado.get("formConsulta").eventos.submit,undefined,
   "Sem autorização, não registrar ação de enviar dados");
 assert.equal(negado.chamadas.length,0);

 const semAuth=await executar({permitido:false,config:true});
 assert.equal(semAuth.get("conteudo").hidden,true);
 assert.equal(semAuth.chamadas.length,0);

 const valido=await executar({permitido:true});
 assert.equal(valido.get("conteudo").hidden,false);
 valido.get("pergunta").value="Resuma os indicadores de furto.";
 await valido.get("formConsulta").requestSubmit();
 assert.equal(valido.chamadas.length,1);
 assert.equal(valido.chamadas[0].nome,"ia-cpc");
 assert.equal(valido.chamadas[0].arg.body.pergunta,"Resuma os indicadores de furto.");
 assert.equal(valido.get("enviar").disabled,false);
 assert.match(valido.get("situacao").textContent,/rascunhos/);
 assert.equal(valido.get("comparacaoContainer").hidden,false);
 assert.match(valido.get("orcamentoEstado").textContent,/R\$ 100,00/);
 assert.equal(valido.get("historico").children.length,2);
 assert.match(valido.get("historico").children[1].lastChild.textContent,/fictícia/);

 const falhou=await executar({permitido:true,resposta:{
   data:null,error:{context:{json:async()=>({error:"Acesso negado na função"})}}
 }});
 falhou.get("pergunta").value="Resumo estatístico";
 await falhou.get("formConsulta").requestSubmit();
 assert.equal(falhou.chamadas.length,1);
 assert.match(falhou.get("historico").children[1].lastChild.textContent,/Acesso negado/);
 assert.equal(falhou.get("enviar").disabled,false);
 assert.equal(falhou.get("situacao").textContent,"Consulta não concluída.");

 console.log("OK — UI real bloqueada sem Auth, acesso autorizado, envio fictício e erro 403 simulados.");
})().catch(err=>{console.error(err);process.exitCode=1;});
