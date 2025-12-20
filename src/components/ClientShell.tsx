'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter, usePathname, redirect } from 'next/navigation';
import Layout from './Layout';
import { useAppStore } from '../context/StoreContext';
import { useToast } from './Toast';
import { UserRole } from '../types';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const store = useAppStore();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  
  // Params role
  const roleParam = params?.role as string;
  
  useEffect(() => {
    if (!store.loaded) return; 
    
    // Redirect if not logged in and not on login page
    if (!store.currentUser) {
      // Don't redirect if we are already on login page to avoid loops
      if (pathname !== '/login') {
          router.replace('/login');
      }
      return;
    }

    // Redirect if role mismatch
    const userRoleSlug = store.currentUser.role.toLowerCase();
    // Only redirect if roleParam exists AND it doesn't match currentUser role
    if (roleParam && roleParam !== userRoleSlug) {
      router.replace(`/${userRoleSlug}/kanban`);
    }

  }, [store.loaded, store.currentUser, roleParam, router, pathname]);

  if (!store.loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p className="text-xs font-black tracking-[0.3em] uppercase text-slate-400">Memuat data sistem...</p>
      </div>
    );
  }

  if (!store.currentUser) return null;

  // Determine Active Tab from Path
  const pathParts = pathname.split('/');
  const tabSlug = pathParts[2] || 'kanban';
  const activeTab = tabSlug; 
  // Simplified logic, assuming tabSlug matches expected 'kanban', 'dashboard', etc.

  const handleTabChange = (tab: string) => {
    const userRoleSlug = store.currentUser!.role.toLowerCase();
    router.push(`/${userRoleSlug}/${tab}`);
  };

  return (
    <>
      <Layout
        userRole={store.currentUser.role}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={() => {
           store.logout();
           toast.info('Logged out.');
           router.replace('/login');
        }}
        userName={store.currentUser.name}
      >
        {children}
      </Layout>
    </>
  );
}
