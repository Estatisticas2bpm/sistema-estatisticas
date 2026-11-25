// Preços de referência: OpenAI API Standard, gpt-5.6-luna,
// USD por 1 milhão de tokens: entrada 0,20; saída 1,20.
// Revalidar a tabela de preços antes da homologação.
export const MODELO_HOMOLOGAVEL = "gpt-5.6-luna";
export const PRECO_USD_ENTRADA_1M = 0.20;
export const PRECO_USD_SAIDA_1M = 1.20;
export const MAX_TOKENS_SAIDA = 800;
export const MAX_BYTES_ENTRADA = 80000;

// Exige câmbio institucional de reserva conservador (mínimo 8 BRL/USD),
// INDEPENDENTEMENTE da cotação de mercado, com margem financeira adicional 2x.
// Não consulta serviços externos de câmbio.
export function cambioReservaValido(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero >= 8 && numero <= 30 ? numero : null;
}
export function calcularReservaCentavos(bytesEntrada, cambioReserva) {
  const cambio = cambioReservaValido(cambioReserva);
  if (!Number.isSafeInteger(bytesEntrada) || bytesEntrada < 0 ||
      bytesEntrada > MAX_BYTES_ENTRADA || cambio === null) return null;
  // Limite conservador: tokens de entrada <= bytes UTF-8 + margem de enquadramento.
  const tokensEntradaMax = bytesEntrada + 2048;
  const usd = (tokensEntradaMax * PRECO_USD_ENTRADA_1M +
               MAX_TOKENS_SAIDA * PRECO_USD_SAIDA_1M) / 1000000;
  // Dobro de proteção para variação cambial, tributos e discrepâncias de faturamento.
  return Math.max(1, Math.ceil(usd * cambio * 100 * 2));
}
export function calcularCustoCentavos(tokensEntrada, tokensSaida, cambioReserva) {
  const cambio = cambioReservaValido(cambioReserva);
  if (!Number.isSafeInteger(tokensEntrada) || tokensEntrada < 0 ||
      !Number.isSafeInteger(tokensSaida) || tokensSaida < 0 ||
      cambio === null) return null;
  const usd = (tokensEntrada * PRECO_USD_ENTRADA_1M +
               tokensSaida * PRECO_USD_SAIDA_1M) / 1000000;
  return Math.ceil(usd * cambio * 100 * 2);
}
