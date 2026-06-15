'use client';
import React from 'react';
import KaizenPanel from '@/components/KaizenPanel';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function KaizenPage() {
  const store = useAppStore();
  const toast = useToast();
  if (!store.currentUser) return null;
  return (
    <KaizenPanel
      currentUser={store.currentUser}
      toast={toast}
    />
  );
}
