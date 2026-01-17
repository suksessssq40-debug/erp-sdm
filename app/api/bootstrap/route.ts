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

    try {
        users = await prisma.user.findMany({
            where: { tenantId } as any,
            select: { id: true, name: true, username: true, role: true, avatarUrl: true, jobTitle: true, isFreelance: true, tenantId: true, telegramId: true, telegramUsername: true, deviceIds: true, bio: true }
        });
        settingsData = await prisma.settings.findFirst({ where: { tenantId } as any });
        financialAccounts = await prisma.financialAccount.findMany({ 
            where: { tenantId, isActive: true } as any
        });
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { featuresJson: true } });
        tenantFeatures = tenant?.featuresJson || '[]';
    } catch (e) {
        console.error("Critical Bootstrap Err (Users/Settings):", e);
        throw e;
    }

    // 3. Fetch Attendance, Projects, Requests, Reports (Safe for migration)
    let attendanceRecords: any[] = [];
    let projectRecords: any[] = [];
    let requestRecords: any[] = [];
    let dailyReportRecords: any[] = [];

    try {
        const [att, proj, req, rep] = await Promise.all([
          prisma.attendance.findMany({ where: { tenantId } as any, orderBy: [{ date: 'desc' }, { timeIn: 'desc' }], take: 100 }),
          prisma.project.findMany({ where: { tenantId } as any, orderBy: { createdAt: 'desc' }, take: 50 }),
          prisma.leaveRequest.findMany({ where: { tenantId } as any, orderBy: { createdAt: 'desc' }, take: 50 }),
          prisma.dailyReport.findMany({ where: { tenantId } as any, orderBy: { createdAt: 'desc' }, take: 50 })
        ]);
        attendanceRecords = att;
        projectRecords = proj;
        requestRecords = req;
        dailyReportRecords = rep;
    } catch (err) {
        console.error("Bootstrap query failure:", err);
        throw err; // Don't fallback to global queries in multi-tenancy!
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
        projects: projectRecords.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description || '',
            collaborators: typeof p.collaboratorsJson === 'string' ? JSON.parse(p.collaboratorsJson) : [],
            deadline: p.deadline ? p.deadline.toISOString().split('T')[0] : '',
            status: p.status,
            tasks: typeof p.tasksJson === 'string' ? JSON.parse(p.tasksJson) : [],
            comments: typeof p.commentsJson === 'string' ? JSON.parse(p.commentsJson) : [],
            isManagementOnly: !!p.isManagementOnly,
            priority: p.priority,
            createdBy: p.createdBy,
            createdAt: p.createdAt ? Number(p.createdAt) : Date.now()
        })),
        requests: requestRecords.map(r => ({
            id: r.id,
            userId: r.userId,
            type: r.type,
            description: r.description,
            startDate: r.startDate?.toISOString().split('T')[0],
            endDate: r.endDate?.toISOString().split('T')[0],
            status: r.status,
            createdAt: Number(r.createdAt),
            approverId: r.approverId,
            approverName: r.approverName,
            actionNote: r.actionNote,
            actionAt: r.actionAt ? Number(r.actionAt) : undefined
        })),
        transactions: [],
        dailyReports: dailyReportRecords.map(dr => ({
            id: dr.id,
            userId: dr.userId,
            date: dr.date,
            activities: typeof dr.activitiesJson === 'string' ? JSON.parse(dr.activitiesJson) : [],
            createdAt: dr.createdAt ? dr.createdAt.getTime() : Date.now()
        })),
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
