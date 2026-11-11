// Regras puras e testáveis do assistente estatístico CPC.
// Não exportar dados de pessoas, relatos ou documentos para o provedor.
export function categoria(v) {
  const texto = String(v ?? "").replace(/\s+/g, " ").trim();
  if (!texto || texto.length > 65 || !/^[\p{L}\p{N} .,()\-\/]+$/u.test(texto)) return "NÃO CLASSIFICADO";
  return texto.toUpperCase();
}
export function ranking(m, maximo = 10) {
  return [...m.entries()].filter(([, quantidade]) => quantidade >= 5)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .slice(0, maximo)
    .map(([nome, quantidade]) => ({ nome, quantidade }));
}
export function somar(m, k, quantidade = 1) {
  m.set(k, (m.get(k) || 0) + quantidade);
}
export function conducoesOperacionaisPorOcorrencia(conduzidos, prisoes) {
  const nConduzidos = Number(conduzidos) || 0;
  const nPrisoes = Number(prisoes) || 0;
  return Math.max(0, nConduzidos, nPrisoes);
}
