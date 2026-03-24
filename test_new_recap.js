
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNewRecap() {
    const tenantId = 'sdm'; // Test with sdm
    console.log(`--- 🧪 TESTING NEW RECAP LOGIC FOR TENANT: ${tenantId} ---`);

    // 1. Simulation Jakarta Date
    const now = new Date();
    // For testing, let's assume we want report for "yesterday" if it's 5 AM
    const isEarlyMorning = true;
    let targetDate = new Date();
    if (isEarlyMorning) {
        targetDate.setDate(targetDate.getDate() - 1);
    }
    const sqlDateStr = targetDate.toISOString().split('T')[0];
    const startOfTargetDate = new Date(sqlDateStr + 'T00:00:00.000Z');
    const endOfTargetDate = new Date(sqlDateStr + 'T23:59:59.999Z');

    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);

    console.log(`Target Date: ${sqlDateStr}`);
    console.log(`Start of Month: ${startOfMonth.toISOString().split('T')[0]}`);

    // 2. DAILY CASH FLOW (Categorized)
    // We filter by accountId IS NOT NULL and status PAID
    const dailyTransactions = await prisma.transaction.findMany({
        where: {
            tenantId,
            date: { gte: startOfTargetDate, lte: endOfTargetDate },
            status: 'PAID',
            accountId: { not: null }
        },
        include: { coa: true }
    });

    let dailyIncome = 0;
    let dailyExpense = 0;
    const dailyIncomeBreakdown = {};
    const dailyExpenseBreakdown = {};

    dailyTransactions.forEach(t => {
        const amount = Number(t.amount);
        const cat = t.coa ? t.coa.name : (t.category || 'Lain-lain');
        if (t.type === 'IN') {
            dailyIncome += amount;
            dailyIncomeBreakdown[cat] = (dailyIncomeBreakdown[cat] || 0) + amount;
        } else {
            dailyExpense += amount;
            dailyExpenseBreakdown[cat] = (dailyExpenseBreakdown[cat] || 0) + amount;
        }
    });

    console.log('\n[DAILY STATS]');
    console.log(`income: ${dailyIncome}`);
    console.log(`expense: ${dailyExpense}`);
    console.log('Breakdown Income:', dailyIncomeBreakdown);
    console.log('Breakdown Expense:', dailyExpenseBreakdown);

    // 3. MONTHLY CASH FLOW (MTD)
    const monthlyIn = await prisma.transaction.aggregate({
        where: {
            tenantId,
            date: { gte: startOfMonth, lte: endOfTargetDate },
            status: 'PAID',
            accountId: { not: null },
            type: 'IN'
        },
        _sum: { amount: true }
    });
    const monthlyOut = await prisma.transaction.aggregate({
        where: {
            tenantId,
            date: { gte: startOfMonth, lte: endOfTargetDate },
            status: 'PAID',
            accountId: { not: null },
            type: 'OUT'
        },
        _sum: { amount: true }
    });

    console.log('\n[MONTHLY STATS]');
    console.log(`Monthly In: ${Number(monthlyIn._sum.amount || 0)}`);
    console.log(`Monthly Out: ${Number(monthlyOut._sum.amount || 0)}`);

    // 4. ACCOUNT BALANCES
    const accounts = await prisma.financialAccount.findMany({
        where: { tenantId, isActive: true }
    });

    console.log('\n[ACCOUNT BALANCES]');
    accounts.forEach(acc => {
        console.log(`- ${acc.name}: ${Number(acc.balance)}`);
    });

    await prisma.$disconnect();
}

testNewRecap().catch(err => {
    console.error(err);
    process.exit(1);
});
