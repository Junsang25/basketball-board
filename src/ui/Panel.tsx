import { useCallback, useEffect, useRef, type PointerEvent as RPointerEvent, type ReactNode } from 'react';

export interface PanelPos {
  x: number;
  y: number;
}

export interface PanelProps {
  /** 기본 자리를 CSS에서 잡는 데 쓴다 (panel-tools, panel-scenes) */
  id: string;
  /** 닫기 버튼 설명에 쓰는 이름 */
  title: string;
  /** 머리말에 title 대신 넣을 것 (예: 전술 이름 입력칸) */
  titleNode?: ReactNode;
  /** 옮긴 적이 없으면 null — 기본 자리에 둔다 */
  pos: PanelPos | null;
  onMove(pos: PanelPos): void;
  onClose(): void;
  children: ReactNode;
}

/** 화면 가장자리에서 이만큼은 남긴다 */
const EDGE = 8;

/**
 * 코트 위에 떠 있는 판. 머리말을 잡고 끌면 움직이고, ✕로 닫는다.
 *
 * 위치는 옮기기 전까지 null이다. 그동안은 CSS가 기본 자리를 잡고,
 * 한 번 끌고 나면 그때부터 좌표로 붙박인다. 판 크기를 재지 않아도 되니까.
 */
export function Panel({ id, title, titleNode, pos, onMove, onClose, children }: PanelProps) {
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ dx: number; dy: number; w: number; h: number } | null>(null);

  const clamp = useCallback((x: number, y: number, w: number, h: number): PanelPos => ({
    x: Math.max(EDGE, Math.min(Math.max(EDGE, window.innerWidth - w - EDGE), x)),
    y: Math.max(EDGE, Math.min(Math.max(EDGE, window.innerHeight - h - EDGE), y)),
  }), []);

  const onPointerDown = useCallback((e: RPointerEvent<HTMLElement>) => {
    // 머리말 안의 버튼·입력칸을 누른 거면 끌지 않는다
    if ((e.target as HTMLElement).closest('button, input, textarea')) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback(
    (e: RPointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d) return;
      onMove(clamp(e.clientX - d.dx, e.clientY - d.dy, d.w, d.h));
    },
    [clamp, onMove],
  );

  const end = useCallback(() => {
    drag.current = null;
  }, []);

  // 창이 작아져서 판이 화면 밖으로 나가면 도로 끌어들인다
  useEffect(() => {
    if (!pos) return;
    const onResize = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const next = clamp(pos.x, pos.y, r.width, r.height);
      if (next.x !== pos.x || next.y !== pos.y) onMove(next);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pos, clamp, onMove]);

  return (
    <section
      ref={ref}
      className={`panel panel-${id} ${pos ? 'moved' : ''}`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
    >
      <header
        className="panel-head"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <span className="panel-grip" aria-hidden="true" />
        {titleNode ?? <span className="panel-title">{title}</span>}
        <button className="icon-btn" onClick={onClose} title={`${title} 닫기`} aria-label={`${title} 닫기`}>
          ✕
        </button>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
