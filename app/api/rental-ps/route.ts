
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { generateInvoiceNumber } from '@/utils/roman';
import { getJakartaNow, recordSystemLog, serialize } from '@/lib/serverUtils';

// Constants
const LEVEL_UP_BIZ_UNIT_ID = 'eke1tjt1u'; // Verified LEVEL UP GAMING in SDM

// Target COAs and Accounts (Exact Names and Codes from DB)
const COA_PIUTANG_LUG = { id: 'coa_132100', code: '132100', name: 'Piutang Dagang Level Up Gaming' };
const COA_PENJUALAN_LUG = { id: 'coa_411400', code: '411400', name: 'Penjualan Level Up Gaming' };
const ACC_KAS_KECIL = { id: 'vq8bcdrkc', name: '110001-Kas Kecil' };
const ACC_MANDIRI_SDM = { id: 'acc_tunai', name: '120007-Kas Mandiri SDM 14843' };

// HELPER: Escape HTML to avoid Telegram errors
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// HELPER: Notify Telegram with Premium Layout
async function notifyRentalAction(params: {
    tenantId: string,
    actionTitle: string,
    record: any,
    actorName: string,
    isUpdate?: boolean,
    oldRecord?: any
}) {
    const { tenantId, actionTitle, record, actorName, isUpdate, oldRecord } = params;

    try {
        const settings = await prisma.settings.findUnique({ where: { tenantId } });
        if (!settings?.telegramBotToken || !settings?.telegramGroupId) return;

        let companyName = tenantId.toUpperCase();
        try {
            if (settings.companyProfileJson) {
                const profile = JSON.parse(settings.companyProfileJson);
                if (profile.name) companyName = profile.name;
            }
        } catch (e) { }

        const divider = '━━━━━━━━━━━━━━━━━━';
        const safeName = escapeHtml(record.customerName || 'N/A');
        const totalAmount = Number(record.totalAmount || 0);
        const totalFmt = `<b>Rp ${totalAmount.toLocaleString('id-ID')}</b>`;

        let paymentDetail = '';
        if (record.paymentMethod === 'SPLIT') {
            paymentDetail = `\n💰 <b>CASH:</b> Rp ${Number(record.cashAmount || 0).toLocaleString('id-ID')}\n📱 <b>TF:</b> Rp ${Number(record.transferAmount || 0).toLocaleString('id-ID')}`;
        } else {
            paymentDetail = `\n💳 <b>METODE:</b> ${record.paymentMethod}`;
        }

        const message = [
            `🏢 <b>${companyName.toUpperCase()}</b>`,
            `🕹️ <b>${actionTitle}</b>`,
            divider,
            `� <b>Invoice:</b> <code>${record.invoiceNumber}</code>`,
            `👤 <b>Customer:</b> ${safeName}`,
            `🎮 <b>Unit:</b> ${record.psType}`,
            `📍 <b>Outlet:</b> ${record.outletName || 'N/A'}`,
            `⏱️ <b>Durasi:</b> ${record.duration} Jam`,
            paymentDetail,
            divider,
            `💵 <b>TOTAL:</b> ${totalFmt}`,
            ``,
            isUpdate ? `⚠️ <i>Pembaruan data transaksi sebelumnya</i>\n` : '',
            `👤 <b>Admin:</b> ${actorName}`,
            `⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
            `_Sistem otomatis SDM ERP_`
        ].join('\n');

        const send = async (chatId: string, threadId?: number) => {
            await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML',
                    message_thread_id: threadId
                })
            });
        };

        const fullDest = settings.telegramGroupId;
        if (fullDest.includes('/') || fullDest.includes('_')) {
            const delimiter = fullDest.includes('/') ? '/' : '_';
            const [chatId, topicId] = fullDest.split(delimiter);
            let targetChat = chatId.trim();
            if (targetChat.startsWith('-') && !targetChat.startsWith('-100')) targetChat = '-100' + targetChat.substring(1);
            else if (!targetChat.startsWith('-') && !targetChat.startsWith('@')) targetChat = '-100' + targetChat;
            await send(targetChat, topicId ? parseInt(topicId.trim()) : undefined);
        } else {
            let targetChat = fullDest.trim();
            if (targetChat.startsWith('-') && !targetChat.startsWith('-100')) targetChat = '-100' + targetChat.substring(1);
            else if (!targetChat.startsWith('-') && !targetChat.startsWith('@')) targetChat = '-100' + targetChat;
            await send(targetChat);
        }
    } catch (e) {
        console.error('[TelePremium Error]', e);
    }
}

export async function POST(request: Request) {
    try {
        const user = await authorize();
        const body = await request.json();
        const {
            customerName,
            psType,
            duration,
            paymentMethod,
            totalAmount,
            cashAmount = 0,
            transferAmount = 0,
            outletId
        } = body;


        if (!customerName || !psType || !duration || !paymentMethod || !outletId) {
            return NextResponse.json({ error: 'Data tidak lengkap (Outlet wajib dipilih)' }, { status: 400 });
        }

        // 0. VULNERABILITY FIX: Re-calculate total based on DB prices (Don't trust client)
        const currentPrice = await (prisma as any).rentalPsPrice.findUnique({
            where: {
                tenantId_outletId_name: {
                    tenantId: user.tenantId,
                    outletId,
                    name: psType
                }
            }
        });

        if (!currentPrice) {
            return NextResponse.json({ error: `Unit ${psType} belum memiliki harga di outlet ini.` }, { status: 400 });
        }

        const outlet = await (prisma as any).rentalPsOutlet.findUnique({ where: { id: outletId } });
        const outletName = outlet?.name || 'Unknown Outlet';

        const calculatedTotal = Number(currentPrice.pricePerHour) * Number(duration);
        const finalTotal = calculatedTotal;

        // Use finalTotal instead of client-provided totalAmount

        const now = new Date();

        // 1. Generate Invoice Number (Sequential within month/year)
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const count = await prisma.rentalRecord.count({
            where: {
                createdAt: { gte: startOfMonth }
            }
        });

        const invoiceNumber = generateInvoiceNumber(count + 1, now);

        // 1.5 Fetch Central Finance Mappings from Settings
        const settings: any = await (prisma as any).settings.findUnique({ where: { tenantId: user.tenantId } });
        const targetTenantId = settings?.rentalPsTargetTenantId || 'sdm';

        // Define Target Accounts (Dynamic with hardcoded fallbacks for safety)
        let targetCashAccount = { id: settings?.rentalPsCashAccountId || ACC_KAS_KECIL.id, name: ACC_KAS_KECIL.name };
        let targetTransferAccount = { id: settings?.rentalPsTransferAccountId || ACC_MANDIRI_SDM.id, name: ACC_MANDIRI_SDM.name };

        // Fetch actual names if dynamic IDs are used to ensure audit string matches "${code} - ${name}"
        if (settings?.rentalPsCashAccountId) {
            const acc = await prisma.financialAccount.findUnique({ where: { id: settings.rentalPsCashAccountId } });
            if (acc) targetCashAccount.name = acc.name;
        }
        if (settings?.rentalPsTransferAccountId) {
            const acc = await prisma.financialAccount.findUnique({ where: { id: settings.rentalPsTransferAccountId } });
            if (acc) targetTransferAccount.name = acc.name;
        }

        // Define Target COAs
        let targetPiutangCOA = { id: settings?.rentalPsReceivableCoaId || COA_PIUTANG_LUG.id, name: `${COA_PIUTANG_LUG.code} - ${COA_PIUTANG_LUG.name}` };
        let targetPenjualanCOA = { id: settings?.rentalPsSalesCoaId || COA_PENJUALAN_LUG.id, name: `${COA_PENJUALAN_LUG.code} - ${COA_PENJUALAN_LUG.name}` };

        if (settings?.rentalPsReceivableCoaId) {
            const coa = await prisma.chartOfAccount.findUnique({ where: { id: settings.rentalPsReceivableCoaId } });
            if (coa) targetPiutangCOA.name = `${coa.code} - ${coa.name}`;
        }
        if (settings?.rentalPsSalesCoaId) {
            const coa = await prisma.chartOfAccount.findUnique({ where: { id: settings.rentalPsSalesCoaId } });
            if (coa) targetPenjualanCOA.name = `${coa.code} - ${coa.name}`;
        }

        // 2. Perform Atomic Multi-Tenant Journaling
        const result = await (prisma as any).$transaction(async (tx: any) => {


            // A. Create the Rental Record (for history & digital note)
            const rental = await tx.rentalRecord.create({
                data: {
                    invoiceNumber,
                    customerName,
                    psType,
                    duration: Number(duration),
                    totalAmount: finalTotal, // Server side re-calculated
                    paymentMethod,
                    cashAmount: paymentMethod === 'SPLIT' ? Number(cashAmount) : (paymentMethod === 'CASH' ? finalTotal : 0),
                    transferAmount: paymentMethod === 'SPLIT' ? Number(transferAmount) : (paymentMethod === 'TRANSFER' ? finalTotal : 0),
                    tenantId: user.tenantId,
                    outletId,
                    staffName: user.name || user.username,
                    businessUnitId: LEVEL_UP_BIZ_UNIT_ID,
                    createdAt: now
                }
            });

            const transactionIds: string[] = [];

            // B. JURNAL 1: PENGAKUAN PENJUALAN (SDM PORTAL)
            // Debit Piutang, Credit Penjualan
            // CRITICAL: account string MUST match "${code} - ${name}" for coa/route.ts logic
            const recognitionTime = new Date(now.getTime() - 1000);
            const j1Id = Math.random().toString(36).substr(2, 9);

            await tx.transaction.create({
                data: {
                    id: j1Id,
                    tenantId: targetTenantId,
                    date: recognitionTime,
                    amount: finalTotal,
                    type: 'IN', // Sales increases (Credit side)
                    category: targetPenjualanCOA.name,
                    coaId: targetPenjualanCOA.id,
                    description: `Penjualan PS (${psType}) - ${invoiceNumber} - ${customerName}`,
                    account: targetPiutangCOA.name, // This will be the DEBIT side match for Piutang
                    accountId: null,
                    businessUnitId: LEVEL_UP_BIZ_UNIT_ID,
                    status: 'PAID',
                    createdAt: recognitionTime
                } as any
            });
            transactionIds.push(j1Id);


            // C. JURNAL 2: PELUNASAN / MONEY IN (SDM PORTAL)
            // Debit Kas/Bank, Credit Piutang
            const createSettlement = async (amount: number, acc: { id: string, name: string }, descSuffix: string) => {
                const jId = Math.random().toString(36).substr(2, 9);

                await tx.transaction.create({
                    data: {
                        id: jId,
                        tenantId: targetTenantId,
                        date: now,
                        amount: Number(amount),
                        type: 'IN', // Money enters the account (Debit Kas)
                        category: targetPiutangCOA.name, // Offset the Receivable (Credit Piutang)
                        coaId: targetPiutangCOA.id,
                        description: `Pelunasan ${invoiceNumber} - ${customerName} (${descSuffix})`,
                        account: acc.name,
                        accountId: acc.id,
                        businessUnitId: LEVEL_UP_BIZ_UNIT_ID,
                        status: 'PAID',
                        createdAt: now
                    } as any
                });

                // UPDATE BANK BALANCE ATOMICALLY
                await (tx.financialAccount as any).update({
                    where: { id: acc.id, tenantId: targetTenantId },
                    data: { balance: { increment: Number(amount) } }
                });

                transactionIds.push(jId);
            };

            if (paymentMethod === 'CASH') {
                await createSettlement(finalTotal, targetCashAccount, 'CASH');
            } else if (paymentMethod === 'TRANSFER') {
                await createSettlement(finalTotal, targetTransferAccount, 'TF');
            } else if (paymentMethod === 'SPLIT') {
                if (Number(cashAmount) > 0) {
                    await createSettlement(Number(cashAmount), targetCashAccount, 'SPLIT-CASH');
                }
                if (Number(transferAmount) > 0) {
                    await createSettlement(Number(transferAmount), targetTransferAccount, 'SPLIT-TF');
                }
            }


            // D. Update Rental Record with the Transaction IDs for Audit Trail
            return await tx.rentalRecord.update({
                where: { id: rental.id },
                data: { transactionIds }
            });
        });

        // 3. SECURE LOGGING & NOTIFICATION
        await recordSystemLog({
            actorId: user.id, actorName: user.name, actorRole: user.role, tenantId: user.tenantId,
            actionType: 'RENTAL_PS_CREATE',
            details: `Mencatat rental baru [${outletName}]: ${invoiceNumber} untuk ${customerName}`,
            targetObj: 'RentalRecord'
        });

        await notifyRentalAction({
            tenantId: user.tenantId,
            actionTitle: 'TRANSAKSI RENTAL BARU 🟢',
            record: { ...result, outletName },
            actorName: user.name || user.username
        });

        return NextResponse.json(serialize(result));
    } catch (error: any) {
        console.error('Rental PS Error:', error);
        return NextResponse.json({ error: 'Failed to process rental', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const user = await authorize(['OWNER', 'MANAGER', 'FINANCE', 'STAFF']);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

        const record = await (prisma as any).rentalRecord.findUnique({
            where: { id, tenantId: user.tenantId },
            include: { outlet: true }
        });

        if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
        const outletName = record.outlet?.name || 'General';

        await (prisma as any).$transaction(async (tx: any) => {
            // 1. Rollback Financials
            const transactions = await tx.transaction.findMany({
                where: { id: { in: record.transactionIds } }
            });

            for (const t of transactions) {
                if (t.accountId) {
                    await (tx.financialAccount as any).update({
                        where: { id: t.accountId, tenantId: t.tenantId },
                        data: { balance: { decrement: Number(t.amount) } }
                    });
                }
            }

            // 2. Delete Transactions
            await tx.transaction.deleteMany({
                where: { id: { in: record.transactionIds } }
            });

            // 3. Delete Rental Record
            await tx.rentalRecord.delete({
                where: { id }
            });
        });

        await recordSystemLog({
            actorId: user.id, actorName: user.name, actorRole: user.role, tenantId: user.tenantId,
            actionType: 'RENTAL_PS_DELETE',
            details: `Menghapus transaksi rental: ${record.invoiceNumber} (${record.customerName})`,
            targetObj: 'RentalRecord'
        });

        await notifyRentalAction({
            tenantId: user.tenantId,
            actionTitle: 'HAPUS TRANSAKSI RENTAL 🔴',
            record: { ...record, outletName },
            actorName: user.name || user.username
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete Error:', error);
        return NextResponse.json({ error: 'Failed to delete record', details: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const user = await authorize(['OWNER', 'MANAGER', 'FINANCE', 'STAFF']);
        const body = await request.json();
        const {
            id,
            customerName,
            psType,
            duration,
            paymentMethod,
            cashAmount = 0,
            transferAmount = 0,
            outletId
        } = body;

        if (!id || !customerName || !psType || !duration || !paymentMethod || !outletId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const oldRecord = await prisma.rentalRecord.findUnique({
            where: { id, tenantId: user.tenantId }
        });

        if (!oldRecord) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

        // Re-calculate new total based on outlet
        const currentPrice = await (prisma as any).rentalPsPrice.findUnique({
            where: {
                tenantId_outletId_name: {
                    tenantId: user.tenantId,
                    outletId,
                    name: psType
                }
            }
        });

        if (!currentPrice) return NextResponse.json({ error: `Unit ${psType} belum memiliki harga di outlet ini.` }, { status: 400 });

        const outlet = await (prisma as any).rentalPsOutlet.findUnique({ where: { id: outletId } });
        const outletName = outlet?.name || 'Unknown Outlet';

        const finalTotal = Number(currentPrice.pricePerHour) * Number(duration);
        const now = new Date(oldRecord.createdAt); // Preserve original date

        // Fetch settings again for PUT (target tenant might have changed but we use current settings for new journals)
        const settings: any = await (prisma as any).settings.findUnique({ where: { tenantId: user.tenantId } });
        const targetTenantId = settings?.rentalPsTargetTenantId || 'sdm';

        // Re-resolve accounts based on potentially new settings
        let targetCashAccount = { id: settings?.rentalPsCashAccountId || ACC_KAS_KECIL.id, name: ACC_KAS_KECIL.name };
        let targetTransferAccount = { id: settings?.rentalPsTransferAccountId || ACC_MANDIRI_SDM.id, name: ACC_MANDIRI_SDM.name };
        if (settings?.rentalPsCashAccountId) {
            const acc = await prisma.financialAccount.findUnique({ where: { id: settings.rentalPsCashAccountId } });
            if (acc) targetCashAccount.name = acc.name;
        }
        if (settings?.rentalPsTransferAccountId) {
            const acc = await prisma.financialAccount.findUnique({ where: { id: settings.rentalPsTransferAccountId } });
            if (acc) targetTransferAccount.name = acc.name;
        }

        const result = await (prisma as any).$transaction(async (tx: any) => {
            // 1. Rollback Old Financials
            const oldTransactions = await tx.transaction.findMany({
                where: { id: { in: oldRecord.transactionIds } }
            });

            for (const t of oldTransactions) {
                if (t.accountId) {
                    await (tx.financialAccount as any).update({
                        where: { id: t.accountId, tenantId: t.tenantId },
                        data: { balance: { decrement: Number(t.amount) } }
                    });
                }
            }

            await tx.transaction.deleteMany({
                where: { id: { in: oldRecord.transactionIds } }
            });

            // 2. Post New Financials (Same logic as POST)
            const transactionIds: string[] = [];
            const recognitionTime = new Date(now.getTime() - 1000);
            const j1Id = Math.random().toString(36).substr(2, 9);

            // Resolve COAs again
            let targetPiutangCOA = { id: settings?.rentalPsReceivableCoaId || COA_PIUTANG_LUG.id, name: `${COA_PIUTANG_LUG.code} - ${COA_PIUTANG_LUG.name}` };
            let targetPenjualanCOA = { id: settings?.rentalPsSalesCoaId || COA_PENJUALAN_LUG.id, name: `${COA_PENJUALAN_LUG.code} - ${COA_PENJUALAN_LUG.name}` };
            if (settings?.rentalPsReceivableCoaId) {
                const coa = await prisma.chartOfAccount.findUnique({ where: { id: settings.rentalPsReceivableCoaId } });
                if (coa) targetPiutangCOA.name = `${coa.code} - ${coa.name}`;
            }
            if (settings?.rentalPsSalesCoaId) {
                const coa = await prisma.chartOfAccount.findUnique({ where: { id: settings.rentalPsSalesCoaId } });
                if (coa) targetPenjualanCOA.name = `${coa.code} - ${coa.name}`;
            }

            await tx.transaction.create({
                data: {
                    id: j1Id,
                    tenantId: targetTenantId,
                    date: recognitionTime,
                    amount: finalTotal,
                    type: 'IN',
                    category: targetPenjualanCOA.name,
                    coaId: targetPenjualanCOA.id,
                    description: `[EDIT] Penjualan PS (${psType}) - ${oldRecord.invoiceNumber} - ${customerName}`,
                    account: targetPiutangCOA.name,
                    accountId: null,
                    businessUnitId: LEVEL_UP_BIZ_UNIT_ID,
                    status: 'PAID',
                    createdAt: recognitionTime
                } as any
            });
            transactionIds.push(j1Id);

            const createSettlement = async (amount: number, acc: { id: string, name: string }, descSuffix: string) => {
                const jId = Math.random().toString(36).substr(2, 9);
                await tx.transaction.create({
                    data: {
                        id: jId,
                        tenantId: targetTenantId,
                        date: now,
                        amount: Number(amount),
                        type: 'IN',
                        category: targetPiutangCOA.name,
                        coaId: targetPiutangCOA.id,
                        description: `[EDIT] Pelunasan ${oldRecord.invoiceNumber} - ${customerName} (${descSuffix})`,
                        account: acc.name,
                        accountId: acc.id,
                        businessUnitId: LEVEL_UP_BIZ_UNIT_ID,
                        status: 'PAID',
                        createdAt: now
                    } as any
                });
                await (tx.financialAccount as any).update({
                    where: { id: acc.id, tenantId: targetTenantId },
                    data: { balance: { increment: Number(amount) } }
                });
                transactionIds.push(jId);
            };

            if (paymentMethod === 'CASH') {
                await createSettlement(finalTotal, targetCashAccount, 'CASH');
            } else if (paymentMethod === 'TRANSFER') {
                await createSettlement(finalTotal, targetTransferAccount, 'TF MANDIRI');
            } else if (paymentMethod === 'SPLIT') {
                if (Number(cashAmount) > 0) await createSettlement(Number(cashAmount), targetCashAccount, 'SPLIT-CASH');
                if (Number(transferAmount) > 0) await createSettlement(Number(transferAmount), targetTransferAccount, 'SPLIT-TF');
            }

            // 3. Update Record
            const updatedRecord = await tx.rentalRecord.update({
                where: { id },
                data: {
                    customerName,
                    psType,
                    duration: Number(duration),
                    totalAmount: finalTotal,
                    paymentMethod,
                    cashAmount: paymentMethod === 'SPLIT' ? Number(cashAmount) : (paymentMethod === 'CASH' ? finalTotal : 0),
                    transferAmount: paymentMethod === 'SPLIT' ? Number(transferAmount) : (paymentMethod === 'TRANSFER' ? finalTotal : 0),
                    transactionIds,
                    outletId,
                    staffName: user.name || user.username
                }
            });
            return updatedRecord;
        });

        await recordSystemLog({
            actorId: user.id, actorName: user.name, actorRole: user.role, tenantId: user.tenantId,
            actionType: 'RENTAL_PS_UPDATE',
            details: `Mengedit transaksi rental [${outletName}]: ${oldRecord.invoiceNumber}`,
            targetObj: 'RentalRecord'
        });

        await notifyRentalAction({
            tenantId: user.tenantId,
            actionTitle: 'KOREKSI DATA RENTAL 🟡',
            record: { ...result, outletName },
            actorName: user.name || user.username,
            isUpdate: true,
            oldRecord
        });

        return NextResponse.json(serialize(result));
    } catch (error: any) {
        console.error('Update Error:', error);
        return NextResponse.json({ error: 'Failed to update record', details: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const user = await authorize();
        const { tenantId } = user;
        const { searchParams } = new URL(request.url);

        const limit = parseInt(searchParams.get('limit') || '50');
        const outletId = searchParams.get('outletId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const where: any = { tenantId };
        if (outletId) where.outletId = outletId;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        const [records, stats] = await Promise.all([
            (prisma as any).rentalRecord.findMany({
                where,
                include: { outlet: true },
                orderBy: { createdAt: 'desc' },
                take: limit
            }),
            (prisma as any).rentalRecord.aggregate({
                where,
                _sum: {
                    totalAmount: true,
                    cashAmount: true,
                    transferAmount: true
                },
                _count: {
                    id: true
                }
            })
        ]);

        return NextResponse.json(serialize({
            records,
            stats: {
                totalRevenue: Number(stats._sum.totalAmount || 0),
                totalCash: Number(stats._sum.cashAmount || 0),
                totalTransfer: Number(stats._sum.transferAmount || 0),
                count: stats._count.id
            }
        }));
    } catch (e) {
        console.error('Fetch History Error:', e);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
