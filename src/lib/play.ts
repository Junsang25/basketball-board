import { BALL_ID } from './types';
import type {
  CourtType, Line, MoveStyle, Play, ScreenPin, Step, TeamId, Token, Vec,
} from './types';
import { clampToCourt, COURT } from './court';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 공을 가진 선수 옆에 공을 놓을 때의 간격 (피트) */
export const BALL_OFFSET: Vec = { x: 2.5, y: 2.0 };

/**
 * 공은 선수 기준 가까운 사이드라인 쪽에 놓는다.
 * 코트 안쪽에서 들어오는 이동 화살표를 공이 가리지 않게 하기 위함.
 */
export function ballOffsetFor(playerPos: Vec): Vec {
  return {
    x: playerPos.x >= 0 ? BALL_OFFSET.x : -BALL_OFFSET.x,
    y: BALL_OFFSET.y,
  };
}

export const MAIN_LINE_NAME = '본선';

const DEFAULT_OFFENSE: Array<{ label: string; pos: Vec }> = [
  { label: '1', pos: { x: 0, y: 31 } },
  { label: '2', pos: { x: 19, y: 24 } },
  { label: '3', pos: { x: -19, y: 24 } },
  { label: '4', pos: { x: -10, y: 11 } },
  { label: '5', pos: { x: 10, y: 11 } },
];

export function createPlay(name = '새 전술', courtType: CourtType = 'half'): Play {
  const tokens: Token[] = [];
  const positions: Record<string, Vec> = {};

  for (const o of DEFAULT_OFFENSE) {
    const id = uid('o');
    tokens.push({ id, kind: 'player', team: 'offense', label: o.label });
    positions[id] = o.pos;
  }

  // 수비는 각 공격수와 바스켓 사이에 세운다
  const hoop: Vec = { x: 0, y: COURT.hoopFromBaseline };
  for (const o of DEFAULT_OFFENSE) {
    const id = uid('d');
    tokens.push({ id, kind: 'player', team: 'defense', label: o.label });
    const dx = hoop.x - o.pos.x;
    const dy = hoop.y - o.pos.y;
    const l = Math.hypot(dx, dy) || 1;
    positions[id] = clampToCourt(
      { x: o.pos.x + (dx / l) * 5.5, y: o.pos.y + (dy / l) * 5.5 },
      courtType,
    );
  }

  tokens.push({ id: BALL_ID, kind: 'ball', label: '' });
  positions[BALL_ID] = { x: 0, y: 34 };

  const firstPlayer = tokens.find((t) => t.team === 'offense')!;

  const step: Step = {
    id: uid('s'),
    positions,
    paths: {},
    moveStyles: {},
    screens: [],
    ballHolder: firstPlayer.id,
    note: '',
    duration: 1400,
  };

  return {
    id: uid('play'),
    name,
    courtType,
    tokens,
    lines: [makeRootLine([step])],
    updatedAt: Date.now(),
  };
}

export function makeRootLine(steps: Step[]): Line {
  return { id: uid('ln'), name: MAIN_LINE_NAME, parentId: null, fromIndex: 0, steps };
}

/** 말 위치 + 공 소유 상태를 그대로 복제한 새 스텝 (스크린은 장면 전용이라 따라오지 않는다) */
export function cloneStepForNext(step: Step): Step {
  return {
    id: uid('s'),
    positions: { ...step.positions },
    paths: {},
    moveStyles: {},
    screens: [],
    ballHolder: step.ballHolder,
    note: '',
    duration: 1400,
  };
}

// ---------------------------------------------------------------- 갈래 탐색

export function rootLine(play: Play): Line {
  return play.lines.find((l) => l.parentId === null) ?? play.lines[0];
}

export function getLine(play: Play, lineId: string): Line | undefined {
  return play.lines.find((l) => l.id === lineId);
}

/** 이 갈래가 앞쪽에서 공유받는 장면 개수 */
export function sharedCount(play: Play, lineId: string): number {
  const line = getLine(play, lineId);
  if (!line || line.parentId === null) return 0;
  return line.fromIndex + 1;
}

/** 공유 장면까지 모두 이어 붙인 전체 장면 목록 */
export function resolveSteps(play: Play, lineId: string): Step[] {
  const chain: Line[] = [];
  let line = getLine(play, lineId);
  let guard = 0;
  while (line && guard++ < 64) {
    chain.unshift(line);
    line = line.parentId ? getLine(play, line.parentId) : undefined;
  }

  let out: Step[] = [];
  for (const l of chain) {
    if (l.parentId === null) out = [...l.steps];
    else out = [...out.slice(0, l.fromIndex + 1), ...l.steps];
  }
  return out;
}

