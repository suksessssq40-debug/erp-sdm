import { AppState } from './types';
import { User, SystemActionType } from '../types';
import { API_BASE, CURRENT_USER_KEY, CURRENT_TOKEN_KEY } from './constants';

export const createUserActions = (
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  authHeaders: Record<string, string>,
  addLog: (actionType: SystemActionType, details: string, target?: string, metadata?: any) => Promise<void>
) => {
  const login = async (username: string, password?: string): Promise<User | null> => {
    try {
      let deviceId = typeof window !== 'undefined' ? window.localStorage.getItem('sdm_device_id') : null;
      if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        if (typeof window !== 'undefined') window.localStorage.setItem('sdm_device_id', deviceId);
      }

      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, deviceId })
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        if (payload?.error === 'DEVICE_LOCKED_MISMATCH') {
          throw new Error('AKSES DITOLAK: Akun ini terkunci pada perangkat lain. Harap hubungi Owner untuk reset.');
        }
        throw new Error(payload?.error || 'Login failed');
      }
      const user: User = {
        ...payload.user,
        roleSlug: payload.user.role.toLowerCase(),
        features: payload.user.features
      };
      const token: string | undefined = payload.token;

      setState(prev => ({ ...prev, currentUser: user, authToken: token as any }));

      try {
        const loginLog: any = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          actorId: user.id,
          actorName: user.name,
          actorRole: user.role,
          actionType: SystemActionType.AUTH_LOGIN,
          details: 'User logged in successfully',
          target: 'Session'
        };
        fetch(`${API_BASE}/api/system-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(loginLog)
        });
        setState(prev => ({ ...prev, logs: [loginLog, ...prev.logs] }));
      } catch (e) { }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        if (token) window.localStorage.setItem(CURRENT_TOKEN_KEY, token);
      }
      return user;
    } catch (e) {
      setState(prev => ({ ...prev, currentUser: null, authToken: undefined }));
      if (e instanceof Error) throw e;
      throw new Error('Tidak dapat terhubung ke server API.');
    }
  };

  const logout = () => {
    addLog(SystemActionType.AUTH_LOGOUT, 'User logged out', 'Session');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CURRENT_USER_KEY);
      window.localStorage.removeItem(CURRENT_TOKEN_KEY);
    }
    setState(prev => ({ ...prev, currentUser: null, authToken: undefined as any }));
  };

  const addUser = async (user: User) => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(user)
      });
      if (!res.ok) throw new Error('Failed to create user');
      const created: User = await res.json();
      setState(prev => ({ ...prev, users: [...prev.users, created] }));
      addLog(SystemActionType.USER_CREATE, `Created new user: ${created.name}`, created.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateUser = async (user: User) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(user)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update user');
      }
      const updated: User = await res.json();

      setState(prev => {
        const newUsers = prev.users.map(u => u.id === updated.id ? { ...u, ...updated } : u);
        let newCurrentUser = prev.currentUser;
        if (prev.currentUser && prev.currentUser.id === updated.id) {
          newCurrentUser = { ...prev.currentUser, ...updated };
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newCurrentUser));
          }
        }
        return { ...prev, users: newUsers, currentUser: newCurrentUser };
      });

      addLog(SystemActionType.USER_UPDATE, `Updated user info: ${updated.name}`, updated.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const resetDevice = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}/reset-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to reset device');
      addLog(SystemActionType.AUTH_RESET_DEVICE, `Reset device ID for user ${userId}`, userId);
      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to delete user');

      addLog(SystemActionType.USER_DELETE, `Deleted user ${userId}`, userId);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setState(prev => ({ ...prev, users: data }));
      }
    } catch (e) { console.error("Fetch Users Failed", e); }
  };

  return { login, logout, addUser, updateUser, resetDevice, deleteUser, fetchUsers };
};
