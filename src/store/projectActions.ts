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
    try {
      const res = await fetch(`${API_BASE}/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action, data })
      });
      if (!res.ok) throw new Error('Failed to patch project');
      const raw: any = await res.json();
      const updated: Project = {
        ...raw,
        tasks: typeof raw.tasksJson === 'string' ? JSON.parse(raw.tasksJson) : (raw.tasks || []),
        comments: typeof raw.commentsJson === 'string' ? JSON.parse(raw.commentsJson) : (raw.comments || []),
        collaborators: typeof raw.collaboratorsJson === 'string' ? JSON.parse(raw.collaboratorsJson) : (raw.collaborators || []),
        deadline: raw.deadline ? new Date(raw.deadline).toISOString() : raw.deadline,
        createdAt: raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now()
      };
      setState(prev => ({
        ...prev,
        projects: prev.projects.map(p => p.id === updated.id ? updated : p)
      }));

      let logType = SystemActionType.PROJECT_UPDATE;
      let logDetails = `Project updated: ${action}`;

      if (action === 'MOVE_STATUS') {
        logType = SystemActionType.PROJECT_MOVE_STATUS;
        logDetails = `Project status moved to: ${data.status}`;
      } else if (action === 'UPDATE_TASK') {
        logType = SystemActionType.PROJECT_TASK_COMPLETE;
        logDetails = `Task updated/completed: ${data.task?.title || 'Unknown Task'}`;
      } else if (action === 'ADD_COMMENT') {
        logType = SystemActionType.PROJECT_COMMENT;
        logDetails = `New project comment added`;
      }

      addLog(logType, logDetails, updated.id);
      return updated;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  return { fetchProjects, addProject, updateProject, deleteProject, patchProject };
};
