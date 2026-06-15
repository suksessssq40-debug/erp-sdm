
import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Helper to escape HTML characters for Telegram
function escapeHtml(text: string): string {
   if (!text) return "";
   return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
}

export async function GET(request: Request) {
   try {
      // 1. SECURITY CHECK (Gembok Pintu)
      const CRON_SECRET = process.env.CRON_SECRET || 'Internal_Cron_Secret_2026_Secure';
      const JWT_SECRET = process.env.JWT_SECRET || 'sdm_erp_dev_secret'; // FIXED: Match Login Secret

      const authHeader = request.headers.get('authorization');
      const token = authHeader?.replace('Bearer ', '');

      // Izinkan jika token cocok, ATAU jika ada parameter ?key=... (untuk testing manual browser)
      const url = new URL(request.url);
      const queryKey = url.searchParams.get("key");
      const isForce = url.searchParams.get("force") === "true";

      // -- VIP CHECK: Apakah ini Admin yang sedang login? --
      let isAdmin = false;

      // Coba baca token dari Header ATAU Cookie
      const candidateToken = token || cookies().get('token')?.value;

      if (candidateToken) {
         try {
            // Cek apakah token ini valid JWT milik Admin?
            const decoded: any = jwt.verify(candidateToken, JWT_SECRET);
            if (decoded && (decoded.role === 'OWNER' || decoded.role === 'ADMIN' || decoded.role === 'super_admin')) {
               isAdmin = true;
            }
         } catch (e) { }
      }

      // Gembok Utama: Tolak jika BUKAN Secret Key DAN BUKAN Admin
      if (token !== CRON_SECRET && queryKey !== CRON_SECRET && !isAdmin) {
         return NextResponse.json({ error: 'Unauthorized: Access Denied. Kunci Salah.' }, { status: 401 });
      }

      // 2. Establish Current Time (WIB) using a robust formatter
      const now = new Date();
      const jakartaFormatter = new Intl.DateTimeFormat('en-US', {
         timeZone: 'Asia/Jakarta',
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
         hour: '2-digit',
         minute: '2-digit',
         second: '2-digit',
         hour12: false
      });

      const jakartaTimeStr = jakartaFormatter.format(now);
      const parts = jakartaFormatter.formatToParts(now);
      const getP = (t: string) => parts.find(p => p.type === t)?.value || '';

      const currentHour = parseInt(getP('hour'));
      const yyyy = getP('year');
      const mm = getP('month');
      const dd = getP('day');

      // Construct a safe date object for today in Jakarta
      let targetDate = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);

      let contextLabel = "HARI INI";
      let reportTitle = "LAPORAN HARIAN TERKINI";

      // LOGIKA TANGGAL PINTAR (Smart Date Logic)
      if (isForce) {
         contextLabel = "SNAPSHOT SAAT INI";
         reportTitle = "📢 LAPORAN SITUASI TERKINI";
         // targetDate remains today
      }
      else if (currentHour < 12) {
         // If running in early morning (e.g., 5 AM), report on YESTERDAY
         targetDate.setDate(targetDate.getDate() - 1);
         contextLabel = "KEMARIN (FULL DAY)";
         reportTitle = "🔔 REKAP HARIAN FINAL (KEMARIN)";
      }
      else {
         contextLabel = "HARI INI (ON-GOING)";
         reportTitle = "🔔 LAPORAN HARIAN SEMENTARA";
      }

      // Re-format targetDate to SQL String
      const ty = targetDate.getFullYear();
      const tm = String(targetDate.getMonth() + 1).padStart(2, "0");
      const td = String(targetDate.getDate()).padStart(2, "0");
      const sqlDateStr = `${ty}-${tm}-${td}`; // YYYY-MM-DD

      const displayDateStr = targetDate.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

      // 3. Fetch Tenants
      const tenantsRes = await pool.query("SELECT * FROM tenants WHERE is_active = true");
      const results = [];

      for (const tenant of tenantsRes.rows) {
         try {
            const tenantId = tenant.id;

            // Get Settings
            const settingsRes = await pool.query("SELECT * FROM settings WHERE tenant_id = $1", [tenantId]);
            if (settingsRes.rows.length === 0) continue;
            const settings = settingsRes.rows[0];

            // --- [AUTO-HEALING] Sinkronisasi Saldo Akun Setiap Hari ---
            console.log(`[AUTO-HEALING] Calibrating balances for tenant: ${tenantId}`);
            const accountsRes = await pool.query("SELECT id FROM financial_accounts WHERE tenant_id = $1", [tenantId]);
            for (const acc of accountsRes.rows) {
               await pool.query(`
                UPDATE financial_accounts 
                SET balance = (
                    SELECT COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0)
                    FROM transactions 
                    WHERE account_id = $1 AND tenant_id = $2
                )
                WHERE id = $1 AND tenant_id = $2
              `, [acc.id, tenantId]);
            }
            // --- END AUTO-HEALING ---

            // Check Telegram Config
            if (!settings.telegram_bot_token || !settings.telegram_owner_chat_id) continue;

            // Check Time Schedule
            const userTime = settings.daily_recap_time || "05:00";
            const userHour = parseInt(userTime.split(':')[0]);

            if (!isForce && userHour !== currentHour) {
               results.push({ tenantId, status: 'skipped', reason: 'time_mismatch', assigned: userTime, current: currentHour });
               continue; // Not the time yet
            }

            // Deduplication check...
            if (!isForce) {
               // ... [Log check remains same logic, just ensure variable names match] ...
               const logCheck = await pool.query(
                  `SELECT id FROM system_logs WHERE action_type = 'DAILY_RECAP_AUTO' AND details LIKE $1 AND actor_id = $2 LIMIT 1`,
                  [`%${sqlDateStr}%`, `system_${tenantId}`]
               );
               if (logCheck.rows.length > 0) {
                  results.push({ tenantId, status: 'skipped', reason: 'already_sent_today' });
                  continue;
               }
            }

            // 4. GENERATE CONTENT (HTML MODE)
            let targetModules: string[] = [];
            try {
               targetModules = typeof settings.daily_recap_content === 'string'
                  ? JSON.parse(settings.daily_recap_content)
                  : (settings.daily_recap_content || []);
            } catch (e) { targetModules = []; }

            let message = `<b>${reportTitle}</b> \n🏢 Unit: <b>${escapeHtml(tenant.name.toUpperCase())}</b>\n📅 Data: <b>${escapeHtml(displayDateStr)}</b> (${contextLabel})\n\n`;
            let hasData = false;


            // -- MODULE: FINANCE --
            if (targetModules.includes("omset")) {
               const resFin = await pool.query(`
                SELECT 
                   COALESCE(SUM(amount) FILTER (WHERE type='IN'), 0) as income,
                   COALESCE(SUM(amount) FILTER (WHERE type='OUT'), 0) as expense
                FROM transactions 
                WHERE date >= $1::date AND date < ($1::date + '1 day'::interval) AND tenant_id = $2
             `, [sqlDateStr, tenantId]);
               const { income, expense } = resFin.rows[0];
               const net = Number(income) - Number(expense);

               message += `💰 <b>KEUANGAN</b>\n`;
               message += `📥 Masuk: Rp ${Number(income).toLocaleString('id-ID')}\n`;
               message += `📤 Keluar: Rp ${Number(expense).toLocaleString('id-ID')}\n`;
               message += `💵 <b>NET: Rp ${net.toLocaleString('id-ID')}</b>\n\n`;
               hasData = true;
            }

            // -- MODULE: ATTENDANCE (DETAILED) --
            if (targetModules.includes("attendance")) {
               // 1. Get Shift Breakdown and Overall Counts
               const resAtt = await pool.query(`
                SELECT 
                   a.shift_id,
                   s.name as shift_name,
                   COUNT(*) as count
                FROM attendance a
                LEFT JOIN shifts s ON a.shift_id = s.id
                WHERE a.date = $1 AND a.tenant_id = $2 AND a.time_in IS NOT NULL
                GROUP BY a.shift_id, s.name
             `, [sqlDateStr, tenantId]);

               // 2. Get Late List with Reasons
               const resLate = await pool.query(`
                SELECT 
                   u.name,
                   a.late_reason
                FROM attendance a
                JOIN users u ON a.user_id = u.id
                WHERE a.date = $1 AND a.tenant_id = $2 AND a.is_late = 1
             `, [sqlDateStr, tenantId]);

               const totalPresent = resAtt.rows.reduce((sum: number, r: any) => sum + Number(r.count), 0);
               const totalLate = resLate.rows.length;

               message += `👥 <b>ABSENSI SDM (${totalPresent} Hadir)</b>\n`;

               // Shift Detail
               if (resAtt.rows.length > 0) {
                  resAtt.rows.forEach((r: any) => {
                     const shiftName = r.shift_name ? r.shift_name : 'Non-Shift';
                     message += `   • ${escapeHtml(shiftName)}: ${r.count}\n`;
                  });
               } else {
                  message += `   <i>(Tidak ada absensi masuk)</i>\n`;
               }

               // Late Detail
               if (totalLate > 0) {
                  message += `\n⚠️ <b>TERLAMBAT (${totalLate} Orang):</b>\n`;
                  resLate.rows.forEach((r: any, idx: number) => {
                     const reason = r.late_reason ? `("${escapeHtml(r.late_reason)}")` : '';
                     message += `   ${idx + 1}. ${escapeHtml(r.name)} ${reason}\n`;
                  });
               } else {
                  message += `   ✨ <b>Semua On-Time</b>\n`;
               }
               message += `\n`;
               hasData = true;
            }

            // -- MODULE: PROJECT --
            if (targetModules.includes("projects")) {
               const resProj = await pool.query(`
                SELECT status, COUNT(*) as cnt FROM projects WHERE tenant_id = $1 GROUP BY status ORDER BY status
             `, [tenantId]);

               message += `📊 <b>PROJECT STATUS</b>\n`;
               const statusEmoji: Record<string, string> = {
                  DONE: '✅', PREVIEW: '👀', DOING: '🔥', TODO: '📋', ON_GOING: '🚀', REVISION: '🛠️'
               };

               if (resProj.rows.length === 0) {
                  message += `   <i>(Tidak ada project aktif)</i>\n`;
               } else {
                  resProj.rows.forEach((row: any) => {
                     const s = row.status;
                     const icon = statusEmoji[s] || '🔹';
                     message += `   ${icon} ${s}: ${row.cnt}\n`;
                  });
               }
               message += `\n`;
               hasData = true;
            }

            // -- MODULE: REQUESTS --
            if (targetModules.includes("requests")) {
               const resReq = await pool.query(`
                SELECT COUNT(*) as cnt FROM leave_requests WHERE tenant_id = $1 AND status = 'PENDING'
             `, [tenantId]);
               const pendingCount = Number(resReq.rows[0].cnt);

               if (pendingCount > 0) {
                  message += `📩 <b>PERMOHONAN PENDING</b>\n`;
                  message += `   ⚠️ Ada ${pendingCount} permohonan perlu approval.\n\n`;
                  hasData = true;
               }
            }

            // SEND TELEGRAM if has data
            if (hasData) {
               const telegramUrl = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
               const teleRes = await fetch(telegramUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                     chat_id: settings.telegram_owner_chat_id,
                     text: message,
                     parse_mode: 'HTML'
                  })
               });

               const teleJson = await teleRes.json();
               if (!teleRes.ok) {
                  console.error("TELEGRAM ERROR:", teleJson);
                  throw new Error(`Telegram error: ${teleJson.description}`);
               }

               // LOG SUCCESS
               if (!isForce) {
                  await pool.query(
                     `INSERT INTO system_logs (id, timestamp, actor_id, actor_name, actor_role, action_type, details, target, tenant_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                     [
                        Math.random().toString(36).substr(2, 9),
                        Date.now(),
                        `system_${tenantId}`,
                        'System Cron',
                        'SYSTEM',
                        'DAILY_RECAP_AUTO',
                        `Sent daily recap for ${sqlDateStr}`,
                        'Telegram',
                        tenantId
                     ]
                  );
               }
               results.push({ tenantId, status: 'sent', recipient: settings.telegram_owner_chat_id });
            } else {
               results.push({ tenantId, status: 'skipped', reason: 'no_data_selected' });
            }

         } catch (err: any) {
            console.error(`Error processing tenant ${tenant.name}:`, err);
            results.push({ tenantId: tenant.id, status: 'error', error: err.message });
         }
      }

      return NextResponse.json({
         success: true,
         serverTimeWIB: jakartaTimeStr,
         targetTime: contextLabel,
         results
      });

   } catch (error: any) {
      console.error('Cron Error:', error);
      return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
   }
}
