import type { DailyReport as PrismaDailyReport } from '@prisma/client';
import type { DailyReport } from '@/types';

function parseActivities(activitiesJson: string | null | undefined): DailyReport['activities'] {
  if (!activitiesJson) return [];
  try {
    const parsed = JSON.parse(activitiesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Normalizes a Prisma DailyReport row into the API/client shape. */
export function serializeDailyReport(row: PrismaDailyReport): DailyReport {
  return {
    id: row.id,
    userId: row.userId ?? '',
    date: row.date ?? '',
    activities: parseActivities(row.activitiesJson),
    createdAt: row.createdAt?.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}
