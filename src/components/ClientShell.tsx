'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Layout from './Layout';
import { useAppStore } from '../context/StoreContext';
import { useToast } from './Toast';
import { UserRole, RequestStatus } from '../types';
import { ReviewerWidget } from './ReviewerWidget';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const store = useAppStore();
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  
  // Params role
  const roleParam = params?.role as string;

  // Unread Chat Badge Logic
  const [unreadCount, setUnreadCount] = React.useState(0);
  
  useEffect(() => {
     if (!store.loaded || !store.authToken) return;
     
     const fetchUnread = async () => {
        try {
           const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/unread`, {
               headers: { 'Authorization': `Bearer ${store.authToken}` }
           });
           if (res.ok) {
              const data = await res.json();
              setUnreadCount(data.count);
           }
        } catch(e) { /* silent fail */ }
     };

     fetchUnread();
     const interval = setInterval(fetchUnread, 10000); // Poll every 10s
     return () => clearInterval(interval);
  }, [store.loaded, store.authToken]);
  
  useEffect(() => {
    if (!store.loaded) return; 
    
    // Redirect if not logged in and not on login page
    if (!store.currentUser) {
      if (pathname !== '/login') {
          router.replace('/login');
      }
      return;
    }

    // Redirect if role mismatch
    const userRoleSlug = store.currentUser.role.toLowerCase();
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

  const handleTabChange = (tab: string) => {
    const userRoleSlug = store.currentUser!.role.toLowerCase();
    router.push(`/${userRoleSlug}/${tab}`);
  };

  // Pending Requests Badge for Management
  const pendingRequests = store.requests.filter(r => r.status === RequestStatus.PENDING).length;

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
        userAvatar={store.currentUser.avatarUrl}
        unreadChatCount={unreadCount}
        pendingRequestCount={pendingRequests}
      >
        {children}
      </Layout>
      <ReviewerWidget store={store} />
    </>
  );
}
