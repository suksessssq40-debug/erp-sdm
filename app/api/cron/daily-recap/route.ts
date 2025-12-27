import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic'; 
export const revalidate = 0; // Disable Vercel/Next.js caching completely

export async function GET(request: Request) {
  try {
    // 1. Get Settings
    const res = await pool.query('SELECT * FROM settings LIMIT 1');
    if (!res.rows.length) {
      return NextResponse.json({ error: 'Settings not initialized' }, { status: 400 });
    }
    const settings = res.rows[0];
    
    const targetTime = settings.daily_recap_time || '18:00'; // HH:mm
    let targetModules: string[] = [];
    try {
        targetModules = typeof settings.daily_recap_content === 'string' 
            ? JSON.parse(settings.daily_recap_content) 
            : settings.daily_recap_content || [];
    } catch (e) {
        targetModules = [];
    }
    
    // 2. Check Time (WIB)
    const now = new Date();
    // Convert to WIB (UTC+7)
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wib = new Date(utc + (3600000 * 7));
    const currentHHMM = wib.toISOString().slice(11, 16); // Extract HH:mm safely
    
    // Check for 'force' query param for testing
    const url = new URL(request.url);
    const isForce = url.searchParams.get('force') === 'true';

    console.log(`[Cron] Checking Daily Recap. Current WIB: ${currentHHMM}, Target: ${targetTime}, Force: ${isForce}`);

    if (currentHHMM !== targetTime && !isForce) {
      return NextResponse.json({ 
          skipped: true, 
          message: 'Not scheduled time yet', 
          serverTimeWIB: currentHHMM, 
          targetTime 
      });
    }

    // 3. Generate Report
    let message = `🔔 *LAPORAN HARIAN OWNER* 🔔\n📅 ${wib.toISOString().split('T')[0]}\n\n`;
    let hasContent = false;

    // -- MODULE: FINANCE (OMSET) --
    if (targetModules.includes('omset')) {
       // Note: Using transactions table. Assuming date column is DATE type or YYYY-MM-DD string.
       // Based on schema master: "date DATE" or "date VARCHAR(20)". The master said DATE.
       // But in schema: "date DATE".
       // We'll use CURRENT_DATE which works for Postgres logic.
       const resFin = await pool.query(`
          SELECT 
            COALESCE(SUM(amount) FILTER (WHERE type='IN'), 0) as income,
            COALESCE(SUM(amount) FILTER (WHERE type='OUT'), 0) as expense
          FROM transactions 
          WHERE date = CURRENT_DATE
       `);
       const { income, expense } = resFin.rows[0];
       message += `💰 *KEUANGAN HARI INI*\n📥 Masuk: Rp ${Number(income).toLocaleString('id-ID')}\nBeban: Rp ${Number(expense).toLocaleString('id-ID')}\n💸 *Net: Rp ${Number(income - expense).toLocaleString('id-ID')}*\n\n`;
       hasContent = true;
    }

    // -- MODULE: ATTENDANCE --
    if (targetModules.includes('attendance')) {
       // Schema: date VARCHAR(20). So we compare with string.
       const todayStr = wib.toISOString().split('T')[0];
       const resAtt = await pool.query(`
          SELECT 
             COUNT(*) FILTER (WHERE time_in IS NOT NULL) as present,
             COUNT(*) FILTER (WHERE CAST(is_late AS TEXT) = 'true' OR CAST(is_late AS TEXT) = '1') as late
          FROM attendance 
          WHERE date = $1
       `, [todayStr]);
       
       const { present, late } = resAtt.rows[0];
       message += `👥 *ABSENSI KARYAWAN*\n✅ Hadir: ${present} orang\n⚠️ Terlambat: ${late} orang\n\n`;
       hasContent = true;
    }

    // -- MODULE: PROJECTS --
    if (targetModules.includes('projects')) {
        const resProj = await pool.query(`
           SELECT status, COUNT(*) as count 
           FROM projects 
           GROUP BY status
        `);
        const stats: any = {};
        resProj.rows.forEach((r: any) => stats[r.status] = r.count);
        
        message += `📊 *STATUS PROYEK (KANBAN)*\n`;
        message += `🔥 Doing: ${stats['DOING'] || 0}\n`;
        message += `✅ Done: ${stats['DONE'] || 0}\n`;
        message += `📋 Todo: ${stats['TODO'] || 0}\n\n`;
        hasContent = true;
    }
    
    // -- MODULE: REQUESTS (IZIN/CUTI) --
    if (targetModules.includes('requests')) {
        const resReq = await pool.query(`
           SELECT type, COUNT(*) as count 
           FROM leave_requests 
           WHERE status = 'PENDING'
           GROUP BY type
        `);
        // e.g. [{type: 'IZIN', count: 1}, {type: 'CUTI', count: 2}]
        const pendingTotal = resReq.rows.reduce((acc: number, curr: any) => acc + Number(curr.count), 0);

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

    if (!hasContent) {
        message += "_Tidak ada modul laporan yang dipilih._";
    }

    // 4. Send to Telegram
    const chatId = settings.telegram_owner_chat_id;
    const token = settings.telegram_bot_token;

    if (!chatId || !token) {
        console.error('[Cron] Missing Telegram Config');
        return NextResponse.json({ error: 'Missing Telegram Configuration' }, { status: 500 });
    }

    const teleRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown'
        })
    });

    const teleData = await teleRes.json();
    
    if (!teleData.ok) {
        console.error('[Cron] Telegram Error:', teleData);
        return NextResponse.json({ error: 'Failed to send to Telegram', details: teleData }, { status: 500 });
    }

    return NextResponse.json({ success: true, recipient: chatId, time: currentHHMM });

  } catch (error: any) {
    console.error('[Cron] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
