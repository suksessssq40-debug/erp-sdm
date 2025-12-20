'use client';
import React from 'react';
import DailyReportModule from '@/components/DailyReport';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function DailyReportPage() {
  const store = useAppStore();
  const toast = useToast();
  if (!store.currentUser) return null;
  return (
    <DailyReportModule 
      currentUser={store.currentUser} 
      users={store.users} 
      reports={store.dailyReports} 
      onAddReport={store.addDailyReport} 
      toast={toast} 
    />
  );
}
