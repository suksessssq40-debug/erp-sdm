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
    const currentHHMM = now
      .toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(/\./g, ":");

    const jakartaDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
    );
    const yyyy = jakartaDate.getFullYear();
    const mm = String(jakartaDate.getMonth() + 1).padStart(2, "0");
    const dd = String(jakartaDate.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // 2. Get Settings
    const res = await pool.query("SELECT * FROM settings LIMIT 1");
    if (!res.rows.length) {
      return NextResponse.json(
        { error: "Settings not initialized" },
        { status: 400 }
      );
    }
    const settings = res.rows[0];

    // Check if configuration exists
    if (!settings.telegram_bot_token || !settings.telegram_owner_chat_id) {
      return NextResponse.json(
        { error: "Telegram settings missing" },
        { status: 500 }
      );
    }

    const targetTime = settings.daily_recap_time || "18:00";

    // Time Check (Skip if Force)
    if (!isForce && currentHHMM !== targetTime) {
      return NextResponse.json({
        skipped: true,
        message: "Too early. Waiting for scheduled time.",
        serverTimeWIB: currentHHMM,
        targetTime,
      });
    }

    // 3. Deduplication (Skip if Force)
    if (!isForce) {
      const logCheck = await pool.query(
        `
            SELECT id FROM system_logs 
            WHERE action_type = 'DAILY_RECAP_AUTO' 
            AND details LIKE $1
            LIMIT 1
        `,
        [`%${dateStr}%`]
      );

      if (logCheck.rows.length > 0) {
        return NextResponse.json({
          skipped: true,
          message: "Already sent today.",
          date: dateStr,
        });
      }
    }

    // 4. Generate Content
    let targetModules: string[] = [];
    try {
      targetModules =
        typeof settings.daily_recap_content === "string"
          ? JSON.parse(settings.daily_recap_content)
          : settings.daily_recap_content || [];
    } catch (e) {
      targetModules = [];
    }

    let message = `🔔 *LAPORAN HARIAN OWNER* 🔔\n📅 ${dateStr}\n\n`;
    let hasContent = false;

    // Finance
    if (targetModules.includes("omset")) {
      // Raw query for aggregation
      const resFin = await pool.query(`
          SELECT 
            COALESCE(SUM(amount) FILTER (WHERE type='IN'), 0) as income,
            COALESCE(SUM(amount) FILTER (WHERE type='OUT'), 0) as expense
          FROM transactions 
          WHERE date = CURRENT_DATE
       `);
      // Note: PG pool returns strings/numbers usually.
      const { income, expense } = resFin.rows[0];

      message += `💰 *KEUANGAN HARI INI*\n📥 Masuk: Rp ${Number(
        income
      ).toLocaleString("id-ID")}\nBeban: Rp ${Number(expense).toLocaleString(
        "id-ID"
      )}\n💸 *Net: Rp ${(Number(income) - Number(expense)).toLocaleString(
        "id-ID"
      )}*\n\n`;
      hasContent = true;
    }

    // Attendance
    if (targetModules.includes("attendance")) {
      const dateDateString = jakartaDate.toDateString();

      const resAtt = await pool.query(
        `
          SELECT 
             COUNT(*) FILTER (WHERE time_in IS NOT NULL) as present,
             COUNT(*) FILTER (WHERE CAST(is_late AS TEXT) = 'true' OR CAST(is_late AS TEXT) = '1') as late
          FROM attendance 
          WHERE date = $1 OR date = $2
       `,
        [dateStr, dateDateString]
      );

      const { present, late } = resAtt.rows[0];

      message += `👥 *ABSENSI KARYAWAN*\n✅ Hadir: ${present} orang\n⚠️ Terlambat: ${late} orang\n\n`;
      hasContent = true;
    }

    // Requests
    if (targetModules.includes("requests")) {
      const resReq = await pool.query(`
           SELECT type, COUNT(*) as count 
           FROM leave_requests 
           WHERE status = 'PENDING'
           GROUP BY type
        `);
      const pendingTotal = resReq.rows.reduce(
        (acc: number, curr: any) => acc + Number(curr.count),
        0
      );

      if (pendingTotal > 0) {
        message += `📩 *PERMOHONAN MENUNGGU (PENDING)*\n`;
        message += `Total: ${pendingTotal} Permohonan\n`;
        resReq.rows.forEach((r: any) => {
          message += `- ${r.type}: ${r.count}\n`;
        });
        message += `_Mohon segera dicek di Dashboard._\n\n`;
      } else {
        message += `📩 *PERMOHONAN*\nSemua bersih (Tidak ada pending).\n\n`;
      }
      hasContent = true;
    }

    // Projects
    if (targetModules.includes("projects")) {
      const resProj = await pool.query(
        `SELECT status, COUNT(*) as count FROM projects GROUP BY status`
      );

      message += `📊 *PROJECT STATUS*\n`;
      const statusMap: Record<string, string> = {
        TODO: "📋 Todo",
        DOING: "🔥 Doing",
        ON_GOING: "🚀 On Going",
        PREVIEW: "👀 Preview",
        DONE: "✅ Done",
      };

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

    if (!hasContent) message += "_Tidak ada modul laporan yang dipilih._";

    // 5. Send Telegram
    const telegramUrl = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage`;
    let body: any = {
      chat_id: settings.telegram_owner_chat_id,
      text: message,
      parse_mode: "Markdown",
    };

    let resp = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      // Auto Retry without Markdown
      console.log("[Cron] Retry without Markdown...");
      delete body.parse_mode;
      resp = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(`Telegram API Error: ${err.description}`);
    }

    // 6. Log if Not Force
    if (!isForce) {
      await pool.query(
        `
            INSERT INTO system_logs (id, timestamp, actor_id, actor_name, actor_role, action_type, details, target_obj)
            VALUES ($1, $2, $3, 'SYSTEM CRON', 'SYSTEM', 'DAILY_RECAP_AUTO', $4, 'Telegram')
        `,
        [
          `log_${Date.now()}`,
          Date.now(),
          "system",
          `Laporan Harian sent for ${dateStr}`,
        ]
      );
    }

    return NextResponse.json({ success: true, time: currentHHMM });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
