
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

/**
 * Helper: Given a stored transaction, look up which financial accounts are
 * involved on the debit side vs the credit side, based on the stored type.
 *
 * Convention (established in POST route.ts):
 *   - 'IN'  → Bank/Kas is on the ACCOUNT (Debit) side, Category is the revenue/contra source
 *   - 'OUT' → Bank/Kas is on the ACCOUNT side too (it was swapped on write), Category is the expense/destination
 *   - Transfer (Bank→Bank): stored as OUT, ACCOUNT = source bank (credit side), CATEGORY = dest bank (debit side)
 *
 * For balance adjustment purposes:
 *   - ACCOUNT field always holds the bank that was credited/debited at ACCOUNT position
 *   - CATEGORY field may hold a second bank in a transfer
 *
 * The balance impact on CREATE was:
 *   if (bankDebit) balance += amount   → bankDebit === the bank in category for OUT, or account for IN
 *   if (bankCredit) balance -= amount  → bankCredit === the bank in account for OUT, or category for IN
 *
 * WAIT — let's re-read POST carefully to be exact:
 *   bankDebit  = match on body.account (debit side label from form)
 *   bankCredit = match on body.category (credit side label from form)
 *   if IN  (bankDebit only): finalAccountLabel = bankDebit.name  → stored in account col
 *                             finalCategoryLabel = creditName     → stored in category col
 *                             balance: bankDebit += amount
 *   if OUT (bankCredit only): finalAccountLabel = bankCredit.name → stored in account col (SWAPPED!)
 *                              finalCategoryLabel = debitName     → stored in category col
 *                              balance: bankCredit -= amount
 *   if Transfer (both):       finalAccountLabel = bankCredit.name → stored in account col
 *                             finalCategoryLabel = bankDebit.name  → stored in category col
 *                             balance: bankDebit += amount, bankCredit -= amount
 *
 * So in the DB, ACCOUNT always holds the "primary" bank reference (the one that was Credit-side for OUT).
 * To UNDO:
 *   IN  → find bank by old.account → DECREMENT (it was incremented on create)
 *   OUT → find bank by old.account → INCREMENT (it was decremented on create)
 *   Transfer → find bank by old.account → INCREMENT, find bank by old.category → DECREMENT
 */
async function undoTransactionBalance(
    tx: any,
    tenantId: string,
    old: { type: string; account: string; category: string | null; amount: any }
): Promise<void> {
    const oldAmount = Number(old.amount);

    if (old.type === 'IN') {
        // Account field holds the bank that was incremented. Undo = decrement.
        const bankAccount = await tx.financialAccount.findFirst({
            where: { tenantId, name: { equals: old.account, mode: 'insensitive' }, isActive: true }
        });
        if (bankAccount) {
            await tx.financialAccount.update({
                where: { id: bankAccount.id },
                data: { balance: { decrement: oldAmount } }
            });
        }
    } else if (old.type === 'OUT') {
        if (old.category) {
            // Check if category is also a bank (= this was an Internal Transfer)
            const bankCategory = await tx.financialAccount.findFirst({
                where: { tenantId, name: { equals: old.category, mode: 'insensitive' }, isActive: true }
            });
            const bankAccount = await tx.financialAccount.findFirst({
                where: { tenantId, name: { equals: old.account, mode: 'insensitive' }, isActive: true }
            });

            if (bankCategory && bankAccount) {
                // Transfer: account was credit-side (decremented), category was debit-side (incremented)
                await tx.financialAccount.update({
                    where: { id: bankAccount.id },
                    data: { balance: { increment: oldAmount } } // Undo the decrement
                });
                await tx.financialAccount.update({
                    where: { id: bankCategory.id },
                    data: { balance: { decrement: oldAmount } } // Undo the increment
                });
            } else if (bankAccount) {
                // Regular OUT: account was credit-side (decremented). Undo = increment.
                await tx.financialAccount.update({
                    where: { id: bankAccount.id },
                    data: { balance: { increment: oldAmount } }
                });
            }
        } else {
            // OUT with no category bank — just undo account
            const bankAccount = await tx.financialAccount.findFirst({
                where: { tenantId, name: { equals: old.account, mode: 'insensitive' }, isActive: true }
            });
            if (bankAccount) {
                await tx.financialAccount.update({
                    where: { id: bankAccount.id },
                    data: { balance: { increment: oldAmount } }
                });
            }
        }
    }
}

/**
 * Helper: Apply balance impact for a new transaction, mirroring POST logic exactly.
 */
