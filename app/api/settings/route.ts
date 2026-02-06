export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request) {
  try {
    const user = await authorize(['OWNER', 'MANAGER', 'FINANCE']);
    const s = await request.json();

    // Use id='1' or simplified singleton logic.
    // The previous logic verified there was a settings row.
    // We will upsert using a fixed query or assume finding first.
    // Prisma requires a unique key for update. Our schema has id(1).
    // 16. Safer: Updates ONLY the record for the current tenant
    const existing = await prisma.settings.findFirst({ where: { tenantId: user.tenantId } });

    if (!existing) {
      // Should have been created during tenant creation, but if missing, create it
      console.warn(`Settings missing for tenant ${user.tenantId}, creating on the fly...`);
      await prisma.settings.create({
        data: {
          tenantId: user.tenantId,
          officeLat: s.officeLocation?.lat || -6.1754,
          officeLng: s.officeLocation?.lng || 106.8272,
          officeStartTime: s.officeHours?.start || '08:00',
          officeEndTime: s.officeHours?.end || '17:00',
          telegramBotToken: s.telegramBotToken || '',
          telegramGroupId: s.telegramGroupId || '',
          telegramOwnerChatId: s.telegramOwnerChatId || '',
          companyProfileJson: JSON.stringify(s.companyProfile || {}),
          dailyRecapTime: s.dailyRecapTime || '18:00',
          dailyRecapContent: JSON.stringify(s.dailyRecapModules || [])
        }
      });
      return NextResponse.json({ ok: true });
    }

    await prisma.settings.update({
      where: { id: existing.id },
      data: {
        officeLat: s.officeLocation?.lat,
        officeLng: s.officeLocation?.lng,
        officeStartTime: s.officeHours?.start,
        officeEndTime: s.officeHours?.end,
        telegramBotToken: s.telegramBotToken || '',
        telegramGroupId: s.telegramGroupId || '',
        telegramOwnerChatId: s.telegramOwnerChatId || '',
        companyProfileJson: JSON.stringify(s.companyProfile),
        dailyRecapTime: s.dailyRecapTime,
        dailyRecapContent: JSON.stringify(s.dailyRecapModules)
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
