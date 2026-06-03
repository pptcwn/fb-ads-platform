'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepperStep {
  id: string;
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  className?: string;
}

export default function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav aria-label="ขั้นตอน" className={cn('w-full', className)}>
      <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const complete = stepNum < currentStep;
          const current = stepNum === currentStep;
          return (
            <li
              key={step.id}
              className="flex items-center gap-1 sm:gap-2 shrink-0"
              aria-current={current ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs font-semibold border transition-colors',
                  complete && 'bg-accent text-white border-accent',
                  current && 'bg-accent-muted text-accent border-accent-border',
                  !complete && !current && 'bg-surface-100 text-ink-300 border-surface-300',
                )}
              >
                {complete ? <Check className="w-4 h-4" aria-hidden /> : stepNum}
              </span>
              <span
                className={cn(
                  'text-xs sm:text-sm font-medium hidden xs:inline sm:inline max-w-[80px] sm:max-w-none truncate',
                  current ? 'text-ink' : 'text-ink-200',
                )}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <span className="w-4 sm:w-8 h-px bg-surface-300 shrink-0 mx-0.5" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-ink-200 mt-1 sm:hidden" aria-live="polite">
        ขั้น {currentStep}/{steps.length}: {steps[currentStep - 1]?.label}
      </p>
    </nav>
  );
}