'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { CheckCircle2, X, Info } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  exiting?: boolean;
}

interface ToastCtx {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const Ctx = createContext<ToastCtx>({ success: () => {}, error: () => {}, info: () => {} });
let toastId = 0;

export function useToast() { return useContext(Ctx); }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, type: Toast['type']) => {
    const id = String(++toastId);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 200);
    }, 3500);
  }, []);

  return (
    <Ctx.Provider value={{
      success: (msg) => add(msg, 'success'),
      error: (msg) => add(msg, 'error'),
      info: (msg) => add(msg, 'info'),
    }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite" role="status">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg text-sm font-medium shadow-lg border max-w-sm animate-slide-up ${
              t.exiting ? 'animate-fade-out opacity-0 translate-y-2' : ''
            } ${
              t.type === 'success' ? 'bg-success-muted text-success border-success-border' :
              t.type === 'error' ? 'bg-danger-muted text-danger border-danger/20' :
              'bg-brand-muted text-brand border-brand-border'
            }`}
            style={{ transition: 'all 0.2s ease' }}
          >
            <div className="flex items-center gap-2">
              <span>
                {t.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : t.type === 'error' ? <X className="w-4 h-4" /> : <Info className="w-4 h-4" />}
              </span>
              <span>{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
