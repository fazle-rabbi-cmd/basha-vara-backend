import { describe, expect, it } from 'vitest';
import { buildPrismaDatabaseUrl } from './prisma.service.js';

describe('buildPrismaDatabaseUrl', () => {
  it('configures Supabase transaction pooler URLs for Prisma', () => {
    const result = new URL(buildPrismaDatabaseUrl(
      'postgresql://user:password@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?schema=public',
    )!);

    expect(result.searchParams.get('pgbouncer')).toBe('true');
    expect(result.searchParams.get('connection_limit')).toBe('1');
    expect(result.searchParams.get('schema')).toBe('public');
  });

  it('keeps direct PostgreSQL URLs on the regular pool settings', () => {
    const result = new URL(buildPrismaDatabaseUrl(
      'postgresql://user:password@localhost:5433/database?schema=public',
    )!);

    expect(result.searchParams.get('pgbouncer')).toBeNull();
    expect(result.searchParams.get('connection_limit')).toBe('5');
    expect(result.searchParams.get('pool_timeout')).toBe('10');
  });
});
