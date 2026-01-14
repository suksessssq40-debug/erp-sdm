'use client';
import React, { useEffect } from 'react';
import AttendanceModule from '@/components/Attendance';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function AttendancePage() {
  const store = useAppStore();
  const toast = useToast();

  useEffect(() => {
    store.fetchAttendance();
  }, []);

  if (!store.currentUser) return null;
  return (
    <AttendanceModule 
      currentUser={store.currentUser} 
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
