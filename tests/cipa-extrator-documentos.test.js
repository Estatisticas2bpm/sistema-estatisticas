const assert=require('node:assert/strict');
const {extrair,documentos}=require('../cipa-extrator.js');
// Dados sintéticos: não contém informação pessoal do PPE real.
const relatorio=[
'RELATO/HISTÓRICO',
'O policial informou AUTO DE INFRAÇÃO Nº 2099000002 e TERMO DE EMBARGO/INTERDIÇÃO Nº 2099000004 no relato.',
'Fls: 19',
'AUTO DE INFRAÇÃO Nº 2099000001',
'☒ Multa Simples ☒ Embargo',
'(03) NOME DO AUTUADO',
'(04) NATURALIDADE',
'PESSOA TESTE',
'(12) DESCRIÇÃO DA INFRAÇÃO',
'Destruir vegetação em reserva legal.',
'(13) DISPOSITIVOS LEGAIS INFRIGIDOS',
'Legislação: Decreto Federal 6.514/08',
'Artigo: Art. 51. Destruir, desmatar, danificar.',
'Legislação: Lei Federal 9.605/98',
'Artigo: Art. 50. Destruir ou danificar vegetação.',
'(14) ÁREA',
'21,7218 Hectares',
'(15) VALOR DA MULTA',
'R$ 110.000,00 (Cento e dez mil)',
'(16) DESCRIÇÃO DAS DEMAIS SANÇÕES ADMINISTRATIVAS APLICADAS',
'Fica embargada.',
'(18) DATA DA AUTUAÇÃO',
'(17) HORA DA AUTUAÇÃO',
'07/07/2026',
'(19) DATA DO VENCIMENTO DO AUTO DE INFRAÇÃO',
'AUTO DE INFRAÇÃO Nº 2099000002',
'☒ Multa Simples ☒ Embargo',
'(03) NOME DO AUTUADO',
'PESSOA TESTE',
'(12) DESCRIÇÃO DA INFRAÇÃO',
'Desmatar 2,48 ha fora da reserva legal.',
'(13) DISPOSITIVOS LEGAIS INFRIGIDOS',
'Legislação: Decreto Federal 6.514/08',
'Artigo: Art. 52. Desmatar, a corte raso.',
'(14) ÁREA',
'2,4880 Hectares',
'(15) VALOR DA MULTA',
'R$ 3.000,00',
'(16) SANÇÕES',
'(18) DATA DA AUTUAÇÃO',
'(17) HORA DA AUTUAÇÃO',
'04/08/2026',
'(19) DATA DO VENCIMENTO',
'TERMO DE EMBARGO/INTERDIÇÃO Nº 2099000003',
'(13) DISPOSITIVOS LEGAIS INFRIGIDOS',
'Legislação: Decreto Federal 6.514/08',
'Artigo: Art. 51.',
'Legislação: Lei Federal 9.605/98',
'Artigo: Art. 50.',
'(14) DESCRIÇÃO DAS DEMAIS SANÇÕES ADMINISTRATIVAS APLICADAS',
'Fica embargada a área descrita no processo.',
'(15) AUTO DE INFRAÇÃO ORIGINÁRIO',
'2099000001',
'(17) DATA DA AUTUAÇÃO',
'(16) HORA DA AUTUAÇÃO',
'07/07/2026',
'(18) DATA DO VENCIMENTO DO TERMO',
'TERMO DE EMBARGO/INTERDIÇÃO Nº 2099000004',
'(13) DISPOSITIVOS LEGAIS INFRIGIDOS',
'Legislação: Decreto Federal 6.514/08',
'Artigo: Art. 52.',
'(14) DESCRIÇÃO DAS DEMAIS SANÇÕES ADMINISTRATIVAS APLICADAS',
'Fica embargada.',
'(15) AUTO DE INFRAÇÃO ORIGINÁRIO',
'2099000002',
'(17) DATA DA AUTUAÇÃO',
'(16) HORA DA AUTUAÇÃO',
'04/08/2026',
'(18) DATA DO VENCIMENTO DO TERMO'
].join('\n');
const docs=documentos(relatorio);
assert.equal(docs.length,4,'narrativa não deve abrir novo bloco administrativo');
const r=extrair(relatorio);
assert.equal(r.autos.length,2);
assert.equal(r.embargos.length,2);
const a=r.autos.find(x=>x.numero==='2099000001');
assert.equal(a.data_autuacao,'2026-07-07');
assert.equal(a.autuado,'PESSOA TESTE');
assert.equal(a.tipo_sancao,'MULTA SIMPLES E EMBARGO');
assert.equal(a.valor_multa,110000);
assert.equal(a.area_embargada_ha,21.7218);
assert.equal(a.art_dec_6514,'51');
assert.equal(a.art_lei_9605,'50');
const b=r.autos.find(x=>x.numero==='2099000002');
assert.equal(b.data_autuacao,'2026-08-04');
assert.equal(b.valor_multa,3000);
assert.equal(b.area_embargada_ha,2.488);
assert.equal(b.art_dec_6514,'52');
assert.equal(b.art_lei_9605,'');
const t=r.embargos.find(x=>x.numero==='2099000003');
assert.equal(t.auto_infracao_originario,'2099000001');
assert.equal(t.data_embargo,'2026-07-07');
assert.equal(t.area_embargada_ha,21.7218);
assert.match(t.descricao,/Art\. 51 do Decreto/);
const t2=r.embargos.find(x=>x.numero==='2099000004');
assert.equal(t2.auto_infracao_originario,'2099000002');
assert.equal(t2.area_embargada_ha,2.488);
assert.match(t2.descricao,/Art\. 52 do Decreto/);
console.log('PASS: dois autos e dois termos estruturados, datas, multas, áreas e vínculos.');
