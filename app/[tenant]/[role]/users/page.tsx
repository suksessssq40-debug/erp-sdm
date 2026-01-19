'use client';
import React from 'react';
import { UserManagement } from '@/components/UserManagement';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function UsersPage() {
  const store = useAppStore();
  const toast = useToast();
  if (!store.currentUser) return null;
  return (
    <UserManagement 
       users={store.users} 
       currentUser={store.currentUser} 
       onAddUser={store.addUser} 
       onUpdateUser={store.updateUser}
       onDeleteUser={store.deleteUser}
       onResetDevice={store.resetDevice} 
       toast={toast} 
       store={store}
    />
  );
}
