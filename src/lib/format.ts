const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  GBP: '£',
  AUD: 'A$',
};

/** Format a number as currency using the user's chosen currency symbol. */
export function formatCurrency(amount: number, currency = 'INR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? '';
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  return `${symbol}${(amount ?? 0).toLocaleString(locale, { maximumFractionDigits: 0 })}`;
}

/** Initials for an avatar, e.g. "Sampath Komarapuri" -> "SK". */
export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
