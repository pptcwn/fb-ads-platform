export interface AdAccountDTO {
  id: string;
  accountId: string;
  name: string;
  currency: string;
  status: string;
  balance: number;
  spentToday: number;
  spendCap?: number;
  isWarmingUp: boolean;
}
