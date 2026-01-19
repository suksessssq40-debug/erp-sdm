import { AppState } from './types';
import { Attendance, Shift, SystemActionType } from '../types';
import { API_BASE } from './constants';

export const createAttendanceActions = (
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  authHeaders: Record<string, string>,
  addLog: (actionType: SystemActionType, details: string, target?: string, metadata?: any) => Promise<void>
) => {
  const fetchAttendance = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/attendance`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setState(prev => ({ ...prev, attendance: data }));
      }
    } catch (e) {
      console.error("Fetch Attendance Failed", e);
    }
  };

  const addAttendance = async (record: Attendance) => {
    try {
      const res = await fetch(`${API_BASE}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(record)
      });
      if (!res.ok) throw new Error('Failed to create attendance');
      const created: Attendance = await res.json();
      setState(prev => ({ ...prev, attendance: [...prev.attendance, created] }));
      addLog(SystemActionType.ATTENDANCE_CLOCK_IN, `Clock In at ${created.timeIn} ${created.isLate ? '(LATE)' : ''}`, created.id);
    } catch (e) {
      console.error(e);
    }
  };

  const updateAttendance = async (record: Attendance) => {
    try {
      const res = await fetch(`${API_BASE}/api/attendance/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(record)
      });
      if (!res.ok) throw new Error('Failed to update attendance');
      const updated: Attendance = await res.json();
      setState(prev => ({
        ...prev,
        attendance: prev.attendance.map(a => (a.id === updated.id ? updated : a))
      }));
      if (updated.timeOut) {
        addLog(SystemActionType.ATTENDANCE_CLOCK_OUT, `Clock Out at ${updated.timeOut}`, updated.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchShifts = async (tenantId: string): Promise<Shift[]> => {
    try {
      const res = await fetch(`${API_BASE}/api/tenants/${tenantId}/shifts`, { headers: authHeaders });
      if (res.ok) return await res.json();
      return [];
    } catch (e) {
      return [];
    }
  };

  const createShift = async (tenantId: string, shift: Omit<Shift, 'id' | 'tenantId'>) => {
    const res = await fetch(`${API_BASE}/api/tenants/${tenantId}/shifts`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(shift)
    });
    if (!res.ok) throw new Error('Failed to create shift');
    return await res.json();
  };

  return {
    fetchAttendance,
    addAttendance,
    updateAttendance,
    fetchShifts,
    createShift
  };
};
