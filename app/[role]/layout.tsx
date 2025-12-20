'use client';
import ClientShell from '@/components/ClientShell';

export default function RoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientShell>
      {children}
    </ClientShell>
  );
}
