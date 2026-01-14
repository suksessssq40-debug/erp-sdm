'use client';
import React, { useEffect } from 'react';
import FinanceModule from '@/components/Finance';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function FinancePage() {
  const store = useAppStore();
  const toast = useToast();

  useEffect(() => {
    store.fetchTransactions();
  }, []);

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
      // Category Management
      categories={store.categories || []}
      onAddCategory={store.addCategory}
      onUpdateCategory={store.updateCategory}
      onDeleteCategory={store.deleteCategory}
      importCategories={store.importCategories}

      // Business Unit Management
      businessUnits={store.businessUnits || []}
      onAddBusinessUnit={store.addBusinessUnit}
      onUpdateBusinessUnit={store.updateBusinessUnit}
      onDeleteBusinessUnit={store.deleteBusinessUnit}
      
      companyProfile={store.settings?.companyProfile || {}}
      toast={toast} 
      uploadFile={store.uploadFile} 
    />
  );
}
