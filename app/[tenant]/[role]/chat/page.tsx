'use client';

import React from 'react';
import ChatModule from '@/components/ChatModule';
import { useAppStore } from '@/context/StoreContext';

export default function ChatPage() {
  const store = useAppStore();

  if (!store.currentUser) return null;

  return (
    <div className="h-[calc(100vh-2rem)]"> {/* Full height container */}
      <div className="mb-6">
         <h1 className="text-2xl font-black text-slate-800 tracking-tight">Team Chat</h1>
         <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Realtime Communication Forum</p>
      </div>
      <ChatModule />
    </div>
  );
}
