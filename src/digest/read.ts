import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

const statuses: readonly string[] = ['ok', 'retry', 'fail'];

type Line = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

// Parse at the edge (styleguide): a line is either a full Line or undefined.
function parseLine(text: string): Line | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (typeof value !== 'object' || value === null) return undefined;
  const o = value as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return undefined;
  if (typeof o.status !== 'string' || !statuses.includes(o.status)) return undefined;
  return {
    at: o.at,
    job: o.job,
    status: o.status as RunStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    error: typeof o.error === 'string' ? o.error : null,
  };
}

// Rows come back sorted by job, so the page and the JSON agree on order (ADR 0001).
export const readNight: ReadNight = (runsDir, night): Night | null => {
  // The night comes from a URL: only a plain date may reach the filesystem.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) return null;

  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const text of readFileSync(path, 'utf8').split('\n')) {
    if (text.trim() === '') continue;
    const line = parseLine(text);
    if (!line) {
      badLines++;
      continue;
    }
    const row = rows.get(line.job);
    if (!row) {
      rows.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }
    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    row.lastAt = line.at;
    // Keep the latest owner and error we have seen: a later line without one doesn't erase it.
    if (line.owner !== null) row.owner = line.owner;
    if (line.error !== null) row.lastError = line.error;
  }

  return { night, rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)), badLines };
};
