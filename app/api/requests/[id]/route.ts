import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authorize } from '@/lib/auth';

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const currentUser = await authorize(['OWNER', 'MANAGER']); // Returns AuthPayload { id, role }
    
    const id = params.id;
    const r = await request.json();

    // UPDATE with AUDIT FIELDS
    // We assume columns: approver_id, approver_name, action_note, action_at exist
    await pool.query(
      `UPDATE leave_requests 
       SET type=$1, description=$2, start_date=$3, end_date=$4, attachment_url=$5, 
           status=$6, created_at=$7,
           approver_id=$8, approver_name=$9, action_note=$10, action_at=$11
       WHERE id=$12`,
      [
        r.type, r.description, r.startDate, r.endDate || r.startDate, r.attachmentUrl || null, 
        r.status, r.createdAt,
        r.approverId || null, r.approverName || null, r.actionNote || null, r.actionAt || null,
        id
      ]
    );

    // INSERT SYSTEM LOG (Server Side Reliability)
    if (r.status === 'APPROVED' || r.status === 'REJECTED') {
        const actionType = r.status === 'APPROVED' ? 'REQUEST_APPROVE' : 'REQUEST_REJECT';
        const logId = Math.random().toString(36).substr(2, 9);
        const logDetail = `Permohonan ${r.type} oleh user ${r.userId} telah ${r.status}. Note: ${r.actionNote || '-'}`;
        
        await pool.query(
            `INSERT INTO system_logs (id, timestamp, actor_id, actor_name, actor_role, action_type, target, details)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                logId, 
                Date.now(), 
                r.approverId || 'system', // Use approverId from payload which is set by frontend to current user
                r.approverName || 'Management', 
                'MANAGER', // Generic fallback or fetch real role if available
                actionType,
                r.userId, // Target is the applicant ID
                logDetail
            ]
        );
    }

    return NextResponse.json(r);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
