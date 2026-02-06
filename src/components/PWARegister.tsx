'use client';

import { useEffect } from 'react';
import { subscribeUserToPush } from '@/lib/pushClient';

export const PWARegister = () => {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((reg) => {
                    console.log('SW Registered:', reg.scope);
                    // Attempt to subscribe to push
                    subscribeUserToPush();
                })
                .catch((err) => console.log('SW Failed:', err));
        }
    }, []);

    return null;
};
