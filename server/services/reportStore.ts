import fs from 'node:fs';
import path from 'node:path';
import type {CrowdLevel, UserCrowdReport} from '../../src/types/krowd.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const REPORTS_FILE = path.join(DATA_DIR, 'user-reports.json');
const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes per client per place

const rateLimitIndex = new Map<string, number>();

function ensureStore(): UserCrowdReport[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    if (!fs.existsSync(REPORTS_FILE)) {
      fs.writeFileSync(REPORTS_FILE, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    const raw = fs.readFileSync(REPORTS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStore(reports: UserCrowdReport[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports.slice(-400), null, 2), 'utf8');
  } catch {
    // Fail safely on read-only environments
  }
}

export function getRecentReportsForPlace(placeId: string, maxAgeMinutes = 120): UserCrowdReport[] {
  const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
  return ensureStore()
    .filter(
      (r) =>
        r.placeId === placeId &&
        r.moderationStatus === 'approved' &&
        new Date(r.createdAt).getTime() >= cutoff
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function submitAnonymousCrowdReport(params: {
  placeId: string;
  crowdLevel: CrowdLevel;
  waitMinutes?: number;
  note?: string;
  clientKey: string;
}): {ok: true; report: UserCrowdReport} | {ok: false; reason: string; retryAfterSec?: number} {
  const limitKey = `${params.clientKey}:${params.placeId}`;
  const lastAt = rateLimitIndex.get(limitKey);
  const now = Date.now();

  if (lastAt && now - lastAt < RATE_LIMIT_MS) {
    const retryAfterSec = Math.ceil((RATE_LIMIT_MS - (now - lastAt)) / 1000);
    return {
      ok: false,
      reason: 'Please wait a few minutes before submitting another report for this location.',
      retryAfterSec,
    };
  }

  const sanitizedNote = params.note
    ? params.note.replace(/[<>]/g, '').trim().slice(0, 140)
    : undefined;

  const waitMinutes =
    typeof params.waitMinutes === 'number' && params.waitMinutes >= 0 && params.waitMinutes <= 180
      ? Math.round(params.waitMinutes)
      : undefined;

  const report: UserCrowdReport = {
    id: `rep_${now}_${Math.random().toString(36).slice(2, 7)}`,
    placeId: params.placeId,
    crowdLevel: params.crowdLevel,
    waitMinutes,
    note: sanitizedNote || undefined,
    createdAt: new Date(now).toISOString(),
    moderationStatus: 'approved',
  };

  const reports = ensureStore();
  reports.push(report);
  saveStore(reports);
  rateLimitIndex.set(limitKey, now);

  return {ok: true, report};
}
