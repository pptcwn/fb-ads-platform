'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.95, y: 8, transition: { duration: 0.15 } },
};

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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: 0.15 }}
          onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
        >
          <motion.div
            className={`${maxWidth} w-full mx-4 bg-surface-100 rounded-lg border border-surface-300 shadow-elevated`}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
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
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary' | 'warning';
  busy?: boolean;
  icon?: React.ReactNode;
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
