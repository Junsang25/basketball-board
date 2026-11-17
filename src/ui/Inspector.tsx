import type { MoveStyle, Token } from '../lib/types';

export interface InspectorProps {
  token: Token;
  stepIndex: number;
  /** 이번 스텝에서 이 말이 움직였는가 */
  moved: boolean;
  moveStyle: MoveStyle;
  hasWaypoint: boolean;
  isBallHolder: boolean;
  onRelabel(label: string): void;
  onGiveBall(): void;
  onDropBall(): void;
  onMoveStyle(style: MoveStyle): void;
  onClearWaypoint(): void;
  onRemove(): void;
  onClose(): void;
}

const STYLE_LABELS: Array<{ v: MoveStyle; label: string; hint: string }> = [
  { v: 'cut', label: '이동', hint: '실선 화살표' },
  { v: 'dribble', label: '드리블', hint: '물결선' },
];

export function Inspector(props: InspectorProps) {
  const {
    token, stepIndex, moved, moveStyle, hasWaypoint, isBallHolder,
    onRelabel, onGiveBall, onDropBall, onMoveStyle, onClearWaypoint, onRemove, onClose,
  } = props;

  const isPlayer = token.kind === 'player';
  const teamName = token.kind === 'ball' ? '공' : token.kind === 'cone' ? '콘' : token.team === 'defense' ? '수비' : '공격';

  return (
    <div className="inspector">
      <div className="inspector-head">
        <span className={`badge ${token.team === 'defense' ? 'badge-defense' : token.kind === 'player' ? 'badge-offense' : 'badge-neutral'}`}>
          {teamName}
        </span>
        {isPlayer && (
          <input
            className="label-input"
            value={token.label}
            onChange={(e) => onRelabel(e.target.value.slice(0, 2))}
            aria-label="등번호"
          />
        )}
        <div className="spacer" />
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} title="닫기">
          ✕
        </button>
      </div>

      {isPlayer && (
        <div className="inspector-row">
          {isBallHolder ? (
            <button className="btn btn-ghost btn-sm" onClick={onDropBall}>
              공 놓기
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={onGiveBall}>
              공 주기
            </button>
          )}
          <span className="hint-sm">
            {isBallHolder ? '이 장면에서 이 선수가 공을 가집니다' : '패스는 공 주인을 바꾸면 자동으로 그려져요'}
          </span>
        </div>
      )}

      {stepIndex > 0 && isPlayer && moved && (
        <div className="inspector-row column">
          <span className="label">움직임 표기</span>
          <div className="seg seg-sm">
            {STYLE_LABELS.map((s) => (
              <button
                key={s.v}
                className={`seg-btn ${moveStyle === s.v ? 'on' : ''}`}
                onClick={() => onMoveStyle(s.v)}
                title={s.hint}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="hint-sm">
            {hasWaypoint
              ? '선 위의 점을 끌면 곡선이 바뀝니다'
              : '선 가운데 점을 끌면 곡선으로 휘어요'}
          </span>
          {hasWaypoint && (
            <button className="btn btn-ghost btn-sm" onClick={onClearWaypoint}>
              직선으로
            </button>
          )}
        </div>
      )}

      {token.kind !== 'ball' && (
        <div className="inspector-row">
          <button className="btn btn-danger btn-sm" onClick={onRemove}>
            이 말 삭제
          </button>
        </div>
      )}
    </div>
  );
}
