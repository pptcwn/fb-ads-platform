import { normalizeCampaignObjective } from './campaign-objective';

describe('normalizeCampaignObjective', () => {
  it('maps legacy TRAFFIC to OUTCOME_TRAFFIC', () => {
    expect(normalizeCampaignObjective('TRAFFIC')).toBe('OUTCOME_TRAFFIC');
  });

  it('keeps ODAX objectives', () => {
    expect(normalizeCampaignObjective('OUTCOME_AWARENESS')).toBe('OUTCOME_AWARENESS');
  });
});