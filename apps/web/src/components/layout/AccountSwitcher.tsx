'use client';

import { ChevronDown, Layers } from 'lucide-react';
import { useAccountContext } from '@/contexts/account-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  canCreateAdsForAccount,
  partitionAccounts,
  statusBadgeClass,
  type AdAccountCapabilities,
} from '@/lib/ad-account-utils';
import { useSelectedAdAccount } from '@/hooks/use-selected-ad-account';

export default function AccountSwitcher() {
  const { accounts, isLoading, selectedAccount, setSelectedAccountId } = useSelectedAdAccount();
  const { selectedAccountId: rawId } = useAccountContext();

  const label = useMemoLabel(selectedAccount, accounts, isLoading, rawId);
  const { usable, restricted } = partitionAccounts(accounts);

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
      <DropdownMenuContent align="start" className="min-w-[260px] max-h-[min(70vh,420px)] overflow-y-auto">
        {usable.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-ink-200">ใช้งานได้</DropdownMenuLabel>
            {usable.map((acc) => (
              <AccountMenuItem
                key={acc.id}
                acc={acc}
                selected={rawId === acc.id}
                onSelect={() => setSelectedAccountId(acc.id)}
              />
            ))}
          </DropdownMenuGroup>
        )}

        {restricted.length > 0 && (
          <>
            {usable.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-ink-200">จำกัด / ปิดใช้งาน</DropdownMenuLabel>
              {restricted.map((acc) => (
                <AccountMenuItem
                  key={acc.id}
                  acc={acc}
                  selected={rawId === acc.id}
                  onSelect={() => setSelectedAccountId(acc.id)}
                  restricted
                />
              ))}
            </DropdownMenuGroup>
          </>
        )}

        {!isLoading && accounts.length === 0 && (
          <div className="px-2 py-2 text-xs text-ink-200">ยังไม่มีบัญชีโฆษณา</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenuItem({
  acc,
  selected,
  onSelect,
  restricted,
}: {
  acc: AdAccountCapabilities & { currency?: string };
  selected: boolean;
  onSelect: () => void;
  restricted?: boolean;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className={selected ? 'bg-surface-200' : ''}>
      <div className="flex flex-col gap-1 min-w-0 w-full">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate font-medium flex-1">{acc.name}</span>
          <span className={`badge text-[10px] shrink-0 ${statusBadgeClass(acc.status)}`}>
            {acc.statusLabelTh || acc.status}
          </span>
        </div>
        <span className="text-xs text-ink-200">{acc.currency}</span>
        {restricted && acc.restrictionMessage && (
          <span className="text-[11px] text-warning leading-snug">{acc.restrictionMessage}</span>
        )}
      </div>
    </DropdownMenuItem>
  );
}

function useMemoLabel(
  selected: AdAccountCapabilities | null,
  accounts: AdAccountCapabilities[],
  isLoading: boolean,
  rawId: string,
) {
  if (isLoading) return 'กำลังโหลด…';
  if (selected) {
    if (!canCreateAdsForAccount(selected)) return `${selected.name} (จำกัด)`;
    return selected.name;
  }
  if (accounts.length > 0) return 'เลือกบัญชี…';
  return rawId ? 'บัญชีไม่พบ' : 'ยังไม่มีบัญชี';
}