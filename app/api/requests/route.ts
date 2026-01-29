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
    } catch (e: any) {
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
                // 1. Get Accurate Jakarta Time
                const now = new Date();
                const jakartaTime = new Intl.DateTimeFormat('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).format(now);

                // 2. Prepare Message
                const startDate = new Date(r.startDate);
                const endDate = new Date(r.endDate || r.startDate);
                const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                const fmtDate = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

                let companyName = tenantId.toUpperCase();
                try {
                    if (telegramSettings.companyProfileJson) {
                        const profile = JSON.parse(telegramSettings.companyProfileJson);
                        if (profile.name) companyName = profile.name;
                    }
                } catch (e) { }

                const message = [
                    `🏢 <b>${companyName.toUpperCase()}</b>`,
                    `✨ <b><u>PENGAJUAN ${r.type.toUpperCase()}</u></b> ✨`,
                    ``,
                    `👤 <b>Karyawan:</b> ${user.name}`,
                    `💼 <b>Jabatan:</b> ${user.jobTitle || 'Staff'}`,
                    ``,
                    `📌 <b>Jenis:</b> ${r.type}`,
                    `📅 <b>Waktu:</b> ${fmtDate(startDate)}${r.endDate && r.endDate !== r.startDate ? ` s/d ${fmtDate(endDate)}` : ''}`,
                    `⏳ <b>Durasi:</b> ${diffDays} Hari`,
                    `📝 <b>Alasan:</b> <i>"${r.description}"</i>`,
                    ``,
                    `📎 <b>Lampiran:</b> ${r.attachmentUrl ? '✅ Tersedia' : '❌ Tidak Ada'}`,
                    `⏰ <b>Diajukan:</b> ${jakartaTime} WIB`,
                    ``,
                    `👉 <b>Segera cek Dashboard Management untuk memberikan keputusan.</b>`
                ].join('\n');

                // 3. Centralized Submission (Internal API Call for standard handling if possible, or direct fetch with current improvements)
                // For API reliability, we'll use the bot API with fallback logic
                const sendTele = async (targetId: string) => {
                    await fetch(`https://api.telegram.org/bot${telegramSettings.telegramBotToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: targetId,
                            text: message,
                            parse_mode: 'HTML'
                        })
                    });
                };

                const fullDest = telegramSettings.telegramGroupId;
                if (fullDest.includes('/')) {
                    const [chatId, topicId] = fullDest.split('/');
                    let targetChat = chatId.trim();
                    // Fix prefix
                    if (!targetChat.startsWith('-')) targetChat = '-100' + targetChat;
                    else if (targetChat.startsWith('-') && !targetChat.startsWith('-100')) targetChat = '-100' + targetChat.substring(1);

                    const body: any = { chat_id: targetChat, text: message, parse_mode: 'HTML' };
                    if (topicId && topicId.trim() !== '1') body.message_thread_id = parseInt(topicId.trim());

                    const res = await fetch(`https://api.telegram.org/bot${telegramSettings.telegramBotToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });

                    if (!res.ok) {
                        // Fallback to Main Group if Topic fails
                        await sendTele(targetChat);
                    }
                } else {
                    let targetChat = fullDest.trim();
                    if (!targetChat.startsWith('-')) targetChat = '-100' + targetChat;
                    else if (targetChat.startsWith('-') && !targetChat.startsWith('-100')) targetChat = '-100' + targetChat.substring(1);
                    await sendTele(targetChat);
                }
            }
        } catch (notifError) {
            console.error("[Telegram] Request integration error:", notifError);
        }
        // --- TELEGRAM NOTIFICATION END ---

        return NextResponse.json(r, { status: 201 });
    } catch (error: any) {
        console.error(error);
        return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
    }
}
