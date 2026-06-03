import {
  FacebookAsyncInsightsClient,
  shouldUseAsyncInsights,
} from './facebook-async-insights.client';

describe('FacebookAsyncInsightsClient', () => {
  describe('shouldUseAsyncInsights', () => {
    it('uses async for last_30d with time_increment', () => {
      expect(
        shouldUseAsyncInsights({
          level: 'campaign',
          datePreset: 'last_30d',
          timeIncrement: 1,
        }),
      ).toBe(true);
    });

    it('uses sync for yesterday without time_increment', () => {
      expect(
        shouldUseAsyncInsights({
          level: 'account',
          datePreset: 'yesterday',
        }),
      ).toBe(false);
    });

    it('respects preferAsync flag', () => {
      expect(
        shouldUseAsyncInsights({
          level: 'account',
          datePreset: 'yesterday',
          preferAsync: true,
        }),
      ).toBe(true);
    });
  });

  describe('waitForReportRun', () => {
    it('resolves when job completes', async () => {
      const axios = {
        get: jest
          .fn()
          .mockResolvedValueOnce({
            data: { async_status: 'Job Running', async_percent_completion: 50 },
          })
          .mockResolvedValueOnce({
            data: { async_status: 'Job Completed', async_percent_completion: 100 },
          }),
      };

      const client = new FacebookAsyncInsightsClient('https://graph.facebook.com/v24.0', axios as any);
      await expect(client.waitForReportRun('12345', 'token')).resolves.toBeUndefined();
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    it('throws when job fails', async () => {
      const axios = {
        get: jest.fn().mockResolvedValue({
          data: { async_status: 'Job Failed' },
        }),
      };

      const client = new FacebookAsyncInsightsClient('https://graph.facebook.com/v24.0', axios as any);
      await expect(client.waitForReportRun('999', 'token')).rejects.toThrow('Job Failed');
    });
  });

  describe('fetchViaSyncGet', () => {
    it('paginates sync results', async () => {
      const axios = {
        get: jest
          .fn()
          .mockResolvedValueOnce({
            data: {
              data: [{ date_start: '2026-06-01', impressions: '1', clicks: '0', ctr: '0', cpc: '0', cpm: '0', spend: '0' }],
              paging: { next: 'https://graph.facebook.com/next' },
            },
          })
          .mockResolvedValueOnce({
            data: {
              data: [{ date_start: '2026-06-02', impressions: '2', clicks: '0', ctr: '0', cpc: '0', cpm: '0', spend: '0' }],
            },
          }),
      };

      const client = new FacebookAsyncInsightsClient('https://graph.facebook.com/v24.0', axios as any);
      const rows = await client.fetchViaSyncGet('act_123', 'token', {
        level: 'account',
        datePreset: 'yesterday',
      });

      expect(rows).toHaveLength(2);
      expect(axios.get).toHaveBeenCalledTimes(2);
    });
  });
});