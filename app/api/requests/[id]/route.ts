export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { serialize } from '@/lib/serverUtils';
import { sendPushNotification } from '@/lib/push';

// UPDATE (Edit) Request
export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize();
        const { tenantId, role, id: authUserId } = user;
        const id = params.id;
        const r = await request.json();

        const existing = await prisma.leaveRequest.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!existing || existing.tenantId !== tenantId) {
            return NextResponse.json({ error: 'Data tidak ditemukan atau akses ditolak' }, { status: 404 });
        }

        const isOwnerOrManagerOrFinance = ['OWNER', 'MANAGER', 'FINANCE'].includes(role);
        const isApplicant = existing.userId === authUserId;

        if (!isOwnerOrManagerOrFinance) {
            if (!isApplicant) {
                return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
            }
            if (existing.status !== 'PENDING') {
                return NextResponse.json({ error: 'Data yang sudah diproses tidak dapat diubah' }, { status: 403 });
            }
        }

        const isApprovalAction = (r.status === 'APPROVED' || r.status === 'REJECTED') && r.status !== existing.status;

        const dataToUpdate: any = {
            type: r.type,
            description: r.description,
            startDate: new Date(r.startDate),
            endDate: r.endDate ? new Date(r.endDate) : new Date(r.startDate),
            startTime: r.startTime || null,
            endTime: r.endTime || null,
            attachmentUrl: r.attachmentUrl || null,
        };

        if (isOwnerOrManagerOrFinance && r.status) {
            dataToUpdate.status = r.status;

            if (isApprovalAction) {
                const activeUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { name: true }
                });
                dataToUpdate.approverId = user.id;
                dataToUpdate.approverName = activeUser?.name || 'Manager';
                dataToUpdate.actionNote = r.actionNote || null;
                dataToUpdate.actionAt = BigInt(Date.now());
            }
        }

        const updated = await prisma.leaveRequest.update({
            where: { id },
            data: dataToUpdate
        });

        // --- TELEGRAM NOTIFICATION FOR APPROVAL/REJECTION ---
        if (isApprovalAction) {
            try {
                const telegramSettings = await prisma.settings.findUnique({ where: { tenantId } });
                if (telegramSettings?.telegramBotToken && telegramSettings?.telegramGroupId) {
                    const statusIcon = r.status === 'APPROVED' ? '✅' : '❌';
                    const statusText = r.status === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK';

                    const sDate = existing.startDate ? new Date(existing.startDate) : new Date();
                    const eDate = existing.endDate ? new Date(existing.endDate) : sDate;

                    const fmtD = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                    const startInfo = `${fmtD(sDate)}${(existing as any).startTime ? ` (${(existing as any).startTime})` : ''}`;
                    const endInfo = `${fmtD(eDate)}${(existing as any).endTime ? ` (${(existing as any).endTime})` : ''}`;

                    const message = [
                        `🏢 <b>${tenantId.toUpperCase()} - UPDATE STATUS</b>`,
                        `${statusIcon} <b><u>PERMOHONAN ${statusText}</u></b>`,
                        ``,
                        `👤 <b>Karyawan:</b> ${existing.user?.name || 'User'}`,
                        `📌 <b>Jenis:</b> ${existing.type}`,
                        `📅 <b>Waktu:</b> ${startInfo} s/d ${endInfo}`,
                        ``,
                        `⚖️ <b>Keputusan:</b> ${statusText}`,
                        `✍️ <b>Oleh:</b> ${dataToUpdate.approverName}`,
                        `📝 <b>Catatan:</b> <i>"${r.actionNote || '-'}"</i>`,
                        ``,
                        `🚀 <i>Status telah diperbarui di sistem ERP.</i>`
                    ].join('\n');

                    const sendTele = async (targetId: string) => {
                        await fetch(`https://api.telegram.org/bot${telegramSettings.telegramBotToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ chat_id: targetId, text: message, parse_mode: 'HTML' })
                        });
                    };

                    const fullDest = telegramSettings.telegramGroupId;
                    const delimiter = fullDest.includes('/') ? '/' : (fullDest.includes('_') ? '_' : null);
                    if (delimiter) {
                        const [chatId, topicId] = fullDest.split(delimiter);
                        let targetChat = chatId.trim();

                        if (targetChat.startsWith('-') && !targetChat.startsWith('-100')) {
                            targetChat = '-100' + targetChat.substring(1);
                        } else if (!targetChat.startsWith('-') && !targetChat.startsWith('@')) {
                            targetChat = '-100' + targetChat;
                        }

                        const topicBody: any = {
                            chat_id: targetChat,
                            text: message,
                            parse_mode: 'HTML'
                        };

                        if (topicId && topicId.trim()) {
                            topicBody.message_thread_id = parseInt(topicId.trim());
                        }

                        const res = await fetch(`https://api.telegram.org/bot${telegramSettings.telegramBotToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(topicBody)
                        });

                        // Fallback: If topic fails, send to main chat
                        if (!res.ok && topicBody.message_thread_id) {
                            delete topicBody.message_thread_id;
                            await sendTele(targetChat);
                        }
                    } else {
                        let targetChat = fullDest.trim();
                        if (targetChat.startsWith('-') && !targetChat.startsWith('-100')) {
                            targetChat = '-100' + targetChat.substring(1);
                        } else if (!targetChat.startsWith('-') && !targetChat.startsWith('@')) {
                            targetChat = '-100' + targetChat;
                        }
                        await sendTele(targetChat);
                    }
                }
            } catch (err) { console.error("Telegram Approval Notify Error:", err); }
        }

        // --- PUSH NOTIFICATION FOR APPLICANT ---
        if (isApprovalAction) {
            try {
                const statusText = r.status === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK';
                await sendPushNotification(existing.userId!, {
                    title: `Permohonan ${statusText}`,
                    body: `Halo ${existing.user?.name}, permohonan ${existing.type} Anda telah ${statusText.toLowerCase()}.`,
                    url: '/requests'
                });
            } catch (err) { console.error("Push Approval Notify Error:", err); }
        }

        // --- SYSTEM LOGGING ---
        try {
            await prisma.systemLog.create({
                data: {
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: BigInt(Date.now()),
                    actorId: user.id,
                    actorName: user.name,
                    actorRole: user.role,
                    actionType: isApprovalAction ? 'REQUEST_RESOLVE' : 'REQUEST_UPDATE',
                    details: isApprovalAction
                        ? `${r.status}: ${existing.type} - ${existing.user?.name}`
                        : `Update ${existing.type}`,
                    targetObj: 'LeaveRequest',
                    tenantId: tenantId
                }
            });
        } catch (logErr) { console.error("Logging Error:", logErr); }

        return NextResponse.json(serialize(updated));
    } catch (error: any) {
        console.error("PUT Request Error:", error);
        return NextResponse.json({ error: 'Gagal memperbarui data', details: error.message }, { status: 500 });
    }
}

