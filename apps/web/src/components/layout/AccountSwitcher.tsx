'use client';

import { ChevronDown, Layers } from 'lucide-react';
import { useAdAccounts } from '@/hooks/use-accounts';
import { useAccountContext, type AccountSelection } from '@/contexts/account-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function AccountSwitcher() {
  const { data: accounts = [], isLoading } = useAdAccounts();
  const { selectedAccountId, setSelectedAccountId } = useAccountContext();

  const label = useMemoLabel(selectedAccountId, accounts, isLoading);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 max-w-[220px] sm:max-w-[280px] px-3 py-2 rounded-lg text-sm text-ink bg-surface-100 hover:bg-surface-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="เลือกบัญชีโฆษณา"
      >
        <Layers className="w-4 h-4 shrink-0 text-ink-100" aria-hidden />
        <span className="truncate font-medium">{label}</span>
        <ChevronDown className="w-4 h-4 shrink-0 text-ink-200" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[240px]">
        <DropdownMenuItem
          onSelect={() => setSelectedAccountId('all')}
          className={selectedAccountId === 'all' ? 'bg-surface-200' : ''}
        >
          <span className="font-medium">ทุกบัญชี</span>
        </DropdownMenuItem>
        {accounts.map((acc) => (
          <DropdownMenuItem
            key={acc.id}
            onSelect={() => setSelectedAccountId(acc.id)}
            className={selectedAccountId === acc.id ? 'bg-surface-200' : ''}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="truncate font-medium">{acc.name}</span>
              <span className="text-xs text-ink-200">{acc.currency}</span>
            </div>
          </DropdownMenuItem>
        ))}
        {!isLoading && accounts.length === 0 && (
          <div className="px-2 py-2 text-xs text-ink-200">ยังไม่มีบัญชีโฆษณา</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useMemoLabel(
  selected: AccountSelection,
  accounts: { id: string; name: string; currency: string }[],
  isLoading: boolean,
) {
  if (isLoading) return 'กำลังโหลด…';
  if (selected === 'all') return 'ทุกบัญชี';
  const acc = accounts.find((a) => a.id === selected);
  return acc ? acc.name : 'เลือกบัญชี';
}