import type { Play } from '../lib/types';
import { rootLine } from '../lib/play';

export interface PlaybookPanelProps {
  plays: Play[];
  currentId: string;
  onOpen(id: string): void;
  onNew(): void;
  onDuplicate(id: string): void;
  onDelete(id: string): void;
  onExportAll(): void;
  onLoadSample(): void;
  onClose(): void;
}

function when(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return sameDay ? `오늘 ${hh}:${mm}` : `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

export function PlaybookPanel(props: PlaybookPanelProps) {
  const { plays, currentId, onOpen, onNew, onDuplicate, onDelete, onExportAll, onLoadSample, onClose } = props;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <aside className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>내 전술</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <button className="btn btn-primary btn-wide" onClick={onNew}>
          + 새 전술
        </button>

        <ul className="play-list">
          {plays.map((p) => (
            <li key={p.id} className={p.id === currentId ? 'on' : ''}>
              <button className="play-open" onClick={() => onOpen(p.id)}>
                <span className="play-name">{p.name}</span>
                <span className="play-meta">
                  {p.courtType === 'full' ? '풀코트' : '하프'} · {rootLine(p)?.steps.length ?? 0}장면
                  {p.lines.length > 1 && ` · 갈래 ${p.lines.length - 1}개`} · {when(p.updatedAt)}
                </span>
              </button>
              <div className="play-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => onDuplicate(p.id)} title="복제">
                  복제
                </button>
                <button
                  className="btn btn-ghost btn-sm danger"
                  onClick={() => onDelete(p.id)}
                  disabled={plays.length < 2}
                  title="삭제"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="sheet-foot">
          <button className="btn btn-ghost btn-wide" onClick={onLoadSample}>
            픽앤롤 샘플 전술 가져오기
          </button>
          <button className="btn btn-ghost btn-wide" onClick={onExportAll}>
            전체 백업 파일로 저장
          </button>
          <p className="hint-sm">전술은 이 브라우저에 자동 저장돼요. 기기를 옮길 땐 백업 파일을 쓰세요.</p>
        </div>
      </aside>
    </div>
  );
}
