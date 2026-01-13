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
  }, []);

  if (!store.currentUser) return null;

  return (
    <Kanban 
      projects={store.projects} 
      users={store.users} 
      currentUser={store.currentUser} 
      settings={store.settings} 
      onAddProject={store.addProject} 
      onUpdateProject={store.updateProject} 
      toast={toast} 
      onCelebrate={() => {}} 
    />
  );
}
