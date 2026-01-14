import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const secretKey = url.searchParams.get("key");
    const envSecret = process.env.CRON_SECRET || "sdm_default_secret_123";

    // Security Check for Force Trigger
    const isForce = url.searchParams.get("force") === "true";

    if (isForce && secretKey !== envSecret) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid Secret Key" },
        { status: 401 }
      );
    }

    // 1. Timezone Check (Jakarta)
    const now = new Date();
    const jakartaDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
    );

    const currentHHMM = now
      .toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/\./g, ":");

    const currentHour = parseInt(currentHHMM.split(':')[0]);
    
    // SMART CONTEXT LOGIC:
    // If running in morning (< 10:00), assume we report Yesterday's data
    // If running in afternoon/evening (>= 10:00), report Today's data
    let reportDate = new Date(jakartaDate);
    let isYesterdayContext = false;

    if (currentHour < 10) {
        reportDate.setDate(reportDate.getDate() - 1);
        isYesterdayContext = true;
    }

    const yyyy = reportDate.getFullYear();
    const mm = String(reportDate.getMonth() + 1).padStart(2, "0");
    const dd = String(reportDate.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`; // Used for SQL Query
    const displayDateStr = reportDate.toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

// 1. Get All Active Tenants
    const tenantsRes = await pool.query("SELECT * FROM tenants WHERE is_active = true");
    const results = [];

    for (const tenant of tenantsRes.rows) {
      const tenantId = tenant.id;
      
      // 2. Get Settings for this Tenant
      const settingsRes = await pool.query("SELECT * FROM settings WHERE tenant_id = $1", [tenantId]);
      if (!settingsRes.rows.length) continue;
      
      const settings = settingsRes.rows[0];

      // Check if telegram configured
      if (!settings.telegram_bot_token || !settings.telegram_owner_chat_id) continue;

      const targetTime = settings.daily_recap_time || "18:00";

      // Time Check (Skip if not force and not time)
      if (!isForce && currentHHMM !== targetTime) {
        results.push({ tenantId, status: 'skipped', reason: 'waiting_for_time', targetTime });
        continue;
      }

      // 3. Deduplication (Skip if already sent for this tenant today)
      if (!isForce) {
        const logCheck = await pool.query(
          `SELECT id FROM system_logs WHERE action_type = 'DAILY_RECAP_AUTO' AND details LIKE $1 AND actor_id = $2 LIMIT 1`,
          [`%${dateStr}%`, `system_${tenantId}`]
        );

        if (logCheck.rows.length > 0) {
          results.push({ tenantId, status: 'skipped', reason: 'already_sent' });
          continue;
        }
      }

      // 4. Generate Content for this Tenant
      let targetModules: string[] = [];
      try {
        targetModules = typeof settings.daily_recap_content === "string"
            ? JSON.parse(settings.daily_recap_content)
            : settings.daily_recap_content || [];
      } catch (e) { targetModules = []; }

      let message = `🔔 *LAPORAN HARIAN OWNER* (${tenant.name.toUpperCase()}) 🔔\n📅 ${displayDateStr}\n${isYesterdayContext ? '_(Rekapan Data Kemarin)_' : ''}\n\n`;
      let hasContent = false;

      // Finance (Filtered by Tenant)
      if (targetModules.includes("omset")) {
        const resFin = await pool.query(`
            SELECT 
              COALESCE(SUM(amount) FILTER (WHERE type='IN'), 0) as income,
              COALESCE(SUM(amount) FILTER (WHERE type='OUT'), 0) as expense
            FROM transactions 
            WHERE date = $1::date AND tenant_id = $2
         `, [dateStr, tenantId]);
        const { income, expense } = resFin.rows[0];

        message += `💰 *KEUANGAN HARI INI*\n📥 Masuk: Rp ${Number(income).toLocaleString("id-ID")}\nBeban: Rp ${Number(expense).toLocaleString("id-ID")}\n💸 *Net: Rp ${(Number(income) - Number(expense)).toLocaleString("id-ID")}*\n\n`;
        hasContent = true;
      }

      // Attendance (Filtered by Tenant)
      if (targetModules.includes("attendance")) {
        const dateDateString = jakartaDate.toDateString();
        const resAtt = await pool.query(`
            SELECT 
               COUNT(*) FILTER (WHERE time_in IS NOT NULL) as present,
               COUNT(*) FILTER (WHERE CAST(is_late AS TEXT) = 'true' OR CAST(is_late AS TEXT) = '1') as late
            FROM attendance 
            WHERE (date = $1 OR date = $2) AND tenant_id = $3
         `, [dateStr, dateDateString, tenantId]);
        const { present, late } = resAtt.rows[0];

        message += `👥 *ABSENSI KARYAWAN*\n✅ Hadir: ${present} orang\n⚠️ Terlambat: ${late} orang\n\n`;
        hasContent = true;
      }

      // Requests (Filtered by Tenant)
      if (targetModules.includes("requests")) {
        const resReq = await pool.query(`
             SELECT type, COUNT(*) as count FROM leave_requests WHERE status = 'PENDING' AND tenant_id = $1 GROUP BY type
          `, [tenantId]);
        const pendingTotal = resReq.rows.reduce((acc: number, curr: any) => acc + Number(curr.count), 0);

        if (pendingTotal > 0) {
          message += `📩 *PERMOHONAN MENUNGGU (PENDING)*\nTotal: ${pendingTotal} Permohonan\n`;
          resReq.rows.forEach((r: any) => { message += `- ${r.type}: ${r.count}\n`; });
          message += `_Mohon segera dicek di Dashboard._\n\n`;
        } else {
          message += `📩 *PERMOHONAN*\nSemua bersih (Tidak ada pending).\n\n`;
        }
        hasContent = true;
      }

      // Projects (Filtered by Tenant)
      if (targetModules.includes("projects")) {
        const resProj = await pool.query(`SELECT status, COUNT(*) as count FROM projects WHERE tenant_id = $1 GROUP BY status`, [tenantId]);
        message += `📊 *PROJECT STATUS*\n`;
        const statusMap: Record<string, string> = { TODO: "📋 Todo", DOING: "🔥 Doing", ON_GOING: "🚀 On Going", PREVIEW: "👀 Preview", DONE: "✅ Done" };

        if (resProj.rows.length === 0) {
          message += `(Belum ada proyek aktif)\n`;
        } else {
          resProj.rows.forEach((r: any) => {
            const s = r.status || "";
            const label = statusMap[s] || `🔹 ${s.replace(/_/g, " ")}`;
            message += `${label}: ${r.count}\n`;
          });
        }
        hasContent = true;
      }

      if (!hasContent) continue;

      // 5. Send Telegram for this Tenant
      const telegramUrl = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
      let body: any = { chat_id: settings.telegram_owner_chat_id, text: message, parse_mode: "Markdown" };

      let resp = await fetch(telegramUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!resp.ok) {
        delete body.parse_mode;
        resp = await fetch(telegramUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }

      if (resp.ok) {
        // 6. Log Success for this Tenant
        await pool.query(
          `INSERT INTO system_logs (id, timestamp, actor_id, actor_name, actor_role, action_type, details, target_obj) VALUES ($1, $2, $3, 'SYSTEM CRON', 'SYSTEM', 'DAILY_RECAP_AUTO', $4, 'Telegram')`,
          [`log_${tenantId}_${Date.now()}`, Date.now(), `system_${tenantId}`, `Laporan Harian sent for ${dateStr}`]
        );
        results.push({ tenantId, status: 'success' });
      } else {
        const err = await resp.json();
        results.push({ tenantId, status: 'failed', error: err.description });
      }
    }

    return NextResponse.json({ success: true, results, currentHHMM });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
