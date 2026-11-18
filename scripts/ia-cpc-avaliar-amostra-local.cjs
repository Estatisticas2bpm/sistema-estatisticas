#!/usr/bin/env node
// Avaliador OFFLINE da qualidade dos relatos do SIE-CPC.
// NÃO inclui, publica, armazena ou imprime texto, BO, pessoas ou endereços.
// Uso: node scripts/ia-cpc-avaliar-amostra-local.cjs /fora/do/repositorio/amostra.jsonl
// Arquivo JSONL: {"historico_resumido":"<texto anonimizado>", "rotulos":{"mencao_arma_fogo":"..."}}
// Rotulagem por revisores humanos é externa a este programa e não pode ser presumida.
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");

const CATEGORIAS=new Set([
 "mencao_arma_fogo","mencao_arma_branca","mencao_motocicleta",
 "mencao_automovel","mencao_residencia","mencao_comercio",
 "mencao_via_publica","mencao_cameras","mencao_ameaca","mencao_danos_materiais"
]);
const ESTADOS=new Set([
 "negada_ou_ausente_no_texto","hipotese_nao_confirmada",
 "atribuida_a_relato","descrita_como_constatada",
 "sem_contexto_claro","contextos_divergentes"
]);

function taxa(n,d){return d?Math.round(n/d*10000)/100:null;}
function estado() {return {tp:0,fp:0,fn:0,contextos_avaliados:0,contextos_corretos:0,afirmacoes_indevidas_como_constatada:0};}
function metricas(o){
 return {rotulos_esperados:o.tp+o.fn,menções_detectadas:o.tp+o.fp,
  precisao_pct:taxa(o.tp,o.tp+o.fp),cobertura_pct:taxa(o.tp,o.tp+o.fn),
  acerto_contextual_pct:taxa(o.contextos_corretos,o.contextos_avaliados),
  afirmacoes_indevidas_como_constatada:o.afirmacoes_indevidas_como_constatada,
  falso_positivo:o.fp,omissoes:o.fn};
}
const isRecord=x=>x!==null && typeof x==="object" && !Array.isArray(x);

async function avaliarRegistros(registros) {
 const {indicadoresLocaisDeRelato}=await import(
   pathToFileURL(path.join(__dirname,"..","supabase","functions","ia-cpc","relatos.mjs")));
 if(!Array.isArray(registros)||registros.length<1||registros.length>1000)
   throw Error("Quantidade de registros fora do limite de homologação");
 const global=estado(),pClasse=new Map();
 let exemplosComTexto=0,exemplosVazios=0;
 for(const entrada of registros){
   if(!isRecord(entrada)||!isRecord(entrada.rotulos)) throw Error("Estrutura inválida");
   const esperado=new Map();
   for(const [cat,status] of Object.entries(entrada.rotulos)){
      if(!CATEGORIAS.has(cat)||!ESTADOS.has(status))throw Error("Rótulo não permitido");
      esperado.set(cat,status);
   }
   for(const campo of ["historico_resumido","detalhes","observacao","observacao_final"]){
     if(entrada[campo]!=null&&(typeof entrada[campo]!=="string"||entrada[campo].length>16000))
       throw Error("Campo narrativo inválido");
   }
   const lido=indicadoresLocaisDeRelato(entrada);
   if(lido.com_relato)exemplosComTexto++;else exemplosVazios++;
   const observado=new Map(lido.contextos.map(x=>[x.categoria,x.status]));
   for(const cat of new Set([...esperado.keys(),...observado.keys()])){
      const e=esperado.get(cat),a=observado.get(cat);
      const conta=pClasse.get(cat)||estado();
      if(e && a) {
        global.tp++;conta.tp++;
        global.contextos_avaliados++;conta.contextos_avaliados++;
        if(e===a) {global.contextos_corretos++;conta.contextos_corretos++;}
        else if(a==="descrita_como_constatada" && 
            ["negada_ou_ausente_no_texto","hipotese_nao_confirmada","atribuida_a_relato"].includes(e)){
          global.afirmacoes_indevidas_como_constatada++;
          conta.afirmacoes_indevidas_como_constatada++;
        }
      }else if(e){global.fn++;conta.fn++;}
      else if(a){global.fp++;conta.fp++;}
      pClasse.set(cat,conta);
   }
 }
 // Não divulgar dimensões com menos de 5 exemplos rotulados:
 // apenas totais agregados e métricas de categorias suficientemente avaliadas.
 const categorias={};
 for(const [cat,c] of pClasse)
    if(c.tp+c.fn>=5 && c.tp+c.fp>=5) categorias[cat]=metricas(c);
 return {
   tipo:"avaliacao_local_offline",
   observacao:"Acurácia nesta amostra, não validade geral. Revisão independente e anonimização precisam ser verificadas externamente.",
   registros:registros.length,com_texto:exemplosComTexto,sem_texto:exemplosVazios,
   geral:metricas(global),categorias
 };
}

async function main(){
 if(process.argv.length!==3)throw Error("Informe um arquivo de amostra fora do repositório");
 const origem=fs.realpathSync(process.argv[2]);
 const repo=fs.realpathSync(path.join(__dirname,".."));
 if(origem===repo||origem.startsWith(repo+path.sep))
   throw Error("Por segurança, mantenha a amostra fora do repositório público");
 const stat=fs.statSync(origem);
 if(!stat.isFile()||stat.size>20*1024*1024)throw Error("Arquivo grande ou inválido");
 const linhas=fs.readFileSync(origem,"utf8").split(/\r?\n/).filter(Boolean);
 if(linhas.length>1000)throw Error("Amostra acima de 1000 BOs");
 const entradas=[];
 for(const linha of linhas){
   try{entradas.push(JSON.parse(linha));}
   catch{throw Error("Formato JSONL inválido");}
 }
 // Nada é gravado no disco nem enviado pela rede.
 const metrica=await avaliarRegistros(entradas);
 process.stdout.write(JSON.stringify(metrica,null,2)+"\n");
}
if(require.main===module){
 main().catch(()=>{process.stderr.write("Avaliação local inválida. Verifique arquivo, formato, localização externa e permissões.\n");process.exitCode=1;});
}
module.exports={avaliarRegistros};