async function applyTransactionBalance(
    tx: any,
    tenantId: string,
    bankDebit: { id: string } | null,
    bankCredit: { id: string } | null,
    amount: number
): Promise<void> {
    if (bankDebit) {
        await tx.financialAccount.update({
            where: { id: bankDebit.id },
            data: { balance: { increment: amount } }
        });
    }
    if (bankCredit) {
        await tx.financialAccount.update({
            where: { id: bankCredit.id },
            data: { balance: { decrement: amount } }
        });
    }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;
        const body = await request.json();

        if (!body.amount || !body.account) {
            return NextResponse.json({ error: 'Invalid data: amount and account are required' }, { status: 400 });
        }

        // STRICT CHECK: Ownership & Tenant match before any writes
        const existingTx = await prisma.transaction.findFirst({ where: { id, tenantId } });
        if (!existingTx) {
            return NextResponse.json({ error: 'Transaction not found or unauthorized' }, { status: 404 });
        }

        // --- Resolve Bank Accounts for the NEW (incoming) transaction data ---
        // These are the form labels BEFORE any swapping. Match them as-is from the form.
        const debitName: string = body.account;
        const creditName: string = body.category ?? '';

        const [newBankDebit, newBankCredit] = await Promise.all([
            prisma.financialAccount.findFirst({
                where: { tenantId, name: { equals: debitName, mode: 'insensitive' }, isActive: true }
            }),
            creditName
                ? prisma.financialAccount.findFirst({
                    where: { tenantId, name: { equals: creditName, mode: 'insensitive' }, isActive: true }
                })
                : Promise.resolve(null)
        ]);

        // Determine final stored type and accountId (mirrors POST logic exactly)
        let finalType: 'IN' | 'OUT' = (body.type as 'IN' | 'OUT') || 'IN';
        let finalAccountLabel = debitName;
        let finalCategoryLabel = creditName;
        let finalAccountId: string | null = null;

        if (newBankDebit || newBankCredit) {
            if (newBankDebit && !newBankCredit) {
                finalType = 'IN';
                finalAccountLabel = newBankDebit.name;
                finalCategoryLabel = creditName;
                finalAccountId = newBankDebit.id;
            } else if (newBankCredit && !newBankDebit) {
                finalType = 'OUT';
                finalAccountLabel = newBankCredit.name;   // SWAP: bank goes to account col
                finalCategoryLabel = debitName;            // expense goes to category col
                finalAccountId = newBankCredit.id;
            } else if (newBankDebit && newBankCredit) {
                // Internal Transfer: credit-side bank is the source
                finalType = 'OUT';
                finalAccountLabel = newBankCredit.name;   // source bank
                finalCategoryLabel = newBankDebit.name;   // destination bank
                finalAccountId = newBankCredit.id;
            }
        }
        // else: General Journal — keep labels as-is, type from body

        const newAmount = Number(body.amount);

        const updated = await prisma.$transaction(async (tx) => {
            // Fetch the current DB state inside the transaction for freshness
            const old = await tx.transaction.findUnique({ where: { id } });
            if (!old) throw new Error('Transaction not found inside transaction');

            // STEP 1: Undo the balance impact of the OLD transaction
            // old.type / old.account are string|null per Prisma schema — we use ?? '' as a safe
            // fallback; valid stored transactions will never actually have null here.
            await undoTransactionBalance(tx, tenantId, {
                type:     old.type    ?? '',
                account:  old.account ?? '',
                category: old.category,
                amount:   old.amount
            });

            // STEP 2: Update the transaction record
            const updatedRecord = await tx.transaction.update({
                where: { id },
                data: {
                    date: new Date(body.date),
                    amount: newAmount,
                    type: finalType,
                    account: finalAccountLabel,
                    category: finalCategoryLabel || null,
                    description: body.description ?? null,
                    accountId: finalAccountId,
                    coaId: body.coaId ?? null,
                    businessUnitId: body.businessUnitId ?? null,
                    imageUrl: body.imageUrl ?? null,
                    contactName: body.contactName ?? null,
                    status: body.status ?? 'PAID',
                    dueDate: body.dueDate ? new Date(body.dueDate) : null,
                } as any
            });

            // STEP 3: Apply the balance impact of the NEW transaction
            await applyTransactionBalance(tx, tenantId, newBankDebit, newBankCredit, newAmount);

            return updatedRecord;
        });

        // Serialize Decimal/BigInt fields safely
        const safe = { ...updated, amount: Number((updated as any).amount) };
        return NextResponse.json(safe);

    } catch (error) {
        console.error('PUT /transactions/[id] Error:', error);
        return NextResponse.json({ error: (error as any).message || 'Failed to update transaction' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = await authorize(['OWNER', 'FINANCE']);
        const { tenantId } = user;
        const id = params.id;

        // STRICT CHECK: Tenant validation
        const existing = await prisma.transaction.findFirst({ where: { id, tenantId } });
        if (!existing) {
            return NextResponse.json({ error: 'Unauthorized delete or not found' }, { status: 403 });
        }

        await prisma.$transaction(async (tx) => {
            const old = await tx.transaction.findUnique({ where: { id } });
            if (!old) return;

            // Undo balance impact using the same robust helper
            await undoTransactionBalance(tx, tenantId, {
                type:     old.type    ?? '',
                account:  old.account ?? '',
                category: old.category,
                amount:   old.amount
            });

            await tx.transaction.delete({ where: { id } });
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('DELETE /transactions/[id] Error:', error);
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}
