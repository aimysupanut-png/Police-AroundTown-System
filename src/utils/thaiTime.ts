
export const THAI_TIMEZONE = 'Asia/Bangkok';

export function formatThaiDateTime(value: string | number | Date | undefined | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', {
    timeZone: THAI_TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
