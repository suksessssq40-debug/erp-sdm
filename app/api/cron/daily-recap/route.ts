import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getJakartaNow, recordSystemLog, serialize } from "@/lib/serverUtils";

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

      let isAdmin = false;
      const candidateToken = token || cookies().get('token')?.value;
      if (candidateToken) {
         try {
            const decoded: any = jwt.verify(candidateToken, JWT_SECRET);
            if (decoded && ['OWNER', 'MANAGER', 'FINANCE', 'ADMIN'].includes(decoded.role)) {
               isAdmin = true;
            }
         } catch (e) { }
      }

      if (token !== CRON_SECRET && queryKey !== CRON_SECRET && !isAdmin) {
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const jkt = getJakartaNow();
      const currentHour = parseInt(jkt.parts.hh);

      let targetDate = new Date();
      targetDate.setHours(12, 0, 0, 0); // Normalize to midday

      let contextLabel = "HARI INI";
      let reportTitle = "LAPORAN HARIAN TERKINI";

      if (isForce) {
         contextLabel = "SNAPSHOT SAAT INI";
         reportTitle = "📢 LAPORAN SITUASI TERKINI";
      } else if (currentHour < 12) {
         targetDate.setDate(targetDate.getDate() - 1);
         contextLabel = "KEMARIN (FULL DAY)";
         reportTitle = "🔔 REKAP HARIAN FINAL (KEMARIN)";
      } else {
         contextLabel = "HARI INI (ON-GOING)";
         reportTitle = "🔔 LAPORAN HARIAN SEMENTARA";
      }

      const sqlDateStr = targetDate.toISOString().split('T')[0];
      const displayDateStr = targetDate.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      const tenants = await prisma.tenant.findMany({ where: { isActive: true } });
      const results = [];

      for (const tenant of tenants) {
         try {
            const tenantId = tenant.id;
            const settings = await prisma.settings.findUnique({ where: { tenantId } });
            if (!settings) continue;

            // --- [AUTO-HEALING] Balance Calibration ---
            const accounts = await prisma.financialAccount.findMany({ where: { tenantId } });
            for (const acc of accounts) {
               const agg = await prisma.transaction.aggregate({
                  where: { accountId: acc.id, tenantId },
                  _sum: { amount: true }
               });
               // Note: Complex IN/OUT logic might need more nuance if using balance field
               // For now we just log that we are processing
            }

            if (!settings.telegramBotToken || !settings.telegramOwnerChatId) continue;

            const userTime = settings.dailyRecapTime || "18:00";
            const userHour = parseInt(userTime.split(':')[0]);

            if (!isForce && userHour !== currentHour) {
               results.push({ tenantId, status: 'skipped', reason: 'time_mismatch' });
               continue;
            }

            if (!isForce) {
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

            let message = `<b>${reportTitle}</b> \n🏢 Unit: <b>${escapeHtml(tenant.name.toUpperCase())}</b>\n📅 Data: <b>${escapeHtml(displayDateStr)}</b> (${contextLabel})\n\n`;
            let hasData = false;

            // Finance
            if (targetModules.includes("omset")) {
               const income = await prisma.transaction.aggregate({
                  where: { tenantId, date: { gte: new Date(sqlDateStr), lt: new Date(new Date(sqlDateStr).getTime() + 86400000) }, type: 'IN' },
                  _sum: { amount: true }
               });
               const expense = await prisma.transaction.aggregate({
                  where: { tenantId, date: { gte: new Date(sqlDateStr), lt: new Date(new Date(sqlDateStr).getTime() + 86400000) }, type: 'OUT' },
                  _sum: { amount: true }
               });
               const inc = Number(income._sum.amount || 0);
               const exp = Number(expense._sum.amount || 0);
               message += `💰 <b>KEUANGAN</b>\n📥 Masuk: Rp ${inc.toLocaleString('id-ID')}\n📤 Keluar: Rp ${exp.toLocaleString('id-ID')}\n💵 <b>NET: Rp ${(inc - exp).toLocaleString('id-ID')}</b>\n\n`;
               hasData = true;
            }

            // Attendance
            if (targetModules.includes("attendance")) {
               const present = await prisma.attendance.findMany({
                  where: { tenantId, date: sqlDateStr },
                  include: { user: true, shift: true }
               });
               message += `👥 <b>ABSENSI SDM (${present.length} Hadir)</b>\n`;
               const lates = present.filter(p => p.isLate);
               if (lates.length > 0) {
                  message += `⚠️ <b>TERLAMBAT (${lates.length}):</b>\n`;
                  lates.forEach((l, i) => {
                     message += `   ${i + 1}. ${escapeHtml(l.user?.name || 'Unknown')} ${l.lateReason ? `("${escapeHtml(l.lateReason)}")` : ''}\n`;
                  });
               } else {
                  message += `   ✨ <b>Semua On-Time</b>\n`;
               }
               message += `\n`;
               hasData = true;
            }

            if (hasData) {
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
                     actionType: 'DAILY_RECAP_AUTO', details: `Sent daily recap for ${sqlDateStr}`,
                     targetObj: 'Telegram', tenantId
                  });
                  results.push({ tenantId, status: 'sent' });
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

