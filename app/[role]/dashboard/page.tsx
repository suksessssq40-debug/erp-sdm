'use client';
import React from 'react';
import { OwnerDashboard } from '@/components/OwnerDashboard';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function DashboardPage() {
  const store = useAppStore();
  const toast = useToast();
  return <OwnerDashboard store={store} toast={toast} />;
}
