import type { Vec } from './types';

export const v = (x: number, y: number): Vec => ({ x, y });

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);

export function norm(a: Vec): Vec {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

export function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** 시계방향 90도 회전 (법선 구할 때 사용) */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });

export function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** 부드러운 가감속 */
export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * 경유점들을 지나는 Catmull-Rom 곡선을 촘촘한 폴리라인으로 변환.
 * 점이 2개면 직선 그대로 돌려준다.
 */
export function smoothPolyline(points: Vec[], segmentsPer = 16): Vec[] {
  if (points.length < 3) return points.slice();

  // 양 끝을 복제해 곡선이 처음/끝 점을 확실히 지나게 한다
  const pts = [points[0], ...points, points[points.length - 1]];
  const out: Vec[] = [points[0]];

  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2];
    for (let s = 1; s <= segmentsPer; s++) {
      const t = s / segmentsPer;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
}

/** 폴리라인의 누적 길이 */
export function polylineLengths(pts: Vec[]): { total: number; cum: number[] } {
  const cum = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += dist(pts[i - 1], pts[i]);
    cum.push(total);
  }
  return { total, cum };
}

/** 폴리라인에서 길이 비율 t(0~1) 지점의 좌표와 진행 방향 */
export function pointAlong(pts: Vec[], t: number): { pos: Vec; dir: Vec } {
  if (pts.length === 0) return { pos: v(0, 0), dir: v(0, 1) };
  if (pts.length === 1) return { pos: pts[0], dir: v(0, 1) };

  const { total, cum } = polylineLengths(pts);
  if (total < 1e-9) return { pos: pts[0], dir: norm(sub(pts[pts.length - 1], pts[0])) };

  const target = clamp(t, 0, 1) * total;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < target) i++;

  const segLen = cum[i] - cum[i - 1];
  const local = segLen < 1e-9 ? 0 : (target - cum[i - 1]) / segLen;
  return {
    pos: lerp(pts[i - 1], pts[i], local),
    dir: norm(sub(pts[i], pts[i - 1])),
  };
}

/** 폴리라인을 앞에서 startTrim, 뒤에서 endTrim 만큼 잘라낸다 (말 아이콘에 선이 겹치지 않게) */
export function trimPolyline(pts: Vec[], startTrim: number, endTrim: number): Vec[] {
  const { total } = polylineLengths(pts);
  if (total <= startTrim + endTrim + 1e-6) return [];
  const a = startTrim / total;
  const b = 1 - endTrim / total;

  const out: Vec[] = [pointAlong(pts, a).pos];
  const { cum } = polylineLengths(pts);
  for (let i = 0; i < pts.length; i++) {
    const r = cum[i] / total;
    if (r > a && r < b) out.push(pts[i]);
  }
  out.push(pointAlong(pts, b).pos);
  return out;
}

/** 점 p 에서 선분 ab 까지의 거리 */
export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y;
  if (l2 < 1e-9) return dist(p, a);
  const t = clamp(((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2, 0, 1);
  return dist(p, add(a, scale(ab, t)));
}