// DELETE Request
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize();
        const { tenantId, role, id: authUserId } = user;
        const id = params.id;

        const existing = await prisma.leaveRequest.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!existing || existing.tenantId !== tenantId) {
            return NextResponse.json({ error: 'Data tidak ditemukan' }, { status: 404 });
        }

        const isAdmin = ['OWNER', 'MANAGER', 'FINANCE'].includes(role);
        const isApplicant = existing.userId === authUserId;

        if (!isAdmin) {
            if (!isApplicant) {
                return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
            }
            if (existing.status !== 'PENDING') {
                return NextResponse.json({ error: 'Hanya permohonan yang berstatus PENDING yang bisa dibatalkan' }, { status: 403 });
            }
        }

        // --- TELEGRAM NOTIFICATION FOR DELETE/CANCEL ---
        try {
            const telegramSettings = await prisma.settings.findUnique({ where: { tenantId } });
            if (telegramSettings?.telegramBotToken && telegramSettings?.telegramGroupId) {
                const isAdminAction = isAdmin && !isApplicant;
                const statusIcon = isAdminAction ? '🗑️' : '🚫';
                const actionText = isAdminAction ? 'DIPERINTAHKAN HAPUS OLEH ADMIN' : 'DIBATALKAN OLEH KARYAWAN';

                const sDate = existing.startDate ? new Date(existing.startDate) : new Date();
                const eDate = existing.endDate ? new Date(existing.endDate) : sDate;

                const fmtD = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                const startInfo = `${fmtD(sDate)}${(existing as any).startTime ? ` (${(existing as any).startTime})` : ''}`;
                const endInfo = `${fmtD(eDate)}${(existing as any).endTime ? ` (${(existing as any).endTime})` : ''}`;

                const message = [
                    `🏢 <b>${tenantId.toUpperCase()} - UPDATE STATUS</b>`,
                    `${statusIcon} <b><u>IZIN ${actionText}</u></b>`,
                    ``,
                    `👤 <b>Karyawan:</b> ${(existing as any).user?.name || 'User'}`,
                    `📌 <b>Jenis:</b> ${existing.type}`,
                    `📅 <b>Waktu:</b> ${startInfo} s/d ${endInfo}`,
                    ``,
                    `✍️ <b>Oleh:</b> ${user.name} (${user.role})`,
                    isAdminAction ? `📝 <b>Alasan:</b> <i>Data telah dihapus dari sistem oleh Manajemen.</i>` : `📝 <b>Alasan:</b> <i>Karyawan memutuskan untuk membatalkan pengajuan ini.</i>`,
                    ``,
                    `🚀 <i>Data permohonan telah dihapus secara permanen dari Dashboard.</i>`
                ].join('\n');

                const sendTele = async (targetId: string) => {
                    await fetch(`https://api.telegram.org/bot${telegramSettings.telegramBotToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chat_id: targetId, text: message, parse_mode: 'HTML' })
                    });
                };

                const fullDest = telegramSettings.telegramGroupId;
                const delimiter = fullDest.includes('/') ? '/' : (fullDest.includes('_') ? '_' : null);
                if (delimiter) {
                    const [chatId, topicId] = fullDest.split(delimiter);
                    let targetChat = chatId.trim();
                    if (targetChat.startsWith('-') && !targetChat.startsWith('-100')) {
                        targetChat = '-100' + targetChat.substring(1);
                    } else if (!targetChat.startsWith('-') && !targetChat.startsWith('@')) {
                        targetChat = '-100' + targetChat;
                    }
                    const topicBody: any = {
                        chat_id: targetChat,
                        text: message,
                        parse_mode: 'HTML'
                    };
                    if (topicId && topicId.trim()) topicBody.message_thread_id = parseInt(topicId.trim());

                    const res = await fetch(`https://api.telegram.org/bot${telegramSettings.telegramBotToken}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(topicBody)
                    });
                    if (!res.ok && topicBody.message_thread_id) {
                        delete topicBody.message_thread_id;
                        await sendTele(targetChat);
                    }
                } else {
                    let targetChat = fullDest.trim();
                    if (targetChat.startsWith('-') && !targetChat.startsWith('-100')) {
                        targetChat = '-100' + targetChat.substring(1);
                    } else if (!targetChat.startsWith('-') && !targetChat.startsWith('@')) {
                        targetChat = '-100' + targetChat;
                    }
                    await sendTele(targetChat);
                }
            }
        } catch (err) { console.error("Telegram Delete Notify Error:", err); }

        await prisma.leaveRequest.delete({
            where: { id }
        });

        // --- SYSTEM LOGGING ---
        try {
            await prisma.systemLog.create({
                data: {
                    id: Math.random().toString(36).substr(2, 9),
                    timestamp: BigInt(Date.now()),
                    actorId: user.id,
                    actorName: user.name,
                    actorRole: user.role,
                    actionType: 'REQUEST_DELETE',
                    details: `Hapus permohonan ID: ${id}`,
                    targetObj: 'LeaveRequest',
                    tenantId: tenantId
                }
            });
        } catch (logErr) { console.error("Logging Error:", logErr); }

        return NextResponse.json({ success: true, message: 'Data berhasil dihapus' });
    } catch (error) {
        console.error("DELETE Request Error:", error);
        return NextResponse.json({ error: 'Gagal menghapus data' }, { status: 500 });
    }
}
