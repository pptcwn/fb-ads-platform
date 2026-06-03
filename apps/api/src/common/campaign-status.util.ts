/** Maps Facebook campaign status strings to Prisma CampaignStatus values. */
export function mapFbCampaignStatus(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'ACTIVE',
    PAUSED: 'PAUSED',
    DELETED: 'DELETED',
    ARCHIVED: 'ARCHIVED',
    IN_REVIEW: 'IN_REVIEW',
    REJECTED: 'REJECTED',
    COMPLETED: 'COMPLETED',
  };
  return map[status.toUpperCase()] || 'PAUSED';
}