export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { recordSystemLog } from '@/lib/serverUtils';

export async function POST(request: Request) {
  try {
    const { chatId, message } = await request.json();
    const user = await authorize();
    const { tenantId } = user;

    const settings = await prisma.settings.findUnique({
      where: { tenantId }
    });

    if (!settings || !settings.telegramBotToken) {
      return NextResponse.json({ error: 'Telegram not configured' }, { status: 404 });
    }

    const token = settings.telegramBotToken;
    const configuredGroupId = settings.telegramGroupId || '';
    const configuredOwnerChatId = settings.telegramOwnerChatId || '';

    let actualChatId = String(chatId);
    let messageThreadId: number | undefined = undefined;

    const separator = actualChatId.includes('_') ? '_' : (actualChatId.includes('/') ? '/' : null);
    if (separator) {
      const parts = actualChatId.split(separator);
      actualChatId = parts[0].trim();
      if (!isNaN(Number(parts[1]))) {
        messageThreadId = parseInt(parts[1].trim());
      }
    }

    // Auto-prefix for Supergroups
    if (!actualChatId.startsWith('-') && !actualChatId.startsWith('@')) {
      actualChatId = '-100' + actualChatId;
    } else if (actualChatId.startsWith('-') && !actualChatId.startsWith('-100') && actualChatId.length >= 10) {
      actualChatId = '-100' + actualChatId.substring(1);
    }

    // Security Check
    const normalize = (id: string) => {
      let clean = id.split('_')[0].split('/')[0].trim();
      if (clean.startsWith('-100')) return clean.substring(4);
      if (clean.startsWith('-')) return clean.substring(1);
      return clean;
    };

    const targetNorm = normalize(actualChatId);
    const allowed = [configuredGroupId, configuredOwnerChatId].map(id => normalize(id || ''));

    if (!allowed.includes(targetNorm) && targetNorm !== '') {
      return NextResponse.json({ error: 'Forbidden Destination' }, { status: 403 });
    }

    const body: any = {
      chat_id: actualChatId,
      text: message,
      parse_mode: 'HTML',
    };
    if (messageThreadId && messageThreadId !== 1) {
      body.message_thread_id = messageThreadId;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.description?.includes('thread not found') && body.message_thread_id) {
        delete body.message_thread_id;
        const retry = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (retry.ok) return NextResponse.json({ success: true, note: 'Fallback success' });
      }
      return NextResponse.json({ error: data.description }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Telegram Fatal Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

