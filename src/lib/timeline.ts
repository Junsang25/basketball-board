import type { Step } from './types';

export interface Segment {
  stepIndex: number;
  /** 'move' = 이전 스텝에서 이 스텝으로 이동 중, 'hold' = 이 장면에서 멈춤 */
  kind: 'move' | 'hold';
  start: number;
  duration: number;
}

export interface Timeline {
  segments: Segment[];
  total: number;
}

export interface TimelineOptions {
  /** 각 장면에 도착한 뒤 멈춰 있는 시간 (설명을 읽을 시간) */
  holdMs?: number;
  /** 시작 배치를 보여주는 시간 */
  startHoldMs?: number;
  /** 마지막 장면을 더 보여주는 시간 */
  endHoldMs?: number;
  /** 재생 속도 배수 */
  speed?: number;
}

export function buildTimeline(steps: Step[], opts: TimelineOptions = {}): Timeline {
  const holdMs = opts.holdMs ?? 0;
  const startHoldMs = opts.startHoldMs ?? 0;
  const endHoldMs = opts.endHoldMs ?? 0;
  const speed = opts.speed && opts.speed > 0 ? opts.speed : 1;

  const segments: Segment[] = [];
  let at = 0;

  if (startHoldMs > 0) {
    segments.push({ stepIndex: 0, kind: 'hold', start: 0, duration: startHoldMs / speed });
    at += startHoldMs / speed;
  }

  for (let i = 1; i < steps.length; i++) {
    const move = Math.max(1, steps[i].duration) / speed;
    segments.push({ stepIndex: i, kind: 'move', start: at, duration: move });
    at += move;

    const isLast = i === steps.length - 1;
    const hold = (isLast ? holdMs + endHoldMs : holdMs) / speed;
    if (hold > 0) {
      segments.push({ stepIndex: i, kind: 'hold', start: at, duration: hold });
      at += hold;
    }
  }

  // 스텝이 하나뿐이면 시작 배치만 보여준다
  if (segments.length === 0) {
    segments.push({ stepIndex: 0, kind: 'hold', start: 0, duration: Math.max(1, startHoldMs + endHoldMs) });
    at = segments[0].duration;
  }

  return { segments, total: at };
}

export function sampleTimeline(tl: Timeline, elapsed: number): { stepIndex: number; t: number } {
  if (tl.segments.length === 0) return { stepIndex: 0, t: 1 };

  const e = Math.max(0, Math.min(elapsed, tl.total));
  for (const seg of tl.segments) {
    if (e < seg.start + seg.duration) {
      if (seg.kind === 'hold') return { stepIndex: seg.stepIndex, t: 1 };
      return { stepIndex: seg.stepIndex, t: (e - seg.start) / seg.duration };
    }
  }
  const last = tl.segments[tl.segments.length - 1];
  return { stepIndex: last.stepIndex, t: 1 };
}

/** 해당 스텝의 움직임이 시작되는 시각 */
export function stepStart(tl: Timeline, stepIndex: number): number {
  const seg = tl.segments.find((s) => s.stepIndex === stepIndex && s.kind === 'move');
  if (seg) return seg.start;
  const hold = tl.segments.find((s) => s.stepIndex === stepIndex);
  return hold ? hold.start : 0;
}
