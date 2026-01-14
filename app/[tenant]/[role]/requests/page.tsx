'use client';
import React, { useEffect } from 'react';
import RequestsModule from '@/components/Requests';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function RequestsPage() {
  const store = useAppStore();
  const toast = useToast();

  useEffect(() => {
    store.fetchRequests();
  }, []);

  if (!store.currentUser) return null;
  return (
    <RequestsModule 
      currentUser={store.currentUser} 
      users={store.users}
      requests={store.requests} 
      onAddRequest={store.addRequest} 
      onUpdateRequest={store.updateRequest} 
      toast={toast} 
      uploadFile={store.uploadFile} 
    />
  );
}
