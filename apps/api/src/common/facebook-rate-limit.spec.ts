import { AxiosError } from 'axios';
import {
  isRetryableFacebookError,
  parseBusinessUseCaseUsage,
} from './facebook-rate-limit';

describe('facebook-rate-limit', () => {
  describe('isRetryableFacebookError', () => {
    it('retries on HTTP 429', () => {
      const err = { response: { status: 429, data: {} } } as AxiosError;
      expect(isRetryableFacebookError(err)).toBe(true);
    });

    it('retries on FB rate-limit error codes', () => {
      const err = {
        response: { status: 400, data: { error: { code: 17 } } },
      } as AxiosError;
      expect(isRetryableFacebookError(err)).toBe(true);
    });

    it('does not retry on generic 400', () => {
      const err = {
        response: { status: 400, data: { error: { code: 100 } } },
      } as AxiosError;
      expect(isRetryableFacebookError(err)).toBe(false);
    });
  });

  describe('parseBusinessUseCaseUsage', () => {
    it('accepts JSON usage header without throwing', () => {
      expect(() =>
        parseBusinessUseCaseUsage({
          'x-business-use-case-usage': JSON.stringify({
            act_123: [{ call_count: 90, estimated_time_to_regain_access: 60 }],
          }),
        }),
      ).not.toThrow();
    });
  });
});