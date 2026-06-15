import { AppState } from './types';
import { Tenant, Shift, UserRole, SystemActionType } from '../types';
import { API_BASE, CURRENT_USER_KEY, CURRENT_TOKEN_KEY } from './constants';

export const createTenantActions = (
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  authHeaders: Record<string, string>,
  addLog: (actionType: SystemActionType, details: string, target?: string, metadata?: any) => Promise<void>
) => {
  const fetchTenants = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tenants`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setState(prev => ({ ...prev, tenants: data }));
      }
    } catch (e) {
      console.error("Fetch Tenants Failed", e);
    }
  };

  const createTenant = async (id: string, name: string, description: string, features: string[], workStrategy?: string, radiusTolerance?: number, lateGracePeriod?: number) => {
    const res = await fetch(`${API_BASE}/api/tenants`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, description, features, workStrategy, radiusTolerance, lateGracePeriod })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create tenant');
    
    const updatedTenantsRes = await fetch(`${API_BASE}/api/tenants`, { headers: authHeaders });
    if (updatedTenantsRes.ok) {
        const updatedData = await updatedTenantsRes.json();
        setState(prev => ({ ...prev, tenants: updatedData }));
    }
    return data;
  };

  const updateTenant = async (id: string, name: string, description: string, features: string[], isActive: boolean, workStrategy?: string, radiusTolerance?: number, lateGracePeriod?: number) => {
    const res = await fetch(`${API_BASE}/api/tenants/${id}`, {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, features, isActive, workStrategy, radiusTolerance, lateGracePeriod })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update tenant');
    
    setState(prev => ({
      ...prev,
      tenants: prev.tenants.map(t => t.id === id ? { ...t, ...data } : t)
    }));
    return data;
  };

  const deleteTenant = async (id: string) => {
    const res = await fetch(`${API_BASE}/api/tenants/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete tenant');
    
    setState(prev => ({
      ...prev,
      tenants: prev.tenants.filter(t => t.id !== id)
    }));
    return data;
  };

  const switchTenant = async (targetTenantId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/tenants/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ targetTenantId })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to switch unit');
      }
      
      const { user, token } = await res.json();
      const normalizedUser = { ...user, roleSlug: (user.role || '').toLowerCase() };
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(normalizedUser));
        window.localStorage.setItem(CURRENT_TOKEN_KEY, token);
        window.location.href = `/${targetTenantId}/${normalizedUser.roleSlug}/dashboard`;
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateAccess = async (userId: string, tenantId: string, role: string, isActive: boolean) => {
    const res = await fetch(`${API_BASE}/api/auth/access-control`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tenantId, role, isActive })
    });
    if (!res.ok) throw new Error('Failed to update access');
    return await res.json();
  };

  return { fetchTenants, createTenant, updateTenant, deleteTenant, switchTenant, updateAccess };
};
