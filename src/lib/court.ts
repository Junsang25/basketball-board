import type { CourtType, Vec } from './types';
import type { BoardTheme } from './look';
import { THEMES } from './look';

/** NBA 규격 (피트) */
export const COURT = {
  width: 50,
  fullLength: 94,
  halfLength: 47,

  hoopFromBaseline: 5.25,
  rimRadius: 0.75,
  backboardFromBaseline: 4,
  backboardWidth: 6,

  paintWidth: 16,
  paintLength: 19,
  ftCircleRadius: 6,

  threeRadius: 23.75,
  threeSideX: 22,
  restrictedRadius: 4,

  centerCircleRadius: 6,
  innerCircleRadius: 2,
} as const;

export function courtLength(type: CourtType): number {
  return type === 'full' ? COURT.fullLength : COURT.halfLength;
}

/** 코트 좌표(피트) <-> 캔버스 좌표(px) 변환 */
export interface Transform {
  scale: number;
  rotated: boolean;
  toCanvas(p: Vec): Vec;
  toCourt(p: Vec): Vec;
  /** 피트 단위 길이를 px로 */
  px(feet: number): number;
}

export function makeTransform(
  canvasW: number,
  canvasH: number,
  courtType: CourtType,
  rotated: boolean,
  pad = 16,
): Transform {
  const L = courtLength(courtType);
  const spanX = rotated ? L : COURT.width;
  const spanY = rotated ? COURT.width : L;

  const scale = Math.max(
    0.0001,
    Math.min((canvasW - pad * 2) / spanX, (canvasH - pad * 2) / spanY),
  );
  const ox = (canvasW - spanX * scale) / 2;
  const oy = (canvasH - spanY * scale) / 2;
  const half = COURT.width / 2;

  if (rotated) {
    return {
      scale,
      rotated,
      px: (feet) => feet * scale,
      toCanvas: (p) => ({ x: ox + p.y * scale, y: oy + (p.x + half) * scale }),
      toCourt: (p) => ({ x: (p.y - oy) / scale - half, y: (p.x - ox) / scale }),
    };
  }
  return {
    scale,
    rotated,
    px: (feet) => feet * scale,
    toCanvas: (p) => ({ x: ox + (p.x + half) * scale, y: oy + p.y * scale }),
    toCourt: (p) => ({ x: (p.x - ox) / scale - half, y: (p.y - oy) / scale }),
  };
}

/** 코트 밖으로 나가지 않게 위치 보정 */
export function clampToCourt(p: Vec, courtType: CourtType, margin = 0.8): Vec {
  const L = courtLength(courtType);
  const half = COURT.width / 2;
  return {
    x: Math.min(half - margin, Math.max(-half + margin, p.x)),
    y: Math.min(L - margin, Math.max(margin, p.y)),
  };
}

/** 림 중심 좌표 */
export function hoopPos(courtType: CourtType, far = false): Vec {
  const L = courtLength(courtType);
  return { x: 0, y: far ? L - COURT.hoopFromBaseline : COURT.hoopFromBaseline };
}

/** 선 두께는 테마가 정한다. 너무 얇아져서 사라지지 않게 하한을 둔다. */
function lineWidth(tf: Transform, theme: BoardTheme, mul = 1): number {
  return Math.max(1, tf.px(theme.lineFeet * mul));
}

export function drawCourt(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  courtType: CourtType,
  theme: BoardTheme = THEMES[0],
): void {
  const L = courtLength(courtType);
  const half = COURT.width / 2;
  const lw = lineWidth(tf, theme);

  const C = (x: number, y: number) => tf.toCanvas({ x, y });

  // 바닥
  const a = C(-half, 0);
  const b = C(half, L);
  ctx.fillStyle = theme.floor;
  ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));

  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';

  drawHalf(ctx, tf, courtType, theme, false);
  if (courtType === 'full') drawHalf(ctx, tf, courtType, theme, true);

  // 센터 서클 / 하프라인
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = lw;
  if (courtType === 'full') {
    const m1 = C(-half, L / 2);
    const m2 = C(half, L / 2);
    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.lineTo(m2.x, m2.y);
    ctx.stroke();

    strokeCircle(ctx, tf, { x: 0, y: L / 2 }, COURT.centerCircleRadius, theme.line, lw);
    strokeCircle(ctx, tf, { x: 0, y: L / 2 }, COURT.innerCircleRadius, theme.lineSoft, lw);
  } else {
    // 하프코트에서는 센터 서클의 절반만 보인다
    strokeArc(ctx, tf, { x: 0, y: L }, COURT.centerCircleRadius, Math.PI, Math.PI * 2, theme.line, lw);
  }

  // 외곽선
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = lineWidth(tf, theme, 1.5);
  const o1 = C(-half, 0);
  const o2 = C(half, 0);
  const o3 = C(half, L);
  const o4 = C(-half, L);
  ctx.beginPath();
  ctx.moveTo(o1.x, o1.y);
  ctx.lineTo(o2.x, o2.y);
  ctx.lineTo(o3.x, o3.y);
  ctx.lineTo(o4.x, o4.y);
  ctx.closePath();
  ctx.stroke();
}

