import { THEMES, TOKEN_SCALES } from '../lib/look';
import type { BoardTheme } from '../lib/look';

export interface SettingsPanelProps {
  themeId: string;
  tokenScale: number;
  onTheme(id: string): void;
  onTokenScale(scale: number): void;
  onClose(): void;
}

/** 테마를 고르는 작은 코트 조각 — 바닥, 선, 공격 말, 수비 말 */
function Swatch({ theme }: { theme: BoardTheme }) {
  const filled = theme.offenseStyle === 'fill';
  return (
    <span className="swatch" style={{ background: theme.floor }}>
      <span className="swatch-paint" style={{ background: theme.paint, borderColor: theme.line }} />
      <span
        className="swatch-dot"
        style={{
          background: filled ? theme.offense : theme.defenseFill,
          boxShadow: filled ? 'none' : `inset 0 0 0 2px ${theme.offense}`,
        }}
      />
      <span
        className="swatch-dot"
        style={{
          background: theme.defenseFill,
          boxShadow: `inset 0 0 0 2px ${theme.defense}`,
        }}
      />
    </span>
  );
}

export function SettingsPanel(props: SettingsPanelProps) {
  const { themeId, tokenScale, onTheme, onTokenScale, onClose } = props;

  return (
    <div className="sheet-backdrop quiet" onClick={onClose}>
      <aside className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>보기 설정</h2>
          <button className="icon-btn" onClick={onClose} title="닫기" aria-label="닫기">
            ⤫
          </button>
        </div>

        <div className="set-group">
          <span className="label">코트 디자인</span>
          <div className="theme-grid">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-card ${t.id === themeId ? 'on' : ''}`}
                onClick={() => onTheme(t.id)}
                aria-pressed={t.id === themeId}
              >
                <Swatch theme={t} />
                <span className="theme-name">{t.name}</span>
                <span className="theme-hint">{t.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="set-group">
          <span className="label">말 크기</span>
          <div className="seg">
            {TOKEN_SCALES.map((s) => (
              <button
                key={s.value}
                className={`seg-btn ${Math.abs(s.value - tokenScale) < 0.01 ? 'on' : ''}`}
                onClick={() => onTokenScale(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="hint-sm">
            코트 대비 말의 비율이에요. 선수가 많으면 작게, 멀리서 보여줄 땐 크게.
          </p>
        </div>

        <div className="spacer" />

        <p className="hint-sm">
          화면에 보이는 그대로 PNG와 영상에도 들어가요. 설정은 이 기기에만 저장돼요.
        </p>
      </aside>
    </div>
  );
}
