import type { MoveStyle, Token } from '../lib/types';

export interface InspectorProps {
  token: Token;
  /** 이번 장면에서 움직인 선수인가 — 그때만 이동/드리블을 고를 수 있다 */
  canStyle: boolean;
  moveStyle: MoveStyle;
  /** 간략 모드 — 글자 없이 아이콘만 */
  compact: boolean;
  /** 말을 가리지 않게 위나 아래 가장자리에 붙는다 */
  dock: 'top' | 'bottom';
  onMoveStyle(style: MoveStyle): void;
  onRemove(): void;
}

const STYLES: Array<{ v: MoveStyle; label: string; icon: string }> = [
  { v: 'cut', label: '이동', icon: '→' },
  { v: 'dribble', label: '드리블', icon: '≈' },
];

/** 말을 눌렀을 때 뜨는 작은 막대 — 이동 / 드리블 / 삭제, 이 셋뿐이다. */
export function Inspector(props: InspectorProps) {
  const { canStyle, moveStyle, compact, dock, onMoveStyle, onRemove } = props;

  return (
    <div className={`inspector dock-${dock} ${compact ? 'compact' : ''}`} role="toolbar" aria-label="말 편집">
      {canStyle && (
        <>
          {STYLES.map((s) => (
            <button
              key={s.v}
              className={`insp-btn ${moveStyle === s.v ? 'on' : ''}`}
              onClick={() => onMoveStyle(s.v)}
              title={s.label}
              aria-label={s.label}
              aria-pressed={moveStyle === s.v}
            >
              {compact ? s.icon : s.label}
            </button>
          ))}
          <span className="insp-sep" />
        </>
      )}
      <button className="insp-btn danger" onClick={onRemove} title="삭제" aria-label="삭제">
        {compact ? '✕' : '삭제'}
      </button>
    </div>
  );
}
