const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ler=p=>fs.readFileSync(path.join(root,p),'utf8');
const base=ler('cadastro-base.html'),wrapper=ler('cadastro.html');
const mapa=ler('mapa-criminal.html'),consulta=ler('consulta.html');
const schema=ler('supabase/migrations/20261020190000_origem_bope_coordenadas_morte_resistencia.sql');
const update=ler('supabase/migrations/20261020190500_edicao_origem_bope_resultado_morte.sql');
const rpc=ler('supabase/migrations/20261020191000_dashboard_origem_bope_resultado_morte.sql');
assert.match(base,/id="latitudeManual"/);
assert.match(base,/id="longitudeManual"/);
assert.match(base,/id="autoResistenciaMorte"/);
assert.match(base,/auto_resistencia_resultou_morte: document.getElementById/);
assert.match(base,/origem_ocorrencia: document.getElementById/);
assert.match(base,/coordenadasManuaisDigitadas\(\)/);
assert.match(base,/!coordenadasManuaisValidas\(\)/);
assert.match(base,/blocoCoordenadasManuais\.hidden=true/);
assert.match(wrapper,/siglaCadastro==='CIPG'/); // CIPG usa caderno próprio, não esta tela de BO.
assert.match(wrapper,/ehBopeCadastro\s*\? '<div class="campo duplo"><label for="origemOcorrenciaBope">/);
assert.match(schema,/ADD COLUMN IF NOT EXISTS origem_ocorrencia/);
assert.match(schema,/ADD COLUMN IF NOT EXISTS auto_resistencia_resultou_morte/);
assert.match(schema,/auto_resistencia='SIM'/);
assert.match(update,/origem_ocorrencia=v.origem_ocorrencia/);
assert.match(update,/auto_resistencia_resultou_morte=v.auto_resistencia_resultou_morte/);
assert.match(rpc,/auto_resistencia_resultou_morte'',o.auto_resistencia_resultou_morte/);
assert.match(mapa,/function coordValida\(x\)/);
assert.match(mapa,/Number\(x.latitude\)/);
assert.match(consulta,/Auto de resistência com resultado morte/);
assert.match(consulta,/Origem da ocorrência — BOPE/);
const ini=base.indexOf('    function numeroCoordenadaManual('),fim=base.indexOf('    function coordenadasManuaisValidas()',ini);
assert.ok(ini>=0&&fim>ini);
const decimal=new Function(base.slice(ini,fim)+'return numeroCoordenadaManual;')();
assert.equal(decimal('2.823500',-90,90),2.8235);
assert.equal(decimal('-60,675800',-180,180),-60.6758);
assert.equal(decimal('100',-90,90),null);
assert.equal(decimal('texto',-90,90),null);
const catalogoSql=ler('supabase/migrations/20261020182000_bope_catalogo_livre_origens.sql');
assert.match(catalogoSql,/CREATE TABLE IF NOT EXISTS public\.bope_origens_ocorrencia/);
assert.match(catalogoSql,/CREATE POLICY bope_origens_cadastro/);
assert.match(catalogoSql,/u\.sigla='BOPE'/);
assert.match(catalogoSql,/ON CONFLICT DO NOTHING/);
assert.match(catalogoSql,/DROP CONSTRAINT IF EXISTS ocorrencias_origem_ocorrencia_check/);
assert.doesNotMatch(wrapper,/<option value="REDE_FALCAO">/);
assert.doesNotMatch(wrapper,/<option value="MISSAO">/);
assert.match(wrapper,/id="abrirNovaOrigemBope"/);
assert.match(wrapper,/id="modalNovaOrigemBope"/);
assert.match(base,/cadastrar_origem_ocorrencia_bope/);
assert.match(base,/await carregarOrigensBope\(data\.nome\)/);
const origemInicio=base.indexOf('    async function sugerirOrigemBopePdf('),origemFim=base.indexOf('    const latitudeManual=',origemInicio);
assert.ok(origemInicio>=0&&origemFim>origemInicio);
const campo={value:''};
const catalogo=[{nome:'REDE FALCÃO'},{nome:'CCC'}];
const chave=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
const reconhecer=new Function('origemOcorrenciaBope','origemOcorrenciaBopeDetalhe','catalogoOrigensBope','origensBopeProntas','chaveOrigemBope',base.slice(origemInicio,origemFim)+'return sugerirOrigemBopePdf;')(campo,{value:''},catalogo,Promise.resolve([]),chave);
async function construir(sigla){
 const script=wrapper.slice(wrapper.lastIndexOf('<script>')+8,wrapper.lastIndexOf('</script>'));
 let html='';
 const win={SistemaAuth:{ready:Promise.resolve({contexto:{sigla}})},location:{search:'',replace(){throw Error('Redirecionamento não esperado')}}};
 const doc={open(){},write(s){html=s},close(){}};
 const fetch=async()=>({ok:true,text:async()=>base});
 await new Function('window','document','fetch','console','return '+script.trim())(win,doc,fetch,console);
 assert.ok(html,'Formulário não montou: '+sigla);
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 for(const x of scripts)new Function(x[1]);
 assert.match(html,/id="autoResistenciaMorte"/);
 assert.match(html,/id="latitudeManual"/);
 assert.match(html,/id="longitudeManual"/);
 assert.equal(html.includes('id="origemOcorrenciaBope"'),sigla==='BOPE',sigla+': origem exclusiva BOPE');
 assert.equal(html.includes('id="modalNovaOrigemBope"'),sigla==='BOPE',sigla+': cadastro de origens exclusivo BOPE');
 if(sigla==='BOPE'){
   assert.match(html,/Selecione ou cadastre uma origem/);
   assert.doesNotMatch(html,/<option value="REDE_FALCAO">/);
 }
 if(sigla==='CIPA'){
   assert.match(html,/id="cipaLocalCoordenadas"/);
   assert.match(html,/const cipaTemCoordenadas=Boolean/);
   assert.match(html,/&& !cipaTemCoordenadas/);
 }else{
   assert.doesNotMatch(html,/id="cipaLocalCoordenadas"/);
   assert.match(html,/&& !coordenadasManuaisValidas\(\)/);
 }
}
(async()=>{
 await reconhecer('ORIGEM DA OCORRÊNCIA: REDE FALCÃO');
 assert.equal(campo.value,'REDE FALCÃO');
 await reconhecer('Origem da ocorrência: CCC');
 assert.equal(campo.value,'CCC');
 await reconhecer('Origem da ocorrência: Missão');
 assert.equal(campo.value,'','Origem não cadastrada não pode ser selecionada automaticamente');
 for(const sigla of ['BOPE','1BPM','2BPM','CIPA','CIPTUR','GIRO','CAVALARIA'])await construir(sigla);
 console.log('PASS: origem BOPE, coordenadas em todas as unidades, resultado morte e mapa criminal.');
})().catch(e=>{console.error(e);process.exitCode=1});
