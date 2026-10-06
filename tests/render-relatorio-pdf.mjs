import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const output=process.argv[2]||path.join(root,'tmp','pdfs','relatorio-2bpm-visual.html');
const source=fs.readFileSync(path.join(root,'relatorio.html'),'utf8');

const naturezas=['MARIA DA PENHA / VIOLÊNCIA DOMÉSTICA','FURTO','ROUBO','AMEAÇA','LESÃO CORPORAL','TRÁFICO DE DROGAS','OCORRÊNCIA DE TRÂNSITO','PERTURBAÇÃO DO SOSSEGO'];
const bairros=['CENTRO','ASA BRANCA','BURITIS','CAUAMÉ','CIDADE SATÉLITE','JARDIM FLORESTA','LIBERDADE','NOVA CIDADE','PRICUMÃ','SÃO VICENTE','TANCREDO NEVES','TREZE DE SETEMBRO'];
const registros=Array.from({length:210},(_,i)=>({
  data_ocorrencia:`2026-${String(7+(i%3)).padStart(2,'0')}-${String(1+(i%28)).padStart(2,'0')}`,
  tipo:'BO',ocorrencia:naturezas[i%naturezas.length],crime:naturezas[i%naturezas.length],
  bairro:bairros[i%bairros.length],endereco:`RUA INSTITUCIONAL ${String(i%32).padStart(2,'0')}`,
  turno:['MADRUGADA','MANHÃ','TARDE','NOITE'][i%4],comandante:`${i%3===0?'SGT':'CB'} PM COMANDANTE ${String(i%46).padStart(2,'0')}`,
  infrator_idade:18+(i%43),infrator_nacionalidade:i%5===0?'VE':'BR',infrator_sexo:i%2?'F':'M',
  vitima_nacionalidade:i%7===0?'VE':'BR',vitima_sexo:i%3?'F':'M',conducoes_operacionais:i%4===0?1:0,
  orientacoes:i%6===0?1:0,foragidos:i%25===0?1:0,veiculos_recuperados:i%21===0?1:0,veiculos_restricao:0,
  tatico_setorial:i%13===0,quantidade_autos_infracao:i%37===0?1:0,auto_infracao:'',auto_resistencia:'NÃO',
  quantidade_armas:i%31===0?1:0,armas_itens:i%31===0?[{categoria:'ARMA DE FOGO',tipo:'PISTOLA',calibre:'9 MM',quantidade:1}]:[],
  quantidade_municoes:i%31===0?8:0,municoes_itens:i%31===0?[{calibre:'9 MM',quantidade:8}]:[],
  quantidade_arma_branca:i%29===0?1:0,arma_branca:i%29===0?'FACA DE CABO PRETO':'',
  entorpecentes_itens:i%23===0?[{tipo:'MACONHA',forma_apresentacao:'INVÓLUCRO',quantidade:3}]:[]
}));

const stub=`<script>
window.Chart=class{constructor(canvas,config){this.canvas=canvas;this.options=config.options||{};this.config=config;this.draw()}draw(){const c=this.canvas;c.width=640;c.height=240;c.style.width='100%';c.style.height='100%';const x=c.getContext('2d');x.fillStyle='#f5f8fb';x.fillRect(0,0,c.width,c.height);x.fillStyle='#173b5e';x.font='bold 20px Arial';x.fillText(this.config.options?.plugins?.title?.text||this.config.type.toUpperCase(),24,34);const valores=this.config.data?.datasets?.[0]?.data||[];const max=Math.max(1,...valores);valores.slice(0,10).forEach((v,i)=>{x.fillStyle=['#2563eb','#16a6bd','#059669','#d97706'][i%4];x.fillRect(30+i*58,210-(v/max)*140,34,(v/max)*140)})}destroy(){}resize(){}update(){this.draw()}};
const dados=${JSON.stringify(registros)};
window.supabase={createClient(){return{rpc(nome,args){if(nome==='obter_dados_dashboard')return Promise.resolve({data:String(args?.data_inicio||'').startsWith('2026-')?dados:[],error:null});return Promise.resolve({data:[],error:null})}}}};
window.SistemaAuth={contexto:{sigla:'2BPM',nome:'2º Batalhão de Polícia Militar'},perfil:{posto_graduacao:'SGT PM',nome:'SERVIDOR DE TESTE',nome_guerra:'TESTE'},client:{},user:{id:'visual-test'},ready:Promise.resolve()};
</script>`;

let html=source
  .replace('<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>','')
  .replace('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',stub)
  .replace('<script src="auth-config.js"></script><script src="auth-guard.js"></script>','')
  .replace('</head>',`<base href="${pathToFileURL(root+path.sep).href}"></head>`)
  .replace('iniciarRelatorio();','iniciarRelatorio().then(()=>{document.documentElement.dataset.relatorioPronto="1"});');

fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,html,'utf8');
console.log(output);
