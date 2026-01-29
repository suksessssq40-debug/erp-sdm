import { AppState } from './types';
import { Transaction, FinancialAccountDef, TransactionCategory, BusinessUnit, SystemActionType } from '../types';
import { API_BASE } from './constants';

export const createFinancialActions = (
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  authHeaders: Record<string, string>,
  addLog: (actionType: SystemActionType, details: string, target?: string, metadata?: any) => Promise<void>
) => {
  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/transactions`, { headers: authHeaders });
      if (res.ok) {
        const result = await res.json();
        // The API returns { data: [...], pagination: {...} }
        const transactionsArray = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setState(prev => ({ ...prev, transactions: transactionsArray }));
      }
    } catch (e) {
      console.error("Fetch Transactions Failed", e);
    }
  };

  const addTransaction = async (t: Transaction) => {
    try {
      const res = await fetch(`${API_BASE}/api/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(t)
      });
      if (!res.ok) throw new Error('Failed to create transaction');
      const created: Transaction = await res.json();
      setState(prev => {
        const currentTransactions = Array.isArray(prev.transactions) ? prev.transactions : [];
        return { ...prev, transactions: [...currentTransactions, created] };
      });
      addLog(SystemActionType.FINANCE_CREATE, `Created transaction: ${created.amount} (${created.type})`, created.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const updateTransaction = async (t: Transaction) => {
    setState(prev => {
      const currentTransactions = Array.isArray(prev.transactions) ? prev.transactions : [];
      return {
        ...prev,
        transactions: currentTransactions.map(tr => tr.id === t.id ? t : tr)
      };
    });
    try {
      const res = await fetch(`${API_BASE}/api/transactions/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(t)
      });
      if (!res.ok) throw new Error('Failed to update transaction');
      addLog(SystemActionType.FINANCE_UPDATE, `Updated transaction: ${t.amount} (${t.type})`, t.id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const deleteTransaction = async (id: string, detailAmount: string) => {
    setState(prev => {
      const currentTransactions = Array.isArray(prev.transactions) ? prev.transactions : [];
      return {
        ...prev,
        transactions: currentTransactions.filter(t => t.id !== id)
      };
    });
    try {
      const res = await fetch(`${API_BASE}/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders }
      });
      if (!res.ok) throw new Error('Failed to delete transaction');
      addLog(SystemActionType.FINANCE_UPDATE, `Deleted transaction: ${detailAmount}`, id);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const syncFinancialBalances = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/finance/recalculate`, {
        method: 'POST',
        headers: authHeaders
      });
      if (res.ok) {
        const bootstrapRes = await fetch(`${API_BASE}/api/bootstrap`, { headers: authHeaders });
        if (bootstrapRes.ok) {
          const data = await bootstrapRes.json();
          setState(prev => ({ ...prev, financialAccounts: data.financialAccounts || [] }));
        }
        return await res.json();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to sync');
      }
    } catch (e) {
      console.error('Sync Balances Error:', e);
      throw e;
    }
  };

  return {
    fetchTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    syncFinancialBalances
  };
};
