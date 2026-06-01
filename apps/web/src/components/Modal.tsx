'use client';

import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export default function Modal({ open, onClose, title, icon, children, maxWidth = 'max-w-md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className={`${maxWidth} w-full mx-4 bg-surface-100 rounded-lg border border-surface-300 shadow-elevated`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <h3 className="text-base font-semibold text-ink flex items-center gap-2">
            {icon && <span>{icon}</span>}
            {title}
          </h3>
          <button 
            onClick={onClose} 
            className="text-ink-100 hover:text-ink text-lg leading-none p-1 rounded hover:bg-surface-200 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary' | 'warning';
  busy?: boolean;
  icon?: string;
  danger?: boolean;
}

export function ConfirmModal({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', confirmVariant = 'danger', busy, icon, danger
}: ConfirmModalProps) {
  const variantClass = confirmVariant === 'danger' ? 'btn-danger'
    : confirmVariant === 'warning' ? 'btn bg-warning-muted text-warning border border-warning-border hover:bg-warning/20'
    : 'btn-primary';

  return (
    <Modal open={open} onClose={onClose} title={title} icon={icon}>
      <p className="text-sm text-ink-50 mb-4">{message}</p>
      {danger && <p className="text-xs text-danger mb-4 font-medium">⚠️ This cannot be undone.</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary btn-sm" disabled={busy}>Cancel</button>
        <button onClick={onConfirm} className={`${variantClass} btn-sm`} disabled={busy}>
          {busy ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
