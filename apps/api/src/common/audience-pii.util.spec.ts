import { hashAudiencePiiValue, normalizeAudiencePii } from './audience-pii.util';

describe('audience-pii.util', () => {
  it('normalizes email to lowercase', () => {
    expect(normalizeAudiencePii('EMAIL', '  User@Example.COM ')).toBe('user@example.com');
  });

  it('normalizes phone to digits only', () => {
    expect(normalizeAudiencePii('PHONE', '+66 81-234-5678')).toBe('66812345678');
  });

  it('hashes email with stable SHA-256 hex', () => {
    const hash = hashAudiencePiiValue('EMAIL', 'test@example.com');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(hashAudiencePiiValue('EMAIL', 'TEST@example.com'));
  });

  it('does not double-hash EXTERN_ID', () => {
    expect(hashAudiencePiiValue('EXTERN_ID', 'user-123')).toBe('user-123');
  });
});