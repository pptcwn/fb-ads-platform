import { createHash } from 'crypto';

/** Schema fields that must be normalized + SHA-256 hashed per Meta Custom Audience spec. */
export const HASHED_AUDIENCE_SCHEMA_FIELDS = new Set([
  'EMAIL',
  'PHONE',
  'MADID',
  'FN',
  'LN',
  'FI',
  'ZIP',
  'CT',
  'ST',
  'COUNTRY',
  'DOBY',
  'DOBM',
  'DOBD',
  'GEN',
  'MOBILE_ADVERTISER_ID',
  'WHATSAPP',
]);

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Normalize raw PII before hashing (Meta customer file requirements). */
/** Map UI/legacy column names to Meta customer file schema keys. */
export function normalizeSchemaType(schema: string): string {
  if (schema === 'FIRST_NAME') return 'FN';
  if (schema === 'LAST_NAME') return 'LN';
  return schema;
}

export function normalizeAudiencePii(schema: string, raw: string): string {
  const metaSchema = normalizeSchemaType(schema);
  const v = raw.trim();
  if (!v) return '';

  switch (metaSchema) {
    case 'EMAIL':
      return v.toLowerCase();
    case 'PHONE':
    case 'WHATSAPP':
      return v.replace(/\D/g, '');
    case 'FN':
    case 'LN':
    case 'FI':
    case 'CT':
    case 'ST':
      return v.toLowerCase().replace(/[^a-z]/g, '');
    case 'ZIP':
      return v.toLowerCase().replace(/\s/g, '');
    case 'COUNTRY':
      return v.toLowerCase().slice(0, 2);
    case 'GEN':
      return v.toLowerCase().slice(0, 1);
    case 'DOBY':
    case 'DOBM':
    case 'DOBD':
      return v.replace(/\D/g, '');
    case 'MADID':
    case 'MOBILE_ADVERTISER_ID':
      return v.toLowerCase();
    default:
      return v;
  }
}

export function hashAudiencePiiValue(schema: string, raw: string): string {
  const metaSchema = normalizeSchemaType(schema);
  const normalized = normalizeAudiencePii(schema, raw);
  if (!normalized) return '';
  if (!HASHED_AUDIENCE_SCHEMA_FIELDS.has(metaSchema)) return normalized;
  return sha256Hex(normalized);
}

export function hashAudienceDataRow(
  schemaOrder: string[],
  values: string[],
): string[] {
  return schemaOrder.map((schema, i) => hashAudiencePiiValue(schema, values[i] ?? ''));
}