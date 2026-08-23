from pathlib import Path
import re


def fail(msg):
    raise SystemExit(msg)


def replace_once_or_present(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        fail(f"Trecho não encontrado em {label}: {old[:160]}")
    return text.replace(old, new, 1)


def sub_once_or_present(text, pattern, replacement, present_marker, label, flags=0):
    if present_marker and present_marker in text:
        return text
    out, n = re.subn(pattern, lambda _m: replacement, text, count=1, flags=flags)
    if n != 1:
        fail(f"Padrão não encontrado em {label}: {pattern[:160]}")
    return out


def patch_cadastro():
    p = Path("cadastro.html")
    s = p.read_text(encoding="utf-8")

    s = replace_once_or_present(
        s,
        '<div><h3>Substâncias apreendidas</h3><small>Cadastre somente quando houver apreensão.</small></div>',
        '<div><h3>Substâncias apreendidas</h3><small>Registre somente o que foi visualmente constatado: tipo, forma de apresentação e quantidade de unidades. Não informe peso (g, kg ou mg).</small></div>',
        "cadastro.html/cabecalho-entorpecentes",
    )

    if 'id="avisoEntorpecentesLegados"' not in s:
        s = replace_once_or_present(
            s,
            '<div class="lista-itens" id="entorpecentesItens"><p class="lista-vazia">Nenhum entorpecente informado.</p></div>',
            '<div id="avisoEntorpecentesLegados" hidden style="margin-bottom:12px;padding:12px;border:1px solid #f59e0b;border-radius:9px;background:#fffbeb;color:#92400e"><strong>Registro legado:</strong> esta ocorrência possui dados antigos de entorpecentes registrados em peso. O dado foi preservado, mas não será convertido nem somado como unidade visual.</div><div class="lista-itens" id="entorpecentesItens"><p class="lista-vazia">Nenhum entorpecente informado.</p></div>',
            "cadastro.html/aviso-legado",
        )

    s = replace_once_or_present(
        s,
        'const TIPOS_ENTORPECENTES = ["MACONHA","COCAÍNA","PASTA BASE","CRACK","SKANK","ECSTASY","LSD","OUTRO"];\n    const UNIDADES_ENTORPECENTES = ["GRAMA (g)","QUILOGRAMA (kg)","UNIDADE","PORÇÃO","INVÓLUCRO","OUTRO"];',
        'const TIPOS_ENTORPECENTES = ["MACONHA","COCAÍNA","PASTA BASE","CRACK","SKANK","ECSTASY","LSD","OUTRO"];\n    const FORMAS_ENTORPECENTES = ["INVÓLUCRO","PORÇÃO","TABLETE","TIJOLO","PAPELOTE","PINO","COMPRIMIDO","SACOLA","UNIDADE","OUTRO"];',
        "cadastro.html/catalogo-entorpecentes",
    )

    if "forma_apresentacao:forma" not in s:
        pattern = r'''        const tipoDroga = TIPOS_ENTORPECENTES\.filter\(t=>t!=="OUTRO"\)\.find\(t=>chave\.includes\(textoComparavel\(t\)\)\);\n        if \(tipoDroga \|\| chave\.includes\("ENTORPECENTE"\) \|\| chave\.includes\("DROGA"\)\) \{\n          const quantidade = .*?\n          const unidadeTexto = .*?\n          const unidade = .*?\n          dados\.entorpecentes\.push\(\{tipo:tipoDroga \|\| "OUTRO",quantidade,unidade,detalhes:descricao\}\); return;\n        \}'''
        replacement = '''        const tipoDroga = TIPOS_ENTORPECENTES.filter(t=>t!=="OUTRO").find(t=>chave.includes(textoComparavel(t)));
        if (tipoDroga || chave.includes("ENTORPECENTE") || chave.includes("DROGA")) {
          const achado = descricao.match(/\\b(\\d+)\\s*(INV[ÓO]LUCROS?|POR[ÇC][ÕO]ES?|TABLETES?|TIJOLOS?|PAPELOTES?|PINOS?|COMPRIMIDOS?|SACOLAS?|UNIDADES?)\\b/i);
          if (achado) {
            const formaChave = textoComparavel(achado[2]);
            const forma = formaChave.includes("INVOLUCRO") ? "INVÓLUCRO" : formaChave.includes("PORCAO") ? "PORÇÃO" : formaChave.includes("TABLETE") ? "TABLETE" : formaChave.includes("TIJOLO") ? "TIJOLO" : formaChave.includes("PAPELOTE") ? "PAPELOTE" : formaChave.includes("PINO") ? "PINO" : formaChave.includes("COMPRIMIDO") ? "COMPRIMIDO" : formaChave.includes("SACOLA") ? "SACOLA" : "UNIDADE";
            dados.entorpecentes.push({tipo:tipoDroga || "OUTRO",quantidade:Number(achado[1]),forma_apresentacao:forma,detalhes:descricao});
          }
          return;
        }'''
        s, n = re.subn(pattern, lambda _m: replacement, s, count=1, flags=re.S)
        if n != 1:
            fail("Bloco do importador PDF de entorpecentes não encontrado")

    new_func = '''    function adicionarEntorpecenteItem(dados = {}) {
      const recipiente = document.getElementById("entorpecentesItens");
      const bloco = document.createElement("div");
      bloco.className = "item-estruturado entorpecente";
      let formaOriginal = String(dados.forma_apresentacao || dados.forma || dados.unidade || "").trim();
      const chaveForma = textoComparavel(formaOriginal);
      if (chaveForma === "G" || chaveForma === "KG" || chaveForma.includes("GRAMA") || chaveForma.includes("QUILOGRAMA") || chaveForma.includes("MILIGRAMA")) formaOriginal = "";
      bloco.innerHTML = `<div class="campo"><label>Tipo de entorpecente</label><select data-item="tipo" required>${opcoesHtml(TIPOS_ENTORPECENTES,dados.tipo)}</select></div><div class="campo"><label>Forma de apresentação</label><select data-item="forma_apresentacao" required>${opcoesHtml(FORMAS_ENTORPECENTES,formaOriginal)}</select></div><div class="campo"><label>Quantidade</label><input data-item="quantidade" type="number" min="1" step="1" inputmode="numeric" value="${Number.isInteger(Number(dados.quantidade)) && Number(dados.quantidade)>0 ? Number(dados.quantidade) : ""}" required></div><div class="campo"><label>Detalhes/observações</label><input data-item="detalhes" value="${escaparHtml(dados.detalhes || "")}" placeholder="Informação opcional"></div><button class="remover-item" type="button" title="Remover este entorpecente" aria-label="Remover entorpecente">×</button>`;
      bloco.querySelector(".remover-item").addEventListener("click", () => { bloco.remove(); atualizarListaVazia(recipiente,"Nenhum entorpecente informado."); });
      recipiente.appendChild(bloco);
      atualizarListaVazia(recipiente,"Nenhum entorpecente informado.");
    }
    function adicionarBemSubtraido'''
    s = sub_once_or_present(
        s,
        r'''    function adicionarEntorpecenteItem\(dados = \{\}\) \{.*?\n    \}\n    function adicionarBemSubtraido''',
        new_func,
        'data-item="forma_apresentacao" required',
        "cadastro.html/editor-entorpecentes",
        re.S,
    )

    s = replace_once_or_present(
        s,
        'function coletarEntorpecentesItens() { return coletarItens("entorpecentesItens",["tipo","quantidade","unidade","detalhes"]); }',
        'function coletarEntorpecentesItens() { return coletarItens("entorpecentesItens",["tipo","forma_apresentacao","quantidade","detalhes"]); }',
        "cadastro.html/coletor-entorpecentes",
    )

    if "const camposDrogas" in s:
        s, n = re.subn(
            r'''\n      const camposDrogas = \{"MACONHA":"maconha","COCAÍNA":"cocaina","PASTA BASE":"pastaBase","CRACK":"crack","SKANK":"skank"\};\n      Object\.values\(camposDrogas\)\.forEach\(id => document\.getElementById\(id\)\.value = ""\);\n      entorpecentesItens\.forEach\(item => \{ const id = camposDrogas\[item\.tipo\]; if \(id\) document\.getElementById\(id\)\.value = \(Number\(document\.getElementById\(id\)\.value\)\|\|0\) \+ item\.quantidade; \}\);''',
            lambda _m: "",
            s,
            count=1,
        )
        if n != 1:
            fail("Sincronização indevida dos campos legados de droga não encontrada")

    if "entorpecentesSalvosBrutos" not in s:
        pattern = r'''      const entorpecentesSalvos = .*?;\n      const bensSubtraidosSalvos ='''
        replacement = '''      const entorpecentesSalvosBrutos = Array.isArray(x.entorpecentes_itens) ? x.entorpecentes_itens : [];
      const ehPesoEntorpecente = item => { const u = textoComparavel(item?.unidade || item?.forma_apresentacao || item?.forma || ""); return u === "G" || u === "KG" || u.includes("GRAMA") || u.includes("QUILOGRAMA") || u.includes("MILIGRAMA"); };
      const entorpecentesSalvos = entorpecentesSalvosBrutos.filter(item=>!ehPesoEntorpecente(item)).map(item=>item.forma_apresentacao ? item : {...item,forma_apresentacao:item.forma || item.unidade || null});
      const possuiEntorpecenteLegado = [x.maconha,x.cocaina,x.pasta_base,x.crack,x.skank].some(v=>Number(v)>0) || entorpecentesSalvosBrutos.some(ehPesoEntorpecente);
      const avisoEntorpecentesLegados = document.getElementById("avisoEntorpecentesLegados");
      if (avisoEntorpecentesLegados) avisoEntorpecentesLegados.hidden = !possuiEntorpecenteLegado;
      const bensSubtraidosSalvos ='''
        s, n = re.subn(pattern, lambda _m: replacement, s, count=1, flags=re.S)
        if n != 1:
            fail("Carga de entorpecentes legados não encontrada")

    p.write_text(s, encoding="utf-8")


def patch_dashboard():
    p = Path("dashboard.html")
    s = p.read_text(encoding="utf-8")

    old_section = '<section class="section"><h2>Apreensões</h2><p class="sub">Armas, munições, entorpecentes, veículos e trânsito</p><div class="grid3" id="apreensoes"></div></section>'
    new_section = old_section + '''
<section class="section" id="secEntorpecentes"><h2>Análise de Entorpecentes</h2><p class="sub">Incidência por ocorrência e quantidade visual por forma de apresentação. Pesos e medidas não são somados.</p><div class="grid2"><div class="tablewrap"><table><thead><tr><th>Tipo</th><th>Ocorrências</th></tr></thead><tbody id="tabEntorpecentesIncidencia"></tbody></table></div><div class="tablewrap"><table><thead><tr><th>Tipo</th><th>Apresentação</th><th>Quantidade</th></tr></thead><tbody id="tabEntorpecentesMateriais"></tbody></table></div></div></section>'''
    s = replace_once_or_present(s, old_section, new_section, "dashboard.html/secao-entorpecentes")

    new_funcs = '''function formaVisualEntorpecente(item){let v=String(item?.forma_apresentacao||item?.forma||item?.unidade||'').trim();if(!v)return '';let k=chaveOcorrencia(v);if(k==='G'||k==='KG'||k.includes('GRAMA')||k.includes('QUILOGRAMA')||k.includes('MILIGRAMA'))return '';return v}
function tipoEntorpecente(item){return String(item?.tipo||'').trim()||'TIPO NÃO INFORMADO'}
function tiposEntorpecentesOcorrencia(o){let tipos=new Set(),itens=Array.isArray(o.entorpecentes_itens)?o.entorpecentes_itens:[];itens.forEach(i=>{if(num(i.quantidade)>0)tipos.add(tipoEntorpecente(i))});[['MACONHA','maconha'],['COCAÍNA','cocaina'],['PASTA BASE','pasta_base'],['CRACK','crack'],['SKANK','skank']].forEach(([tipo,c])=>{if(num(o[c])>0)tipos.add(tipo)});if(!tipos.size&&norm(o.entorpecentes)==='SIM')tipos.add('TIPO NÃO INFORMADO');return [...tipos]}
function temEntorpecente(o){return tiposEntorpecentesOcorrencia(o).length>0}
function incidenciaEntorpecentes(registros){let m={};registros.forEach(o=>tiposEntorpecentesOcorrencia(o).forEach(tipo=>m[tipo]=(m[tipo]||0)+1));return Object.entries(m).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))}
function materiaisEntorpecentes(registros){let m={};registros.forEach(o=>(Array.isArray(o.entorpecentes_itens)?o.entorpecentes_itens:[]).forEach(i=>{let forma=formaVisualEntorpecente(i),q=num(i.quantidade);if(!forma||q<=0)return;let tipo=tipoEntorpecente(i),k=tipo+'|'+forma;m[k]=(m[k]||0)+q}));return Object.entries(m).map(([k,q])=>{let p=k.split('|');return[p[0],p.slice(1).join('|'),q]}).sort((a,b)=>a[0].localeCompare(b[0])||b[2]-a[2]||a[1].localeCompare(b[1]))}
function detalhesEntorpecentes(registros){return materiaisEntorpecentes(registros).map(x=>[x[0]+' — '+x[1],x[2]])}
function chaveOcorrencia'''
    s = sub_once_or_present(
        s,
        r'''function detalhesEntorpecentes\(registros\)\{.*?\}\nfunction chaveOcorrencia''',
        new_funcs,
        "function materiaisEntorpecentes(registros)",
        "dashboard.html/logica-entorpecentes",
        re.S,
    )

    old_ent_count = "entOcorr=a.filter(x=>(Array.isArray(x.entorpecentes_itens)&&x.entorpecentes_itens.some(i=>num(i.quantidade)>0))||norm(x.entorpecentes)==='SIM'||num(x.maconha)+num(x.cocaina)+num(x.pasta_base)+num(x.crack)+num(x.skank)>0).length"
    if old_ent_count in s:
        s = s.replace(old_ent_count, "entOcorr=a.filter(temEntorpecente).length", 1)
    elif "entOcorr=a.filter(temEntorpecente).length" not in s:
        fail("Contagem de ocorrências com entorpecentes não encontrada no dashboard")

    if "tabEntorpecentesIncidencia" in s and "let entInc=incidenciaEntorpecentes(a)" not in s:
        anchor = "apreensoes.innerHTML=apr.map(x=>`<div class=\"card\"><small>${x[0]}</small><strong>${x[1]}</strong><em>${x[2].filter(z=>z[1]).map(z=>esc(z[0])+': '+z[1]).join('<br>')||'Sem detalhamento'}</em></div>`).join('');"
        if anchor not in s:
            fail("Renderização do card de apreensões não encontrada")
        extra = anchor + "\nlet entInc=incidenciaEntorpecentes(a),entMat=materiaisEntorpecentes(a);rows('tabEntorpecentesIncidencia',entInc.map(x=>`<tr><td>${esc(x[0])}</td><td>${x[1]}</td></tr>`).join(''));rows('tabEntorpecentesMateriais',entMat.map(x=>`<tr><td>${esc(x[0])}</td><td>${esc(x[1])}</td><td>${x[2]}</td></tr>`).join(''));"
        s = s.replace(anchor, extra, 1)

    old_cmd = "g.filter(y=>(Array.isArray(y.entorpecentes_itens)&&y.entorpecentes_itens.some(i=>num(i.quantidade)>0))||norm(y.entorpecentes)==='SIM').length"
    s = s.replace(old_cmd, "g.filter(temEntorpecente).length")

    if "indicador('Ocorrências com entorpecentes'" not in s:
        marker = "...pro.map(x=>indicador(x[0],soma(a,x[1]),soma(p,x[1]))),indicador('Maria da Penha / Violência Doméstica'"
        if marker in s:
            s = s.replace(marker, "...pro.map(x=>indicador(x[0],soma(a,x[1]),soma(p,x[1]))),indicador('Ocorrências com entorpecentes',a.filter(temEntorpecente).length,p.filter(temEntorpecente).length),indicador('Maria da Penha / Violência Doméstica'", 1)

    p.write_text(s, encoding="utf-8")


def patch_relatorio():
    p = Path("relatorio.html")
    s = p.read_text(encoding="utf-8")

    if "function formaVisualEntorpecente(item)" not in s:
        pattern = r'''(function spec\(text\)\{.*?\}\n)'''
        helpers = '''function formaVisualEntorpecente(item){let v=String(item?.forma_apresentacao||item?.forma||item?.unidade||'').trim();if(!v)return '';let k=S(v).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase();if(k==='G'||k==='KG'||k.includes('GRAMA')||k.includes('QUILOGRAMA')||k.includes('MILIGRAMA'))return '';return v}
function tipoEntorpecente(item){return S(item?.tipo)||'TIPO NÃO INFORMADO'}
function tiposEntorpecentesOcorrencia(o){let tipos=new Set(),itens=Array.isArray(o.entorpecentes_itens)?o.entorpecentes_itens:[];itens.forEach(i=>{if(N(i.quantidade)>0)tipos.add(tipoEntorpecente(i))});[['MACONHA','maconha'],['COCAÍNA','cocaina'],['PASTA BASE','pasta_base'],['CRACK','crack'],['SKANK','skank']].forEach(([tipo,c])=>{if(N(o[c])>0)tipos.add(tipo)});if(!tipos.size&&S(o.entorpecentes)==='SIM')tipos.add('TIPO NÃO INFORMADO');return[...tipos]}
function temEntorpecente(o){return tiposEntorpecentesOcorrencia(o).length>0}
function incidenciaEntorpecentes(registros){let m={};registros.forEach(o=>tiposEntorpecentesOcorrencia(o).forEach(tipo=>m[tipo]=(m[tipo]||0)+1));return Object.entries(m).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))}
function materiaisEntorpecentes(registros){let m={};registros.forEach(o=>(Array.isArray(o.entorpecentes_itens)?o.entorpecentes_itens:[]).forEach(i=>{let forma=formaVisualEntorpecente(i),q=N(i.quantidade);if(!forma||q<=0)return;let tipo=tipoEntorpecente(i),k=tipo+'|'+forma;m[k]=(m[k]||0)+q}));return Object.entries(m).map(([k,q])=>{let p=k.split('|');return[p[0],p.slice(1).join('|'),q]}).sort((a,b)=>a[0].localeCompare(b[0])||b[2]-a[2]||a[1].localeCompare(b[1]))}
function totalEstruturadoOuLegado(registros,campoEstruturado,campoLegado){return registros.reduce((s,o)=>{let itens=Array.isArray(o[campoEstruturado])?o[campoEstruturado]:[];return s+(itens.length?itens.reduce((t,i)=>t+N(i.quantidade),0):N(o[campoLegado]))},0)}
function detalhesArmasRel(registros){let m={};registros.forEach(o=>{let itens=Array.isArray(o.armas_itens)?o.armas_itens:[];if(itens.length)itens.forEach(i=>{let k=S(i.categoria)==='SIMULACRO'?'SIMULACRO':S(i.tipo||i.categoria)||'TIPO NÃO INFORMADO';m[k]=(m[k]||0)+N(i.quantidade)});else if(N(o.quantidade_armas)>0){let k=S(o.armas)||'TIPO NÃO INFORMADO';m[k]=(m[k]||0)+N(o.quantidade_armas)}});return Object.entries(m).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1])}
function detalhesMunicoesRel(registros){let m={};registros.forEach(o=>{let itens=Array.isArray(o.municoes_itens)?o.municoes_itens:[];if(itens.length)itens.forEach(i=>{let k=i.calibre?'Calibre '+S(i.calibre):'Calibre não informado';m[k]=(m[k]||0)+N(i.quantidade)});else if(N(o.quantidade_municoes)>0){let k=S(o.municoes)||'Calibre não informado';m[k]=(m[k]||0)+N(o.quantidade_municoes)}});return Object.entries(m).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1])}
function ocorrenciaComArmasOuMunicoes(o){return totalEstruturadoOuLegado([o],'armas_itens','quantidade_armas')+totalEstruturadoOuLegado([o],'municoes_itens','quantidade_municoes')>0}
function docsComTco(registros,tcos){let m=Object.fromEntries(rank(registros,'tipo_registro'));m.TCO=(m.TCO||0)+tcos.length;return Object.entries(m).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))}
'''
        s, n = re.subn(pattern, lambda m: m.group(1) + helpers, s, count=1, flags=re.S)
        if n != 1:
            fail("Ponto de inserção das funções estatísticas no relatório não encontrado")

    old_calls = "db.rpc('obter_acoes_preventivas',{data_inicio:ini.value,data_fim:fim.value})]);"
    new_calls = "db.rpc('obter_acoes_preventivas',{data_inicio:ini.value,data_fim:fim.value}),db.rpc('obter_tcos_dashboard',{data_inicio:ini.value,data_fim:fim.value}),db.rpc('obter_tcos_dashboard',{data_inicio:cr[0],data_fim:cr[1]})]);"
    s = replace_once_or_present(s, old_calls, new_calls, "relatorio.html/fontes-tco")

    old_vars = "actions=res[2].data||[],docs=rank(d,'tipo_registro'),occ="
    new_vars = "actions=res[2].data||[],tcos=filtrarTerritorio(res[3].data||[]),tcosOld=filtrarTerritorio(res[4].data||[]),docs=docsComTco(d,tcos),occ="
    s = replace_once_or_present(s, old_vars, new_vars, "relatorio.html/variaveis-tco")

    s = s.replace("docsTotal=`<tr class=\"total\"><td>TOTAL</td><td>${d.length}</td></tr>`", "docsTotal=`<tr class=\"total\"><td>TOTAL</td><td>${d.length+tcos.length}</td></tr>`", 1)

    s = s.replace("d.filter(x=>S(x.entorpecentes)==='SIM').length", "d.filter(temEntorpecente).length")
    s = s.replace("g.filter(y=>S(y.entorpecentes)==='SIM').length", "g.filter(temEntorpecente).length")
    s = s.replace("d.filter(x=>N(x.quantidade_armas)+N(x.quantidade_municoes)>0).length", "d.filter(ocorrenciaComArmasOuMunicoes).length")

    replacements = {
        "sum(d,'quantidade_armas')": "totalEstruturadoOuLegado(d,'armas_itens','quantidade_armas')",
        "sum(old,'quantidade_armas')": "totalEstruturadoOuLegado(old,'armas_itens','quantidade_armas')",
        "sum(g,'quantidade_armas')": "totalEstruturadoOuLegado(g,'armas_itens','quantidade_armas')",
        "sum(d,'quantidade_municoes')": "totalEstruturadoOuLegado(d,'municoes_itens','quantidade_municoes')",
        "sum(old,'quantidade_municoes')": "totalEstruturadoOuLegado(old,'municoes_itens','quantidade_municoes')",
        "sum(g,'quantidade_municoes')": "totalEstruturadoOuLegado(g,'municoes_itens','quantidade_municoes')",
    }
    for old, new in replacements.items():
        s = s.replace(old, new)

    old_detail = "let weapons=spec(d.map(x=>x.armas).filter(Boolean).join(';')),ammo=spec(d.map(x=>x.municoes).filter(Boolean).join(';'));"
    new_detail = "let weapons=detalhesArmasRel(d),ammo=detalhesMunicoesRel(d),entInc=incidenciaEntorpecentes(d),entMat=materiaisEntorpecentes(d);"
    s = replace_once_or_present(s, old_detail, new_detail, "relatorio.html/detalhes-apreensoes")

    if "ENTORPECENTES — INCIDÊNCIA POR OCORRÊNCIA" not in s:
        pattern = r'''(let p8=page\('3\. INFORMAÇÕES GERAIS SOBRE ATUAÇÕES DO 2º BPM'.*?\);\n)(let white=)'''
        ent_page = '''let pEnt=page('',`<h3 class="subtitle">ENTORPECENTES — INCIDÊNCIA POR OCORRÊNCIA</h3>${table(['TIPO','OCORRÊNCIAS'],entInc.map(x=>`<tr><td>${E(x[0])}</td><td>${x[1]}</td></tr>`),`<tr class="total"><td>TOTAL DE OCORRÊNCIAS COM ENTORPECENTES</td><td>${d.filter(temEntorpecente).length}</td></tr>`)}<h3 class="subtitle">ENTORPECENTES — MATERIAIS REGISTRADOS POR APRESENTAÇÃO</h3>${table(['TIPO','FORMA DE APRESENTAÇÃO','QUANTIDADE'],entMat.map(x=>`<tr><td>${E(x[0])}</td><td>${E(x[1])}</td><td>${x[2]}</td></tr>`))}<p class="source">A quantidade física é apresentada somente pela forma visual registrada na ocorrência; não são utilizados pesos ou medidas.</p>`);
'''
        s, n = re.subn(pattern, lambda m: m.group(1) + ent_page + m.group(2), s, count=1, flags=re.S)
        if n != 1:
            fail("Ponto de inserção da página de entorpecentes no relatório não encontrado")

    s = s.replace("let oldDocs=Object.fromEntries(rank(old,'tipo_registro'))", "let oldDocs=Object.fromEntries(docsComTco(old,tcosOld))", 1)

    if "+p8+pEnt+p9+" not in s:
        if "+p8+p9+" not in s:
            fail("Composição final do relatório não encontrada")
        s = s.replace("+p8+p9+", "+p8+pEnt+p9+", 1)

    p.write_text(s, encoding="utf-8")


def validate():
    cadastro = Path("cadastro.html").read_text(encoding="utf-8")
    dashboard = Path("dashboard.html").read_text(encoding="utf-8")
    relatorio = Path("relatorio.html").read_text(encoding="utf-8")

    checks = [
        ("FORMAS_ENTORPECENTES" in cadastro, "Cadastro sem catálogo de formas visuais"),
        ("UNIDADES_ENTORPECENTES" not in cadastro, "Cadastro ainda contém unidades de peso/medida"),
        ('data-item="forma_apresentacao"' in cadastro, "Cadastro não grava forma de apresentação"),
        ("step=\"1\"" in cadastro, "Quantidade de entorpecente ainda aceita decimal"),
        ("const camposDrogas" not in cadastro, "Quantidade visual ainda alimenta campos legados"),
        ("function materiaisEntorpecentes(registros)" in dashboard, "Dashboard sem lógica visual de entorpecentes"),
        ("Análise de Entorpecentes" in dashboard, "Dashboard sem seção de análise de entorpecentes"),
        ("tabEntorpecentesIncidencia" in dashboard, "Dashboard sem incidência por tipo"),
        ("obter_tcos_dashboard" in relatorio, "Relatório ainda não consulta TCOs vinculados"),
        ("ENTORPECENTES — INCIDÊNCIA POR OCORRÊNCIA" in relatorio, "Relatório sem incidência de entorpecentes"),
        ("não são utilizados pesos ou medidas" in relatorio, "Relatório sem regra explícita de peso"),
        ("detalhesArmasRel" in relatorio and "detalhesMunicoesRel" in relatorio, "Relatório ainda não usa itens estruturados de armas/munições"),
    ]
    for ok, msg in checks:
        if not ok:
            fail(msg)


if __name__ == "__main__":
    patch_cadastro()
    patch_dashboard()
    patch_relatorio()
    validate()
    print("Correção consolidada aplicada e validada.")
