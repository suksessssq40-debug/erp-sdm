'use client';
import React, { useEffect } from 'react';
import AttendanceModule from '@/components/Attendance';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';
import { LoadingState } from '@/components/LoadingState';

export default function AttendancePage() {
  const store = useAppStore();
  const toast = useToast();

  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    store.fetchAttendance().finally(() => setIsLoading(false));
  }, []);

  if (!store.currentUser) return null;
  if (isLoading) {
    return <LoadingState text="Menyiapkan sistem absensi..." />;
  }
  return (
    <AttendanceModule 
      currentUser={store.currentUser} 
      currentTenant={store.currentTenant}
      shifts={store.shifts}
      settings={store.settings} 
      attendanceLog={store.attendance} 
      onAddAttendance={store.addAttendance} 
      onUpdateAttendance={store.updateAttendance} 
      onUpdateSettings={store.updateSettings} 
      toast={toast} 
      uploadFile={store.uploadFile} 
    />
  );
}
