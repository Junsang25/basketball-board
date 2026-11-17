import { BALL_ID } from './types';
import type { Play, Step, TeamId, Vec } from './types';
import { clamp, dist, easeInOut, pointAlong, smoothPolyline } from './geom';
import { ballOffsetFor, ballPositionIn, effectiveMoveStyle } from './play';

export type TrailKind = 'cut' | 'dribble' | 'screen' | 'pass' | 'shot';

export interface Trail {
  tokenId: string;
  kind: TrailKind;
  /** 코트 좌표계의 폴리라인 */
  points: Vec[];
  team?: TeamId;
}

/**
 * 화면에 그릴 스크린 마커.
 * 장면에 직접 놓은 것이라 그 장면에서만 나타나고,
 * 애니메이션에서는 움직임이 끝날 때쯤 떠오른다.
 */
export interface ScreenMark {
  id: string;
  pos: Vec;
  /** 막대가 누운 각도(라디안) */
  angle: number;
  /** 0~1 */
  opacity: number;
}

export interface Frame {
  positions: Record<string, Vec>;
  /** 직전 장면의 위치 (잔상 표시용). 시작 배치에서는 없다 */
  ghostPositions?: Record<string, Vec>;
  trails: Trail[];
  screens: ScreenMark[];
  stepIndex: number;
  t: number;
}

/** 스크린 마커가 떠오르기 시작하는 지점 (이동이 거의 끝났을 때) */
const SCREEN_APPEAR_AT = 0.88;

function screenOpacity(t: number): number {
  if (t >= 1) return 1;
  if (t <= SCREEN_APPEAR_AT) return 0;
  return (t - SCREEN_APPEAR_AT) / (1 - SCREEN_APPEAR_AT);
}

function screensOf(step: Step, t: number): ScreenMark[] {
  // 예전 형식으로 저장된 장면에는 screens가 없을 수 있다
  const pins = step.screens ?? [];
  if (pins.length === 0) return [];
  const opacity = screenOpacity(clamp(t, 0, 1));
  if (opacity <= 0) return [];
  return pins.map((s) => ({ id: s.id, pos: s.pos, angle: s.angle, opacity }));
}

/** 움직인 것으로 볼 최소 거리 (피트) */
const MOVE_EPS = 0.6;

/** 공은 선수보다 조금 먼저 도착한다 */
const BALL_LEAD = 1.25;

/** 어떤 말이 이번 장면에서 지나간 경로 (곡선 적용) */
export function tokenPath(steps: Step[], stepIndex: number, tokenId: string): Vec[] {
  const prev = steps[stepIndex - 1];
  const cur = steps[stepIndex];
  if (!prev || !cur) return [];

  const a = prev.positions[tokenId];
  const b = cur.positions[tokenId];
  if (!a || !b) return [];

  const mids = cur.paths[tokenId] ?? [];
  if (mids.length === 0) return [a, b];
  return smoothPolyline([a, ...mids, b]);
}

/**
 * steps[stepIndex] 장면의 t(0~1) 시점 상태를 계산한다.
 * t는 stepIndex-1 에서 stepIndex 로 넘어가는 진행도.
 * stepIndex 가 0이면 시작 배치를 그대로 돌려준다.
 */
export function frameAt(
  play: Play,
  steps: Step[],
  stepIndex: number,
  t = 1,
  withTrails = true,
): Frame {
  const cur = steps[stepIndex];
  const prev = steps[stepIndex - 1];

  if (!cur) {
    return { positions: {}, trails: [], screens: [], stepIndex, t };
  }

  // 시작 배치
  if (!prev) {
    const positions: Record<string, Vec> = { ...cur.positions };
    positions[BALL_ID] = ballPositionIn(cur);
    return { positions, trails: [], screens: screensOf(cur, 1), stepIndex, t: 1 };
  }

  const te = easeInOut(clamp(t, 0, 1));
  const positions: Record<string, Vec> = {};
  const trails: Trail[] = [];

  for (const token of play.tokens) {
    if (token.kind === 'ball') continue;

    const path = tokenPath(steps, stepIndex, token.id);
    if (path.length === 0) {
      positions[token.id] = cur.positions[token.id] ?? prev.positions[token.id];
      continue;
    }

    positions[token.id] = pointAlong(path, te).pos;

    if (withTrails && dist(path[0], path[path.length - 1]) > MOVE_EPS) {
      trails.push({
        tokenId: token.id,
        kind: effectiveMoveStyle(steps, stepIndex, token.id),
        points: path,
        team: token.team,
      });
    }
  }

  // 공
  const prevHolder = prev.ballHolder;
  const curHolder = cur.ballHolder;
  const tb = easeInOut(clamp(t * BALL_LEAD, 0, 1));

  if (curHolder && prevHolder === curHolder) {
    // 계속 들고 있음 -> 선수를 따라간다
    const p = positions[curHolder] ?? cur.positions[curHolder];
    const off = ballOffsetFor(p);
    positions[BALL_ID] = { x: p.x + off.x, y: p.y + off.y };
  } else {
    const from = ballPositionIn(prev);
    const to = ballPositionIn(cur);
    const ballPath = [from, to];
    positions[BALL_ID] = pointAlong(ballPath, tb).pos;

    if (withTrails && dist(from, to) > MOVE_EPS) {
      trails.push({
        tokenId: BALL_ID,
        kind: curHolder === null ? 'shot' : 'pass',
        points: ballPath,
      });
    }
  }

  return {
    positions,
    ghostPositions: prev.positions,
    trails,
    screens: screensOf(cur, t),
    stepIndex,
    t,
  };
}
