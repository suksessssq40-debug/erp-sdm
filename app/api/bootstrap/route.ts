import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Parallel Fetching for Performance
    const [
        users, 
        projects, 
        attendance, 
        requests, 
        transactions, 
        dailyReports, 
        salaryConfigs, 
        payrollRecords, 
        logs,
        settingsData,
        financialAccounts
    ] = await Promise.all([
        prisma.user.findMany(),
        prisma.project.findMany(),
        prisma.attendance.findMany({ orderBy: [{ date: 'desc' }, { timeIn: 'desc' }], take: 100 }), // Reduced from 500
        prisma.leaveRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }), // Reduced from 200
        prisma.transaction.findMany({ orderBy: { date: 'desc' }, take: 100 }), // Reduced from 500
        prisma.dailyReport.findMany({ orderBy: { date: 'desc' }, take: 50 }), // Reduced from 200 (Only need recent)
        prisma.salaryConfig.findMany(),
        prisma.payrollRecord.findMany({ orderBy: { processedAt: 'desc' }, take: 50 }), // Reduced from 100
        prisma.systemLog.findMany({ orderBy: { timestamp: 'desc' }, take: 50 }), // CRITICAL: Reduced from 1000 to 50. Logs are heavy.
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
        projects: projects.map(p => ({
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
        attendance: attendance.map(a => ({
          id: a.id,
          userId: a.userId,
          date: a.date,
          timeIn: a.timeIn,
          timeOut: a.timeOut || undefined,
          isLate: !!a.isLate,
          lateReason: a.lateReason || undefined,
          selfieUrl: a.selfieUrl,
          checkOutSelfieUrl: a.checkoutSelfieUrl || undefined,
          location: { lat: Number(a.locationLat), lng: Number(a.locationLng) }
        })),
        requests: requests.map(r => ({
          id: r.id,
          userId: r.userId,
          type: r.type,
          description: r.description,
          startDate: r.startDate ? r.startDate.toISOString().split('T')[0] : '',
          endDate: r.endDate ? r.endDate.toISOString().split('T')[0] : (r.startDate ? r.startDate.toISOString().split('T')[0] : ''),
          attachmentUrl: r.attachmentUrl || undefined,
          status: r.status,
          createdAt: r.createdAt ? Number(r.createdAt) : Date.now()
        })),
        transactions: transactions.map(t => ({
          id: t.id,
          date: t.date ? t.date.toISOString().split('T')[0] : '',
          amount: Number(t.amount),
          type: t.type,
          category: t.category || '',
          description: t.description,
          account: t.account,
          imageUrl: t.imageUrl || undefined
        })),
        dailyReports: dailyReports.map(r => ({
          id: r.id,
          userId: r.userId,
          date: r.date,
          activities: typeof r.activitiesJson === 'string' ? JSON.parse(r.activitiesJson) : []
        })),
        salaryConfigs: salaryConfigs.map(c => ({
          userId: c.userId,
          basicSalary: Number(c.basicSalary),
          allowance: Number(c.allowance),
          mealAllowance: Number(c.mealAllowance),
          lateDeduction: Number(c.lateDeduction)
        })),
        payrollRecords: payrollRecords.map(pr => ({
          id: pr.id,
          userId: pr.userId,
          month: pr.month,
          basicSalary: Number(pr.basicSalary),
          allowance: Number(pr.allowance),
          totalMealAllowance: Number(pr.totalMealAllowance),
          bonus: Number(pr.bonus),
          deductions: Number(pr.deductions),
          netSalary: Number(pr.netSalary),
          isSent: !!pr.isSent,
          processedAt: pr.processedAt ? Number(pr.processedAt) : Date.now(),
          metadata: typeof pr.metadataJson === 'string' ? JSON.parse(pr.metadataJson) : undefined
        })),
        logs: logs.map(l => ({
          id: l.id,
          timestamp: (() => {
            const t = l.timestamp as any;
            if (typeof t === 'bigint') return Number(t);
            if (typeof t === 'number') return t;
            if (t instanceof Date) return t.getTime();
            if (typeof t === 'string') return new Date(t).getTime();
            return Date.now();
          })(),
          actorId: l.actorId,
          actorName: l.actorName,
          actorRole: l.actorRole,
          actionType: l.actionType,
          details: l.details,
          target: l.targetObj || undefined,
          metadata: l.metadataJson ? JSON.parse(l.metadataJson) : undefined
        })),
        settings,
        financialAccounts: financialAccounts.map(a => ({
          id: a.id,
          name: a.name,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
          description: a.description,
          isActive: a.isActive
        }))
    };

    return NextResponse.json(data);
  } catch (err) {
    console.error('Bootstrap error', err);
    return NextResponse.json({ error: 'Failed to load initial data' }, { status: 500 });
  }
}
