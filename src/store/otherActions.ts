import { AppState } from './types';
import { LeaveRequest, FinancialAccountDef, TransactionCategory, BusinessUnit, SystemActionType } from '../types';
import { API_BASE } from './constants';

export const createOtherActions = (
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  authHeaders: Record<string, string>,
  addLog: (actionType: SystemActionType, details: string, target?: string, metadata?: any) => Promise<void>
) => {
  const fetchRequests = async (startDate?: string, endDate?: string) => {
    try {
      let url = `${API_BASE}/api/requests`;
      const params = new URLSearchParams();
      if (startDate) params.append('start', startDate);
      if (endDate) params.append('end', endDate);

      const queryString = params.toString();
      if (queryString) url += `?${queryString}`;

      const res = await fetch(url, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setState(prev => ({ ...prev, requests: data }));
      }
    } catch (e) {
      console.error("Fetch Requests Failed", e);
    }
  };

  const addRequest = async (req: LeaveRequest) => {
    try {
      const res = await fetch(`${API_BASE}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(req)
      });
      if (!res.ok) throw new Error('Failed to create request');
      const created: LeaveRequest = await res.json();
      setState(prev => ({ ...prev, requests: [...prev.requests, created] }));
      addLog(SystemActionType.REQUEST_CREATE, `Submitted request: ${created.type}`, created.id);
    } catch (e) {
      console.error(e);
    }
  };

  const updateRequest = async (req: LeaveRequest) => {
    // Optimistic Update
    setState(prev => ({
      ...prev,
      requests: prev.requests.map(r => (r.id === req.id ? { ...r, ...req } : r))
    }));

    try {
      const res = await fetch(`${API_BASE}/api/requests/${req.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(req)
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update request');
      }
      const updated: LeaveRequest = await res.json();
      setState(prev => ({
        ...prev,
        requests: prev.requests.map(r => (r.id === updated.id ? updated : r))
      }));
      addLog(SystemActionType.REQUEST_APPROVE, `Updated request: ${updated.type} (${updated.status})`, updated.id);
    } catch (e) {
      console.error(e);
      // Rollback on error might be needed, but for now we re-fetch or log
      throw e;
    }
  };

  const deleteRequest = async (id: string) => {
    setState(prev => ({ ...prev, requests: prev.requests.filter(r => r.id !== id) }));
    try {
      const res = await fetch(`${API_BASE}/api/requests/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to delete request');
      addLog(SystemActionType.REQUEST_APPROVE, `Deleted request: ${id}`, id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const addFinancialAccount = async (acc: FinancialAccountDef) => {
    try {
      const res = await fetch(`${API_BASE}/api/financial-accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(acc)
      });
      if (!res.ok) throw new Error('Failed to create account');
      const created: FinancialAccountDef = await res.json();
      setState(prev => ({ ...prev, financialAccounts: [...prev.financialAccounts, created] }));
      addLog(SystemActionType.FINANCE_UPDATE, `Added financial account: ${created.name}`, created.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateFinancialAccount = async (acc: FinancialAccountDef) => {
    setState(prev => ({
      ...prev,
      financialAccounts: prev.financialAccounts.map(a => (a.id === acc.id ? acc : a))
    }));
    try {
      const res = await fetch(`${API_BASE}/api/financial-accounts/${acc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(acc)
      });
      if (!res.ok) throw new Error('Failed to update account');
      addLog(SystemActionType.FINANCE_UPDATE, `Updated financial account: ${acc.name}`, acc.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteFinancialAccount = async (id: string) => {
    setState(prev => ({ ...prev, financialAccounts: prev.financialAccounts.filter(a => a.id !== id) }));
    try {
      const res = await fetch(`${API_BASE}/api/financial-accounts/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to delete account');
      addLog(SystemActionType.FINANCE_UPDATE, `Deleted financial account: ${id}`, id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const addCategory = async (cat: TransactionCategory) => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(cat)
      });
      if (!res.ok) throw new Error('Failed to create category');
      const created: TransactionCategory = await res.json();
      setState(prev => ({ ...prev, categories: [...prev.categories, created] }));
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateCategory = async (cat: TransactionCategory) => {
    setState(prev => ({ ...prev, categories: prev.categories.map(c => (c.id === cat.id ? cat : c)) }));
    try {
      const res = await fetch(`${API_BASE}/api/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(cat)
      });
      if (!res.ok) throw new Error('Failed to update category');
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteCategory = async (id: string) => {
    setState(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id && c.parentId !== id) }));
    try {
      const res = await fetch(`${API_BASE}/api/categories/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to delete category');
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const addBusinessUnit = async (unit: BusinessUnit) => {
    try {
      const res = await fetch(`${API_BASE}/api/business-units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(unit)
      });
      if (!res.ok) throw new Error('Failed to create business unit');
      const created: BusinessUnit = await res.json();
      setState(prev => ({ ...prev, businessUnits: [...prev.businessUnits, created] }));
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateBusinessUnit = async (unit: BusinessUnit) => {
    setState(prev => ({ ...prev, businessUnits: prev.businessUnits.map(u => (u.id === unit.id ? unit : u)) }));
    try {
      const res = await fetch(`${API_BASE}/api/business-units/${unit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(unit)
      });
      if (!res.ok) throw new Error('Failed to update business unit');
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteBusinessUnit = async (id: string) => {
    setState(prev => ({ ...prev, businessUnits: prev.businessUnits.filter(u => u.id !== id) }));
    try {
      const res = await fetch(`${API_BASE}/api/business-units/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to delete business unit');
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const fetchLogs = async (target?: string) => {
    try {
      let url = `${API_BASE}/api/system-logs`;
      if (target) url += `?target=${encodeURIComponent(target)}`;

      const res = await fetch(url, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setState(prev => {
          // Merge and avoid duplicates based on ID
          const existingIds = new Set(prev.logs.map(l => l.id));
          const newUnique = data.filter((l: any) => !existingIds.has(l.id));
          return { ...prev, logs: [...newUnique, ...prev.logs] };
        });
      }
    } catch (e) {
      console.error("Fetch Logs Failed", e);
    }
  };

  return {
    fetchRequests, addRequest, updateRequest, deleteRequest,
    addFinancialAccount, updateFinancialAccount, deleteFinancialAccount,
    addCategory, updateCategory, deleteCategory,
    addBusinessUnit, updateBusinessUnit, deleteBusinessUnit,
    fetchLogs
  };
};
