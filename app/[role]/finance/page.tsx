'use client';
import React from 'react';
import FinanceModule from '@/components/Finance';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function FinancePage() {
  const store = useAppStore();
  const toast = useToast();
  return (
    <FinanceModule 
      transactions={store.transactions} 
      onAddTransaction={store.addTransaction} 
      toast={toast} 
      uploadFile={store.uploadFile} 
    />
  );
}
