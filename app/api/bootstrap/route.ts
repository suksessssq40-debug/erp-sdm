export const dynamic = 'force-dynamic';
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
    let tenantFeatures: string | null = null;
    let logs: any[] = [];

    // 2. Fetch Users who have access to this tenant (via TenantAccess table)
    try {
      const [tenantAccessList, settingsRes, accountsRes, tenantRes, logsRes] = await Promise.all([
        prisma.tenantAccess.findMany({
          where: { tenantId, isActive: true },
          include: { user: true }
        }),
        prisma.settings.findFirst({ where: { tenantId } as any }),
        prisma.financialAccount.findMany({
          where: { tenantId, isActive: true } as any
        }),
        prisma.tenant.findUnique({ where: { id: tenantId }, select: { featuresJson: true } }),
        prisma.systemLog.findMany({
          where: { tenantId },
          orderBy: { timestamp: 'desc' },
          take: 50
        })
      ]);

      // Flatten and transform to match previous structure
      users = tenantAccessList.map(ta => ({
        ...ta.user,
        role: ta.role, // Use the role defined for THIS tenant
        tenantId: ta.tenantId
      }));

      settingsData = settingsRes;
      financialAccounts = accountsRes;
      tenantFeatures = tenantRes?.featuresJson || '[]';

      logs = logsRes.map(l => ({
        id: l.id,
        timestamp: Number(l.timestamp),
        actorId: l.actorId,
        actorName: l.actorName,
        actorRole: l.actorRole,
        actionType: l.actionType,
        details: l.details,
        target: l.targetObj || undefined,
        metadata: l.metadataJson ? JSON.parse(l.metadataJson) : undefined
      }));
    } catch (e) {
      console.error("Critical Bootstrap Err (Users/Settings):", e);
      throw e;
    }

    // 3. REMOVED HEAVY FETCHES (Lazy Load Implementation)
    // We only return EMPTY arrays or minimal data required for "App Shell"
    // The specific modules (Finance, Projects, etc.) will fetch their own data.

    // Format Settings
    const settings = settingsData ? {
      officeLocation: { lat: Number(settingsData.officeLat), lng: Number(settingsData.officeLng) },
      officeHours: { start: settingsData.officeStartTime, end: settingsData.officeEndTime },
      hasOvernightShift: !!settingsData.hasOvernightShift,
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
        isFreelance: !!u.isFreelance,
        features: u.id === user.id ? (tenantFeatures || '[]') : undefined
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
      attendance: [], // Lazy Loaded
      projects: [],   // Lazy Loaded
      requests: [],   // Lazy Loaded
      transactions: [], // Lazy Loaded
      dailyReports: [], // Lazy Loaded
      salaryConfigs: [], // Fetched on demand in Payroll
      payrollRecords: [], // Fetched on demand in Payroll
      logs: logs
    };

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Bootstrap error', err);
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Auth Required' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load data', details: err.message }, { status: 500 });
  }
}
