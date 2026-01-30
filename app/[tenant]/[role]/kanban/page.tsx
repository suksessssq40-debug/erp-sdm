'use client';

import React, { useEffect } from 'react';
import Kanban from '@/components/Kanban';
import { useAppStore } from '@/context/StoreContext';
import { useToast } from '@/components/Toast';

export default function KanbanPage() {
  const store = useAppStore();
  const toast = useToast();

  useEffect(() => {
    store.fetchProjects();
    if (store.fetchLogs) store.fetchLogs();
  }, []);

  if (!store.currentUser) return null;

  return (
    <Kanban
      projects={store.projects}
      users={store.users}
      currentUser={store.currentUser}
      settings={store.settings}
      logs={store.logs}
      onAddProject={store.addProject}
      onUpdateProject={store.updateProject}
      fetchLogs={store.fetchLogs}
      toast={toast}
      onCelebrate={() => { }}
    />
  );
}
