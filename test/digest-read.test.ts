import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');

  it('finds 5 jobs and 1 bad line', () => {
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night?.badLines).toBe(1);
  });

  it('counts retries and keeps the last error', () => {
    const row = night?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(row).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(row?.firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(row?.lastAt).toBe('2026-10-29T01:37:00+01:00');
  });

  it('counts log lines by status', () => {
    expect(night?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('keeps a row whose owner is null', () => {
    expect(night?.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
  });

  it('keeps a failed job as fail', () => {
    expect(night?.rows.find((r) => r.job === 'notes/backup')).toMatchObject({
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(dir, '2026-01-01.jsonl'), '');
  writeFileSync(join(dir, '2026-01-02.jsonl'), 'not json\n{"at":"x","job":"a","status":"nope"}\n[1]\n');

  it('returns null for a night with no file', () => {
    expect(readNight(dir, '2026-01-03')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('counts every unusable line and never throws', () => {
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 3, counts: { ok: 0, retry: 0, fail: 0 } });
  });

  it('refuses a night that is not a plain date', () => {
    expect(readNight('runs', '../rig')).toBeNull();
  });
});
