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
      financialAccounts={store.financialAccounts}
      onAddTransaction={store.addTransaction} 
      onUpdateTransaction={store.updateTransaction}
      onDeleteTransaction={store.deleteTransaction}
      // Account Management
      onAddAccount={store.addFinancialAccount}
      onUpdateAccount={store.updateFinancialAccount}
      onDeleteAccount={store.deleteFinancialAccount}
      toast={toast} 
      uploadFile={store.uploadFile} 
    />
  );
}
