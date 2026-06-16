const REPORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

const REPORT_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Tanggal pelaporan (date field) — e.g. "Sen, 15 Jun 2026" */
export function formatReportDate(dateStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return dateStr;
  return date.toLocaleDateString('id-ID', REPORT_DATE_OPTIONS);
}

/** Timestamp sistem — e.g. "15 Jun 2026, 14.32" */
export function formatReportDateTime(isoStr: string): string {
  const date = parseDate(isoStr);
  if (!date) return '';
  return date.toLocaleString('id-ID', REPORT_DATETIME_OPTIONS);
}

/** True jika laporan pernah diedit setelah dibuat */
export function wasReportUpdated(createdAt?: string, updatedAt?: string): boolean {
  if (!createdAt || !updatedAt) return false;
  return new Date(updatedAt).getTime() > new Date(createdAt).getTime();
}
