import type { Line, MoveStyle, Play, ScreenPin, Step } from './types';
import { BALL_ID } from './types';
import { MAIN_LINE_NAME, makeRootLine, uid } from './play';
import { createSamplePlay } from './sample';

const KEY = 'hoopboard.playbook.v1';

interface Stored {
  version: 1;
  plays: Play[];
}

export function loadPlaybook(): Play[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || !Array.isArray(parsed.plays)) return [];
    return parsed.plays.map(normalizePlay).filter((p): p is Play => p !== null);
  } catch {
    return [];
  }
}

export function savePlaybook(plays: Play[]): void {
  try {
    const data: Stored = { version: 1, plays };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // 저장 공간이 꽉 찬 경우 등은 무시 (화면 작업은 계속 가능)
  }
}

export function upsertPlay(plays: Play[], play: Play): Play[] {
  const i = plays.findIndex((p) => p.id === play.id);
  if (i === -1) return [play, ...plays];
  const next = [...plays];
  next[i] = play;
  return next;
}

function normalizeScreens(input: unknown): ScreenPin[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (s): s is ScreenPin =>
        !!s &&
        typeof s === 'object' &&
        typeof (s as ScreenPin).pos?.x === 'number' &&
        typeof (s as ScreenPin).pos?.y === 'number',
    )
    .map((s) => ({
      id: typeof s.id === 'string' ? s.id : uid('sc'),
      pos: { x: s.pos.x, y: s.pos.y },
      angle: typeof s.angle === 'number' && Number.isFinite(s.angle) ? s.angle : 0,
    }));
}

/** 'screen'은 더 이상 이동 표기가 아니라 따로 놓는 마커라서 걸러낸다 */
function normalizeMoveStyles(input: unknown): Record<string, MoveStyle> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, MoveStyle> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (v === 'cut' || v === 'dribble') out[k] = v;
  }
  return out;
}

function normalizeStep(s: Partial<Step> | undefined): Step {
  return {
    id: typeof s?.id === 'string' ? s.id : uid('s'),
    positions: s?.positions && typeof s.positions === 'object' ? s.positions : {},
    paths: s?.paths && typeof s.paths === 'object' ? s.paths : {},
    moveStyles: normalizeMoveStyles(s?.moveStyles),
    screens: normalizeScreens(s?.screens),
    ballHolder: typeof s?.ballHolder === 'string' ? s.ballHolder : null,
    note: typeof s?.note === 'string' ? s.note : '',
    duration: typeof s?.duration === 'number' && s.duration > 0 ? s.duration : 1400,
  };
}

/**
 * 외부에서 들어온 데이터를 안전하게 정리한다.
 * 갈래가 없던 옛 형식(steps 하나짜리)도 본선 하나로 변환해서 받아준다.
 */
export function normalizePlay(input: unknown): Play | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Partial<Play> & { steps?: Partial<Step>[] };
  if (!Array.isArray(p.tokens)) return null;

  const tokens = p.tokens.filter(
    (t) => t && typeof t.id === 'string' && typeof t.kind === 'string',
  );
  if (!tokens.some((t) => t.id === BALL_ID)) {
    tokens.push({ id: BALL_ID, kind: 'ball', label: '' });
  }

  let lines: Line[] = [];

  if (Array.isArray(p.lines) && p.lines.length > 0) {
    lines = p.lines
      .filter((l) => l && Array.isArray(l.steps) && l.steps.length > 0)
      .map((l) => ({
        id: typeof l.id === 'string' ? l.id : uid('ln'),
        name: typeof l.name === 'string' && l.name.trim() ? l.name : '갈래',
        parentId: typeof l.parentId === 'string' ? l.parentId : null,
        fromIndex: typeof l.fromIndex === 'number' && l.fromIndex >= 0 ? Math.floor(l.fromIndex) : 0,
        steps: l.steps.map(normalizeStep),
      }));

    // 부모를 못 찾는 갈래는 독립 갈래로 떼어낸다
    const ids = new Set(lines.map((l) => l.id));
    lines = lines.map((l) =>
      l.parentId && !ids.has(l.parentId) ? { ...l, parentId: null, fromIndex: 0 } : l,
    );
    if (!lines.some((l) => l.parentId === null)) {
      lines[0] = { ...lines[0], parentId: null, fromIndex: 0, name: MAIN_LINE_NAME };
    }
  } else if (Array.isArray(p.steps) && p.steps.length > 0) {
    lines = [makeRootLine(p.steps.map(normalizeStep))];
  }

  if (lines.length === 0) return null;

  return {
    id: typeof p.id === 'string' ? p.id : uid('play'),
    name: typeof p.name === 'string' && p.name.trim() ? p.name : '불러온 전술',
    courtType: p.courtType === 'full' ? 'full' : 'half',
    tokens,
    lines,
    updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
  };
}

/** 처음 켰을 때는 샘플 전술 하나로 시작한다 */
export function ensurePlaybook(): Play[] {
  const plays = loadPlaybook();
  if (plays.length > 0) return plays;
  const sample = createSamplePlay();
  savePlaybook([sample]);
  return [sample];
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(name: string): string {
  return (name.trim() || '전술').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
}

/** 전술 하나를 .json 파일로 내보낸다 */
export function exportPlayFile(play: Play): void {
  const blob = new Blob([JSON.stringify(play, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${safeFileName(play.name)}.hoopboard.json`);
}

/** 플레이북 전체를 내보낸다 */
export function exportPlaybookFile(plays: Play[]): void {
  const blob = new Blob([JSON.stringify({ version: 1, plays }, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `플레이북_${new Date().toISOString().slice(0, 10)}.hoopboard.json`);
}

/** .json 파일에서 전술들을 읽어온다 (단일 전술 / 플레이북 둘 다 지원) */
export async function importFromFile(file: File): Promise<Play[]> {
  const text = await file.text();
  const data = JSON.parse(text) as unknown;

  const candidates: unknown[] =
    data && typeof data === 'object' && Array.isArray((data as Stored).plays)
      ? (data as Stored).plays
      : [data];

  const plays = candidates
    .map(normalizePlay)
    .filter((p): p is Play => p !== null)
    // 기존 전술과 id가 겹치지 않도록 새 id 부여
    .map((p) => ({ ...p, id: uid('play') }));

  if (plays.length === 0) throw new Error('이 파일에서 전술을 찾지 못했어요.');
  return plays;
}

export { downloadBlob };
