export function eur(value: number | string | undefined | null): string {
  const n = Number(value ?? 0);
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function datum(value?: string | Date | null): string {
  if (!value) return '–';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function datumZeit(value?: string | Date | null): string {
  if (!value) return '–';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function kundenName(c?: {
  type?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}): string {
  if (!c) return '–';
  if (c.type === 'business' || c.companyName) return c.companyName || '–';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || '–';
}
