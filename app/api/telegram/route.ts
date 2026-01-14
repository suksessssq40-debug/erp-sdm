
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { chatId, message, document, filename, caption } = await request.json();

    console.log(`[API Transporter] Sending to ${chatId}`);

    // 1. Get Token from Database (Securely for CURRENT Tenant)
    const user = await authorize();
    const settingsRes = await pool.query('SELECT telegram_bot_token FROM settings WHERE tenant_id = $1', [user.tenantId]);
    
    if (settingsRes.rows.length === 0) {
      console.warn(`Telegram token not configured for tenant: ${user.tenantId}`);
      return NextResponse.json({ error: 'Token not configured' }, { status: 404 });
    }
    const token = settingsRes.rows[0].telegram_bot_token;

    if (!token) {
        return NextResponse.json({ error: 'Token empty' }, { status: 404 });
    }

    // 2. Format Chat ID
    let actualChatId = chatId;
    let messageThreadId: number | undefined = undefined;

    // Handle standard thread format: ID_THREADID
    if (String(chatId).includes('_')) {
        const parts = String(chatId).split('_');
        actualChatId = parts[0]; 
        
        if (!isNaN(Number(parts[1]))) {
            messageThreadId = parseInt(parts[1]);
        }
    } else {
         actualChatId = chatId;
    }

    console.log(`[API Transporter] Raw: ${actualChatId} Thread: ${messageThreadId}`);

    // 3. Send Message (ATTEMPT 1: AS IS)
    let telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    let body: any = {
        chat_id: actualChatId,
        text: message,
        parse_mode: 'HTML',
    };
    if (messageThreadId) body.message_thread_id = messageThreadId;

    let response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    let data = await response.json();

    // 4. ERROR HANDLING & INTELLIGENT RETRY CHAINS
    if (!response.ok) {
        console.error("[API Failed 1]", data);
        const errDesc = data.description || '';

        // --- RETRY CHAIN STRATEGY ---
        
        // STEP 1: FIX CHAT ID PREFIX (If 'chat not found')
        if (errDesc.includes('chat not found')) {
            console.log("[Retry] Fixing Prefix...");
            
            let retryId = actualChatId;
            if (String(actualChatId).startsWith('-100')) {
                 retryId = String(actualChatId).replace('-100', '-');
                 if (retryId.startsWith('--')) retryId = retryId.replace('--', '-');
            } else if (String(actualChatId).startsWith('-')) {
                 retryId = '-100' + String(actualChatId).substring(1); 
            } else {
                 retryId = '-100' + actualChatId;
            }
            
            // Try with Fixed ID
            body.chat_id = retryId;
            console.log(`[Retry] New ID: ${retryId}`);
            
            const retryRes = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const retryData = await retryRes.json();
            
            if (retryRes.ok) {
                 return NextResponse.json({ success: true, retried: true, note: 'Fixed Chat ID Prefix' });
            } 
            
            // If still failed, Update 'data' to the latest error so next block can check it
            data = retryData; 
            console.error("[Retry Failed]", retryData);
        }

        // STEP 2: FIX THREAD (If 'thread not found' or still failing after prefix fix)
        // Note: The previous block might have fixed the Chat ID but now we hit "thread not found" on the correct Chat ID.
        // So we check data.description again (it might be updated from retryData)
        
        if ((data.description && data.description.includes('thread not found')) || (errDesc.includes('thread not found'))) {
             console.log("[Retry] Dropping Thread ID (General Topic)...");
             delete body.message_thread_id;
             
             // Ensure we use the best Chat ID we have (body.chat_id is already updated if Step 1 ran)
             const retryRes2 = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (retryRes2.ok) {
                return NextResponse.json({ success: true, retried: true, note: 'Sent to General Topic' });
            }
        }

        return NextResponse.json({ error: data.description }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("Telegram Fatal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
