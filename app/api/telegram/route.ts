
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { chatId, message, document, filename, caption } = await request.json();

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

    if (chatId.includes('_')) {
        const parts = chatId.split('_');
        if (parts.length === 2 && !isNaN(Number(parts[1]))) {
            actualChatId = parts[0];
            messageThreadId = parseInt(parts[1]);
        }
    }

    if (!actualChatId.startsWith('-') && /^\d+$/.test(actualChatId)) {
        actualChatId = `-100${actualChatId}`;
    }

    // 3. Send Message
    let telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    let body: any = {
        chat_id: actualChatId,
        text: message,
        parse_mode: 'HTML',
    };

    if (document) {
         // Handling Base64 Document (Simplified for now, assumes string content or handling file upload differently in future if needed)
         // For text notifications, document is usually null.
         // If we need to support document upload, we might need FormData which is harder in JSON body.
         // For now, let's stick to TEXT notifications which are 99% of usage in Kanban.
         // If document is needed, we'll need a different approach (FormData).
    }

    if (messageThreadId) {
        body.message_thread_id = messageThreadId;
    }

    const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const err = await response.json();
        // Retry logic for Topic Not Found
        if (err.description && err.description.includes('message thread not found') && messageThreadId) {
             delete body.message_thread_id;
             await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
        }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Telegram Proxy Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
