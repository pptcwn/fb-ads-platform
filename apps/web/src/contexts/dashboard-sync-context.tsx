'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react';

export interface DashboardSyncValue {
  onSync?: () => void | Promise<void>;
  syncing?: boolean;
}

const DashboardSyncContext = createContext<DashboardSyncValue>({});
const DashboardSyncSetterContext = createContext<
  Dispatch<SetStateAction<DashboardSyncValue>>
>(() => {});

export function DashboardSyncProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<DashboardSyncValue>({});
  return (
    <DashboardSyncSetterContext.Provider value={setValue}>
      <DashboardSyncContext.Provider value={value}>
        {children}
      </DashboardSyncContext.Provider>
    </DashboardSyncSetterContext.Provider>
  );
}

export function useDashboardSync(): DashboardSyncValue {
  return useContext(DashboardSyncContext);
}

/** หน้า overview (หรือหน้าที่ต้องการ sync) — ต้องส่ง handlers ที่ stable */
export function useRegisterDashboardSync(handlers: DashboardSyncValue): void {
  const setValue = useContext(DashboardSyncSetterContext);
  const stable = useMemo(
    () => ({ onSync: handlers.onSync, syncing: handlers.syncing }),
    [handlers.onSync, handlers.syncing],
  );
  useEffect(() => {
    setValue(stable);
    return () => setValue({});
  }, [setValue, stable.onSync, stable.syncing]);
}