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
  
  // Params
  const tenantParam = params?.tenant as string;
  const roleParam = params?.role as string;

  // Unread Chat Badge Logic
  const [unreadCount, setUnreadCount] = React.useState(0);
  
  // Notification Logic
  const lastUnreadRef = React.useRef(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Request Notification Permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // Preload Audio
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); 
  }, []);

  useEffect(() => {
     if (!store.loaded || !store.authToken) return;
     
     const fetchUnread = async () => {
        try {
           const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/chat/unread`, {
               headers: { 'Authorization': `Bearer ${store.authToken}` }
           });
           if (res.ok) {
              const data = await res.json();
              const newCount = data.count;
              
              // If unread count INCREASED, it means new message arrived
              if (newCount > lastUnreadRef.current) {
                 // 1. Play Sound
                 try {
                    audioRef.current?.play().catch(() => {}); // User interaction might be required first, catch error
                 } catch(e) {}

                 // 2. Browser Notification (if background)
                 if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification('Pesan Baru', {
                       body: `Anda memiliki ${newCount} pesan belum dibaca`,
                       icon: '/icon.png' // Optional fallback
                    });
                 }

                 // 3. Document Title Blink (optional, simple logic)
                 document.title = `(${newCount}) Pesan Baru! - SDM ERP`;
              } else if (newCount === 0) {
                 document.title = 'SDM ERP'; // Reset
              }

              setUnreadCount(newCount);
              lastUnreadRef.current = newCount;
           }
        } catch(e) { /* silent fail */ }
     };

     fetchUnread();
     const interval = setInterval(fetchUnread, 3000); // Poll every 3s (Realtime feel)
     return () => clearInterval(interval);
  }, [store.loaded, store.authToken]);
  
  useEffect(() => {
    if (!store.loaded) return; 
    
    // Redirect if not logged in
    if (!store.currentUser) {
      if (pathname !== '/login') {
          router.replace('/login');
      }
      return;
    }

    // MULTI-TENANT REDIRECT LOGIC
    if (!store.currentUser || !store.currentUser.role) return;

    const userRoleSlug = String(store.currentUser.role).toLowerCase();
    const userTenantId = String(store.currentUser?.tenantId || 'sdm').toLowerCase();
    
    // Normalize params
    const normalizedTenantParam = (tenantParam || '').toLowerCase();
    const normalizedRoleParam = (roleParam || '').toLowerCase();

    // If we're at a path that doesn't have tenant or has WRONG tenant/role
    if (!normalizedTenantParam || normalizedTenantParam !== userTenantId || !normalizedRoleParam || normalizedRoleParam !== userRoleSlug) {
        const pathParts = pathname.split('/');
        let currentTab = pathParts[3] || pathParts[2] || 'dashboard'; 
        
        // Safety: If currentTab is the tenant itself, force dashboard
        if (currentTab === userTenantId || currentTab === tenantParam) currentTab = 'dashboard';

        // Force redirect to correct tenant path (normalized to lowercase)
        router.replace(`/${userTenantId}/${userRoleSlug}/${currentTab}`);
    }

  }, [store.loaded, store.currentUser, tenantParam, roleParam, router, pathname]);

  // Determine Active Tab from Path: /[tenant]/[role]/[tab]
  const pathParts = pathname.split('/');
  const tabSlug = pathParts[3] || 'dashboard';
  const activeTab = tabSlug;

  // --- SECURITY & FEATURE GUARD (URL BYPASS PREVENTION) ---
  useEffect(() => {
    if (!store.loaded || !store.currentUser) return;

    // 1. Check if user is on the correct tenant/role path
    const userRoleSlug = String(store.currentUser.role).toLowerCase();
    const userTenantId = String(store.currentUser?.tenantId || 'sdm').toLowerCase();
    const normalizedTenantParam = (tenantParam || '').toLowerCase();
    const normalizedRoleParam = (roleParam || '').toLowerCase();

    if (normalizedTenantParam && normalizedRoleParam) {
        if (normalizedTenantParam !== userTenantId || normalizedRoleParam !== userRoleSlug) {
            console.warn(`[SECURITY] Unauthorized path access: ${pathname}. Redirecting to ${userTenantId}/${userRoleSlug}`);
            router.replace(`/${userTenantId}/${userRoleSlug}/dashboard`);
            return;
        }
    }

    // 2. Feature Access Check
    const featureMap: Record<string, string> = {
        'kanban': 'projects',
        'chat': 'chat',
        'attendance': 'attendance',
        'payroll': 'payroll',
        'requests': 'requests',
        'daily-report': 'daily_report',
        'finance': 'finance'
    };

    const requiredFeature = featureMap[activeTab];
    if (requiredFeature) {
        let enabled: string[] = [];
        try {
            const parsed = typeof store.currentUser.features === 'string' 
                ? JSON.parse(store.currentUser.features) 
                : (store.currentUser.features || []);
            enabled = Array.isArray(parsed) ? parsed : [];
        } catch(e) {}

        // Special Restriction: Finance & Payroll usually only in SDM (unless overridden)
        const isFinanceRestricted = (activeTab === 'finance' || activeTab === 'payroll') && store.currentUser.tenantId !== 'sdm';
        const hasFeature = enabled.includes(requiredFeature);
        
        if (isFinanceRestricted && !hasFeature) {
            toast.error("Modul Keuangan hanya tersedia di Kantor Pusat SDM.");
            router.replace(`/${userTenantId}/${userRoleSlug}/dashboard`);
        } else if (!isFinanceRestricted && !hasFeature) {
            toast.warning(`Modul "${activeTab.toUpperCase()}" dinonaktifkan untuk unit ini.`);
            router.replace(`/${userTenantId}/${userRoleSlug}/dashboard`);
        }
    }
  }, [activeTab, store.loaded, store.currentUser, store.currentUser?.features, tenantParam, roleParam, router, pathname]);

  if (!store.loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <p className="text-xs font-black tracking-[0.3em] uppercase text-slate-400">Memuat data sistem...</p>
      </div>
    );
  }

  if (!store.currentUser) return null;

  const handleTabChange = (tab: string) => {
    const userRoleSlug = store.currentUser!.role.toLowerCase();
    const userTenantId = store.currentUser?.tenantId || 'sdm';
    router.push(`/${userTenantId}/${userRoleSlug}/${tab}`);
  };

  // Pending Requests Badge for Management
  const pendingRequests = (store.requests || []).filter(r => r.status === RequestStatus.PENDING).length;
  
  // Tenant Data
  const tenantId = store.currentUser?.tenantId || 'sdm';
  const tenantName = store.settings?.companyProfile?.name || `Office ${tenantId.toUpperCase()}`;

  return (
    <>
      <Layout
        userRole={store.currentUser.role}
        tenantId={tenantId}
        tenantName={tenantName}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={() => {
           store.logout();
           toast.info('Logged out.');
           router.replace('/login');
        }}
        userName={store.currentUser.name || store.currentUser.username || 'User'}
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
