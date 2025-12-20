import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request) {
  try {
    await authorize(['OWNER']);
    const s = await request.json();
    
    const resSettings = await pool.query('SELECT id FROM settings LIMIT 1');
    if (!resSettings.rows.length) return NextResponse.json({ error: 'Settings not initialized' }, { status: 400 });
    const id = resSettings.rows[0].id;
    
    await pool.query(
      `UPDATE settings SET office_lat=$1, office_lng=$2, office_start_time=$3, office_end_time=$4, telegram_bot_token=$5, telegram_group_id=$6, telegram_owner_chat_id=$7, company_profile_json=$8 WHERE id=$9`,
      [
        s.officeLocation.lat, s.officeLocation.lng, s.officeHours.start, s.officeHours.end,
        s.telegramBotToken || '', s.telegramGroupId || '', s.telegramOwnerChatId || '', 
        JSON.stringify(s.companyProfile), id
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
