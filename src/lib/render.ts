import { BALL_ID } from './types';
import type { Play, Token, Vec } from './types';
import { drawCourt } from './court';
import type { Transform } from './court';
import { DEFAULT_LOOK } from './look';
import type { BoardLook } from './look';
import type { Frame, ScreenMark, Trail, TrailKind } from './frame';
import { distToSegment, norm, perp, pointAlong, polylineLengths, sub, trimPolyline } from './geom';

/** 말 크기 (피트) */
export const PLAYER_R = 1.9;
export const BALL_R = 1.05;
export const CONE_R = 1.3;

export interface RenderOptions {
  /** 선택된 말 id */
  selectedId?: string | null;
  /** 이전 스텝 위치를 흐리게 표시 */
  ghosts?: boolean;
  /** 곡선 조절 핸들을 표시할 말 id */
  handleFor?: string | null;
  /** 핸들 좌표 (코트 좌표) */
  handlePos?: Vec | null;
  /** 커서가 올라가 있는 스크린 마커 */
  activeScreenId?: string | null;
  /** 코트 밖으로 끌려 나와 지금 손을 떼면 버려지는 마커 */
  trashScreenId?: string | null;
  /** 테마와 말 크기 */
  look?: BoardLook;
}

export function tokenRadius(token: Token, scale = 1): number {
  if (token.kind === 'ball') return BALL_R * scale;
  if (token.kind === 'cone') return CONE_R * scale;
  return PLAYER_R * scale;
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  play: Play,
  frame: Frame,
  opts: RenderOptions = {},
): void {
  const look = opts.look ?? DEFAULT_LOOK;
  drawCourt(ctx, tf, play.courtType, look.theme);

  // 직전 장면 잔상
  if (opts.ghosts && frame.ghostPositions) {
    for (const token of play.tokens) {
      if (token.kind === 'ball') continue;
      const p = frame.ghostPositions[token.id];
      const now = frame.positions[token.id];
      if (!p || !now) continue;
      if (Math.hypot(p.x - now.x, p.y - now.y) < 0.6) continue;
      drawGhost(ctx, tf, p, tokenRadius(token, look.tokenScale), look);
    }
  }

  // 움직임 기호 (말보다 아래)
  for (const trail of frame.trails) {
    drawTrail(ctx, tf, trail, play, look);
  }

  // 말
  for (const token of play.tokens) {
    if (token.kind === 'ball') continue;
    const p = frame.positions[token.id];
    if (!p) continue;
    drawToken(ctx, tf, token, p, opts.selectedId === token.id, look);
  }

  // 스크린 마커 (말 위에 올린다)
  for (const mark of frame.screens) {
    const mode = opts.trashScreenId === mark.id
      ? 'trash'
      : opts.activeScreenId === mark.id ? 'active' : 'plain';
    drawScreenMark(ctx, tf, mark, mode, look);
  }

  // 공은 항상 맨 위
  const ballPos = frame.positions[BALL_ID];
  if (ballPos) {
    const ball = play.tokens.find((t) => t.id === BALL_ID);
    if (ball) drawToken(ctx, tf, ball, ballPos, opts.selectedId === BALL_ID, look);
  }

  // 곡선 핸들
  if (opts.handleFor && opts.handlePos) {
    const c = tf.toCanvas(opts.handlePos);
    const r = Math.max(5, tf.px(0.85));
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = look.theme.floor;
    ctx.fill();
    ctx.lineWidth = Math.max(1.6, tf.px(0.2));
    ctx.strokeStyle = look.theme.handle;
    ctx.stroke();
  }
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  pos: Vec,
  rFeet: number,
  look: BoardLook,
): void {
  const c = tf.toCanvas(pos);
  ctx.beginPath();
  ctx.arc(c.x, c.y, tf.px(rFeet), 0, Math.PI * 2);
  ctx.setLineDash([tf.px(0.4), tf.px(0.4)]);
  ctx.lineWidth = Math.max(1, tf.px(0.16));
  ctx.strokeStyle = look.theme.ghost;
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawToken(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  token: Token,
  pos: Vec,
  selected: boolean,
  look: BoardLook,
): void {
  const c = tf.toCanvas(pos);
  const k = look.tokenScale;
  const th = look.theme;

  if (token.kind === 'ball') {
    drawBall(ctx, tf, c, look);
    if (selected) drawSelectRing(ctx, tf, c, BALL_R * k, look);
    return;
  }

  if (token.kind === 'cone') {
    const r = tf.px(CONE_R * k);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - r);
    ctx.lineTo(c.x + r * 0.88, c.y + r * 0.68);
    ctx.lineTo(c.x - r * 0.88, c.y + r * 0.68);
    ctx.closePath();
    ctx.fillStyle = th.cone;
    ctx.fill();
    if (selected) drawSelectRing(ctx, tf, c, CONE_R * k, look);
    return;
  }

  const r = tf.px(PLAYER_R * k);
  const isOffense = token.team !== 'defense';
  // 테두리는 말 크기를 따라간다. 말을 키웠는데 선만 가늘면 허전해 보인다.
  const ring = Math.max(1.4, tf.px(0.24 * k));

  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  if (isOffense && th.offenseStyle === 'fill') {
    ctx.fillStyle = th.offense;
    ctx.fill();
  } else {
    // 속을 채워야 코트 선이 말을 뚫고 보이지 않는다
    ctx.fillStyle = th.defenseFill;
    ctx.fill();
    ctx.lineWidth = ring;
    ctx.strokeStyle = isOffense ? th.offense : th.defense;
    ctx.stroke();
  }

  // 등번호
  ctx.fillStyle = isOffense
    ? th.offenseStyle === 'fill' ? th.offenseText : th.offense
    : th.defense;
  ctx.font = `650 ${Math.round(tf.px(2.05 * k))}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(token.label, c.x, c.y + tf.px(0.06 * k));

  if (selected) drawSelectRing(ctx, tf, c, PLAYER_R * k, look);
}

function drawSelectRing(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  c: Vec,
  rFeet: number,
  look: BoardLook,
): void {
  ctx.beginPath();
  ctx.arc(c.x, c.y, tf.px(rFeet) + Math.max(3, tf.px(0.45)), 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1.4, tf.px(0.18));
  ctx.strokeStyle = look.theme.select;
  ctx.setLineDash([tf.px(0.6), tf.px(0.45)]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawBall(ctx: CanvasRenderingContext2D, tf: Transform, c: Vec, look: BoardLook): void {
  const r = tf.px(BALL_R * look.tokenScale);
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = look.theme.ball;
  ctx.fill();
  // 코트 색 테두리 — 선수 위에 겹쳐도 공이 따로 보인다
  ctx.lineWidth = Math.max(1, tf.px(0.14));
  ctx.strokeStyle = look.theme.floor;
  ctx.stroke();
}

function trailColor(trail: Trail, look: BoardLook): string {
  const th = look.theme;
  if (trail.kind === 'pass' || trail.kind === 'shot') return th.pass;
  return trail.team === 'defense' ? th.defense : th.offense;
}

export function drawTrail(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  trail: Trail,
  play: Play,
  look: BoardLook,
): void {
  const token = play.tokens.find((t) => t.id === trail.tokenId);
  const r = token ? tokenRadius(token, look.tokenScale) : 1;
  const pts = trimPolyline(trail.points, r + 0.25, r + 0.35);
  if (pts.length < 2) return;

  const color = trailColor(trail, look);
  const lw = Math.max(1.8, tf.px(0.26));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;

  const shape: Vec[] = trail.kind === 'dribble' ? squiggle(pts, 0.55, 2.2) : pts;

  if (trail.kind === 'pass' || trail.kind === 'shot') {
    ctx.setLineDash([tf.px(1.1), tf.px(0.8)]);
  }

  ctx.beginPath();
  shape.forEach((p, i) => {
    const c = tf.toCanvas(p);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // 끝 화살표 (스크린도 이동 자체는 똑같이 그리고, 스크린 표시는 따로 찍는다)
  const end = pts[pts.length - 1];
  drawArrowHead(ctx, tf, end, endDirection(pts), color, lw);
}

function endDirection(pts: Vec[]): Vec {
  const { total } = polylineLengths(pts);
  if (total < 1e-6) return { x: 0, y: 1 };
  const back = pointAlong(pts, Math.max(0, 1 - 1.2 / total)).pos;
  return norm(sub(pts[pts.length - 1], back));
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  tip: Vec,
  dir: Vec,
  color: string,
  _lw: number,
): void {
  const size = 1.5;
  const n = perp(dir);
  const base: Vec = { x: tip.x - dir.x * size, y: tip.y - dir.y * size };
  const a: Vec = { x: base.x + n.x * size * 0.52, y: base.y + n.y * size * 0.52 };
  const b: Vec = { x: base.x - n.x * size * 0.52, y: base.y - n.y * size * 0.52 };

  const cTip = tf.toCanvas(tip);
  const cA = tf.toCanvas(a);
  const cB = tf.toCanvas(b);
  ctx.beginPath();
  ctx.moveTo(cTip.x, cTip.y);
  ctx.lineTo(cA.x, cA.y);
  ctx.lineTo(cB.x, cB.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** 스크린 막대 길이의 절반 (피트) */
export const SCREEN_HALF_LEN = 2.6;

/** 스크린 막대의 양 끝 좌표 */
export function screenEnds(pos: Vec, angle: number): [Vec, Vec] {
  const dx = Math.cos(angle) * SCREEN_HALF_LEN;
  const dy = Math.sin(angle) * SCREEN_HALF_LEN;
  return [
    { x: pos.x + dx, y: pos.y + dy },
    { x: pos.x - dx, y: pos.y - dy },
  ];
}

export type ScreenMarkMode = 'plain' | 'active' | 'trash';

/** 직접 놓는 스크린 마커 — 벽처럼 생긴 짧고 굵은 막대 */
export function drawScreenMark(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  mark: ScreenMark,
  mode: ScreenMarkMode,
  look: BoardLook,
): void {
  const [p1, p2] = screenEnds(mark.pos, mark.angle);
  const a = tf.toCanvas(p1);
  const b = tf.toCanvas(p2);
  const lw = Math.max(3.5, tf.px(0.6));
  const trash = mode === 'trash';

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, mark.opacity)) * (trash ? 0.55 : 1);
  ctx.lineCap = 'round';

  // 코트 색으로 한 겹 깔아서 선과 말 위에 올라가도 막대가 또렷하게 보이게 한다
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = look.theme.floor;
  ctx.lineWidth = lw + Math.max(2.5, tf.px(mode === 'active' ? 0.45 : 0.26));
  ctx.stroke();

  // 버려질 막대는 끊긴 빨간 선으로 바꿔서 손을 떼면 사라진다는 걸 보여준다
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  if (trash) ctx.setLineDash([Math.max(3, tf.px(0.5)), Math.max(3, tf.px(0.45))]);
  ctx.strokeStyle = trash ? look.theme.defense : look.theme.screen;
  ctx.lineWidth = lw;
  ctx.stroke();

  ctx.restore();
}

/** 캔버스 좌표에서 스크린 막대를 집는다 */
export function hitTestScreen(
  frame: Frame,
  tf: Transform,
  canvasPoint: Vec,
  extraPx = 10,
): string | null {
  let best: { id: string; d: number } | null = null;

  for (const mark of frame.screens) {
    const [p1, p2] = screenEnds(mark.pos, mark.angle);
    const a = tf.toCanvas(p1);
    const b = tf.toCanvas(p2);
    const d = distToSegment(canvasPoint, a, b);
    if (d <= tf.px(0.5) + extraPx && (!best || d < best.d)) best = { id: mark.id, d };
  }
  return best ? best.id : null;
}

/** 드리블 표기용 물결선 */
function squiggle(pts: Vec[], amp: number, wave: number): Vec[] {
  const { total } = polylineLengths(pts);
  if (total < wave * 0.9) return pts;

  const n = Math.max(12, Math.round((total / wave) * 10));
  const out: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const { pos, dir } = pointAlong(pts, t);
    const nrm = perp(dir);
    const taper = Math.min(1, Math.min(t, 1 - t) * 5);
    const s = Math.sin(((t * total) / wave) * Math.PI * 2) * amp * taper;
    out.push({ x: pos.x + nrm.x * s, y: pos.y + nrm.y * s });
  }
  return out;
}

/** 캔버스 좌표에서 가장 가까운 말 찾기 (터치용 넉넉한 반경) */
export function hitTest(
  play: Play,
  frame: Frame,
  tf: Transform,
  canvasPoint: Vec,
  extraPx = 8,
  tokenScale = 1,
): string | null {
  let best: { id: string; d: number } | null = null;

  const order = [...play.tokens].reverse(); // 공이 먼저 잡히도록
  for (const token of order) {
    const p = frame.positions[token.id];
    if (!p) continue;
    const c = tf.toCanvas(p);
    const d = Math.hypot(c.x - canvasPoint.x, c.y - canvasPoint.y);
    const r = tf.px(tokenRadius(token, tokenScale)) + extraPx;
    if (d <= r && (!best || d < best.d)) best = { id: token.id, d };
  }
  return best ? best.id : null;
}

export type { TrailKind };
