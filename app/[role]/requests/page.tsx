'use client';
import React from 'react';
import RequestsModule from '@/components/Requests';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function RequestsPage() {
  const store = useAppStore();
  const toast = useToast();
  if (!store.currentUser) return null;
  return (
    <RequestsModule 
      currentUser={store.currentUser} 
      requests={store.requests} 
      onAddRequest={store.addRequest} 
      onUpdateRequest={store.updateRequest} 
      toast={toast} 
      uploadFile={store.uploadFile} 
    />
  );
}
