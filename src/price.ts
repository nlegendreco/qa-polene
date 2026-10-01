/**
 * Convertit un prix affiché en centimes : "640 €", "640,00 €", "1 290,00 €", "€495,95", "€1,290.00", "$880".
 * Les décimales sont les 2 chiffres qui suivent le dernier séparateur (virgule ou point).
 * Renvoie null si aucun prix n'est trouvé.
 */
export function parsePriceToCents(text: string): number | null {
  const normalized = text.replace(/[  ]/g, ' ');
  const match = normalized.match(/[€$£]\s*(\d[\d., ]*)|(\d[\d., ]*?)\s*[€$£]/);
  if (!match) return null;
  const amount = (match[1] ?? match[2]).trim().replace(/ /g, '');
  const decimals = amount.match(/[.,](\d{2})$/);
  const integerPart = (decimals ? amount.slice(0, -3) : amount).replace(/[.,]/g, '');
  return Number(integerPart) * 100 + Number(decimals?.[1] ?? 0);
}

export function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}
