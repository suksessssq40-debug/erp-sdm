
'use client';
import React from 'react';
import RentalPSModule from '@/components/RentalPS';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function RentalPSPage() {
    const store = useAppStore();
    const toast = useToast();

    if (!store.currentUser) return null;

    return (
        <RentalPSModule
            currentUser={store.currentUser}
            toast={toast}
        />
    );
}
