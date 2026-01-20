import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Helper to escape MarkdownV2 characters to prevent telegram errors
function escapeMd(text: string): string {
  if (!text) return "";
  // Escape chars: _ * [ ] ( ) ~ ` > # + - = | { } . !
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

export async function GET(request: Request) {
  try {
    // 1. SECURITY CHECK (Gembok Pintu)
    // Gunakan Environment Variable di Vercel, atau Fallback ke Hardcoded Secret (aman untuk private repo)
    const CRON_SECRET = process.env.CRON_SECRET || 'Internal_Cron_Secret_2026_Secure';
    
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Izinkan jika token cocok, ATAU jika ada parameter ?key=... (untuk testing manual browser)
    const url = new URL(request.url);
    const queryKey = url.searchParams.get("key");
    const isForce = url.searchParams.get("force") === "true"; // Restore isForce for testing logic below

    if (token !== CRON_SECRET && queryKey !== CRON_SECRET) {
         return NextResponse.json({ error: 'Unauthorized: Access Denied. Kunci Salah.' }, { status: 401 });
    }
    
    // 1. Establish Current Time (WIB)
    const now = new Date();
    const jakartaTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    const jakartaDate = new Date(jakartaTimeStr); // This Date object now represents WIB time in local values

    const currentHour = jakartaDate.getHours();
    const currentMinute = jakartaDate.getMinutes();
    
    // Format HH:MM for comparison with settings
    const currentHHMM = `${String(currentHour).padStart(2, '0')}:${currentMinute < 30 ? '00' : '00'}`; 
    // CRON runs hourly at :00. So we check against user setting like "05:00".
    
    // 2. Determine Reporting Period (Data H-1 or H-0?)
    // Rule: If Report Time is < 12:00 (Morning/Subuh), we report YESTERDAY's data.
    // Rule: If Report Time is >= 12:00 (Evening), we report TODAY's data.
    
    let targetDate = new Date(jakartaDate);
    let contextLabel = "HARI INI";
    
    if (currentHour < 12) {
        targetDate.setDate(targetDate.getDate() - 1); // Go back 1 day
        contextLabel = "KEMARIN";
    }

    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
    const dd = String(targetDate.getDate()).padStart(2, "0");
    const sqlDateStr = `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD
    
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

          // Check Telegram Config
          if (!settings.telegram_bot_token || !settings.telegram_owner_chat_id) continue;

          // Check Time Schedule
          // We normalize HH:MM. Example: user sets "05:00", cron runs at "05:03" -> close enough?
          // Vercel cron runs roughly on time. Let's strict match hour.
          const userTime = settings.daily_recap_time || "05:00";
          const userHour = parseInt(userTime.split(':')[0]);
          
          if (!isForce && userHour !== currentHour) {
             results.push({ tenantId, status: 'skipped', reason: 'time_mismatch', assigned: userTime, current: currentHour });
             continue; // Not the time yet
          }

          // Deduplication: Check if already sent for this specific date & tenant
          if (!isForce) {
            const logCheck = await pool.query(
                `SELECT id FROM system_logs WHERE action_type = 'DAILY_RECAP_AUTO' AND details LIKE $1 AND actor_id = $2 LIMIT 1`,
                [`%${sqlDateStr}%`, `system_${tenantId}`]
            );
            if (logCheck.rows.length > 0) {
                 results.push({ tenantId, status: 'skipped', reason: 'already_sent_today' });
                 continue;
            }
          }

          // 4. GENERATE CONTENT
          let targetModules: string[] = [];
          try {
             targetModules = typeof settings.daily_recap_content === 'string' 
                ? JSON.parse(settings.daily_recap_content) 
                : (settings.daily_recap_content || []);
          } catch(e) { targetModules = []; }

          let message = `🔔 *LAPORAN HARIAN OWNER* \n🏢 Unit: *${escapeMd(tenant.name.toUpperCase())}*\n📅 Data: *${escapeMd(displayDateStr)}* (${contextLabel})\n\n`;
          let hasData = false;


          // -- MODULE: FINANCE --
          if (targetModules.includes("omset")) {
             const resFin = await pool.query(`
                SELECT 
                   COALESCE(SUM(amount) FILTER (WHERE type='IN'), 0) as income,
                   COALESCE(SUM(amount) FILTER (WHERE type='OUT'), 0) as expense
                FROM transactions 
                WHERE date = $1::date AND tenant_id = $2
             `, [sqlDateStr, tenantId]);
             const { income, expense } = resFin.rows[0];
             const net = Number(income) - Number(expense);
             
             message += `💰 *KEUANGAN*\n`;
             message += `📥 Masuk: Rp ${Number(income).toLocaleString('id-ID')}\n`;
             message += `📤 Keluar: Rp ${Number(expense).toLocaleString('id-ID')}\n`;
             message += `💵 *NET: Rp ${net.toLocaleString('id-ID')}*\n\n`;
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
                WHERE a.date = $1 AND a.tenant_id = $2 AND a.is_late = true
             `, [sqlDateStr, tenantId]);

             const totalPresent = resAtt.rows.reduce((sum: number, r: any) => sum + Number(r.count), 0);
             const totalLate = resLate.rows.length;

             message += `👥 *ABSENSI SDM (${totalPresent} Hadir)*\n`;
             
             // Shift Detail
             if (resAtt.rows.length > 0) {
                resAtt.rows.forEach((r: any) => {
                   const shiftName = r.shift_name ? r.shift_name : 'Non-Shift';
                   message += `   • ${shiftName}: ${r.count}\n`;
                });
             } else {
                message += `   _(Tidak ada absensi masuk)_\n`;
             }

             // Late Detail
             if (totalLate > 0) {
                message += `\n⚠️ *TERLAMBAT (${totalLate} Orang):*\n`;
                resLate.rows.forEach((r: any, idx: number) => {
                   const reason = r.late_reason ? `("${escapeMd(r.late_reason)}")` : '';
                   message += `   ${idx+1}. ${escapeMd(r.name)} ${reason}\n`;
                });
             } else {
                message += `   ✨ *Semua On-Time*\n`;
             }
             message += `\n`;
             hasData = true;
          }

          // -- MODULE: PROJECT --
          if (targetModules.includes("projects")) {
             const resProj = await pool.query(`
                SELECT status, COUNT(*) as cnt FROM projects WHERE tenant_id = $1 GROUP BY status ORDER BY status
             `, [tenantId]);
             
             message += `📊 *PROJECT STATUS*\n`;
             const statusEmoji: Record<string, string> = { 
                DONE: '✅', PREVIEW: '👀', DOING: '🔥', TODO: '📋', ON_GOING: '🚀', REVISION: '🛠️' 
             };

             if (resProj.rows.length === 0) {
                message += `   _(Tidak ada project aktif)_\n`;
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
                 SELECT type, COUNT(*) as cnt FROM leave_requests WHERE status = 'PENDING' AND tenant_id = $1 GROUP BY type
              `, [tenantId]);
              const totalPending = resReq.rows.reduce((sum: number, r: any) => sum + Number(r.cnt), 0);
              
              if (totalPending > 0) {
                 message += `📩 *PERMOHONAN (${totalPending} Pending)*\n`;
                 resReq.rows.forEach((r: any) => {
                    message += `   • ${r.type}: ${r.cnt}\n`;
                 });
                 message += `   _Cek dashboard untuk approval._\n\n`;
              } else {
                 message += `📩 *PERMOHONAN*\n   ✅ Bersih (Nihil)\n\n`;
              }
              hasData = true;
          }

          if (!hasData) {
             message += `_Tidak ada modul laporan yang dipilih._`;
          }

          message += `_Generated by System at ${currentHHMM} WIB_`;

          // 5. SEND TELEGRAM
          const telegramUrl = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
          const payload = {
             chat_id: settings.telegram_owner_chat_id,
             text: message,
             parse_mode: 'Markdown' // We use basic Markdown, not MarkdownV2 to be safer if escape fails, or handle carefully. 
             // Actually, 'Markdown' (v1) is very forgiving. 'MarkdownV2' is strict.
             // Let's stick to standard Markdown (v1) which supports *bold* and _italic_.
             // But we need to be careful with underscores in names.
          };

          const resp = await fetch(telegramUrl, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify(payload)
          });

          if (resp.ok) {
             // Log Success
             await pool.query(
                `INSERT INTO system_logs (id, timestamp, actor_id, actor_name, actor_role, action_type, details, target_obj) 
                 VALUES ($1, $2, $3, 'SYSTEM', 'SYSTEM', 'DAILY_RECAP_AUTO', $4, 'Telegram')`,
                [`log_cron_${tenantId}_${Date.now()}`, Date.now(), `system_${tenantId}`, `Sent Daily Recap for ${sqlDateStr}`]
             );
             results.push({ tenantId, status: 'sent', date: sqlDateStr });
          } else {
             const errData = await resp.json();
             console.error("Telegram Error", errData);
             results.push({ tenantId, status: 'failed_send', error: errData });
          }

       } catch (innerErr: any) {
          console.error(`Error processing tenant ${tenant.id}:`, innerErr);
          results.push({ tenantId: tenant.id, status: 'error', msg: innerErr.message });
       }
    }

    return NextResponse.json({ success: true, timestamp: jakartaTimeStr, hour: currentHour, results });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