function drawHalf(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  courtType: CourtType,
  theme: BoardTheme,
  far: boolean,
): void {
  const L = courtLength(courtType);
  const lw = lineWidth(tf, theme);
  /** 베이스라인에서의 거리 d -> 코트 y */
  const Y = (d: number) => (far ? L - d : d);
  const C = (x: number, d: number) => tf.toCanvas({ x, y: Y(d) });
  const paintHalf = COURT.paintWidth / 2;

  // 페인트 존
  const p1 = C(-paintHalf, 0);
  const p2 = C(paintHalf, 0);
  const p3 = C(paintHalf, COURT.paintLength);
  const p4 = C(-paintHalf, COURT.paintLength);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.fillStyle = theme.paint;
  ctx.fill();
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = lw;
  ctx.stroke();

  // 자유투 서클: 바스켓 반대쪽(코트 중앙 쪽) 절반이 실선, 페인트 안쪽 절반이 점선
  const ftCenter: Vec = { x: 0, y: Y(COURT.paintLength) };
  // 베이스라인에서 멀어지는 방향의 각도 범위
  const outward: [number, number] = far ? [Math.PI, Math.PI * 2] : [0, Math.PI];
  const inward: [number, number] = far ? [0, Math.PI] : [Math.PI, Math.PI * 2];

  strokeArc(ctx, tf, ftCenter, COURT.ftCircleRadius, outward[0], outward[1], theme.line, lw);
  ctx.save();
  ctx.setLineDash([tf.px(0.9), tf.px(0.7)]);
  strokeArc(ctx, tf, ftCenter, COURT.ftCircleRadius, inward[0], inward[1], theme.lineSoft, lw);
  ctx.restore();

  // 3점 라인
  const hoop: Vec = { x: 0, y: Y(COURT.hoopFromBaseline) };
  const cornerD = COURT.hoopFromBaseline + Math.sqrt(
    COURT.threeRadius * COURT.threeRadius - COURT.threeSideX * COURT.threeSideX,
  );
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = lw;
  for (const sx of [-COURT.threeSideX, COURT.threeSideX]) {
    const s1 = C(sx, 0);
    const s2 = C(sx, cornerD);
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.stroke();
  }
  // 코트 중앙 쪽으로 볼록한 호가 되도록 각도 순서를 잡는다
  const leftAng = Math.atan2(Y(cornerD) - hoop.y, -COURT.threeSideX - hoop.x);
  const rightAng = Math.atan2(Y(cornerD) - hoop.y, COURT.threeSideX - hoop.x);
  if (far) strokeArc(ctx, tf, hoop, COURT.threeRadius, leftAng, rightAng, theme.line, lw);
  else strokeArc(ctx, tf, hoop, COURT.threeRadius, rightAng, leftAng, theme.line, lw);

  // 제한구역 아크
  strokeArc(
    ctx, tf, hoop, COURT.restrictedRadius,
    outward[0], outward[1],
    theme.lineSoft, lw,
  );

  // 백보드
  ctx.strokeStyle = theme.line;
  ctx.lineWidth = lineWidth(tf, theme, 1.9);
  const bb1 = C(-COURT.backboardWidth / 2, COURT.backboardFromBaseline);
  const bb2 = C(COURT.backboardWidth / 2, COURT.backboardFromBaseline);
  ctx.beginPath();
  ctx.moveTo(bb1.x, bb1.y);
  ctx.lineTo(bb2.x, bb2.y);
  ctx.stroke();

  // 림
  strokeCircle(ctx, tf, hoop, COURT.rimRadius, theme.rim, lineWidth(tf, theme, 1.3));
}

function strokeCircle(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  center: Vec,
  radiusFeet: number,
  stroke: string,
  lineWidth: number,
): void {
  const c = tf.toCanvas(center);
  ctx.beginPath();
  ctx.arc(c.x, c.y, tf.px(radiusFeet), 0, Math.PI * 2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * 코트 좌표계에서 정의된 각도 범위의 호.
 * 변환이 회전을 포함할 수 있어 직접 샘플링해 그린다.
 */
function strokeArc(
  ctx: CanvasRenderingContext2D,
  tf: Transform,
  center: Vec,
  radiusFeet: number,
  startAng: number,
  endAng: number,
  stroke: string,
  lineWidth: number,
): void {
  let a0 = startAng;
  let a1 = endAng;
  if (a1 < a0) a1 += Math.PI * 2;

  const steps = Math.max(24, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 200));
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const ang = a0 + ((a1 - a0) * i) / steps;
    const p = tf.toCanvas({
      x: center.x + Math.cos(ang) * radiusFeet,
      y: center.y + Math.sin(ang) * radiusFeet,
    });
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/** 코트 밖으로 slack 피트 이상 벗어났는지 (막대를 끌어서 버릴 때 쓴다) */
export function outsideCourt(p: Vec, courtType: CourtType, slack = 2.5): boolean {
  const L = courtLength(courtType);
  const half = COURT.width / 2;
  return p.x < -half - slack || p.x > half + slack || p.y < -slack || p.y > L + slack;
}
