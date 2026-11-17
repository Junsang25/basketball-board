import type { CourtType, Play, Step } from './types';
import { COURT, courtLength, makeTransform } from './court';
import type { Transform } from './court';
import { frameAt } from './frame';
import { orderedLines, resolveSteps } from './play';
import { drawScene } from './render';
import { downloadBlob, safeFileName } from './storage';

export interface ExportLayout {
  width: number;
  height: number;
  captionH: number;
  tf: Transform;
}

const even = (n: number) => (n % 2 === 0 ? n : n + 1);

export function exportLayout(
  courtType: CourtType,
  rotated: boolean,
  courtPx: number,
  withCaption: boolean,
): ExportLayout {
  const L = courtLength(courtType);
  const spanX = rotated ? L : COURT.width;
  const spanY = rotated ? COURT.width : L;

  const scale = courtPx / spanX;
  const pad = Math.round(scale * 1.2);
  const width = even(Math.round(spanX * scale + pad * 2));
  const courtH = Math.round(spanY * scale + pad * 2);
  const captionH = withCaption ? even(Math.round(scale * 5.5)) : 0;
  const height = even(courtH + captionH);

  return {
    width,
    height,
    captionH,
    tf: makeTransform(width, height - captionH, courtType, rotated, pad),
  };
}

/** 코트가 가로로 누웠을 때가 더 보기 좋은지 */
export function preferRotated(courtType: CourtType, viewportW: number, viewportH: number): boolean {
  if (courtType === 'half') return false;
  return viewportW / Math.max(1, viewportH) > 1.1;
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  layout: ExportLayout,
  steps: Step[],
  stepIndex: number,
  fallback: string,
  lineName: string | null,
): void {
  if (layout.captionH === 0) return;

  const { width, height, captionH } = layout;
  const top = height - captionH;

  ctx.fillStyle = '#15181c';
  ctx.fillRect(0, top, width, captionH);

  const note = steps[stepIndex]?.note?.trim() ?? '';
  const pad = Math.round(captionH * 0.26);
  const badgeR = Math.round(captionH * 0.26);
  const cy = top + captionH / 2;

  // 장면 번호 배지
  ctx.beginPath();
  ctx.arc(pad + badgeR, cy, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = '#e0701d';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(badgeR * 1.15)}px ui-sans-serif, system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(stepIndex + 1), pad + badgeR, cy + 1);

  let textX = pad + badgeR * 2 + pad * 0.8;
  const fontSize = Math.round(captionH * 0.3);

  // 갈래 이름 (본선이 아닐 때만)
  if (lineName) {
    ctx.font = `600 ${Math.round(fontSize * 0.86)}px ui-sans-serif, system-ui, "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    const tagW = ctx.measureText(lineName).width + pad * 0.9;
    const tagH = Math.round(captionH * 0.42);
    roundRect(ctx, textX, cy - tagH / 2, tagW, tagH, tagH / 2);
    ctx.fillStyle = '#31527d';
    ctx.fill();
    ctx.fillStyle = '#cfe0f7';
    ctx.fillText(lineName, textX + pad * 0.45, cy + 1);
    textX += tagW + pad * 0.6;
  }

  const maxW = width - textX - pad;
  ctx.font = `500 ${fontSize}px ui-sans-serif, system-ui, "Segoe UI", sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = note ? '#f3f4f6' : '#6b7280';

  const lines = wrapText(ctx, note || fallback, maxW, 2);
  const lineH = fontSize * 1.35;
  const startY = cy - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => ctx.fillText(line, textX, startY + i * lineH));
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  if (!text) return [''];
  const lines: string[] = [];
  let current = '';

  for (const ch of text) {
    if (ch === '\n') {
      lines.push(current);
      current = '';
      if (lines.length >= maxLines) return lines;
      continue;
    }
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = ch;
      if (lines.length >= maxLines) {
        let last = lines[maxLines - 1];
        while (ctx.measureText(last + '…').width > maxWidth && last.length > 1) {
          last = last.slice(0, -1);
        }
        lines[maxLines - 1] = last + '…';
        return lines;
      }
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

interface RenderArgs {
  play: Play;
  steps: Step[];
  stepIndex: number;
  t: number;
  withCaption: boolean;
  lineName: string | null;
}

function renderTo(ctx: CanvasRenderingContext2D, layout: ExportLayout, args: RenderArgs): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, layout.width, layout.height);
  const frame = frameAt(args.play, args.steps, args.stepIndex, args.t, true);
  drawScene(ctx, layout.tf, args.play, frame, { ghosts: args.t >= 0.999 });
  if (args.withCaption) {
    drawCaption(ctx, layout, args.steps, args.stepIndex, args.play.name, args.lineName);
  }
}

/** 분기 갈래가 시작될 때 보여주는 안내 화면 */
function renderTitleCard(
  ctx: CanvasRenderingContext2D,
  layout: ExportLayout,
  title: string,
  subtitle: string,
): void {
  const { width, height } = layout;
  ctx.fillStyle = '#15181c';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const size = Math.round(Math.min(width, height) * 0.075);
  ctx.fillStyle = '#e0701d';
  ctx.font = `600 ${Math.round(size * 0.52)}px ui-sans-serif, system-ui, "Segoe UI", sans-serif`;
  ctx.fillText(subtitle, width / 2, height / 2 - size * 0.8);

  ctx.fillStyle = '#f3f4f6';
  ctx.font = `700 ${size}px ui-sans-serif, system-ui, "Segoe UI", sans-serif`;
  ctx.fillText(title, width / 2, height / 2 + size * 0.2);
}

