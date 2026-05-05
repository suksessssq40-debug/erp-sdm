import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getJakartaNow, recordSystemLog } from "@/lib/serverUtils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function escapeHtml(text: string): string {
   if (!text) return "";
   return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function GET(request: Request) {
   try {
      const CRON_SECRET = process.env.CRON_SECRET || 'Internal_Cron_Secret_2026_Secure';
      const JWT_SECRET = process.env.JWT_SECRET || 'sdm_erp_dev_secret';

      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');
      const url = new URL(request.url);
      const queryKey = url.searchParams.get("key");
      const isForce = url.searchParams.get("force") === "true";
      const customDate = url.searchParams.get("date"); // YYYY-MM-DD support

      let isAdmin = false;
      const candidateToken = token || cookies().get('token')?.value;
      if (candidateToken) {
         try {
            const decoded: any = jwt.verify(candidateToken, JWT_SECRET);
            if (decoded && ['OWNER', 'MANAGER', 'FINANCE', 'ADMIN', 'SUPERADMIN'].includes(decoded.role)) {
               isAdmin = true;
            }
         } catch (e) { }
      }

      if (token !== CRON_SECRET && queryKey !== CRON_SECRET && !isAdmin) {
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const jkt = getJakartaNow();
      let currentHour = parseInt(jkt.parts.hh);

      let targetDate = new Date();
      const jktDate = new Date(`${jkt.isoDate}T12:00:00Z`);
      targetDate = jktDate;

      let contextLabel = "HARI INI";
      let isHistorical = false;

      if (customDate) {
         targetDate = new Date(`${customDate}T12:00:00Z`);
         contextLabel = `REKAP TANGGAL ${customDate}`;
         isHistorical = true;
      } else if (isForce) {
         contextLabel = "SNAPSHOT SAAT INI";
      } else if (currentHour < 12) {
         targetDate.setDate(targetDate.getDate() - 1);
         contextLabel = "KEMARIN (FULL DAY)";
      } else {
         contextLabel = "HARI INI (ON-GOING)";
      }

      const sqlDateStr = targetDate.toISOString().split('T')[0];
      const startOfTargetDate = new Date(sqlDateStr + 'T00:00:00.000Z');
      const endOfTargetDate = new Date(sqlDateStr + 'T23:59:59.999Z');
      const displayDateStr = targetDate.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);

      const tenants = await prisma.tenant.findMany({ where: { isActive: true } });
      const results = [];

      for (const tenant of tenants) {
         try {
            const tenantId = tenant.id;
            const settings = await prisma.settings.findUnique({ where: { tenantId } });
            if (!settings || !settings.telegramBotToken || !settings.telegramOwnerChatId) continue;

            const userTime = settings.dailyRecapTime || "18:00";
            const userHour = parseInt(userTime.split(':')[0]);

            if (!isForce && !customDate && userHour !== currentHour) {
               results.push({ tenantId, status: 'skipped', reason: 'time_mismatch' });
               continue;
            }

            if (!isForce && !customDate) {
               const alreadySent = await (prisma as any).systemLog.findFirst({
                  where: {
                     actionType: 'DAILY_RECAP_AUTO',
                     tenantId,
                     details: { contains: sqlDateStr }
                  }
               });
               if (alreadySent) {
                  results.push({ tenantId, status: 'skipped', reason: 'already_sent' });
                  continue;
               }
            }

            let targetModules: string[] = [];
            try {
               targetModules = typeof settings.dailyRecapContent === 'string'
                  ? JSON.parse(settings.dailyRecapContent)
                  : (settings.dailyRecapContent as any || []);
            } catch (e) { }

            let reportTitle = isHistorical ? "📅 LAPORAN RIWAYAT HARIAN" : "📊 LAPORAN KEUANGAN TERKINI";
            let message = `<b>${reportTitle}</b> \n🏢 Unit: <b>${escapeHtml(tenant.name.toUpperCase())}</b>\n📅 Tanggal: <b>${escapeHtml(displayDateStr)}</b>\n📍 Status: <b>${contextLabel}</b>\n\n`;
            let hasData = false;

            if (targetModules.includes("omset")) {
               // 1. Fetch all active Bank/Kas accounts for this tenant (needed to detect transfers)
               const cashAccounts = await prisma.financialAccount.findMany({
                  where: {
                     tenantId,
                     isActive: true,
                     OR: [
                        { name: { startsWith: '11' } },
                        { name: { startsWith: '12' } }
                     ]
                  }
               });
               const cashAccountIds = cashAccounts.map(a => a.id);
               const accountMap: Record<string, string> = {};
               // Build lookup: id → name  AND  name(lower) → name
               cashAccounts.forEach(a => {
                  accountMap[a.id] = a.name;
               });
               // Set of bank names in lowercase for fast transfer detection
               const bankNameSet = new Set(cashAccounts.map(a => a.name.toLowerCase()));

               const dailyTransactions = await prisma.transaction.findMany({
                  where: {
                     tenantId,
                     date: { gte: startOfTargetDate, lte: endOfTargetDate },
                     status: 'PAID',
                     accountId: { in: cashAccountIds }
                  },
                  orderBy: { createdAt: 'desc' }
               });

               let dailyIn = 0;
               let dailyOut = 0;
               let dailyInDetails = '';
               let dailyOutDetails = '';
               let mutasiDetails = '';  // Internal transfers & cash movements

               dailyTransactions.forEach(t => {
                  const amt = Number(t.amount);
                  const desc = escapeHtml(t.description || t.category || 'Tanpa Keterangan');
                  const accName = escapeHtml(accountMap[t.accountId!] || 'Kas/Bank');

                  // --- Detect inter-bank transfer ---
                  // By write convention: transfers are stored as OUT where category = another bank name
                  const isTransfer = t.type === 'OUT' && !!t.category && bankNameSet.has(t.category.toLowerCase());

                  if (isTransfer) {
                     // Do NOT count in income/expense — just log as mutasi
                     const destName = escapeHtml(t.category || '');
                     mutasiDetails += `   ⁃ Rp ${amt.toLocaleString('id-ID')} | ${desc} (${accName} → ${destName})\n`;
                     return; // Skip to next transaction
                  }

                  const line = `   ⁃ Rp ${amt.toLocaleString('id-ID')} | <i>${desc}</i> (${accName})\n`;

                  if (t.type === 'IN') {
                     dailyIn += amt;
                     dailyInDetails += line;
                  } else {
                     dailyOut += amt;
                     dailyOutDetails += line;
                  }
               });

               // Build the Telegram message sections
               message += `💰 <b>ALIRAN KAS HARIAN</b>\n`;
               message += `📥 <b>MASUK: Rp ${dailyIn.toLocaleString('id-ID')}</b>\n`;
               message += dailyInDetails || `   ⁃ <i>(Tidak ada pemasukan)</i>\n`;

               message += `📤 <b>KELUAR: Rp ${dailyOut.toLocaleString('id-ID')}</b>\n`;
               message += dailyOutDetails || `   ⁃ <i>(Tidak ada pengeluaran)</i>\n`;

               message += `💵 <b>NET HARI INI: Rp ${(dailyIn - dailyOut).toLocaleString('id-ID')}</b>\n`;

               // Show internal transfers in a dedicated block if any exist
               if (mutasiDetails) {
                  message += `\n🔄 <b>MUTASI KAS INTERNAL (Tidak Mempengaruhi Omset)</b>\n`;
                  message += mutasiDetails;
               }

               message += `\n`;

               // --- Saldo Posisi ---
               message += `🏦 <b>POSISI SALDO KAS & BANK</b>\n`;
               let totalAll = 0;
               cashAccounts.sort((a, b) => a.name.localeCompare(b.name)).forEach(acc => {
                  const bal = Number(acc.balance || 0);
                  totalAll += bal;
                  message += `⁃ ${escapeHtml(acc.name)}: Rp ${bal.toLocaleString('id-ID')}\n`;
               });
               message += `🧮 <b>TOTAL LIKUID: Rp ${totalAll.toLocaleString('id-ID')}</b>\n\n`;
               hasData = true;
            }

            if (targetModules.includes("attendance")) {
               const present = await prisma.attendance.findMany({
                  where: { tenantId, date: sqlDateStr },
                  include: { user: true }
               });
               message += `👥 <b>ABSENSI (${present.length} Hadir)</b>\n`;
               const lates = present.filter(p => p.isLate);
               if (lates.length > 0) {
                  message += `⚠️ <b>TERLAMBAT (${lates.length}):</b>\n`;
                  lates.forEach((l, i) => {
                     message += `   ${i + 1}. ${escapeHtml(l.user?.name || 'Unknown')} ${l.lateReason ? `("${escapeHtml(l.lateReason)}")` : ''}\n`;
                  });
               } else {
                  message += `   ✨ ${present.length > 0 ? "Kedisiplinan Sempurna" : "Tidak ada data absen"}\n`;
               }
               message += `\n`;
               hasData = true;
            }

            if (targetModules.includes("requests")) {
               const pendings = await prisma.leaveRequest.count({
                  where: { tenantId, status: 'PENDING' }
               });
               if (pendings > 0) {
                  message += `📩 <b>${pendings} PERMOHONAN PENDING</b>\n<i>Mohon segera direview di Dashboard.</i>\n\n`;
                  hasData = true;
               }
            }

            if (hasData) {
               message += `<i>SDM ERP Intelligence System • ${jkt.isoTime} WIB</i>`;
               const teleRes = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                     chat_id: settings.telegramOwnerChatId,
                     text: message,
                     parse_mode: 'HTML'
                  })
               });

               if (teleRes.ok) {
                  await recordSystemLog({
                     actorId: 'SYSTEM', actorName: 'Cron Job', actorRole: 'SYSTEM',
                     actionType: customDate ? 'DAILY_RECAP_MANUAL' : 'DAILY_RECAP_AUTO',
                     details: `Sent recap for ${sqlDateStr}`,
                     targetObj: 'Telegram', tenantId
                  });
                  results.push({ tenantId, status: 'sent' });
               } else {
                  const errJson = await teleRes.json();
                  results.push({ tenantId, status: 'error', error: errJson.description });
               }
            }

         } catch (err: any) {
            console.error(`Error tenant ${tenant.name}:`, err);
            results.push({ tenantId: tenant.id, status: 'error', error: err.message });
         }
      }

      return NextResponse.json({ success: true, results });

   } catch (error: any) {
      console.error('Cron Error:', error);
      return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
   }
}
