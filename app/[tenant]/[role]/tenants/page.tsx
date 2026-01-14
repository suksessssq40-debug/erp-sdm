
'use client';
import React from 'react';
import { TenantManager } from '@/components/TenantManager';
import { useAppStore } from '@/context/StoreContext';
import { UserRole } from '@/types';
import { useRouter } from 'next/navigation';

export default function TenantsPage() {
  const store = useAppStore();
  const router = useRouter();

  React.useEffect(() => {
    if (store.loaded && store.currentUser?.role !== UserRole.OWNER) {
      router.replace(`/${store.currentUser?.tenantId || 'sdm'}/staff/dashboard`);
    }
  }, [store.loaded, store.currentUser, router]);

  if (!store.loaded) return null;

  return <TenantManager store={store} />;
}
