'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'fb-ads-selected-account';

export type AccountSelection = string | 'all';

interface AccountContextValue {
  selectedAccountId: AccountSelection;
  setSelectedAccountId: (id: AccountSelection) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [selectedAccountId, setSelectedAccountIdState] = useState<AccountSelection>('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedAccountIdState(stored as AccountSelection);
    } catch {
      /* ignore */
    }
  }, []);

  const setSelectedAccountId = useCallback((id: AccountSelection) => {
    setSelectedAccountIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ selectedAccountId, setSelectedAccountId }),
    [selectedAccountId, setSelectedAccountId],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

const FALLBACK: AccountContextValue = {
  selectedAccountId: '',
  setSelectedAccountId: () => {},
};

export function useAccountContext() {
  const ctx = useContext(AccountContext);
  return ctx ?? FALLBACK;
}