
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const res = await pool.query('SELECT * FROM settings LIMIT 1');
    if (!res.rows.length) {
      return NextResponse.json({ error: 'Settings not initialized' }, { status: 400 });
    }
    const settings = res.rows[0];
    
    // Check if configuration exists
    if (!settings.telegram_bot_token || !settings.telegram_owner_chat_id) {
        return NextResponse.json({ error: 'Telegram settings missing' }, { status: 500 });
    }

    const targetTime = settings.daily_recap_time || '18:00'; // HH:mm
    let targetModules: string[] = [];
    try {
        targetModules = typeof settings.daily_recap_content === 'string' 
            ? JSON.parse(settings.daily_recap_content) 
            : settings.daily_recap_content || [];
    } catch (e) {
        targetModules = [];
    }
    
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibDate = new Date(utc + (3600000 * 7));
    const currentHHMM = wibDate.toISOString().slice(11, 16); 
    const dateStr = wibDate.toISOString().split('T')[0]; 

    const url = new URL(request.url);
    const isForce = url.searchParams.get('force') === 'true';

    console.log(`[Cron] Check. WIB: ${currentHHMM}, Target: ${targetTime}, Date: ${dateStr}`);

    if (currentHHMM < targetTime && !isForce) {
         return NextResponse.json({ 
          skipped: true, 
          message: 'Too early. Waiting for scheduled time.', 
          serverTimeWIB: currentHHMM, 
          targetTime 
      });
    }

    if (!isForce) {
        const logCheck = await pool.query(`
            SELECT id FROM system_logs 
            WHERE action_type = 'DAILY_RECAP_AUTO' 
            AND details LIKE $1
            LIMIT 1
        `, [`%${dateStr}%`]);

        if (logCheck.rows.length > 0) {
            return NextResponse.json({ 
                skipped: true, 
                message: 'Already sent today.', 
                date: dateStr 
            });
        }
    }

    let message = `🔔 *LAPORAN HARIAN OWNER* 🔔\n📅 ${dateStr}\n\n`;
    let hasContent = false;

    if (targetModules.includes('omset')) {
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

    if (targetModules.includes('attendance')) {
       console.log(`[Cron] Querying attendance for date: ${dateStr}`);
       // Robust query handling both boolean and smallint (0/1) for is_late
       // Also ensures we count correct rows
       const resAtt = await pool.query(`
          SELECT 
             COUNT(*) FILTER (WHERE time_in IS NOT NULL) as present,
             COUNT(*) FILTER (WHERE CAST(is_late AS TEXT) = 'true' OR CAST(is_late AS TEXT) = '1') as late,
             COUNT(*)Total
          FROM attendance 
          WHERE date = $1
       `, [dateStr]);
       
       console.log(`[Cron] Attendance Result:`, resAtt.rows[0]);
       const { present, late } = resAtt.rows[0];
       message += `👥 *ABSENSI KARYAWAN*\n✅ Hadir: ${present} orang\n⚠️ Terlambat: ${late} orang\n\n`;
       hasContent = true;
    }

    if (targetModules.includes('requests')) {
        const resReq = await pool.query(`
           SELECT type, COUNT(*) as count 
           FROM leave_requests 
           WHERE status = 'PENDING'
           GROUP BY type
        `);
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

    if (!hasContent) message += "_Tidak ada modul laporan yang dipilih._";

    // Use internal Smart Transporter (re-use the logic we just fixed!)
    // Instead of raw fetch to telegram.org, we can call our own internal API helpers or just copy the logic.
    // Copying logic is safer for Cron as it runs server-side locally.
    
    // --- SMART SEND LOGIC (COPIED FROM Transporter) ---
    const sendSmart = async (chatId: string, text: string) => {
        const token = settings.telegram_bot_token;
        let actualChatId = chatId;
        let messageThreadId: number | undefined = undefined;

        if (String(chatId).includes('_')) {
            const parts = String(chatId).split('_');
            actualChatId = parts[0]; 
            if (!isNaN(Number(parts[1]))) messageThreadId = parseInt(parts[1]);
        } 
        
        let telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        let body: any = { chat_id: actualChatId, text: text, parse_mode: 'Markdown' }; 
        // Note: Markdown vs HTML. Original cron used Markdown. New transporter used HTML.
        // Let's stick to Markdown for Cron as the message is formatted with *bold*.
        
        if (messageThreadId) body.message_thread_id = messageThreadId;

        console.log(`[Cron Transporter] Sending to ${actualChatId} Thread ${messageThreadId}`);

        let response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        
        if (!response.ok) {
            const data = await response.json();
            const errDesc = data.description || '';
            
            let currentError = errDesc;
            let currentBody = { ...body };
            
            // Retry Chain Step 1: Fix Prefix (if 'chat not found')
            if (currentError.includes('chat not found')) {
                 let retryId = actualChatId;
                 if (String(actualChatId).startsWith('-100')) {
                     retryId = String(actualChatId).replace('-100', '-');
                     if (retryId.startsWith('--')) retryId = retryId.replace('--', '-');
                 } else if (String(actualChatId).startsWith('-')) {
                     retryId = '-100' + String(actualChatId).substring(1); 
                 } else {
                     retryId = '-100' + actualChatId;
                 }
                 currentBody.chat_id = retryId;
                 console.log(`[Cron Retry] Fixing Prefix to ${retryId}`);
                 
                 const r2 = await fetch(telegramUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(currentBody)});
                 if (r2.ok) return { success: true };
                 
                 // Enable Fallthrough: If r2 failed, update currentError to check if it's now a thread error
                 const d2 = await r2.json();
                 currentError = d2.description || '';
                 console.log(`[Cron Retry] Prefix Fix Failed: ${currentError}`);
            }
            
            // Retry Chain Step 2: Fix Thread (if 'thread not found' - either initially or after prefix fix)
            if (currentError.includes('thread not found')) {
                 console.log("[Cron Retry] Dropping Thread ID...");
                 delete currentBody.message_thread_id;
                 const r3 = await fetch(telegramUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(currentBody)});
                 if (r3.ok) return { success: true };
            }
            
            throw new Error(currentError);
        }
        return { success: true };
    };

    await sendSmart(settings.telegram_owner_chat_id, message);

    // 6. LOG SUCCESS
    if (!isForce) {
        await pool.query(`
            INSERT INTO system_logs (id, timestamp, actor_id, actor_name, actor_role, action_type, details, target_obj)
            VALUES ($1, $2, $3, 'SYSTEM CRON', 'SYSTEM', 'DAILY_RECAP_AUTO', $4, 'Telegram')
        `, [`log_${Date.now()}`, Date.now(), 'system', `Laporan Harian sent for ${dateStr}`]);
    }

    return NextResponse.json({ success: true, recipient: settings.telegram_owner_chat_id, time: currentHHMM });

  } catch (error: any) {
    console.error('[Cron] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
