import { resolveAdSetDelivery } from './ad-set-delivery';

describe('resolveAdSetDelivery', () => {
  it('maps OUTCOME_TRAFFIC + REACH to LINK_CLICKS', () => {
    const d = resolveAdSetDelivery('OUTCOME_TRAFFIC', 'REACH', 'IMPRESSIONS');
    expect(d.optimization_goal).toBe('LINK_CLICKS');
    expect(d.billing_event).toBe('IMPRESSIONS');
  });

  it('keeps valid awareness goal', () => {
    const d = resolveAdSetDelivery('OUTCOME_AWARENESS', 'REACH', 'IMPRESSIONS');
    expect(d.optimization_goal).toBe('REACH');
  });

  it('defaults unknown objective to traffic delivery', () => {
    const d = resolveAdSetDelivery('UNKNOWN_OBJ', null, null);
    expect(d.optimization_goal).toBe('LINK_CLICKS');
  });
});