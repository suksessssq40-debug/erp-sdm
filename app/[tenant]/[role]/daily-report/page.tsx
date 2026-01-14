'use client';
import React, { useEffect } from 'react';
import DailyReportModule from '@/components/DailyReport';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function DailyReportPage() {
  const store = useAppStore();
  const toast = useToast();

  useEffect(() => {
      store.fetchDailyReports();
  }, []);

  if (!store.currentUser) return null;
  return (
    <DailyReportModule 
      currentUser={store.currentUser} 
      users={store.users} 
      reports={store.dailyReports} 
      onAddReport={store.addDailyReport} 
      onUpdateReport={store.updateDailyReport}
      onDeleteReport={store.deleteDailyReport} 
      toast={toast} 
    />
  );
}
