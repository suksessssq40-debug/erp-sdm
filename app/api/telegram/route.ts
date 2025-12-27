
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { chatId, message, document, filename, caption } = await request.json();

    console.log(`[API Transporter] Sending to ${chatId}`);

    // 1. Get Token from Database (Securely)
    const settingsRes = await pool.query('SELECT telegram_bot_token FROM settings LIMIT 1');
    if (settingsRes.rows.length === 0) {
      console.warn("Telegram token not configured in settings");
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
        // Part 0 is base chat ID, Part 1 is Thread ID
        // Ensure base chat ID has -100 prefix if it looks like a Supergroup ID but missing prefix
        if (!parts[0].startsWith('-') && /^\d+$/.test(parts[0])) {
            actualChatId = `-100${parts[0]}`; 
        } else {
            actualChatId = parts[0];
        }
        
        if (!isNaN(Number(parts[1]))) {
            messageThreadId = parseInt(parts[1]);
        }
    } else {
        // Normal Group / Private Chat
        // If it's a group ID (positive number) but meant to be supergroup, add prefix?
        // Usually positive numbers are private chats. Negative are groups.
        // If user input "123456" for a group, it's likely wrong, but we can try forcing -100 if it fails? 
        // Better: Assume user Input is raw. 
        // BUT for Supergroups without prefix, we assist:
        if (!String(chatId).startsWith('-') && String(chatId).length > 9) {
             // Heuristic: Long ID without minus is likely a supergroup ID missing -100
             actualChatId = `-100${chatId}`;
        }
    }

    console.log(`[API Transporter] Resolved: ${actualChatId} (Thread: ${messageThreadId || 'None'})`);

    // 3. Send Message
    let telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    let body: any = {
        chat_id: actualChatId,
        text: message,
        parse_mode: 'HTML',
    };

    if (messageThreadId) {
        body.message_thread_id = messageThreadId;
    }

    const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("[API Transporter] Telegram Error 1:", data);
        
        // RETRY 1: If "Message thread not found", try sending to General (Threadless)
        // Description usually: "Bad Request: message thread not found"
        if (data.description && data.description.includes('thread not found') && messageThreadId) {
             console.log("[API Transporter] Retry without thread...");
             delete body.message_thread_id;
             const retryRes = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const retryData = await retryRes.json();
            if (!retryRes.ok) {
                console.error("[API Transporter] Retry Failed:", retryData);
                return NextResponse.json({ error: retryData.description }, { status: 500 });
            }
            return NextResponse.json({ success: true, retried: true });
        }
        
        // RETRY 2: If "Chat not found" AND we added -100 prefix, try without it (maybe it was a private chat or basic group)
        if (data.description && data.description.includes('chat not found') && String(actualChatId).startsWith('-100')) {
             console.log("[API Transporter] Retry without -100 prefix...");
             body.chat_id = actualChatId.replace('-100', '');
             // Restore thread if it was there? Assume logic above holds.
             const retryRes2 = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const retryData2 = await retryRes2.json();
            if (!retryRes2.ok) {
                 console.error("[API Transporter] Retry 2 Failed:", retryData2);
                 return NextResponse.json({ error: data.description }, { status: 500 }); // Return original error
            }
             return NextResponse.json({ success: true, retried: true });
        }

        return NextResponse.json({ error: data.description }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error("Telegram Proxy Fatal Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
