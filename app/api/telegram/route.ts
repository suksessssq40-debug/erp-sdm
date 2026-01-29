
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { chatId, message, document, filename, caption } = await request.json();

    console.log(`[API Transporter] Sending to ${chatId}`);

    // 1. Get Token from Database (Securely for CURRENT Tenant)
    const user = await authorize();
    const settingsRes = await pool.query('SELECT telegram_bot_token, telegram_group_id, telegram_owner_chat_id FROM settings WHERE tenant_id = $1', [user.tenantId]);

    if (settingsRes.rows.length === 0) {
      console.warn(`Telegram token not configured for tenant: ${user.tenantId}`);
      return NextResponse.json({ error: 'Token not configured' }, { status: 404 });
    }
    const token = settingsRes.rows[0].telegram_bot_token;
    const configuredGroupId = settingsRes.rows[0].telegram_group_id || '';
    const configuredOwnerChatId = settingsRes.rows[0].telegram_owner_chat_id || '';

    if (!token) {
      return NextResponse.json({ error: 'Token empty' }, { status: 404 });
    }

    // 2. Normalize and Format Chat ID
    let actualChatId = String(chatId);
    let messageThreadId: number | undefined = undefined;

    // Support both ID_THREAD and ID/THREAD
    const separator = actualChatId.includes('_') ? '_' : (actualChatId.includes('/') ? '/' : null);
    if (separator) {
      const parts = actualChatId.split(separator);
      actualChatId = parts[0].trim();
      if (!isNaN(Number(parts[1]))) {
        messageThreadId = parseInt(parts[1].trim());
      }
    }

    // PRO-ACTIVE FIX: Add -100 prefix immediately for supergroups to avoid first-attempt failure
    if (!actualChatId.startsWith('-')) {
      actualChatId = '-100' + actualChatId;
    } else if (actualChatId.startsWith('-') && !actualChatId.startsWith('-100') && actualChatId.length >= 10) {
      actualChatId = '-100' + actualChatId.substring(1);
    }

    // Advanced Normalization for Security Check
    const normalizeId = (id: string | null | undefined) => {
      if (!id) return '';
      let clean = String(id).trim();
      const sep = clean.includes('_') ? '_' : (clean.includes('/') ? '/' : null);
      if (sep) clean = clean.split(sep)[0].trim();
      if (clean.startsWith('-100')) return clean.substring(4);
      if (clean.startsWith('-')) return clean.substring(1);
      return clean;
    };

    const normalizedTarget = normalizeId(actualChatId);

    // 2b. SECURITY HARDENING
    const rawAllowed = [configuredGroupId, configuredOwnerChatId];
    const allowedIdsNormalized = rawAllowed.filter(id => !!id).map(id => normalizeId(id));

    if (!allowedIdsNormalized.includes(normalizedTarget) && normalizedTarget !== '') {
      return NextResponse.json({ error: 'Destination not allowed' }, { status: 403 });
    }

    // 3. Send Message (Optimized Attempt)
    const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;
    const body: any = {
      chat_id: actualChatId,
      text: message,
      parse_mode: 'HTML',
    };

    // Logic: If thread is 1, it's usually General Topic which works better without thread_id
    if (messageThreadId && messageThreadId !== 1) {
      body.message_thread_id = messageThreadId;
    }

    let response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let data = await response.json();

    // 4. SMART FALLBACK
    if (!response.ok) {
      const errDesc = data.description || '';

      // If thread failed, try one last time without thread
      if (errDesc.includes('thread not found') && body.message_thread_id) {
        delete body.message_thread_id;
        const retryRes = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (retryRes.ok) return NextResponse.json({ success: true, note: 'Thread fallback success' });
      }

      return NextResponse.json({ error: errDesc }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Telegram Fatal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
