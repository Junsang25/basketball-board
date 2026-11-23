import type { ReactNode } from 'react';

export interface PanelProps {
  /** 어느 레일인지 (panel-tools, panel-scenes) */
  id: string;
  title: string;
  /** 접힌 상태에서 띠에 보일 글자 */
  icon: string;
  /** 세로로 선 레일인지 가로로 누운 레일인지 */
  shape: 'vert' | 'horz';
  open: boolean;
  onToggle(): void;
  children: ReactNode;
}

/**
 * 화면 가장자리에 붙는 레일.
 *
 * 코트는 레일을 뺀 자리에만 그려지기 때문에 둘이 겹칠 일이 없다.
 * 접으면 얇은 띠만 남고, 그만큼 코트가 쓸 자리가 넓어진다.
 */
export function Panel({ id, title, icon, shape, open, onToggle, children }: PanelProps) {
  if (!open) {
    return (
      <button
        className={`rail rail-shut rail-${id} shape-${shape}`}
        onClick={onToggle}
        title={`${title} 펼치기`}
        aria-label={`${title} 펼치기`}
      >
        {icon}
      </button>
    );
  }

  return (
    <section className={`rail rail-${id} shape-${shape}`}>
      <header className="rail-head">
        <span className="rail-title">{title}</span>
        <button
          className="icon-btn"
          onClick={onToggle}
          title={`${title} 접기`}
          aria-label={`${title} 접기`}
        >
          ⤫
        </button>
      </header>
      <div className="rail-body">{children}</div>
    </section>
  );
}
