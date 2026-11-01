import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// runs/ is read-only: every case here uses a temp runs dir.
const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
const good = [
  '{"at":"2026-01-01T01:00:00+01:00","job":"b/job","status":"ok","owner":"rook"}',
  '{"at":"2026-01-01T02:00:00+01:00","job":"a/job","status":"fail","owner":null,"error":"boom"}',
].join('\n');
writeFileSync(join(dir, '2026-01-01.jsonl'), `${good}\n`);
writeFileSync(join(dir, '2026-01-02.jsonl'), '');
writeFileSync(join(dir, '2026-01-03.jsonl'), `${good}\n{"at":"2026-01-01T03:00:00+01:00","job":"c/jo\n`);

const app = createApp({ adapter: 'shim', installed: 'x', beatEverySeconds: 60, runsDir: dir });

describe('GET /digest/:night', () => {
  it('renders a night: 200, rows sorted by job, fail marked, null owner as a dash', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html).toContain('fail ▲');
    expect(html).toContain('<td>—</td>');
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/digest/2026-02-02')).status).toBe(404);
  });

  it('renders "nothing ran" for an empty night', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders a night with a bad line and says so', async () => {
    const res = await app.request('/digest/2026-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('1 line could not be read');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the rows as JSON', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    const body = (await res.json()) as { rows: { job: string }[] };
    expect(res.status).toBe(200);
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/api/digest/2026-02-02')).status).toBe(404);
  });

  it('an empty night has no rows', async () => {
    const body = (await (await app.request('/api/digest/2026-01-02')).json()) as { rows: unknown[] };
    expect(body.rows).toEqual([]);
  });

  it('counts the bad line', async () => {
    const body = (await (await app.request('/api/digest/2026-01-03')).json()) as { badLines: number };
    expect(body.badLines).toBe(1);
  });

  it('lists the same jobs, in the same order, as the page', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const pageJobs = [...html.matchAll(/<tr><td>([^<]+)<\/td>/g)].map((m) => m[1]);
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as { rows: { job: string }[] };
    expect(body.rows.map((r) => r.job)).toEqual(pageJobs);
  });
});
