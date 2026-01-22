import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');

    const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(user.role);
    const where: any = { tenantId };
    if (!isAdmin) where.userId = user.id;

    // Smart Filter: Filter by Request Date (Execution Date)
    if (startDate && endDate) {
        where.startDate = {
            gte: new Date(startDate),
            lte: new Date(endDate)
        };
    } else if (startDate) {
         where.startDate = {
            gte: new Date(startDate)
        };
    }

    const requests = await prisma.leaveRequest.findMany({
       where,
       orderBy: { createdAt: 'desc' },
       take: startDate ? undefined : 150 // Limit 150 if no filter
    });

    const formatted = requests.map(r => ({
          id: r.id,
          userId: r.userId,
          tenantId: (r as any).tenantId,
          type: r.type,
          description: r.description,
          startDate: r.startDate ? r.startDate.toISOString().split('T')[0] : '',
          endDate: r.endDate ? r.endDate.toISOString().split('T')[0] : (r.startDate ? r.startDate.toISOString().split('T')[0] : ''),
          attachmentUrl: r.attachmentUrl || undefined,
          status: r.status,
          createdAt: r.createdAt ? Number(r.createdAt) : Date.now()
    }));

    return NextResponse.json(formatted);
  } catch(e: any) {
      console.error(e);
      return NextResponse.json({ error: 'Failed', details: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await authorize();
    const { tenantId } = user;
    const r = await request.json();

    const newRequest = await prisma.leaveRequest.create({
      data: {
        id: r.id,
        tenantId,
        userId: r.userId,
        type: r.type,
        description: r.description,
        startDate: new Date(r.startDate),
        endDate: r.endDate ? new Date(r.endDate) : new Date(r.startDate),
        attachmentUrl: r.attachmentUrl || null,
        status: r.status,
        createdAt: r.createdAt ? BigInt(new Date(r.createdAt).getTime()) : BigInt(Date.now())
      }
    });

    // --- TELEGRAM NOTIFICATION START ---
    try {
        const telegramSettings = await prisma.settings.findUnique({ where: { tenantId } });

        if (telegramSettings?.telegramBotToken && telegramSettings?.telegramGroupId) {
            let [rawChatId, rawTopicId] = telegramSettings.telegramGroupId.split('/');
            let chatId = rawChatId.trim();
            let topicId = rawTopicId ? parseInt(rawTopicId.trim()) : null;

            // Auto-Fix Chat ID Prefix
            if (!chatId.startsWith('-')) chatId = '-100' + chatId;
            else if (chatId.startsWith('-') && !chatId.startsWith('-100')) chatId = '-100' + chatId.substring(1);

            const startDate = new Date(r.startDate);
            const endDate = new Date(r.endDate || r.startDate);
            
            // Calculate Duration
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            const fmtDate = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            
            const message = [
                `✨ <b><u>PENGAJUAN ${r.type.toUpperCase()}</u></b> ✨`,
                ``,
                `👤 <b>Karyawan:</b> ${user.name}`,
                `💼 <b>Jabatan:</b> ${user.jobTitle || 'Staff'}`,
                `🏢 <b>Unit:</b> ${tenantId.toUpperCase()}`,
                ``,
                `📌 <b>Jenis:</b> ${r.type}`,
                `📅 <b>Waktu:</b> ${fmtDate(startDate)}${r.endDate && r.endDate !== r.startDate ? ` s/d ${fmtDate(endDate)}` : ''}`,
                `⏳ <b>Durasi:</b> ${diffDays} Hari`,
                `📝 <b>Alasan:</b> <i>"${r.description}"</i>`,
                ``,
                `📎 <b>Lampiran:</b> ${r.attachmentUrl ? '✅ Tersedia' : '❌ Tidak Ada'}`,
                `⏰ <b>Diajukan:</b> ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`,
                ``,
                `👉 <b>Segera cek Dashboard Management untuk memberikan keputusan.</b>`
            ].join('\n');
            
            const sendTelegram = async (tId: number | null) => {
                const payload: any = { chat_id: chatId, text: message, parse_mode: 'HTML' };
                if (tId && tId !== 0) payload.message_thread_id = tId; // ID 0 or null goes to main

                const res = await fetch(`https://api.telegram.org/bot${telegramSettings.telegramBotToken}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                return await res.json();
            };

            console.log(`[Telegram] Sending to: ${chatId} | Topic: ${topicId ?? 'Main'}`);
            let result = await sendTelegram(topicId);

            if (!result.ok) {
                console.error(`[Telegram] FAIL (Topic ${topicId}): ${result.description} (Code: ${result.error_code})`);
                
                // If Topic fails (any reason), always try Fallback to Main Group
                console.log(`[Telegram] RETRYING: Sending to Main Group (No Topic)...`);
                result = await sendTelegram(null);
                
                if (result.ok) {
                    console.log(`[Telegram] SUCCESS: Message delivered to Main Group.`);
                } else {
                    console.error(`[Telegram] FATAL: All attempts failed. Error: ${result.description}`);
                }
            } else {
                console.log(`[Telegram] SUCCESS: Message delivered to Topic!`);
            }
        }
    } catch (notifError) {
        console.error("[Telegram] CRITICAL ERROR:", notifError);
    }
    // --- TELEGRAM NOTIFICATION END ---

    return NextResponse.json(r, { status: 201 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
  }
}
