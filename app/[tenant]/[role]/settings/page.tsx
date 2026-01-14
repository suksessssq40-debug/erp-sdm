'use client';
import React from 'react';
import { AppSettings } from '@/components/AppSettings';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function SettingsPage() {
  const store = useAppStore();
  const toast = useToast();
  return <AppSettings store={store} toast={toast} />;
}
