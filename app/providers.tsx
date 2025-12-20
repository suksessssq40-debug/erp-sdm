'use client';

import React from 'react';
import { StoreProvider } from '../src/context/StoreContext';
import { ToastProvider } from '../src/components/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </StoreProvider>
  );
}
