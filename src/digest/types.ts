export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job for one night. `owner` is null when the log line has none; views show it as `—`.
// Times keep the offset from the log (styleguide): never converted to UTC.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[];
  // Lines that did not parse. Counted, never thrown: the night still renders.
  badLines: number;
};

// Signature of readNight(runsDir, night), implemented in src/digest/read.ts. Reads runs/<night>.jsonl. Returns null when the night has no file (the page answers 404);
// an empty file returns zero rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
