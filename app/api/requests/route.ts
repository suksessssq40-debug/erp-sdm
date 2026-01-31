
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

// Helper to serialize BigInt
const serialize = (data: any): any => {
    return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint' ? Number(value) : value
    ));
};

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

        // Smart Filter
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
            take: startDate ? undefined : 150 // Limit 150 if no filter to prevent overload
        });

        // Use helper to serialize
        return NextResponse.json(serialize(requests));
    } catch (e: any) {
        console.error("GET Requests Error:", e);
        return NextResponse.json({ error: 'Failed', details: e.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await authorize();
        const { tenantId } = user;
        const r = await request.json();

        // 1. Create Data
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
                createdAt: r.createdAt ? BigInt(r.createdAt) : BigInt(Date.now())
            }
        });

        // --- TELEGRAM NOTIFICATION ---
        try {
            const telegramSettings = await prisma.settings.findUnique({ where: { tenantId } });

            if (telegramSettings?.telegramBotToken && telegramSettings?.telegramGroupId) {
                const now = new Date();
                const jakartaTime = new Intl.DateTimeFormat('id-ID', {
                    timeZone: 'Asia/Jakarta',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).format(now);

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

                const sendTele = async (targetId: string) => {
                    try {
                        const res = await fetch(`https://api.telegram.org/bot${telegramSettings.telegramBotToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: targetId,
                                text: message,
                                parse_mode: 'HTML'
                            })
                        });
                    } catch (err) { console.error("Tele Send Error", err); }
                };

                const fullDest = telegramSettings.telegramGroupId;
                if (fullDest.includes('/')) {
                    const [chatId, topicId] = fullDest.split('/');
                    let targetChat = chatId.trim();
                    if (!targetChat.startsWith('-')) targetChat = '-100' + targetChat.replace(/^-/, '');

                    const topicBody = {
                        chat_id: targetChat,
                        text: message,
                        parse_mode: 'HTML',
                        message_thread_id: parseInt(topicId.trim())
                    };

                    try {
                        const res = await fetch(`https://api.telegram.org/bot${telegramSettings.telegramBotToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(topicBody)
                        });
                        if (!res.ok) await sendTele(targetChat); // Fallback
                    } catch (e) { await sendTele(targetChat); }
                } else {
                    let targetChat = fullDest.trim();
                    if (!targetChat.startsWith('-') && !targetChat.startsWith('@')) targetChat = '-100' + targetChat; // Assuming ID
                    await sendTele(targetChat);
                }
            }
        } catch (notifError) {
            console.error("[Telegram] Request integration error:", notifError);
        }

        // Return the ACTUAL created object, serialized properly
        return NextResponse.json(serialize(newRequest), { status: 201 });
    } catch (error: any) {
        console.error("POST Request Error:", error);
        return NextResponse.json({ error: 'Failed', details: error.message }, { status: 500 });
    }
}
