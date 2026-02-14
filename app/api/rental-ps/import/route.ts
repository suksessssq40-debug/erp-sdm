
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
                        // Handle potential currency strings from excel
                        return Number(val.toString().replace(/[^0-9]/g, ''));
                    };

                    const cleanFloat = (val: any) => {
                        if (typeof val === 'number') return isNaN(val) ? 1 : val;
                        if (!val) return 1;
                        const str = val.toString().replace(',', '.').replace(/[^0-9.]/g, '');
                        const num = parseFloat(str);
                        return isNaN(num) ? 1 : num;
                    };

                    const cashAmountInput = cleanAmount(rec.cashAmount || rec.tunai);
                    const transferAmountInput = cleanAmount(rec.transferAmount || rec.transfer || rec.bank);

                    // SMART TOTAL: Calculate total from components
                    // Even if totalAmount header is missing or wrong, we trust cash + transfer
                    const totalAmount = cashAmountInput + transferAmountInput;

                    // STRICT VALIDATION: Must have some money coming in
                    if (totalAmount <= 0) {
                        failCount++;
                        errors.push(`Baris ${successCount + failCount}: Nominal Tunai & Transfer kosong.`);
                        continue;
                    }

                    // Determine Dates (Force to Jakarta context to avoid UTC shifts)
                    let transactionDate = new Date();
                    if (rec.date) {
                        try {
                            // If it's already a simple YYYY-MM-DD string, parse components directly
                            const isoMatch = typeof rec.date === 'string' && rec.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
                            if (isoMatch) {
                                transactionDate = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T12:00:00.000+07:00`);
                            } else {
                                const d = new Date(rec.date);
                                if (!isNaN(d.getTime())) {
                                    // Extract components using Jakarta timezone
                                    const jktParts = new Intl.DateTimeFormat('en-CA', {
                                        timeZone: 'Asia/Jakarta',
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                    }).formatToParts(d);

                                    const getP = (t: string) => jktParts.find(p => p.type === t)?.value;
                                    const dateStr = `${getP('year')}-${getP('month')}-${getP('day')}`;

                                    // Set to 12:00 PM Jakarta (05:00 AM UTC) - safe from any TZ boundary shifts
                                    transactionDate = new Date(`${dateStr}T12:00:00.000+07:00`);
                                }
                            }
                        } catch (e) {
                            transactionDate = new Date();
                        }
                    }

                    // Resolve Outlet
                    const inputOutlet = (rec.outlet || rec.cabang || "").toLowerCase().trim();
                    const outletId = outletMap[inputOutlet] || allOutlets[0]?.id || null;

                    // B. GENERATE INVOICE NUMBER (Using Jakarta Context)
                    const jktFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'numeric' }).formatToParts(transactionDate);
                    const year = parseInt(jktFmt.find(p => p.type === 'year')?.value || "0");
                    const month = parseInt(jktFmt.find(p => p.type === 'month')?.value || "0");
                    const periodKey = `${year}-${month}`;

                    if (!batchCounter[periodKey]) {
                        // Find the highest sequence number in DB for this month/year (Jakarta range)
                        const start = new Date(`${year}-${month.toString().padStart(2, '0')}-01T00:00:00+07:00`);
                        const end = new Date(`${month === 12 ? year + 1 : year}-${(month === 12 ? 1 : month + 1).toString().padStart(2, '0')}-01T00:00:00+07:00`);

                        const latestInDB = await tx.rentalRecord.findFirst({
                            where: {
                                createdAt: {
                                    gte: start,
                                    lt: end
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

                    // C. SMART PAYMENT METHOD DETECTION
                    let paymentMethod: 'CASH' | 'TRANSFER' | 'SPLIT' = 'CASH';
                    let finalCash = cashAmountInput;
                    let finalTf = transferAmountInput;

                    if (finalCash > 0 && finalTf > 0) {
                        paymentMethod = 'SPLIT';
                    } else if (finalTf > 0) {
                        paymentMethod = 'TRANSFER';
                    } else {
                        paymentMethod = 'CASH';
                    }

                    const staffName = rec.staffName || rec.petugas || 'System Import';

                    // D. CREATE RENTAL RECORD
                    const rental = await tx.rentalRecord.create({
                        data: {
                            invoiceNumber,
                            customerName: rec.customerName || rec.customer || 'Unknown',
                            psType: rec.psType || rec.unit || 'PS 3',
                            duration: cleanFloat(rec.duration),
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
