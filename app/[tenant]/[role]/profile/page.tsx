'use client';

import React from 'react';
import ProfileModule from '@/components/ProfileModule';
import { useAppStore } from '@/context/StoreContext';

export default function ProfilePage() {
  const store = useAppStore();

  if (!store || !store.currentUser) {
      return null;
  }

  return (
    <ProfileModule
      currentUser={store.currentUser}
      onUpdateUser={store.updateUser}
      uploadFile={store.uploadFile}
    />
  );
}
