import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function GET() {
  try {
    const user = await authorize();
    const { tenantId } = user;

    // Parallel Fetching for Performance - Filter by Tenant (with fallback)
    let users: any[] = [];
    let settingsData: any = null;
    let financialAccounts: any[] = [];

    try {
        users = await prisma.user.findMany({
            where: { tenantId } as any,
            select: { id: true, name: true, username: true, role: true, avatarUrl: true, jobTitle: true, isFreelance: true, tenantId: true, telegramId: true, telegramUsername: true, deviceIds: true, bio: true }
        });
        settingsData = await prisma.settings.findFirst({ where: { tenantId } as any });
        financialAccounts = await prisma.financialAccount.findMany({ 
            where: { tenantId, isActive: true } as any
        });
    } catch (e) {
        console.warn("Schema mismatch: falling back to legacy global queries");
        users = await prisma.user.findMany({
            select: { id: true, name: true, username: true, role: true, avatarUrl: true, jobTitle: true, isFreelance: true, tenantId: true, telegramId: true, telegramUsername: true, deviceIds: true, bio: true }
        });
        settingsData = await prisma.settings.findFirst();
        financialAccounts = await prisma.financialAccount.findMany({ 
            where: { isActive: true } as any
        });
    }

    // 3. Fetch Attendance (Safe for migration)
    let attendanceRecords: any[] = [];
    try {
        attendanceRecords = await prisma.attendance.findMany({
            where: { tenantId } as any,
            orderBy: [{ date: 'desc' }, { timeIn: 'desc' }],
            take: 100
        });
    } catch (err) {
        console.warn("Schema mismatch: falling back to non-tenant attendance query");
        attendanceRecords = await prisma.attendance.findMany({
            orderBy: [{ date: 'desc' }, { timeIn: 'desc' }],
            take: 100
        });
    }

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
          tenantId: (u as any).tenantId,
          telegramId: u.telegramId || '',
          telegramUsername: u.telegramUsername || '',
          role: u.role,
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
        attendance: attendanceRecords.map(a => ({
            id: a.id,
            userId: a.userId,
            tenantId: (a as any).tenantId,
            date: a.date,
            timeIn: a.timeIn,
            timeOut: a.timeOut || undefined,
            isLate: !!a.isLate,
            lateReason: a.lateReason || undefined,
            selfieUrl: a.selfieUrl,
            checkOutSelfieUrl: a.checkoutSelfieUrl || undefined,
            location: { lat: Number(a.locationLat), lng: Number(a.locationLng) }
        })),
        projects: [],
        requests: [],
        transactions: [],
        dailyReports: [],
        salaryConfigs: [],
        payrollRecords: [],
        logs: []
    };

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Bootstrap error', err);
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Auth Required' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load data', details: err.message }, { status: 500 });
  }
}
