import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await authorize(['OWNER', 'FINANCE', 'MANAGER']);
    
    // 1. Fetch Chart of Accounts (Standard)
    const coaList = await prisma.chartOfAccount.findMany({
      where: { isActive: true },
      include: { 
        transactions: {
            select: { amount: true, type: true }
        }
      }
    });

    // 2. Fetch Financial Accounts (Banks/Cash) -> Treat as ASSET
    const financialAccounts = await prisma.financialAccount.findMany({
        where: { isActive: true },
        include: {
            transactions: {
                select: { amount: true, type: true }
            }
        }
    });

    // 2b. Fetch General Journal Transactions (Non-Cash)
    // These are transactions where 'account' stores the Debit COA Name, and 'coaId' stores the Credit COA.
    // 'accountId' is null.
    const generalTransactions = await prisma.transaction.findMany({
        where: { accountId: null },
        select: { amount: true, type: true, account: true }
    });

    // 3. Process COA Balances
    const processedCoa = coaList.map(c => {
        // A. Standard Linked Transactions (via coaId) - Usually the "Credit" side or "Lawan"
        const totalIn = c.transactions.filter(t => t.type === 'IN').reduce((acc, t) => acc + Number(t.amount), 0);
        const totalOut = c.transactions.filter(t => t.type === 'OUT').reduce((acc, t) => acc + Number(t.amount), 0);
        
        // B. General Journal Debit Side (via account string match)
        // Format used in Modal: `${c.code} - ${c.name}`
        const coaString = `${c.code} - ${c.name}`;
        const debitMatches = generalTransactions.filter(t => t.account === coaString);
        const debitIn = debitMatches.filter(t => t.type === 'IN').reduce((acc, t) => acc + Number(t.amount), 0);
        const debitOut = debitMatches.filter(t => t.type === 'OUT').reduce((acc, t) => acc + Number(t.amount), 0); // Rare

        // Calculate Balance based on Normal Position
        let balance = 0;
        
        // Logic:
        // 1. ASSET/EXPENSE (Normal Debit):
        //    - Increase on DEBIT (General Debit matches IN)
        //    - Increase on OUT (Standard Spending)
        //    - Decrease on CREDIT (General Debit matches OUT?)
        //    - Decrease on IN (Standard Income/Lawan)
        
        // Let's Simplify:
        // Net Debit = (Standard OUT) + (General IN [Debit Side])
        // Net Credit = (Standard IN) + (General OUT [Debit Side])
        
        // If Normal DEBIT: Balance = Net Debit - Net Credit
        // If Normal CREDIT: Balance = Net Credit - Net Debit

        const netDebit = totalOut + debitIn;
        const netCredit = totalIn + debitOut;

        if (c.type === 'REVENUE' || c.type === 'LIABILITY' || c.type === 'EQUITY') {
            // Normal Credit
            balance = netCredit - netDebit;
        } else {
            // Normal Debit (Asset / Expense)
            balance = netDebit - netCredit;
        }

        return {
            id: c.id,
            code: c.code,
            name: c.name,
            type: c.type,
            normalPos: c.normalPos,
            balance: balance,
            isSystem: false, // Editable
            createdAt: c.createdAt ? c.createdAt.toString() : null
        };
    });

    // 4. Process Financial Accounts as COA Items
    const processedBanks = financialAccounts.map((fa, index) => {
        // Bank Balance: IN (Debit/Deposit) - OUT (Credit/Withdrawal)
        const totalIn = fa.transactions.filter(t => t.type === 'IN').reduce((acc, t) => acc + Number(t.amount), 0);
        const totalOut = fa.transactions.filter(t => t.type === 'OUT').reduce((acc, t) => acc + Number(t.amount), 0);
        const balance = totalIn - totalOut;

        // Virtual Code - The user mentioned standard bank codes like "110x"
        // We assign temporary virtual codes for display to ensure they appear at the top of ASSETS
        const mockCode = `100${index + 1}`; 

        return {
            id: fa.id,
            code: mockCode, // Virtual Code
            name: `${fa.bankName} - ${fa.name}`, // Combine for clarity
            type: 'ASSET',
            normalPos: 'DEBIT',
            balance: balance,
            isSystem: true, // Lock these (managed in Accounts menu)
            createdAt: fa.createdAt ? fa.createdAt.toString() : null
        };
    });

    // 5. Merge and Sort by Code
    const mergedList = [...processedBanks, ...processedCoa].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

// ...existing code...
    return NextResponse.json(mergedList);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch COA' }, { status: 500 });
  }
}

export async function POST(request: Request) {
    try {
        await authorize(['OWNER', 'FINANCE']);
        const body = await request.json();
        
        // Basic Validation
        if (!body.code || !body.name || !body.type || !body.normalPos) {
            return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
        }

        // Check Duplicate Code
        const existing = await prisma.chartOfAccount.findUnique({ where: { code: body.code } });
        if (existing) {
            return NextResponse.json({ error: `Kode Akun ${body.code} sudah digunakan!` }, { status: 400 });
        }

        const newCoa = await prisma.chartOfAccount.create({
            data: {
                id: `coa_${body.code}`, // Predictable ID
                code: body.code,
                name: body.name,
                type: body.type,
                normalPos: body.normalPos,
                description: body.description || '',
                isActive: true,
                createdAt: Date.now()
            }
        });

        return NextResponse.json({
             ...newCoa,
             createdAt: newCoa.createdAt ? newCoa.createdAt.toString() : null
        }, { status: 201 });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Gagal membuat akun' }, { status: 500 });
    }
}
