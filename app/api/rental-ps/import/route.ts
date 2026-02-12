
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import { generateInvoiceNumber } from '@/utils/roman';
import { recordSystemLog, serialize } from '@/lib/serverUtils';

export const dynamic = 'force-dynamic';

// Constants - Fallbacks
const LEVEL_UP_BIZ_UNIT_ID = 'eke1tjt1u';
const COA_PIUTANG_LUG = { id: 'coa_132100', code: '132100', name: 'Piutang Dagang Level Up Gaming' };
const COA_PENJUALAN_LUG = { id: 'coa_411400', code: '411400', name: 'Penjualan Level Up Gaming' };

// Legacy Fallbacks (Used if settings are not configured)
const ACC_KAS_KECIL = { id: 'vq8bcdrkc', name: '110001-Kas Kecil' };
const ACC_MANDIRI_SDM = { id: 'acc_tunai', name: '120007-Kas Mandiri SDM 14843' };

export async function POST(request: Request) {
    try {
        const user = await authorize(['OWNER', 'MANAGER', 'FINANCE', 'STAFF']);
        const body = await request.json();
        const { records, outletId } = body;

        if (!records || !Array.isArray(records)) {
            return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
        }

        // Fetch Financial Settings once
        const settings = await (prisma as any).settings.findUnique({ where: { tenantId: user.tenantId } });
        const targetTenant = settings?.rentalPsTargetTenantId || 'sdm';

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

        // Define Target COAs
        let targetPiutangCOA = { id: (settings as any)?.rentalPsReceivableCoaId || COA_PIUTANG_LUG.id, name: `${COA_PIUTANG_LUG.code} - ${COA_PIUTANG_LUG.name}` };
        let targetPenjualanCOA = { id: (settings as any)?.rentalPsSalesCoaId || COA_PENJUALAN_LUG.id, name: `${COA_PENJUALAN_LUG.code} - ${COA_PENJUALAN_LUG.name}` };

        if ((settings as any)?.rentalPsReceivableCoaId) {
            const coa = await prisma.chartOfAccount.findUnique({ where: { id: (settings as any).rentalPsReceivableCoaId } });
            if (coa) targetPiutangCOA.name = `${coa.code} - ${coa.name}`;
        }
        if ((settings as any)?.rentalPsSalesCoaId) {
            const coa = await prisma.chartOfAccount.findUnique({ where: { id: (settings as any).rentalPsSalesCoaId } });
            if (coa) targetPenjualanCOA.name = `${coa.code} - ${coa.name}`;
        }

        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        for (const rec of records) {
            try {
                // 1. Clean & Parse Data
                const cleanAmount = (val: any) => {
                    if (typeof val === 'number') return val;
                    if (!val) return 0;
                    return Number(val.toString().replace(/[^0-9]/g, ''));
                };

                const totalAmount = cleanAmount(rec.totalAmount || rec.nominal);
                if (totalAmount <= 0) continue; // Skip empty rows

                const paymentMethod = (rec.paymentMethod || 'CASH').toUpperCase();
                const cashAmount = paymentMethod === 'CASH' ? totalAmount : (paymentMethod === 'SPLIT' ? cleanAmount(rec.cashAmount) : 0);
                const transferAmount = paymentMethod === 'TRANSFER' ? totalAmount : (paymentMethod === 'SPLIT' ? cleanAmount(rec.transferAmount) : 0);

                // BACKDATE FIX: Stricter date parsing
                let createdAt = new Date();
                if (rec.date) {
                    const parsed = new Date(rec.date);
                    if (!isNaN(parsed.getTime())) {
                        createdAt = parsed;
                    }
                }

                const psType = rec.psType || rec.unit || 'PS 3';
                const customerName = rec.customerName || rec.customer || 'Unknown';
                const staffName = rec.staffName || rec.petugas || 'Spreadsheet Import';

                // 2. Generate Invoice Number based on the ACTUAL transaction date
                const startOfMonth = new Date(createdAt.getFullYear(), createdAt.getMonth(), 1);
                const endOfMonth = new Date(createdAt.getFullYear(), createdAt.getMonth() + 1, 0, 23, 59, 59, 999);

                const monthCount = await prisma.rentalRecord.count({
                    where: {
                        createdAt: { gte: startOfMonth, lte: endOfMonth }
                    }
                });

                const invoiceNumber = rec.invoiceNumber || generateInvoiceNumber(monthCount + 1, createdAt);

                // 3. EXECUTE ATOMIC TRANSACTION
                await (prisma as any).$transaction(async (tx: any) => {
                    // A. Create Rental Record
                    const rental = await tx.rentalRecord.create({
                        data: {
                            invoiceNumber,
                            customerName,
                            psType,
                            duration: Number(rec.duration || 1),
                            totalAmount,
                            paymentMethod,
                            cashAmount,
                            transferAmount,
                            tenantId: user.tenantId,
                            outletId: outletId || rec.outletId,
                            staffName,
                            businessUnitId: LEVEL_UP_BIZ_UNIT_ID,
                            createdAt: createdAt // FORCE SET
                        }
                    });

                    const transactionIds: string[] = [];

                    // B. JURNAL 1: PENGAKUAN PENJUALAN
                    const recognitionTime = new Date(createdAt.getTime() - 1000);
                    const j1Id = `J1-${Math.random().toString(36).substr(2, 7)}-${Date.now()}`;

                    await tx.transaction.create({
                        data: {
                            id: j1Id,
                            tenantId: targetTenant,
                            date: recognitionTime,
                            amount: totalAmount,
                            type: 'IN',
                            category: targetPenjualanCOA.name,
                            coaId: targetPenjualanCOA.id,
                            description: `[IMPORT] Penjualan PS (${psType}) - ${invoiceNumber} - ${customerName}`,
                            account: targetPiutangCOA.name,
                            accountId: null,
                            businessUnitId: LEVEL_UP_BIZ_UNIT_ID,
                            status: 'PAID',
                            createdAt: recognitionTime
                        } as any
                    });
                    transactionIds.push(j1Id);

                    // C. JURNAL 2: PELUNASAN
                    const createSettlement = async (amount: number, acc: { id: string, name: string }, suffix: string) => {
                        const jId = `J2-${Math.random().toString(36).substr(2, 7)}-${Date.now()}`;

                        await tx.transaction.create({
                            data: {
                                id: jId,
                                tenantId: targetTenant,
                                date: createdAt,
                                amount: Number(amount),
                                type: 'IN',
                                category: targetPiutangCOA.name,
                                coaId: targetPiutangCOA.id,
                                description: `[IMPORT] Pelunasan ${invoiceNumber} - ${customerName} (${suffix})`,
                                account: acc.name,
                                accountId: acc.id,
                                businessUnitId: LEVEL_UP_BIZ_UNIT_ID,
                                status: 'PAID',
                                createdAt: createdAt
                            } as any
                        });

                        // Update Bank Balance
                        await (tx.financialAccount as any).update({
                            where: { id: acc.id, tenantId: targetTenant },
                            data: { balance: { increment: Number(amount) } }
                        });

                        transactionIds.push(jId);
                    };

                    if (paymentMethod === 'CASH') {
                        await createSettlement(totalAmount, targetCashAccount, 'CASH');
                    } else if (paymentMethod === 'TRANSFER') {
                        await createSettlement(totalAmount, targetTransferAccount, 'TF');
                    } else if (paymentMethod === 'SPLIT') {
                        if (cashAmount > 0) await createSettlement(cashAmount, targetCashAccount, 'SPLIT-CASH');
                        if (transferAmount > 0) await createSettlement(transferAmount, targetTransferAccount, 'SPLIT-TF');
                    }

                    // D. Link Audit
                    await tx.rentalRecord.update({
                        where: { id: rental.id },
                        data: { transactionIds }
                    });
                });

                successCount++;
            } catch (err: any) {
                failCount++;
                errors.push(`Row ${successCount + failCount}: ${err.message}`);
            }
        }

        await recordSystemLog({
            actorId: user.id, actorName: user.name, actorRole: user.role, tenantId: user.tenantId,
            actionType: 'RENTAL_PS_IMPORT_FULL',
            details: `Import masal berhasil: ${successCount}, Gagal: ${failCount}. Dengan Jurnal Keuangan Dinamis.`,
            targetObj: 'RentalRecord'
        });

        return NextResponse.json({
            success: true,
            count: successCount,
            failed: failCount,
            errors: errors.slice(0, 10)
        });
    } catch (error: any) {
        console.error('Core Import Error:', error);
        return NextResponse.json({ error: 'Gagal total proses import', details: error.message }, { status: 500 });
    }
}
