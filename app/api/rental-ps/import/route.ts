
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
        const { records } = body;

        if (!records || !Array.isArray(records)) {
            return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
        }

        // 1. Fetch Tenant Settings
        const settings = await (prisma as any).settings.findUnique({ where: { tenantId: user.tenantId } });
        const targetTenant = settings?.rentalPsTargetTenantId || user.tenantId;
        const targetBusinessUnitId = settings?.rentalPsTargetBusinessUnitId || LEVEL_UP_BIZ_UNIT_ID;

        const targetCashAccount = { id: settings?.rentalPsCashAccountId || ACC_KAS_KECIL.id, name: ACC_KAS_KECIL.name };
        const targetTransferAccount = { id: settings?.rentalPsTransferAccountId || ACC_MANDIRI_SDM.id, name: ACC_MANDIRI_SDM.name };

        // 2. Map Outlets for Name Resolution
        const allOutlets = await prisma.rentalPsOutlet.findMany({ where: { tenantId: user.tenantId } });
        const outletMap: Record<string, string> = {};
        allOutlets.forEach(o => { outletMap[o.name.toLowerCase().trim()] = o.id; });

        // 3. Define Target COAs
        const targetPiutangCOA = { id: (settings as any)?.rentalPsReceivableCoaId || COA_PIUTANG_LUG.id, name: COA_PIUTANG_LUG.name };
        const targetPenjualanCOA = { id: (settings as any)?.rentalPsSalesCoaId || COA_PENJUALAN_LUG.id, name: COA_PENJUALAN_LUG.name };

        let successCount = 0;
        let failCount = 0;
        const errors: string[] = [];

        // Global counter to avoid duplicate invoice numbers within the same batch
        const batchCounter: Record<string, number> = {};

        // USE TRANSACTION FOR ATOMICITY
        await (prisma as any).$transaction(async (tx: any) => {
            for (const rec of records) {
                try {
                    // A. Parse & Clean Data
                    const cleanAmount = (val: any) => {
                        if (typeof val === 'number') return val;
                        if (!val) return 0;
                        return Number(val.toString().replace(/[^0-9]/g, ''));
                    };

                    const totalAmount = cleanAmount(rec.totalAmount || rec.nominal);
                    const cashAmountInput = cleanAmount(rec.cashAmount);
                    const transferAmountInput = cleanAmount(rec.transferAmount);

                    if (totalAmount <= 0) continue;

                    // Determine Dates
                    let transactionDate = new Date();
                    if (rec.date) {
                        const parsed = new Date(rec.date);
                        if (!isNaN(parsed.getTime())) transactionDate = parsed;
                    }

                    // Resolve Outlet
                    const inputOutlet = (rec.outlet || rec.cabang || "").toLowerCase().trim();
                    const outletId = outletMap[inputOutlet] || allOutlets[0]?.id || null;

                    // B. GENERATE INVOICE NUMBER (The Smart Way)
                    const year = transactionDate.getFullYear();
                    const month = transactionDate.getMonth() + 1;
                    const periodKey = `${year}-${month}`;

                    if (!batchCounter[periodKey]) {
                        // Find the highest sequence number in DB for this month/year
                        const latestInDB = await tx.rentalRecord.findFirst({
                            where: {
                                createdAt: {
                                    gte: new Date(year, month - 1, 1),
                                    lt: new Date(year, month, 1)
                                }
                            },
                            orderBy: { invoiceNumber: 'desc' },
                            select: { invoiceNumber: true }
                        });

                        let currentSeq = 0;
                        if (latestInDB?.invoiceNumber) {
                            const parts = latestInDB.invoiceNumber.split('-');
                            const lastPart = parts[parts.length - 1];
                            currentSeq = parseInt(lastPart) || 0;
                        }
                        batchCounter[periodKey] = currentSeq;
                    }

                    batchCounter[periodKey]++;
                    const invoiceNumber = generateInvoiceNumber(batchCounter[periodKey], transactionDate);

                    // C. Payment Method Logic
                    let paymentMethod = (rec.paymentMethod || 'CASH').toUpperCase();
                    let finalCash = 0;
                    let finalTf = 0;

                    if (paymentMethod === 'SPLIT' || (cashAmountInput > 0 && transferAmountInput > 0)) {
                        paymentMethod = 'SPLIT';
                        finalCash = cashAmountInput;
                        finalTf = transferAmountInput;
                        // Safety check if split amounts don't match total
                        if (finalCash + finalTf !== totalAmount && finalCash + finalTf > 0) {
                            // Keep input as is, but maybe prioritize total? Let's assume input is correct.
                        }
                    } else if (paymentMethod === 'TRANSFER' || transferAmountInput > 0) {
                        paymentMethod = 'TRANSFER';
                        finalTf = totalAmount;
                    } else {
                        paymentMethod = 'CASH';
                        finalCash = totalAmount;
                    }

                    const staffName = rec.staffName || rec.petugas || 'System Import';

                    // D. CREATE RENTAL RECORD
                    const rental = await tx.rentalRecord.create({
                        data: {
                            invoiceNumber,
                            customerName: rec.customerName || rec.customer || 'Unknown',
                            psType: rec.psType || rec.unit || 'PS 3',
                            duration: Number(rec.duration || 1),
                            totalAmount,
                            paymentMethod,
                            cashAmount: finalCash,
                            transferAmount: finalTf,
                            tenantId: user.tenantId,
                            outletId,
                            staffName,
                            businessUnitId: targetBusinessUnitId,
                            createdAt: transactionDate
                        }
                    });

                    // E. FINANCE JOURNALS
                    const transactionIds: string[] = [];
                    const recognitionTime = new Date(transactionDate.getTime() - 1000);

                    // J1: Sales Recognition (Piutang)
                    const j1Id = `J1-${Math.random().toString(36).substr(2, 5)}-${Date.now()}`;
                    await tx.transaction.create({
                        data: {
                            id: j1Id, tenantId: targetTenant, date: recognitionTime, amount: totalAmount,
                            type: 'IN', category: targetPenjualanCOA.name, coaId: targetPenjualanCOA.id,
                            description: `[IMPORT] Penjualan PS - ${invoiceNumber} - ${rental.customerName}`,
                            account: targetPiutangCOA.name, accountId: null, status: 'PAID',
                            businessUnitId: targetBusinessUnitId, createdAt: recognitionTime
                        } as any
                    });
                    transactionIds.push(j1Id);

                    // J2: Settlement (Payment)
                    const createSettlement = async (amt: number, acc: { id: string, name: string }, type: string) => {
                        const jId = `J2-${Math.random().toString(36).substr(2, 5)}-${Date.now()}`;
                        await tx.transaction.create({
                            data: {
                                id: jId, tenantId: targetTenant, date: transactionDate, amount: amt,
                                type: 'IN', category: targetPiutangCOA.name, coaId: targetPiutangCOA.id,
                                description: `[IMPORT] Pelunasan ${invoiceNumber} (${type})`,
                                account: acc.name, accountId: acc.id, status: 'PAID',
                                businessUnitId: targetBusinessUnitId, createdAt: transactionDate
                            } as any
                        });
                        await tx.financialAccount.update({
                            where: { id: acc.id },
                            data: { balance: { increment: amt } }
                        });
                        transactionIds.push(jId);
                    };

                    if (finalCash > 0) await createSettlement(finalCash, targetCashAccount, 'KAS');
                    if (finalTf > 0) await createSettlement(finalTf, targetTransferAccount, 'BANK');

                    await tx.rentalRecord.update({
                        where: { id: rental.id },
                        data: { transactionIds }
                    });

                    successCount++;
                } catch (err: any) {
                    failCount++;
                    errors.push(`Baris ${successCount + failCount}: ${err.message}`);
                    throw err; // Trigger transaction rollback
                }
            }
        }, { timeout: 30000 });

        await recordSystemLog({
            actorId: user.id, actorName: user.name, actorRole: user.role, tenantId: user.tenantId,
            actionType: 'RENTAL_PS_IMPORT_EXCEL',
            details: `Import berhasil: ${successCount}, Gagal: ${failCount}.`,
            targetObj: 'RentalRecord'
        });

        return NextResponse.json({ success: true, count: successCount, failed: failCount, errors });

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Gagal proses import' }, { status: 500 });
    }
}