export function childLines(play: Play, lineId: string): Line[] {
  return play.lines.filter((l) => l.parentId === lineId);
}

/** 화면에 늘어놓을 순서 (본선 먼저, 그 아래로 깊이 우선) */
export function orderedLines(play: Play): Array<{ line: Line; depth: number }> {
  const out: Array<{ line: Line; depth: number }> = [];
  const seen = new Set<string>();

  const visit = (line: Line, depth: number) => {
    if (seen.has(line.id) || depth > 32) return;
    seen.add(line.id);
    out.push({ line, depth });
    for (const child of childLines(play, line.id)) visit(child, depth + 1);
  };

  const root = rootLine(play);
  if (root) visit(root, 0);
  for (const l of play.lines) if (!seen.has(l.id)) out.push({ line: l, depth: 0 });
  return out;
}

/** 해석된 장면 번호가 실제로 어느 갈래의 몇 번째 장면인지 */
export function locate(
  play: Play,
  lineId: string,
  index: number,
): { line: Line; local: number } | null {
  let line = getLine(play, lineId);
  let guard = 0;
  while (line && guard++ < 64) {
    const pre = line.parentId === null ? 0 : line.fromIndex + 1;
    if (index >= pre) {
      return index - pre < line.steps.length ? { line, local: index - pre } : null;
    }
    if (!line.parentId) return null;
    line = getLine(play, line.parentId);
  }
  return null;
}

/** 지금 보고 있는 갈래가 아니라 윗 갈래가 가진 장면인가 */
export function isSharedStep(play: Play, lineId: string, index: number): boolean {
  return index < sharedCount(play, lineId);
}

function withLine(play: Play, lineId: string, fn: (l: Line) => Line): Play {
  return {
    ...play,
    lines: play.lines.map((l) => (l.id === lineId ? fn(l) : l)),
    updatedAt: Date.now(),
  };
}

/** 어느 갈래에서 장면이 추가/삭제되면, 거기서 갈라진 하위 갈래의 분기점을 밀어준다 */
function shiftChildBranches(
  play: Play,
  parentLineId: string,
  atResolvedIndex: number,
  delta: number,
): Play {
  return {
    ...play,
    lines: play.lines.map((l) =>
      l.parentId === parentLineId && l.fromIndex >= atResolvedIndex
        ? { ...l, fromIndex: Math.max(0, l.fromIndex + delta) }
        : l,
    ),
  };
}

// ---------------------------------------------------------------- 말

export function nextPlayerLabel(play: Play, team: TeamId): string {
  const used = new Set(
    play.tokens.filter((t) => t.kind === 'player' && t.team === team).map((t) => t.label),
  );
  for (let i = 1; i <= 15; i++) {
    if (!used.has(String(i))) return String(i);
  }
  return '?';
}

function mapAllSteps(play: Play, fn: (s: Step) => Step): Play {
  return {
    ...play,
    lines: play.lines.map((l) => ({ ...l, steps: l.steps.map(fn) })),
    updatedAt: Date.now(),
  };
}

/** 모든 갈래의 모든 장면에 같은 위치로 말을 추가한다 */
export function addToken(
  play: Play,
  token: Omit<Token, 'id'>,
  pos: Vec,
): { play: Play; tokenId: string } {
  const id = uid(token.kind === 'player' ? (token.team === 'defense' ? 'd' : 'o') : 'c');
  const withPositions = mapAllSteps(play, (s) => ({
    ...s,
    positions: { ...s.positions, [id]: pos },
  }));
  return {
    play: { ...withPositions, tokens: [...play.tokens, { ...token, id }] },
    tokenId: id,
  };
}

export function removeToken(play: Play, tokenId: string): Play {
  if (tokenId === BALL_ID) return play;
  const stripped = mapAllSteps(play, (s) => {
    const positions = { ...s.positions };
    const paths = { ...s.paths };
    const moveStyles = { ...s.moveStyles };
    delete positions[tokenId];
    delete paths[tokenId];
    delete moveStyles[tokenId];
    return {
      ...s,
      positions,
      paths,
      moveStyles,
      ballHolder: s.ballHolder === tokenId ? null : s.ballHolder,
    };
  });
  return { ...stripped, tokens: play.tokens.filter((t) => t.id !== tokenId) };
}

// ---------------------------------------------------------------- 장면 편집

