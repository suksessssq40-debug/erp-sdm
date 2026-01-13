'use client';
import React, { useEffect } from 'react';
import PayrollModule from '@/components/Payroll';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function PayrollPage() {
  const store = useAppStore();
  const toast = useToast();
  
  useEffect(() => {
     store.fetchPayrollRecords();
     store.fetchSalaryConfigs();
     store.fetchAttendance();
  }, []);

  if (!store.currentUser) return null;
  return (
    <PayrollModule 
      currentUser={store.currentUser} 
      users={store.users} 
      salaryConfigs={store.salaryConfigs} 
      attendance={store.attendance} 
      settings={store.settings} 
      payrollRecords={store.payrollRecords} 
      onUpdateSalary={store.updateSalaryConfig} 
      onAddPayroll={store.addPayrollRecord} 
      toast={toast} 
    />
  );
}
