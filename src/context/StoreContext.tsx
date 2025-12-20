'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useStore as useStoreHook } from '../store';

const StoreContext = createContext<ReturnType<typeof useStoreHook> | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const store = useStoreHook();
  return (
    <StoreContext.Provider value={store}>
      {children}
    </StoreContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useAppStore must be used within a StoreProvider');
  }
  return context;
};
