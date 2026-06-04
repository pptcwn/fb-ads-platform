import { PrismaService } from '../prisma/prisma.service';

/** Statuses that should not appear in the dashboard after sync/delete. */
export const HIDDEN_CAMPAIGN_STATUSES = ['DELETED', 'ARCHIVED'] as const;

export function isHiddenCampaignStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return HIDDEN_CAMPAIGN_STATUSES.includes(
    status.toUpperCase() as (typeof HIDDEN_CAMPAIGN_STATUSES)[number],
  );
}

/** Graph error when object was already deleted or never existed. */
export function isFbObjectMissingError(err: any): boolean {
  const code = err?.response?.data?.error?.code;
  const subcode = err?.response?.data?.error?.error_subcode;
  const msg = (err?.response?.data?.error?.message || err?.message || '').toLowerCase();
  if (code === 100 && (subcode === 33 || msg.includes('does not exist') || msg.includes('invalid'))) {
    return true;
  }
  if (code === 190 || code === 803) return true;
  return msg.includes('nonexisting') || msg.includes('not exist');
}

/** Meta Marketing API filtering — exclude deleted/archived campaigns from list fetches. */
export function fbCampaignListFilteringParam(): string {
  return JSON.stringify([
    {
      field: 'effective_status',
      operator: 'NOT_IN',
      value: [...HIDDEN_CAMPAIGN_STATUSES],
    },
  ]);
}

/** Remove campaign row and all FK children (matches prior CampaignsService logic). */
export async function deleteCampaignGraph(
  prisma: PrismaService,
  localCampaignId: string,
  fbCampaignId?: string,
): Promise<void> {
  await prisma.creativeCampaign.deleteMany({ where: { campaignId: localCampaignId } });
  await prisma.campaignInsight.deleteMany({ where: { campaignId: localCampaignId } });
  await prisma.abTest.deleteMany({ where: { sourceCampaignId: localCampaignId } });
  if (fbCampaignId) {
    await prisma.abTestVariant.deleteMany({ where: { campaignId: fbCampaignId } });
  }
  await prisma.campaignSchedule.deleteMany({ where: { campaignId: localCampaignId } });

  const adsets = await prisma.adSet.findMany({
    where: { campaignId: localCampaignId },
    select: { id: true },
  });
  for (const adset of adsets) {
    await prisma.ad.deleteMany({ where: { adsetId: adset.id } });
  }
  await prisma.adSet.deleteMany({ where: { campaignId: localCampaignId } });

  const rules = await prisma.rule.findMany({
    where: { campaignId: localCampaignId },
    select: { id: true },
  });
  if (rules.length > 0) {
    await prisma.ruleLog.deleteMany({
      where: { ruleId: { in: rules.map((r) => r.id) } },
    });
  }
  await prisma.rule.deleteMany({ where: { campaignId: localCampaignId } });

  await prisma.campaign.delete({ where: { id: localCampaignId } });
}