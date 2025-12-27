
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
        
        // --- FIX LOGIC HERE ---
        // Jika input sudah negatif (misal -238...), kita harus hati-hati.
        // Telegram ID Supergroup biasanya -100 + ID.
        // Kasus USER: -2383546842_1
        // Jika kita paksa tambah -100 jadi -100-238... SALAH.
        // Jika ID awalannya sudah negatif, kita cek apakah itu "kurang -100" atau memang ID basic group.
        
        let baseId = parts[0];
        
        // CASE A: User input "-238..." (ID Group biasa, atau ID Supergroup yang belum lengkap?)
        // Biasanya Supergroup ID itu panjang (13 digit). Group biasa pendek (9-10 digit).
        // -2383546842 (10 digit) -> Kemungkinan besar BASIC GROUP (yang lama/migrasi) atau USER SALAH INPUT (kurang -100).
        
        // Logika Retry Otomatis adalah KUNCI.
        // Strategi: 
        // 1. Coba RAW dulu (apa adanya).
        // 2. Jika gagal "Chat Not Found", coba tambah "-100" (tapi handle minus ganda).
        
        actualChatId = baseId; 
        
        if (!isNaN(Number(parts[1]))) {
            messageThreadId = parseInt(parts[1]);
        }
    } else {
         // Normal Without Thread
         actualChatId = chatId;
    }

    console.log(`[API Transporter] Cleaned: ${actualChatId} Thread: ${messageThreadId}`);

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

    // 4. ERROR HANDLING & INTELLIGENT RETRY
    if (!response.ok) {
        console.error("[API Transporter] Attempt 1 Failed:", data);
        
        const errDesc = data.description || '';

        // SCENARIO 1: "Chat not found"
        // Kemungkinan:
        // A. ID kurang "-100" (Supergroup)
        // B. ID kebanyakan "-100" (Basic Group)
        if (errDesc.includes('chat not found')) {
            console.log("[API Transporter] Retrying for 'chat not found'...");
            
            let retryId = actualChatId;
            
            // Logic Swap Prefix
            if (String(actualChatId).startsWith('-100')) {
                // Remove -100 -> Try Basic
                retryId = String(actualChatId).replace('-100', '-');
                // Fix double minus if result is --
                if (retryId.startsWith('--')) retryId = retryId.replace('--', '-');
            } else if (String(actualChatId).startsWith('-')) {
                // Add -100 -> Try Supergroup
                // But avoid --100.
                // Insert 100 after first -
                retryId = '-100' + String(actualChatId).substring(1); 
            } else {
                // No minus? Add -100
                 retryId = '-100' + actualChatId;
            }
            
            console.log(`[API Transporter] Retry ID: ${retryId}`);
            body.chat_id = retryId;
            
            const retryRes = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const retryData = await retryRes.json();
            
            if (retryRes.ok) {
                 console.log("[API Transporter] Retry Success!");
                 return NextResponse.json({ success: true, retried: true, note: 'Fixed Chat ID Prefix' });
            } else {
                 console.error("[API Transporter] Retry Failed:", retryData);
            }
        }
        
        // SCENARIO 2: "Message thread not found" (Topic Error)
        if (errDesc.includes('thread not found') && messageThreadId) {
             console.log("[API Transporter] Retrying without thread (Fall to General)...");
             delete body.message_thread_id;
             // Reset chat ID to original attempt (or keep last modified? usually original)
             // Let's stick to what we have in body.chat_id (which might be the fixed one from Scenario 1 if chained, but simple here)
             
             const retryRes = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (retryRes.ok) {
                return NextResponse.json({ success: true, retried: true, note: 'Sent to General Topic' });
            }
        }

        return NextResponse.json({ error: data.description }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("Telegram Proxy Fatal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