export function updateStepAt(
  play: Play,
  lineId: string,
  index: number,
  patch: Partial<Step>,
): Play {
  const loc = locate(play, lineId, index);
  if (!loc) return play;
  return withLine(play, loc.line.id, (l) => ({
    ...l,
    steps: l.steps.map((s, i) => (i === loc.local ? { ...s, ...patch } : s)),
  }));
}

export function moveTokenAt(
  play: Play,
  lineId: string,
  index: number,
  tokenId: string,
  pos: Vec,
): Play {
  const loc = locate(play, lineId, index);
  if (!loc) return play;
  const step = loc.line.steps[loc.local];
  return updateStepAt(play, lineId, index, {
    positions: { ...step.positions, [tokenId]: clampToCourt(pos, play.courtType) },
  });
}

export function setWaypointAt(
  play: Play,
  lineId: string,
  index: number,
  tokenId: string,
  point: Vec | null,
): Play {
  const loc = locate(play, lineId, index);
  if (!loc) return play;
  const paths = { ...loc.line.steps[loc.local].paths };
  if (point === null) delete paths[tokenId];
  else paths[tokenId] = [clampToCourt(point, play.courtType)];
  return updateStepAt(play, lineId, index, { paths });
}

export function setMoveStyleAt(
  play: Play,
  lineId: string,
  index: number,
  tokenId: string,
  style: MoveStyle | null,
): Play {
  const loc = locate(play, lineId, index);
  if (!loc) return play;
  const moveStyles = { ...loc.line.steps[loc.local].moveStyles };
  if (style === null) delete moveStyles[tokenId];
  else moveStyles[tokenId] = style;
  return updateStepAt(play, lineId, index, { moveStyles });
}

// ---------------------------------------------------------------- 스크린 마커

/** 코트 가로 방향으로 누운 막대가 기본값 */
export const DEFAULT_SCREEN_ANGLE = 0;

export function addScreenAt(
  play: Play,
  lineId: string,
  index: number,
  pos: Vec,
  angle = DEFAULT_SCREEN_ANGLE,
): { play: Play; screenId: string } {
  const loc = locate(play, lineId, index);
  if (!loc) return { play, screenId: '' };

  const pin: ScreenPin = {
    id: uid('sc'),
    pos: clampToCourt(pos, play.courtType),
    angle,
  };
  return {
    play: updateStepAt(play, lineId, index, {
      screens: [...(loc.line.steps[loc.local].screens ?? []), pin],
    }),
    screenId: pin.id,
  };
}

function patchScreen(
  play: Play,
  lineId: string,
  index: number,
  screenId: string,
  fn: (pin: ScreenPin) => ScreenPin,
): Play {
  const loc = locate(play, lineId, index);
  if (!loc) return play;
  return updateStepAt(play, lineId, index, {
    screens: loc.line.steps[loc.local].screens.map((s) => (s.id === screenId ? fn(s) : s)),
  });
}

export function moveScreenAt(
  play: Play,
  lineId: string,
  index: number,
  screenId: string,
  pos: Vec,
): Play {
  return patchScreen(play, lineId, index, screenId, (s) => ({
    ...s,
    pos: clampToCourt(pos, play.courtType),
  }));
}

/** 설치 중 위아래로 움직여 맞춘 각도를 그대로 넣는다 */
export function setScreenAngleAt(
  play: Play,
  lineId: string,
  index: number,
  screenId: string,
  angle: number,
): Play {
  return patchScreen(play, lineId, index, screenId, (s) => ({ ...s, angle }));
}

export function removeScreenAt(
  play: Play,
  lineId: string,
  index: number,
  screenId: string,
): Play {
  const loc = locate(play, lineId, index);
  if (!loc) return play;
  return updateStepAt(play, lineId, index, {
    screens: loc.line.steps[loc.local].screens.filter((s) => s.id !== screenId),
  });
}

/** 현재 갈래가 소유한 장면에서만 구조를 바꿀 수 있다 */
export function canEditStructure(play: Play, lineId: string, index: number): boolean {
  if (isSharedStep(play, lineId, index)) return false;
  const loc = locate(play, lineId, index);
  return !!loc;
}

export function addStepAt(
  play: Play,
  lineId: string,
  index: number,
): { play: Play; index: number } {
  const loc = locate(play, lineId, index);
  if (!loc || isSharedStep(play, lineId, index)) return { play, index };

  const step = cloneStepForNext(loc.line.steps[loc.local]);
  const inserted = withLine(play, loc.line.id, (l) => {
    const steps = [...l.steps];
    steps.splice(loc.local + 1, 0, step);
    return { ...l, steps };
  });
  return {
    play: shiftChildBranches(inserted, loc.line.id, index + 1, 1),
    index: index + 1,
  };
}

