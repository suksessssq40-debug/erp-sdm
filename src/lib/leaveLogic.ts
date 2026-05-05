import { prisma } from './prisma';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Normalize type strings defensively (e.g. "sakit", "SAKIT", "Sakit" → "SAKIT")
// ─────────────────────────────────────────────────────────────────────────────
function normalizeType(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().trim();
}

/** Calculate inclusive day count between two dates. Minimum 1. */
function calcDays(startDate: Date, endDate?: Date | null): number {
  const s = new Date(startDate);
  const e = endDate ? new Date(endDate) : new Date(startDate);
  // Normalise to midnight so timezone offset doesn't bleed into date diff
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diffMs = e.getTime() - s.getTime();
  // Allow end < start (e.g. same-day permit) → treat as 1 day
  return diffMs < 0 ? 1 : Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// validateAndCalculateRequest
//
// Validates a new leave/permit/sick submission and returns enforcement metadata.
// Throws a user-friendly Error if ANY SOP rule is violated — the caller must
// surface these messages directly to the user (no extra wrapping).
// ─────────────────────────────────────────────────────────────────────────────
export async function validateAndCalculateRequest(payload: {
  userId: string;
  tenantId: string;
  type: string;
  startDate: Date;
  endDate?: Date | null;
  hasAttachment: boolean;
  tenantPolicy?: {
    leaveWeeklyLimit: number;
    leaveAnnualQuota: number;
    leaveSuddenPenalty: number;
    leaveNoticeThreshold: number;
    leaveNoticeRequired: number;
    leaveSuddenHourCutoff: number;
  } | null;
}) {
  const { userId, tenantId, type, startDate, endDate, hasAttachment, tenantPolicy } = payload;
  const typeUpper = normalizeType(type);

  // ── 0. Fetch Tenant Policy ──────────────────────────────────────────────
  const tp = tenantPolicy ?? await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      leaveWeeklyLimit: true,
      leaveAnnualQuota: true,
      leaveSuddenPenalty: true,
      leaveNoticeThreshold: true,
      leaveNoticeRequired: true,
      leaveSuddenHourCutoff: true,
    },
  });
  if (!tp) throw new Error('Konfigurasi kantor tidak ditemukan. Hubungi Owner.');

  // ── 1. Jakarta "now" ────────────────────────────────────────────────────
  const nowUtc = new Date();
  const jktNow = new Date(nowUtc.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const todayStr = `${jktNow.getFullYear()}-${String(jktNow.getMonth() + 1).padStart(2, '0')}-${String(jktNow.getDate()).padStart(2, '0')}`;
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

  // ── 2. Duration ─────────────────────────────────────────────────────────
  const diffDays = calcDays(startDate, endDate);

  // ── 3. SOP per type ─────────────────────────────────────────────────────
  let isSudden = false;
  let penaltyWeight = 1;
  let hasDoctorNote = false;

  if (typeUpper === 'SAKIT') {
    // SICK: Requires doctor note as attachment to exempt from quota
    if (!hasAttachment) {
      throw new Error(
        'Permohonan Sakit WAJIB melampirkan Surat Dokter atau bukti medis. ' +
        'Silakan unggah dokumen sebelum mengajukan.'
      );
    }
    hasDoctorNote = true;
    penaltyWeight = 0; // Does NOT consume annual leave quota
    // Do NOT apply weekly limit for SAKIT with doctor note (falls through to Step 4 skip)

  } else {
    // ── 3a. Sudden Leave Detection ────────────────────────────────────────
    const tomorrowStr = (() => {
      const d = new Date(jktNow);
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    if (startStr === todayStr) {
      // H-0 = definitely sudden
      isSudden = true;
    } else if (startStr === tomorrowStr && jktNow.getHours() >= tp.leaveSuddenHourCutoff) {
      // H-1 but AFTER cut-off hour = sudden
      isSudden = true;
    }

    // ── 3b. Long-leave notice requirement ────────────────────────────────
    if (diffDays >= tp.leaveNoticeThreshold) {
      const earliestAllowed = new Date(jktNow);
      earliestAllowed.setDate(earliestAllowed.getDate() + tp.leaveNoticeRequired);
      earliestAllowed.setHours(0, 0, 0, 0);
      if (startDate < earliestAllowed) {
        isSudden = true; // Missing advance notice → apply penalty
      }
    }

    if (isSudden) {
      penaltyWeight = tp.leaveSuddenPenalty;
    }

    // ── 4. Weekly Limit Check ─────────────────────────────────────────────
    // Rule: Max N requests (PENDING or APPROVED) per week (Mon–Sun),
    //       excluding SAKIT with doctor note.
    // The week is based on the START DATE of the requested leave, NOT today.
    const weekStart = new Date(startDate);
    weekStart.setHours(0, 0, 0, 0);
    const dayOfWeek = weekStart.getDay(); // 0 = Sun
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(weekStart.getDate() + daysToMonday);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weeklyCount = await prisma.leaveRequest.count({
      where: {
        userId,
        tenantId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { gte: weekStart, lte: weekEnd },
        // Exclude SAKIT with doctor note — they're exempt from the weekly limit
        NOT: {
          AND: [
            { type: { in: ['SAKIT', 'sakit', 'Sakit'] } },
            { hasDoctorNote: true },
          ],
        },
      },
    });

    const limit = tp.leaveWeeklyLimit ?? 1;
    // 99 = unlimited (escape hatch for owners/special cases)
    if (limit !== 99 && weeklyCount >= limit) {
      throw new Error(
        `Anda sudah mencapai batas izin/cuti minggu tersebut ` +
        `(Maks. ${limit}x per Senin–Minggu). Pengajuan sakit dengan Surat Dokter tidak terhitung.`
      );
    }
  }

  // ── 5. Annual Quota Check ───────────────────────────────────────────────
  // Skip for SAKIT with note (penaltyWeight = 0)
  if (penaltyWeight > 0) {
    const currentYear = startDate.getFullYear();
    const quota = await prisma.leaveQuota.findUnique({
      where: { userId_year: { userId, year: currentYear } },
    });

    const totalQuota = quota?.totalQuota ?? tp.leaveAnnualQuota;
    const remaining  = quota?.remainingQuota ?? totalQuota;
    const required   = penaltyWeight * diffDays;

    if (required > remaining) {
      throw new Error(
        `Jatah cuti tidak mencukupi untuk tahun ${currentYear}. ` +
        `Sisa: ${remaining} hari, Dibutuhkan: ${required} hari ` +
        `(${diffDays} hari × Faktor ${penaltyWeight}${penaltyWeight > 1 ? ' (mendadak)' : ''}).`
      );
    }
  }

  return {
    isSudden,
    penaltyWeight,
    hasDoctorNote,
    diffDays,
  };
}