/** 현재 장면을 PNG로 저장 */
export async function exportPNG(
  play: Play,
  steps: Step[],
  stepIndex: number,
  rotated: boolean,
  lineName: string | null,
  withCaption = true,
): Promise<void> {
  const layout = exportLayout(play.courtType, rotated, 1400, withCaption);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없어요.');

  renderTo(ctx, layout, { play, steps, stepIndex, t: 1, withCaption, lineName });

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('이미지를 만들지 못했어요.');
  downloadBlob(blob, `${safeFileName(play.name)}_${stepIndex + 1}.png`);
}

// ---------------------------------------------------------------- 영상

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

export function pickVideoMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

export function canExportVideo(): boolean {
  return pickVideoMime() !== null && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

interface Section {
  name: string;
  steps: Step[];
  /** 이 구간에서 처음 보여줄 장면 (분기 갈래는 분기점부터) */
  startIndex: number;
  isRoot: boolean;
  branchScene: number;
}

/** 본선과 모든 갈래를 영상 구간으로 늘어놓는다 */
export function buildSections(play: Play): Section[] {
  const out: Section[] = [];
  for (const { line } of orderedLines(play)) {
    const steps = resolveSteps(play, line.id);
    if (steps.length === 0) continue;
    const isRoot = line.parentId === null;
    out.push({
      name: line.name,
      steps,
      startIndex: isRoot ? 0 : Math.max(0, Math.min(line.fromIndex, steps.length - 1)),
      isRoot,
      branchScene: line.fromIndex + 1,
    });
  }
  return out;
}

type Cue =
  | { kind: 'title'; section: number; start: number; duration: number }
  | { kind: 'hold' | 'move'; section: number; stepIndex: number; start: number; duration: number };

function buildCues(
  sections: Section[],
  holdMs: number,
): { cues: Cue[]; total: number } {
  const TITLE_MS = 1500;
  const START_HOLD = 900;
  const END_HOLD = 1200;

  const cues: Cue[] = [];
  let at = 0;

  sections.forEach((sec, si) => {
    if (!sec.isRoot) {
      cues.push({ kind: 'title', section: si, start: at, duration: TITLE_MS });
      at += TITLE_MS;
    }

    cues.push({ kind: 'hold', section: si, stepIndex: sec.startIndex, start: at, duration: START_HOLD });
    at += START_HOLD;

    const last = sec.steps.length - 1;
    for (let i = sec.startIndex + 1; i <= last; i++) {
      const move = Math.max(1, sec.steps[i].duration);
      cues.push({ kind: 'move', section: si, stepIndex: i, start: at, duration: move });
      at += move;

      const hold = i === last ? holdMs + END_HOLD : holdMs;
      cues.push({ kind: 'hold', section: si, stepIndex: i, start: at, duration: hold });
      at += hold;
    }

    // 분기점 이후에 장면이 없는 갈래
    if (sec.startIndex >= last) {
      cues.push({ kind: 'hold', section: si, stepIndex: sec.startIndex, start: at, duration: END_HOLD });
      at += END_HOLD;
    }
  });

  return { cues, total: Math.max(1, at) };
}

function cueAt(cues: Cue[], elapsed: number): Cue {
  for (const c of cues) {
    if (elapsed < c.start + c.duration) return c;
  }
  return cues[cues.length - 1];
}

export interface VideoExportOptions {
  rotated: boolean;
  withCaption?: boolean;
  /** 각 장면에서 멈추는 시간 */
  holdMs?: number;
  onProgress?: (ratio: number) => void;
}

/**
 * 전체 움직임을 영상으로 저장한다.
 * 갈래가 있으면 본선을 끝까지 보여준 뒤, 갈래마다 안내 화면과 함께
 * 분기점으로 되감아 이어 붙인다. (MP4 지원 시 MP4, 아니면 WebM)
 */
export async function exportVideo(play: Play, opts: VideoExportOptions): Promise<void> {
  const mime = pickVideoMime();
  if (!mime) throw new Error('이 브라우저는 영상 저장을 지원하지 않아요. Chrome이나 Edge에서 시도해 주세요.');

  const withCaption = opts.withCaption ?? true;
  const layout = exportLayout(play.courtType, opts.rotated, 1080, withCaption);

  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없어요.');

  const sections = buildSections(play);
  if (sections.length === 0) throw new Error('내보낼 장면이 없어요.');
  const { cues, total } = buildCues(sections, opts.holdMs ?? 900);

  const draw = (cue: Cue, localT: number) => {
    const sec = sections[cue.section];
    if (cue.kind === 'title') {
      renderTitleCard(ctx, layout, sec.name, `${sec.branchScene}번 장면에서 분기`);
      return;
    }
    renderTo(ctx, layout, {
      play,
      steps: sec.steps,
      stepIndex: cue.stepIndex,
      t: cue.kind === 'hold' ? 1 : localT,
      withCaption,
      lineName: sec.isRoot ? null : sec.name,
    });
  };

  // 첫 프레임을 미리 그려둔다
  draw(cues[0], 0);

  const fps = 30;
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(100);
  const startedAt = performance.now();

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const cue = cueAt(cues, elapsed);
      draw(cue, Math.min(1, Math.max(0, (elapsed - cue.start) / cue.duration)));
      opts.onProgress?.(Math.min(1, elapsed / total));

      if (elapsed >= total) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // 마지막 프레임이 확실히 기록되도록 잠깐 둔다
  await new Promise((r) => setTimeout(r, 250));
  recorder.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  await stopped;

  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  downloadBlob(new Blob(chunks, { type: mime }), `${safeFileName(play.name)}.${ext}`);
  opts.onProgress?.(1);
}