export function duplicateStepAt(
  play: Play,
  lineId: string,
  index: number,
): { play: Play; index: number } {
  const loc = locate(play, lineId, index);
  if (!loc || isSharedStep(play, lineId, index)) return { play, index };

  const src = loc.line.steps[loc.local];
  const copy: Step = {
    ...src,
    id: uid('s'),
    positions: { ...src.positions },
    paths: { ...src.paths },
    moveStyles: { ...src.moveStyles },
    screens: src.screens.map((s) => ({ ...s, id: uid('sc') })),
  };
  const inserted = withLine(play, loc.line.id, (l) => {
    const steps = [...l.steps];
    steps.splice(loc.local + 1, 0, copy);
    return { ...l, steps };
  });
  return {
    play: shiftChildBranches(inserted, loc.line.id, index + 1, 1),
    index: index + 1,
  };
}

export function canRemoveStep(play: Play, lineId: string, index: number): boolean {
  if (isSharedStep(play, lineId, index)) return false;
  const loc = locate(play, lineId, index);
  return !!loc && loc.line.steps.length > 1;
}

export function removeStepAt(
  play: Play,
  lineId: string,
  index: number,
): { play: Play; index: number } {
  if (!canRemoveStep(play, lineId, index)) return { play, index };
  const loc = locate(play, lineId, index)!;

  const removed = withLine(play, loc.line.id, (l) => ({
    ...l,
    steps: l.steps.filter((_, i) => i !== loc.local),
  }));
  const next = shiftChildBranches(removed, loc.line.id, index, -1);
  const total = resolveSteps(next, lineId).length;
  return { play: next, index: Math.max(0, Math.min(index, total - 1)) };
}

// ---------------------------------------------------------------- 갈래 편집

export function addBranch(
  play: Play,
  fromLineId: string,
  fromIndex: number,
  name: string,
): { play: Play; lineId: string } {
  const resolved = resolveSteps(play, fromLineId);
  if (resolved.length === 0) return { play, lineId: fromLineId };

  const at = Math.max(0, Math.min(fromIndex, resolved.length - 1));
  const line: Line = {
    id: uid('ln'),
    name,
    parentId: fromLineId,
    fromIndex: at,
    steps: [cloneStepForNext(resolved[at])],
  };
  return {
    play: { ...play, lines: [...play.lines, line], updatedAt: Date.now() },
    lineId: line.id,
  };
}

export function removeLine(play: Play, lineId: string): Play {
  const line = getLine(play, lineId);
  if (!line || line.parentId === null) return play;

  const doomed = new Set<string>([lineId]);
  let grew = true;
  let guard = 0;
  while (grew && guard++ < 64) {
    grew = false;
    for (const l of play.lines) {
      if (l.parentId && doomed.has(l.parentId) && !doomed.has(l.id)) {
        doomed.add(l.id);
        grew = true;
      }
    }
  }
  return {
    ...play,
    lines: play.lines.filter((l) => !doomed.has(l.id)),
    updatedAt: Date.now(),
  };
}

export function renameLine(play: Play, lineId: string, name: string): Play {
  return withLine(play, lineId, (l) => ({ ...l, name }));
}

// ---------------------------------------------------------------- 파생 정보

/**
 * 이번 장면에서 말이 어떻게 움직였는지 표기 방식을 결정한다.
 * 직접 지정한 값이 있으면 그걸 쓰고, 없으면 공을 계속 들고 움직였는지로 판단한다.
 */
export function effectiveMoveStyle(
  steps: Step[],
  stepIndex: number,
  tokenId: string,
): MoveStyle {
  const step = steps[stepIndex];
  const prev = steps[stepIndex - 1];
  if (!step) return 'cut';

  const explicit = step.moveStyles[tokenId];
  if (explicit) return explicit;

  if (prev && prev.ballHolder === tokenId && step.ballHolder === tokenId) return 'dribble';
  return 'cut';
}

/** 공의 실제 좌표 (선수가 들고 있으면 그 옆) */
export function ballPositionIn(step: Step): Vec {
  if (step.ballHolder && step.positions[step.ballHolder]) {
    const p = step.positions[step.ballHolder];
    const off = ballOffsetFor(p);
    return { x: p.x + off.x, y: p.y + off.y };
  }
  return step.positions[BALL_ID] ?? { x: 0, y: 25 };
}

export function totalDuration(steps: Step[]): number {
  return steps.slice(1).reduce((sum, s) => sum + s.duration, 0);
}
