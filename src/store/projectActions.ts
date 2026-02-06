import { AppState } from './types';
import { Project, SystemActionType } from '../types';
import { API_BASE } from './constants';

export const createProjectActions = (
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  authHeaders: Record<string, string>,
  addLog: (actionType: SystemActionType, details: string, target?: string, metadata?: any) => Promise<void>
) => {
  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setState(prev => ({ ...prev, projects: data }));
      }
    } catch (e) {
      console.error("Fetch Projects Failed", e);
    }
  };

  const addProject = async (project: Project) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(project)
      });
      if (!res.ok) throw new Error('Failed to create project');
      const created: Project = await res.json();
      setState(prev => ({ ...prev, projects: [...prev.projects, created] }));
      addLog(SystemActionType.PROJECT_CREATE, `Created project: ${created.title}`, created.id);
    } catch (e) {
      console.error(e);
    }
  };

  const updateProject = async (project: Project) => {
    try {
      const res = await fetch(`${API_BASE}/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(project)
      });
      if (!res.ok) throw new Error('Failed to update project');
      const updated: Project = await res.json();
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === updated.id ? updated : p)
      }));
      addLog(SystemActionType.PROJECT_UPDATE, `Updated project: ${updated.title} (Status: ${updated.status})`, updated.id);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const project = state.projects.find(p => p.id === projectId);
      if (!project) return;
      setState(prev => ({ ...prev, projects: prev.projects.filter(p => p.id !== projectId) }));
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      });
      if (!res.ok) throw new Error('Gagal menghapus proyek');
      addLog(SystemActionType.PROJECT_DELETE, `Menghapus proyek: ${project.title}`, projectId);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const patchProject = async (projectId: string, action: string, data: any) => {
    // 1. Snapshot previous state for rollback
    const previousProjects = [...state.projects];

    // 2. OPTIMISTIC UPDATE: Apply changes immediately to UI
    let optimisticUpdatedProject: Project | undefined;

    setState(prev => {
      return {
        ...prev,
        projects: prev.projects.map(p => {
          if (p.id !== projectId) return p;

          // Clone to avoid mutation
          const copy = { ...p };

          // Apply Logic based on Action
          if (action === 'MOVE_STATUS') {
            copy.status = data.status;
          }
          else if (action === 'UPDATE_TASK') {
            // data.task contains the updated task
            if (data.task && copy.tasks) {
              copy.tasks = copy.tasks.map(t => t.id === data.taskId ? data.task : t);
            }
          }
          else if (action === 'ADD_COMMENT') {
            // This is usually complex to optimistic update accurately without ID from server, 
            // but we can simulate it if needed. For now, we rely on the fast server response for comments 
            // or let the UI handle pending state. 
            // However, let's try to update if data.comment is provided
            if (data.comment) {
              const newComment = {
                ...data.comment,
                id: data.comment.id || Date.now().toString(), // Temp ID
                createdAt: Date.now()
              };
              copy.comments = [...(copy.comments || []), newComment];
            }
          }

          optimisticUpdatedProject = copy;
          return copy;
        })
      };
    });

    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action, data })
      });

      if (!res.ok) throw new Error('Failed to patch project');

      // 3. SUCCESS: Sync with actual server data (Final Consistency)
      const raw: any = await res.json();
      const finalUpdated: Project = {
        ...raw,
        tasks: typeof raw.tasksJson === 'string' ? JSON.parse(raw.tasksJson) : (raw.tasks || []),
        comments: typeof raw.commentsJson === 'string' ? JSON.parse(raw.commentsJson) : (raw.comments || []),
        collaborators: typeof raw.collaboratorsJson === 'string' ? JSON.parse(raw.collaboratorsJson) : (raw.collaborators || []),
        deadline: raw.deadline ? new Date(raw.deadline).toISOString() : raw.deadline,
        createdAt: raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now()
      };

      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === finalUpdated.id ? finalUpdated : p)
      }));

      // Logging
      let logType = SystemActionType.PROJECT_UPDATE;
      let logDetails = `Project updated: ${action}`;
      if (action === 'MOVE_STATUS') {
        logType = SystemActionType.PROJECT_MOVE_STATUS;
        logDetails = `Project status moved to: ${data.status}`;
      } else if (action === 'UPDATE_TASK') {
        logType = SystemActionType.PROJECT_TASK_COMPLETE;
        logDetails = `Task updated/completed: ${data.task?.title || 'Unknown Task'}`;
      }
      addLog(logType, logDetails, finalUpdated.id);

      return finalUpdated;

    } catch (e) {
      console.error("Optimistic Update Failed. Reverting...", e);
      // 4. ROLLBACK on Failure
      setState(prev => ({ ...prev, projects: previousProjects }));
      throw e;
    }
  };

  return { fetchProjects, addProject, updateProject, deleteProject, patchProject };
};
