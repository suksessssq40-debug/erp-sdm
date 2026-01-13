import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Parallel Fetching for Performance
    const [
        users, 
        settingsData,
        financialAccounts
    ] = await Promise.all([
        prisma.user.findMany(),
        prisma.settings.findFirst(),
        prisma.financialAccount.findMany({ where: { isActive: true } })
    ]);

    // Format Settings
    const settings = settingsData ? {
        officeLocation: { lat: Number(settingsData.officeLat), lng: Number(settingsData.officeLng) },
        officeHours: { start: settingsData.officeStartTime, end: settingsData.officeEndTime },
        telegramBotToken: settingsData.telegramBotToken || '',
        telegramGroupId: settingsData.telegramGroupId || '',
        telegramOwnerChatId: settingsData.telegramOwnerChatId || '',
        dailyRecapTime: settingsData.dailyRecapTime || '18:00',
        dailyRecapModules: typeof settingsData.dailyRecapContent === 'string' 
            ? JSON.parse(settingsData.dailyRecapContent) 
            : (settingsData.dailyRecapContent || []),
        companyProfile: typeof settingsData.companyProfileJson === 'string'
            ? JSON.parse(settingsData.companyProfileJson)
            : (settingsData.companyProfileJson || {})
    } : {};

    const data = {
        users: users.map(u => ({
          id: u.id,
          name: u.name,
          username: u.username,
          telegramId: u.telegramId || '',
          telegramUsername: u.telegramUsername || '',
          role: u.role,
          deviceId: typeof u.deviceIds === 'object' ? null : null, 
          deviceIds: u.deviceIds || [],
          avatarUrl: u.avatarUrl || undefined,
          jobTitle: u.jobTitle || undefined,
          bio: u.bio || undefined,
          isFreelance: !!u.isFreelance
        })),
        settings,
        financialAccounts: financialAccounts.map(a => ({
          id: a.id,
          name: a.name,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
          description: a.description,
          isActive: a.isActive
        })),
        // Lazy Loading Placeholders
        attendance: [],
        projects: [],
        requests: [],
        transactions: [],
        dailyReports: [],
        salaryConfigs: [],
        payrollRecords: [],
        logs: []
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('Bootstrap error', err);
    return NextResponse.json({ error: 'Failed to load initial data' }, { status: 500 });
  }
}
