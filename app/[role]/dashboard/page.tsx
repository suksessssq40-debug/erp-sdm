import React, { useEffect } from 'react';
import { OwnerDashboard } from '@/components/OwnerDashboard';
import { StaffDashboard } from '@/components/StaffDashboard';
import { ManagerDashboard } from '@/components/ManagerDashboard';
import { FinanceDashboard } from '@/components/FinanceDashboard';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';
import { UserRole } from '@/types';

export default function DashboardPage() {
  const store = useAppStore();
  const toast = useToast();

  // Lazy Load Data on Dashboard Mount to ensure stats are fresh
  useEffect(() => {
     // Fetch based on Role Needs
     if (store.currentUser?.role === UserRole.STAFF) {
         store.fetchAttendance();
         store.fetchDailyReports();
         store.fetchProjects(); // For Kanban tasks
     } else if (store.currentUser?.role === UserRole.MANAGER) {
         store.fetchAttendance(); // Check team
         store.fetchRequests(); // Check pending
         store.fetchProjects(); // Check overdue
     } else if (store.currentUser?.role === UserRole.FINANCE) {
         store.fetchTransactions();
         // Financial Accounts are loaded in bootstrap (small data), no fetch needed.
     } else if (store.currentUser?.role === UserRole.OWNER) {
         // Owner needs bits of everything
         store.fetchTransactions();
         store.fetchAttendance();
         store.fetchProjects();
     }
  }, [store.currentUser?.role]);

  if (!store.currentUser) return null;

  switch (store.currentUser.role) {
      case UserRole.STAFF:
          return <StaffDashboard />;
      case UserRole.MANAGER:
          return <ManagerDashboard />;
      case UserRole.FINANCE:
          return <FinanceDashboard />;
      case UserRole.OWNER:
      case UserRole.SUPERADMIN:
          return <OwnerDashboard store={store} toast={toast} />;
      default:
          return <StaffDashboard />;
  }
}
