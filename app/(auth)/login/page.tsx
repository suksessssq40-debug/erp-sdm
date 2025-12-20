'use client';

import React from 'react';
import { LoginScreen } from '@/components/LoginScreen';
import { useStore } from '@/store';

export default function LoginPage() {
  const store = useStore();
  return <LoginScreen store={store} />;
}
